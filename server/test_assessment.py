import tempfile
import io
import json
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient
from imageio_ffmpeg import get_ffmpeg_exe

from server.app import app
from server.assessment import ask_model, extract_frames, normalize_result


LISTING = {"title": "Oak door", "type": "doors", "material": "oak", "model": ""}
FRAMES = [{"index": n, "timeSeconds": (n - 1) * 5} for n in range(1, 4)]


def model_output(category="match", appearance="match", material="match", quality="adequate", condition="no_visible_issue"):
    return {
        "checks": [
            {"field": field, "status": status, "observation": f"Observed {field}", "frame": 1}
            for field, status in (("category", category), ("appearance", appearance), ("material", material))
        ],
        "condition": {"status": condition, "observation": "Visible surface checked", "frame": 2},
        "videoQuality": {"status": quality, "reason": "Frames reviewed"},
    }


class AssessmentTests(unittest.TestCase):
    def test_match_score_is_rule_based_and_condition_is_separate(self):
        result = normalize_result(model_output(condition="visible_issue"), LISTING, FRAMES)
        self.assertEqual(result["matchStatus"], "consistent")
        self.assertEqual(result["matchScore"], 100)
        self.assertEqual(result["condition"]["status"], "visible_issue")
        self.assertEqual(result["condition"]["timeSeconds"], 5)

    def test_mismatch_is_reported_even_if_score_is_withheld(self):
        result = normalize_result(
            model_output(category="mismatch", appearance="unclear", material="unclear"), LISTING, FRAMES
        )
        self.assertEqual(result["matchStatus"], "mismatch")
        self.assertIsNone(result["matchScore"])

    def test_bad_video_abstains_and_invalid_frame_is_discarded(self):
        raw = model_output(quality="inadequate", condition="visible_issue")
        raw["condition"]["frame"] = 99
        result = normalize_result(raw, LISTING, FRAMES)
        self.assertEqual(result["matchStatus"], "unclear")
        self.assertIsNone(result["matchScore"])
        self.assertEqual(result["condition"]["status"], "unclear")
        self.assertIsNone(result["condition"]["timeSeconds"])

    def test_no_visible_issue_is_withheld_when_item_cannot_be_identified(self):
        raw = model_output(category="unclear", appearance="unclear", material="unclear")
        result = normalize_result(raw, LISTING, FRAMES)
        self.assertEqual(result["matchStatus"], "unclear")
        self.assertEqual(result["condition"]["status"], "unclear")

    def test_unsupported_claims_and_malformed_model_fields_abstain(self):
        raw = model_output()
        raw["checks"][0]["frame"] = 99
        raw["checks"][1]["status"] = ["match"]
        raw["condition"]["status"] = ["visible_issue"]
        result = normalize_result(raw, LISTING, FRAMES)
        self.assertEqual(result["matchStatus"], "unclear")
        self.assertIsNone(result["matchScore"])
        self.assertEqual(result["condition"]["status"], "unclear")

    def test_explicit_contradiction_overrides_an_inconsistent_unclear_label(self):
        raw = model_output(category="unclear", appearance="unclear", material="unclear")
        raw["checks"][0]["observation"] = "Wooden door, not a porcelain tile as claimed."
        raw["checks"][2]["observation"] = "The listing is incorrect about the material."
        tile_listing = {"title": "Porcelain floor tiles", "type": "flooring", "material": "porcelain", "model": ""}
        result = normalize_result(raw, tile_listing, FRAMES)
        self.assertEqual(result["matchStatus"], "mismatch")
        self.assertEqual(result["checks"][0]["status"], "mismatch")
        self.assertEqual(result["checks"][2]["status"], "mismatch")
        self.assertIsNone(result["matchScore"])

    def test_fixed_model_checks_are_normalized(self):
        raw = model_output()
        raw["checks"] = {
            item["field"]: {key: value for key, value in item.items() if key != "field"}
            for item in raw["checks"]
        }
        result = normalize_result(raw, LISTING, FRAMES)
        self.assertEqual(result["matchStatus"], "consistent")
        self.assertEqual(result["matchScore"], 100)

    def test_short_video_produces_real_frames(self):
        import subprocess
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)
            video = path / "video.mp4"
            subprocess.run([
                get_ffmpeg_exe(), "-f", "lavfi", "-i", "color=c=green:s=320x240:r=2",
                "-t", "6", "-pix_fmt", "yuv420p", "-y", str(video),
            ], check=True, capture_output=True)
            frames = extract_frames(video, path)
            self.assertEqual([frame["timeSeconds"] for frame in frames], [0, 5])
            self.assertTrue(all(frame["path"].stat().st_size > 0 for frame in frames))

    def test_very_short_video_samples_a_representative_middle_frame(self):
        import subprocess
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)
            video = path / "video.mp4"
            subprocess.run([
                get_ffmpeg_exe(), "-f", "lavfi", "-i", "color=c=green:s=320x240:r=10",
                "-t", "2.4", "-pix_fmt", "yuv420p", "-y", str(video),
            ], check=True, capture_output=True)
            frames = extract_frames(video, path)
            self.assertEqual([frame["timeSeconds"] for frame in frames], [1])

    def test_ollama_request_sends_image_array_and_structured_format(self):
        with tempfile.TemporaryDirectory() as directory:
            image = Path(directory) / "frame.jpg"
            image.write_bytes(b"sample image")
            frame = {"index": 1, "timeSeconds": 0, "path": image}
            payload = json.dumps({"message": {"content": json.dumps(model_output())}}).encode()
            with patch("server.assessment.urllib.request.urlopen", return_value=io.BytesIO(payload)) as request:
                ask_model(LISTING, [frame])
            sent = json.loads(request.call_args.args[0].data)
            self.assertIsInstance(sent["messages"][0]["content"], str)
            self.assertEqual(len(sent["messages"][0]["images"]), 1)
            self.assertIsInstance(sent["format"], dict)
            self.assertEqual(sent["format"]["properties"]["checks"]["type"], "object")
            self.assertEqual(sent["options"]["num_predict"], 1024)

    def test_endpoint_handles_invalid_inputs_and_cleans_temp_files(self):
        with TestClient(app) as client:
            wrong_type = client.post("/api/assessments", files={"video": ("x.txt", b"x", "text/plain")}, data={"listing": '{}'})
            self.assertEqual(wrong_type.status_code, 415)
            empty = client.post("/api/assessments", files={"video": ("x.mp4", b"", "video/mp4")}, data={"listing": '{"title":"Door","type":"doors"}'})
            self.assertEqual(empty.status_code, 400)
            with patch("server.app.assess", return_value={"matchStatus": "unclear"}) as mocked:
                response = client.post("/api/assessments", files={"video": ("x.mp4", b"sample", "video/mp4")}, data={"listing": '{"title":"Door","type":"doors"}'})
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json()["matchStatus"], "unclear")
                self.assertFalse(mocked.call_args.args[0].exists())


if __name__ == "__main__":
    unittest.main()
