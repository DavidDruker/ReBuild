# ReBuild PoC

The existing ReBuild web app, reduced to the core construction-material exchange workflow. The original sidebar, top search bar, typography, green palette, card layout, and photographs are retained.

## Run

Requires Node.js 22.12+.

```sh
npm install
npm run dev
```

For the production preview:

```sh
npm run build
npm run preview
```

The core marketplace runs in the browser with local demo persistence. No account setup or payment processor is needed. Video assessment is optional and uses a separate local server. Listings remain specific to the current browser and origin; they do not sync between devices or tabs. Existing database files are preserved but unused.

## Optional local video assessment

The listing form can analyze an MP4, WebM, or MOV video of up to 50 MB. The server samples up to six frames from the first 30 seconds (one middle frame for clips under five seconds) and sends them to a locally running `qwen3-vl:2b-instruct` model. The result compares visible details with the seller's description and reports visible condition issues. It does not block publishing. The uploaded video and extracted frames are deleted after the request; only the written result is kept with a published listing in this browser. For a useful check, film the full item and any wear from more than one angle.

On Windows, install [Ollama](https://ollama.com/download/windows), then run:

```powershell
ollama pull qwen3-vl:2b-instruct
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r server\requirements.txt
.\.venv\Scripts\python.exe -m uvicorn server.app:app --host 127.0.0.1 --port 8765
```

Keep Ollama running, and run `npm run dev` in another terminal. Vite forwards `/api` requests to the Python server. The Python dependencies include an FFmpeg binary for frame extraction. To point a separately hosted frontend at the assessment server, set `VITE_ASSESSMENT_API` to its full `/api/assessments` URL when building, and set `REBUILD_ALLOWED_ORIGINS` on the server to the frontend origin. The existing static GitHub Pages deployment has no assessment server, so its video check displays an unavailable message while listing creation still works.

For a phone demo on the same network, open `http://<computer-LAN-IP>:5173` on the phone while the Vite dev server and Python server run on the computer. The existing dev command listens on the network and proxies video requests to the Python server. A separately hosted phone frontend needs a reachable assessment API URL configured at build time.

The displayed **demo match score** is a rule-based summary of the model's category (40 points), appearance (30), material (20), and visible model label (10) checks. Unspecified fields are omitted; unclear checks reduce coverage. The number appears only when at least 70% of applicable checks were assessable. It is not a calibrated probability of authenticity or product quality. Condition is reported separately and cannot verify function, structural soundness, or safety ratings.

## PoC scope

- **Marketplace:** browse and search the original 30 material listings, use material type filters, and view your company's inventory.
- **List material:** publish surplus through the existing form pattern. No prescribed product or demonstration script is required.
- **Request material:** choose a quantity and pickup date. On your own listings, record an incoming request from another company.
- **Activity:** accept requests, mark materials ready for pickup, complete handoffs, or cancel before completion. All actions use the same workspace; there are no seller/buyer views.
- **Summary strip:** actual demo totals replace static claims. Only completed handoffs contribute to value and estimated material diversion.
- **Reset demo:** restores the original material catalog and clears this browser's created listings, requests, and totals after confirmation.

Removed from the interface: separate supply/demand pages, smart-match dashboard, logistics mockups, simulated card checkout, placeholder notifications, and settings. The page structure and visual design remain those of the original app.

## Demo data and impact

The original catalog, including its companies, quantities, specifications, prices, and notes, is retained in `src/catalog.js`. Pickup dates are refreshed at reset. The original image files are served from `public/assets`; they are illustrative warehouse photos rather than evidence of live inventory. No company is contacted and no payment occurs.

Completed value = quantity × price. Estimated material diversion = quantity × kg-per-unit assumption. The assumptions and reused quantities are visible beneath the summary strip. These are simulated estimates, not verified environmental outcomes.

## Offline use

The loaded page can complete transactions without a server connection. The production build also prepares an offline cache. A fresh offline reload produced a blank page in the embedded test browser, so keep the loaded tab open for offline demonstrations and verify cold reloads separately on the intended device. Service workers require HTTPS or localhost.

## Validation

```sh
npm test
npm run build
\.venv\Scripts\python.exe -m unittest server.test_assessment -v
```

See `VERIFICATION.md` for browser checks and known limitations. `POC_PLAN.md` records the current scope. The existing GitHub Pages workflow serves the static production build; no deployment was performed.

MIT license.
