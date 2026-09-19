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

The app runs in the browser with local demo persistence. No API server, account setup, or payment processor is needed. Changes are specific to the current browser and origin, and do not sync between devices or tabs. Existing database files are preserved but unused.

## PoC scope

- **Marketplace:** browse and search the original 30 material listings, use specification filters, and view your company's inventory.
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
```

See `VERIFICATION.md` for browser checks and known limitations. `POC_PLAN.md` records the current scope. The existing GitHub Pages workflow serves the static production build; no deployment was performed.

MIT license.
