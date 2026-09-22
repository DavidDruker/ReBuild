const endpoint = import.meta.env.VITE_ASSESSMENT_API || "/api/assessments";

export async function assessVideo(video, listing) {
  const body = new FormData();
  body.append("video", video);
  body.append("listing", JSON.stringify(listing));
  let response;
  try {
    response = await fetch(endpoint, { method: "POST", body });
  } catch {
    throw new Error("The video analysis server is unavailable. You can still publish the listing.");
  }
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(
      typeof result.detail === "string"
        ? `${result.detail} You can still publish the listing.`
        : response.status === 404
          ? "The video analysis route is unavailable here. Reload the local app on port 5173 and try again. You can still publish the listing."
          : `Video analysis failed (HTTP ${response.status}). Check the local analysis server and try again. You can still publish the listing.`,
    );
  }
  const result = await response.json().catch(() => null);
  if (!result || !["consistent", "mismatch", "unclear"].includes(result.matchStatus)) {
    throw new Error("The video analysis server returned an unreadable result. You can still publish the listing.");
  }
  return result;
}
