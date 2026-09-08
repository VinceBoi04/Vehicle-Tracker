"""Seed the database with a small amount of realistic example data.

Called automatically on startup (see main.py) but only when the vehicles table is empty,
so it never overwrites real data. Dates are computed relative to today so the demo always
looks current - one vehicle is deliberately left with an overdue and a due-soon service
item so the maintenance badges have something to show.
"""
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import models
from .database import SessionLocal


def seed_if_empty() -> bool:
    """Insert demo data if there are no vehicles yet. Returns True if it seeded."""
    db: Session = SessionLocal()
    try:
        if db.scalar(select(models.Vehicle.id).limit(1)) is not None:
            return False

        today = date.today()

        civic = models.Vehicle(
            make="Honda", model="Civic", year=2018, nickname="Daily", current_odometer=0
        )
        tacoma = models.Vehicle(
            make="Toyota", model="Tacoma", year=2015, nickname="Truck", current_odometer=0
        )
        db.add_all([civic, tacoma])
        db.flush()  # assigns ids without committing

        # --- Fuel history -------------------------------------------------------------
        # Civic: eleven fill-ups roughly every 3 weeks, ~330 miles and ~11 gal apiece,
        # with one deliberate partial fill so the partial-tank handling is exercised.
        civic_odo = 41_200.0
        civic_fills = [
            # (weeks ago, miles since last, gallons, price/unit, full tank?)
            (30, 0, 11.4, 3.39, True),  # first entry only anchors the calculation
            (27, 332, 10.9, 3.45, True),
            (24, 318, 10.4, 3.52, True),
            (21, 341, 11.2, 3.61, True),
            (18, 150, 5.0, 3.58, False),  # partial top-up mid-interval
            (17, 190, 6.3, 3.55, True),
            (14, 305, 10.1, 3.44, True),
            (11, 356, 11.8, 3.29, True),
            (8, 327, 10.6, 3.31, True),
            (5, 344, 11.1, 3.48, True),
            (2, 338, 10.8, 3.62, True),
        ]
        for weeks_ago, miles, gallons, price, full in civic_fills:
            civic_odo += miles
            db.add(
                models.FuelLog(
                    vehicle_id=civic.id,
                    date=today - timedelta(weeks=weeks_ago),
                    odometer=round(civic_odo, 1),
                    gallons=gallons,
                    price_per_unit=price,
                    total_cost=round(gallons * price, 2),
                    is_full_tank=full,
                    notes=None if full else "Splash and dash on a road trip",
                )
            )
        civic.current_odometer = round(civic_odo, 1)

        # Tacoma: fewer, thirstier fill-ups.
        tacoma_odo = 98_400.0
        tacoma_fills = [
            (26, 0, 19.8, 3.55, True),
            (20, 288, 17.9, 3.61, True),
            (14, 301, 18.6, 3.49, True),
            (7, 274, 17.2, 3.58, True),
            (3, 293, 18.1, 3.66, True),
        ]
        for weeks_ago, miles, gallons, price, full in tacoma_fills:
            tacoma_odo += miles
            db.add(
                models.FuelLog(
                    vehicle_id=tacoma.id,
                    date=today - timedelta(weeks=weeks_ago),
                    odometer=round(tacoma_odo, 1),
                    gallons=gallons,
                    price_per_unit=price,
                    total_cost=round(gallons * price, 2),
                    is_full_tank=full,
                )
            )
        tacoma.current_odometer = round(tacoma_odo, 1)

        # --- Service history ----------------------------------------------------------
        # Civic: oil change due soon by distance, registration/inspection due soon by date.
        db.add_all(
            [
                models.ServiceLog(
                    vehicle_id=civic.id,
                    date=today - timedelta(days=210),
                    odometer=civic.current_odometer - 4_600,
                    service_type="Oil Change",
                    cost=62.40,
                    notes="Full synthetic 0W-20",
                    next_due_odometer=civic.current_odometer + 400,  # -> due soon
                    next_due_date=today + timedelta(days=155),
                ),
                models.ServiceLog(
                    vehicle_id=civic.id,
                    date=today - timedelta(days=120),
                    odometer=civic.current_odometer - 2_500,
                    service_type="Tire Rotation",
                    cost=25.00,
                    notes=None,
                    next_due_odometer=civic.current_odometer + 3_100,  # -> ok
                    next_due_date=None,
                ),
                models.ServiceLog(
                    vehicle_id=civic.id,
                    date=today - timedelta(days=340),
                    odometer=civic.current_odometer - 7_200,
                    service_type="State Inspection",
                    cost=35.00,
                    notes="Annual safety inspection",
                    next_due_odometer=None,
                    next_due_date=today + timedelta(days=21),  # -> due soon by date
                ),
                models.ServiceLog(
                    vehicle_id=civic.id,
                    date=today - timedelta(days=400),
                    odometer=civic.current_odometer - 9_000,
                    service_type="Cabin Air Filter",
                    cost=18.99,
                    notes="One-off, nothing scheduled",
                ),
            ]
        )

        # Tacoma: brakes are past due on both axes, coolant flush is comfortably ok.
        db.add_all(
            [
                models.ServiceLog(
                    vehicle_id=tacoma.id,
                    date=today - timedelta(days=430),
                    odometer=tacoma.current_odometer - 11_000,
                    service_type="Brake Pads",
                    cost=310.00,
                    notes="Front pads and rotors",
                    next_due_odometer=tacoma.current_odometer - 600,  # -> overdue
                    next_due_date=today - timedelta(days=15),  # -> also overdue
                ),
                models.ServiceLog(
                    vehicle_id=tacoma.id,
                    date=today - timedelta(days=90),
                    odometer=tacoma.current_odometer - 1_200,
                    service_type="Coolant Flush",
                    cost=129.50,
                    notes=None,
                    next_due_odometer=tacoma.current_odometer + 28_000,
                    next_due_date=today + timedelta(days=900),
                ),
                models.ServiceLog(
                    vehicle_id=tacoma.id,
                    date=today - timedelta(days=45),
                    odometer=tacoma.current_odometer - 700,
                    service_type="Oil Change",
                    cost=78.25,
                    notes="High-mileage blend",
                    next_due_odometer=tacoma.current_odometer + 4_300,
                    next_due_date=today + timedelta(days=135),
                ),
            ]
        )

        db.commit()
        return True
    finally:
        db.close()


if __name__ == "__main__":
    # Allows `python -m app.seed` to (re)seed manually.
    from .database import Base, engine

    Base.metadata.create_all(engine)
    print("Seeded." if seed_if_empty() else "Database already has data; nothing to do.")
