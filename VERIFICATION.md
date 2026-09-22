# Verification

Updated September 19, 2026, after the design-preservation correction.

## Video assessment addition (September 21, 2026)

- The browser form sends video and listing claims to the optional local server. Assessment failure leaves listing publication available.
- Python unit tests cover real FFmpeg frame extraction, explicit match-score rules, contradictions in model observations, abstention on poor footage, invalid uploads, and temporary-file cleanup.
- Live inference with the local `qwen3-vl:2b-instruct` model returned HTTP 200 for a short door clip. The matching listing completed in about 56 seconds in the initial direct test, and the final version displayed its advisory result in the phone-sized listing form.
- A deliberately wrong porcelain-tile listing yielded observations that explicitly identified a wooden door. The model labeled those checks unclear, so normalization now marks explicit, frame-supported contradictions as mismatches. This rule has an automated test; the final prompt change was not rechecked against a wider video set.
- CPU inference time varies: the first wrong-listing request reached the five-minute model timeout, while a shorter retry completed in about 102 seconds. The score is not calibrated and visible condition is not a safety or quality certification.
- A 2.4-second portrait phone clip exposed a stale Vite proxy (HTTP 404) and a model response cut off by its output limit. After restarting Vite, bounding frame size, and using a fixed four-check response schema, the clip returned HTTP 200 through port 5173 in about 47 seconds. With no listing details confirmed, the result withheld both the score and a positive condition finding.

## Passed

- Eight state-model tests: original catalog search, live listings, validation, remaining stock, overbooking prevention, valid handoff transitions, cancellation, completed impact, and reset.
- Production Vite build.
- Original stylesheet restored from Git HEAD with limited PoC additions. Original document font loading restored.
- All 30 original catalog entries retained, including their names, companies, specifications, quantities, prices, and notes.
- All six original photographs copied unchanged into the served assets directory. Generated material illustrations removed.
- Desktop browser: original sidebar, top search, summary strip, filters, three-column photographic cards, and green visual system inspected.
- Completed a request for two Commercial LED fixtures from the original catalog through acceptance, readiness, and completion. Observed $56 material value and 6.8 kg estimated diversion.

- Phone viewport (390 x 844): published an arbitrary insulation listing; no horizontal page overflow. Mobile menu and confirmed reset restored all 30 original materials.
- Original photo hashes match the repository files; the original stylesheet is retained verbatim before the PoC additions.

## Demo boundaries

Data is local to one browser and origin. No real supplier is contacted or charged. All activity actions are available in the shared workspace for the PoC.

The prior loaded-page offline workflow passed with the server stopped. Fresh offline reload produced a blank page in the embedded browser; keep the loaded tab open when demonstrating offline. No physical-phone test or public deployment was performed.
