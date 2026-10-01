# PulseX — Customer 360° Digital Twin (CRM-04)

**One Customer. One Relationship. One Live View.**

PulseX merges customer data from eight source systems (CRM, email, WhatsApp, invoices, payments, support, website, product telemetry) into one live digital twin per customer. An explainable, rule-based engine recalculates sentiment, engagement, churn probability, lifetime value and relationship state every time an event arrives, and records exactly why the state changed.

> Churn scores are **simulated with transparent rules**, not a trained ML model. Every point can be traced to an event.

## Stack

React 18 · Vite · Tailwind CSS · Recharts · Node.js · Express · MongoDB (Mongoose) · Server-Sent Events for live updates.

## Run it

Requirements: **Node 18+** and **MongoDB** (local `mongod`, Docker, or an Atlas connection string).

```bash
# 1. Point the API at MongoDB (defaults to mongodb://127.0.0.1:27017/pulsex)
cp server/.env.example server/.env

# 2. Install everything (root, server, client)
npm run setup

# 3. Start API + web app together
npm run dev
```

Open **http://localhost:5173**. On first start the API seeds the demo dataset automatically (`AUTO_SEED=true`).

No local MongoDB? `docker run -d -p 27017:27017 --name pulsex-mongo mongo:7`

Other commands:

| Command | What it does |
|---|---|
| `npm run seed` | Wipe and rebuild the demo dataset |
| `npm run build && npm start` | Production build; the API serves the app at http://localhost:5000 |

You can also reset data from the app: **Data sources → Import demo data** or **Event simulator → Reset demo data**.

### Environment

`server/.env`: `PORT` (5000), `MONGODB_URI`, `CLIENT_ORIGIN` (http://localhost:5173), `AUTO_SEED` (true).
`client/.env` (optional): `VITE_API_PROXY` if the API runs somewhere other than localhost:5000.

## Five-minute demo script

1. **Dashboard** — 17 customers across five states, KPIs and trends. Click a state in the strip to filter.
2. **Customers → Apex Industries** — Stable, high CLV, one open opportunity, positive sentiment. Note the state rail and "Why stable".
3. **Event simulator → Guided demo** (or use **+ Add customer event** on the profile):
   1. Complaint raised → stays **Stable** (one risk point, churn rises)
   2. Payment overdue ₹1,20,000 → **At Risk** with reasons
   3. Negative email → sentiment turns negative, added to the reasons
   4. Payment received → still **At Risk** (open complaint + negative sentiment)
   5. Complaint resolved → **Recovering**
   Each step shows before → after for every metric and the rule that fired. The dashboard, timeline and profile update live, no refresh.
4. **Relationship timeline** — every event with source, reference, impact and any state change it caused. Filter by type.
5. **Data sources** — sync **Payments**: Orion Logistics' ₹2,40,000 payment is resolved to the right customer and moves it from At Risk to Recovering. A look-alike payer is kept separate.
6. **Identity** — Acme Corporation appears as "Acme Corp" (Support), "ACME CORPORATION LTD" (Payments), "Acme Corporation Pvt. Ltd." (Invoices) and more; all linked with confidence and evidence.
7. **Risk & insights** — portfolio churn drivers, churn vs CLV map, watchlist with contributors ("Payment delays +20"), and the full rulebook.

## How the engine works

`server/src/engine/engine.js` replays a customer's full event history in time order. After each event it recalculates:

- **Risk points**: overdue payment 2 · open complaints 1 (2 if two or more) · negative sentiment 1 · usage down 10%+ in 45 days 1 · engagement below 35 1.
- **State** (first match wins): **Lost** — contract cancelled, no purchase since · **At Risk** — 2+ risk points · **Recovering** — was At Risk/Lost and risk fell below 2; stays Recovering until 30 days with zero risk · **Growing** — no risk and 3+ growth signals (frequent purchases, usage up, positive sentiment, high engagement, open pipeline) · **Stable** — otherwise.
- **Sentiment**: keyword lexicon with negation and phrases, −100…+100; customer score is a recency-weighted average of the last six messages/complaints/resolutions.
- **Engagement**: weighted activity points over 30 days plus product usage.
- **Churn**: baseline 8 + additive factors (payment delays, complaints, sentiment, usage decline, low engagement, purchase gaps) − protective factors, clamped to 2–97%.
- **CLV**: historical revenue + annual run rate × 3 years × (1 − churn).

Because the state is derived by replay, it is deterministic and every transition is stored with its trigger event, rule, reasons and churn before/after.

**Identity resolution** (`engine/identity.js`) scores each incoming record against every customer: name similarity (token overlap, edit distance, abbreviations like "Inds") × 0.4, email domain 0.3, phone 0.3, company ID (CIN) +0.5 or −0.3 on mismatch. Records at 60%+ merge; the rest are kept separate with the explanation.

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Liveness and DB status |
| GET | `/api/meta` | States, sources, event types, presets, thresholds |
| GET | `/api/dashboard` | KPIs, state distribution, 6-month trends, transitions, customers |
| GET | `/api/customers?search=&state=&sort=churn\|clv\|name\|engagement\|outstanding` | Customer list |
| GET | `/api/customers/:id` | Full profile: snapshot, events, transitions, source records |
| GET | `/api/events?customerId=&category=&limit=` | Timeline feed |
| POST | `/api/events` | Add an event → returns before/after, transition, reasons, changes |
| GET | `/api/sources` | Source status, counts, pending records |
| POST | `/api/sources/:key/sync` | Incremental sync of one source |
| GET | `/api/sources/identity` | Identity clusters and unmatched records |
| POST | `/api/sources/import-demo` | Rebuild the demo dataset |
| GET | `/api/insights` | Churn drivers, watchlist, risk map, rulebook |
| GET | `/api/stream` | Server-Sent Events for live updates |

Example:

```bash
curl -X POST localhost:5000/api/events -H 'Content-Type: application/json' \
  -d '{"customerId":"<id>","type":"PAYMENT_OVERDUE","amount":120000}'
```

Invalid input returns `400` with a `details` list; unknown ids return `404`.

## Project structure

```
server/src
  engine/     catalog, rules, sentiment, identity, engine (replay), diff
  models/     Customer, Event, StateTransition, SourceRecord, DataSource, PendingRecord
  services/   customer (live pipeline), dashboard, insights, ingestion, validation
  routes/     REST endpoints + SSE stream
  seed/       17 scripted customer stories + source records + queued sync records
client/src
  components/ Layout, StateRail, EventForm, EventResult, Timeline, ChurnFactors, IdentityPanel, UI kit
  pages/      Dashboard, Customers, CustomerProfile, Timeline, Simulator, DataSources, RiskInsights
```
