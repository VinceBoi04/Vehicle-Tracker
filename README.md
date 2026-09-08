# Vehicle Maintenance & Fuel Tracker

A full-stack web app for tracking your vehicles' fuel fill-ups and service history. It
computes real fuel economy from your fill-up records, charts spending over time, and tells
you what maintenance is coming due — by mileage, by date, or both.

- **Backend** — Python / FastAPI / SQLAlchemy / SQLite
- **Frontend** — React / Vite / Tailwind CSS / Recharts

The database ships seeded with two example vehicles and about a year of fuel and service
history, so the dashboard has something to show the first time you open it.

## What it does

| View | What you get |
|---|---|
| **Dashboard** | Total spent (fuel vs. service), all-time average fuel economy, fill-up and record counts, and how many service items need attention — plus a line chart of fuel economy per fill-up with a rolling average, a stacked bar chart of monthly spend, and a list of upcoming maintenance. |
| **Vehicles** | Add, edit, delete and select vehicles. The selected vehicle scopes every other page. |
| **Fuel Logs** | A table of fill-ups with an add/edit form. Marks full vs. partial tanks and auto-calculates the total from volume × price. |
| **Service Logs** | A table of service records with a **Due soon / Overdue** badge, plus optional next-due mileage and next-due date per record. |

### How fuel economy is calculated

A fill-up is the only moment you know exactly how much fuel is in the tank, so economy is
measured **between consecutive full-tank fill-ups**:

- If the tank was full at odometer **A** and full again at odometer **B**, every drop of
  fuel added in between — including any partial top-ups along the way — is exactly what was
  burned covering `B − A`.
- Partial fills are therefore never dropped; their volume rolls into the interval that ends
  at the next full tank.
- Fill-ups before the first full tank are skipped: there is no anchor to measure from.
- **MPG** = distance ÷ volume (imperial), or **L/100km** = volume × 100 ÷ distance (metric).
- The **rolling average** is a trailing mean of the last N readings (default 5).
- The **all-time average** is total distance ÷ total fuel, not a mean of the per-interval
  figures — intervals differ in length, so weighting by distance is the honest number.

The implementation lives in [`backend/app/routers/analytics.py`](backend/app/routers/analytics.py).

### How "maintenance due" is decided

For each **service type**, only the most recent record counts — three logged oil changes
mean the first two are history and their due targets are already satisfied. Records with
neither a next-due odometer nor a next-due date are one-off repairs and are skipped.

A record can come due on two independent axes, and the worse of the two wins:

| Axis | Overdue | Due soon |
|---|---|---|
| Distance | `current_odometer >= next_due_odometer` | within 500 miles/km (configurable) |
| Date | `today >= next_due_date` | within 30 days (configurable) |

Both thresholds are query parameters (`odometer_threshold`, `days_threshold`), so the
frontend or an API client can tighten or loosen the warning window without a code change.

## Folder structure

```
vehicle-tracker/
├── backend/
│   ├── app/
│   │   ├── main.py          FastAPI app, CORS, startup (create tables + seed)
│   │   ├── database.py      Engine/session setup, reads DATABASE_URL
│   │   ├── models.py        SQLAlchemy models: Vehicle, FuelLog, ServiceLog
│   │   ├── schemas.py       Pydantic request/response schemas
│   │   ├── seed.py          Example data, inserted only when the DB is empty
│   │   └── routers/
│   │       ├── vehicles.py      CRUD /vehicles
│   │       ├── fuel_logs.py     CRUD /vehicles/{id}/fuel-logs and /fuel-logs/{id}
│   │       ├── service_logs.py  CRUD /vehicles/{id}/service-logs and /service-logs/{id}
│   │       └── analytics.py     fuel-economy + maintenance-due (the interesting logic)
│   ├── requirements.txt
│   ├── Procfile             Start command for Railway/Render
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── App.jsx              Shell: sidebar nav + global vehicle picker + routes
    │   ├── api/client.js        Axios wrapper; base URL from VITE_API_BASE_URL
    │   ├── context/             Selected-vehicle state shared across pages
    │   ├── components/ui.jsx    Badges, stat cards, modal, form field, empty states
    │   ├── pages/               Dashboard, Vehicles, FuelLogs, ServiceLogs
    │   └── utils/format.js      Currency/date/number formatting helpers
    ├── vercel.json          SPA rewrites for client-side routing
    └── .env.example
```

## Running locally

You need **Python 3.11+** and **Node 18+**. Run the two servers in two terminals.

### 1. Backend (http://localhost:8000)

macOS / Linux:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

Windows (PowerShell):

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload --port 8000
```

On first start it creates `vehicle_tracker.db` and seeds the example data. Interactive API
docs are at **http://localhost:8000/docs**.

### 2. Frontend (http://localhost:5173)

```bash
cd frontend
npm install
cp .env.example .env          # Windows: Copy-Item .env.example .env
npm run dev
```

Open **http://localhost:5173**.

### Resetting the demo data

Delete the database file and restart the backend — it will re-seed:

```bash
rm backend/vehicle_tracker.db      # Windows: Remove-Item backend\vehicle_tracker.db
```

You can also seed manually without starting the server: `python -m app.seed`.

## Environment variables

### Backend (`backend/.env`, or the host's dashboard)

| Variable | Default | Purpose |
|---|---|---|
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated list of browser origins allowed to call the API. Set this to your deployed frontend URL in production. `*` allows everything (credentials are then disabled automatically). |
| `DATABASE_URL` | `sqlite:///./vehicle_tracker.db` | SQLAlchemy URL. Point at Postgres to move off SQLite without code changes. |
| `UNITS` | `imperial` | `imperial` → miles/gallons/MPG, `metric` → km/liters/L-per-100km. Affects the fuel-economy endpoint only. |
| `PORT` | `8000` | Injected by the host; the start command reads it. |

> `backend/app/__init__.py` calls `load_dotenv()` before anything reads the environment, so
> a local `backend/.env` is picked up automatically. Hosting platforms have no `.env` file;
> set these in the platform's own dashboard instead, which is the recommended path in
> production.

### Frontend (`frontend/.env`, or Vercel project settings)

| Variable | Default | Purpose |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:8000` | Base URL of the backend. Vite only exposes variables prefixed with `VITE_`, and they are inlined **at build time** — so changing it on Vercel requires a redeploy. |

The API base URL is never hardcoded; see [`frontend/src/api/client.js`](frontend/src/api/client.js).

## Deploying

### Backend → Railway or Render

The app reads its port from `$PORT` and binds `0.0.0.0`, so it works on either host as-is.

- **Start command** (already in `backend/Procfile`):
  ```
  uvicorn app.main:app --host 0.0.0.0 --port $PORT
  ```
- **Build command:** `pip install -r requirements.txt`
- **Root directory:** `backend`
- **Health check path:** `/health`
- **Environment:** set `CORS_ORIGINS` to your Vercel URL, e.g.
  `https://your-app.vercel.app`.

Railway auto-detects the `Procfile`. Render can use the included `render.yaml`, or you can
paste the same build/start commands into a new Web Service.

> **A note on SQLite in production:** most container hosts have ephemeral disks, so the
> SQLite file — and anything you logged — is wiped on redeploy. That is fine for a demo. For
> real data, attach a persistent volume (Railway volume / Render disk) and point
> `DATABASE_URL` at a path on it, or provision Postgres and set
> `DATABASE_URL=postgresql+psycopg://…` (add `psycopg[binary]` to `requirements.txt`).

### Frontend → Vercel

- **Root directory:** `frontend`
- **Framework preset:** Vite (auto-detected)
- **Build command:** `npm run build` · **Output directory:** `dist`
- **Environment variable:** `VITE_API_BASE_URL = https://your-api.up.railway.app`

`vercel.json` rewrites all paths to `index.html` so deep links like `/service` work with
client-side routing.

## API reference

| Method | Path | Purpose |
|---|---|---|
| `GET` / `POST` | `/vehicles` | List / create vehicles |
| `GET` / `PUT` / `DELETE` | `/vehicles/{id}` | Read / update / delete a vehicle (deleting cascades to its logs) |
| `GET` / `POST` | `/vehicles/{id}/fuel-logs` | List / create fill-ups for a vehicle |
| `GET` / `PUT` / `DELETE` | `/fuel-logs/{id}` | Read / update / delete a fill-up |
| `GET` / `POST` | `/vehicles/{id}/service-logs` | List / create service records |
| `GET` / `PUT` / `DELETE` | `/service-logs/{id}` | Read / update / delete a service record |
| `GET` | `/vehicles/{id}/fuel-economy` | Per-interval economy, rolling average, all-time average |
| `GET` | `/vehicles/{id}/maintenance-due` | Service items flagged `ok` / `due_soon` / `overdue` |
| `GET` | `/health` | Liveness probe |

Creating a fuel or service log whose odometer exceeds the vehicle's current reading bumps
`current_odometer` automatically, which keeps the maintenance-due math correct without you
having to update the vehicle by hand.
