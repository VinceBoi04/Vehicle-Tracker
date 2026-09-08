"""FastAPI application entrypoint.

Run locally:   uvicorn app.main:app --reload
Run in prod:   uvicorn app.main:app --host 0.0.0.0 --port $PORT
"""
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, engine
from .routers import analytics, fuel_logs, service_logs, vehicles
from .seed import seed_if_empty

@asynccontextmanager
async def lifespan(_: FastAPI):
    """Startup work: create tables, then seed demo data if the database is empty."""
    # create_all is enough for a SQLite app of this size; a bigger project would use Alembic.
    Base.metadata.create_all(engine)
    seed_if_empty()  # no-op once the database has any vehicles
    yield


app = FastAPI(
    title="Vehicle Maintenance & Fuel Tracker API",
    version="1.0.0",
    description="Track vehicles, fuel fill-ups, and service history; compute fuel economy "
    "and flag upcoming maintenance.",
    lifespan=lifespan,
)

# CORS_ORIGINS is a comma-separated list, e.g. "http://localhost:5173,https://app.vercel.app".
# "*" allows everything, which is convenient locally but should be narrowed in production.
raw_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
origins = [o.strip() for o in raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    # allow_credentials must be False when origins is "*", or browsers reject the response.
    allow_credentials="*" not in origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(vehicles.router)
app.include_router(fuel_logs.router)
app.include_router(service_logs.router)
app.include_router(analytics.router)


@app.get("/", tags=["meta"])
def root():
    return {"name": "Vehicle Maintenance & Fuel Tracker API", "docs": "/docs"}


@app.get("/health", tags=["meta"])
def health():
    """Cheap liveness probe for Railway/Render health checks."""
    return {"status": "ok"}


if __name__ == "__main__":
    # Lets the app be started with `python -m app.main`; hosts inject PORT.
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
