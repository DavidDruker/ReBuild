# ReBuild

ReBuild is a hackathon-ready B2B web application for matching surplus construction materials with upcoming project demand before reusable inventory becomes waste.

## What it demonstrates

- A searchable marketplace for documented surplus materials
- Separate supplier and requester workflows
- Compatibility scoring based on specification, timing, distance, and quantity
- Circular logistics using available return-trip capacity
- Financial and environmental impact reporting
- Hybrid specification search using edit distance, semantic tokens, and exact attributes
- Stripe-style simulated checkout with receipts stored in SQLite
- Responsive desktop and mobile layouts

## Tech stack

- React
- Vite
- Lucide React
- Express REST API
- SQLite database
- Responsive CSS

## Run locally

```bash
npm install
npm run dev:all
```

Open the local URL printed by Vite.

The web app runs on `http://127.0.0.1:5173` and proxies `/api` requests to the API on `http://127.0.0.1:3001`.

To test on a phone, connect the phone and computer to the same Wi-Fi network, then open `http://YOUR_COMPUTER_IP:5173`. Vite accepts LAN connections; API requests continue through the same frontend origin and development proxy.

## How inventory data is created

The database is initialized automatically on the first API start. Six demo listings are inserted only when the listings table is empty. New production-style data enters through the **List supply** and **Post demand** forms, which call the REST API and persist records to `data/rebuild.db`.

Future import paths can use the same API:

- Contractor form submissions
- CSV or ERP inventory imports
- BIM quantity exports
- AI-assisted photo classification followed by human review
- Deconstruction audits and material passports

## API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Check API and database availability |
| `GET` | `/api/listings` | Return published surplus inventory |
| `POST` | `/api/listings` | Create a supply listing |
| `GET` | `/api/listings/:id` | Return a material passport |
| `GET` | `/api/demands` | Return material requirements |
| `POST` | `/api/demands` | Create a demand record |
| `POST` | `/api/checkout/simulate` | Create a simulated payment and order |
| `GET` | `/api/orders` | Return simulated orders |
| `GET` | `/api/summary` | Return aggregate marketplace totals |

### Compatibility search

`GET /api/listings` accepts `q`, `type`, `model`, `dimensions`, `material`, and `buildingType`. Results are ranked using:

- 30% normalized Levenshtein similarity for titles and model numbers
- 30% local semantic token similarity with construction synonym groups
- 40% structured model, dimensions, material, and building-use compatibility

This is a transparent local demo model, not a production embedding service. The API returns the total score and all three component scores for every result.

### Payment simulation

The checkout imitates a Stripe payment flow but never contacts Stripe and never charges a card. Use `4242 4242 4242 4242` for success or `4000 0000 0000 0002` to simulate a decline. Only the final four digits are stored.

## Deploy to GitHub Pages

1. Create a GitHub repository and add these files to its root.
2. Push the repository to the `main` branch.
3. Open **Settings → Pages** and select **GitHub Actions** as the source.
4. The included workflow builds and deploys the site automatically.

## Demo flow

1. Search for `FD90-OAK-90O` to demonstrate typo-tolerant model matching.
2. Add dimensions, material, and building type in **Specification filters**.
3. Open a material passport and complete a simulated checkout.
4. Open **Supply** and publish a database-backed surplus listing.
5. Open **Demand** and publish a material requirement.
6. Export the impact inventory as CSV.

## Project structure

```text
rebuild/
├── assets/
├── server/
│   ├── database.js
│   └── index.js
├── src/
│   ├── main.jsx
│   └── styles.css
├── .github/workflows/deploy.yml
├── index.html
├── package.json
├── vite.config.js
├── LICENSE
└── README.md
```

## Product direction

The prototype focuses on pre-waste matching: coordinating future material availability, future project demand, and transport capacity before disposal occurs. A production implementation would add authentication, a database, third-party material verification, BIM integrations, and audited life-cycle assessment data.

## License

MIT
