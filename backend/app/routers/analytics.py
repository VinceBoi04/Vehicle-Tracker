"""Derived / computed endpoints: fuel economy and maintenance-due.

These are the two places with non-obvious logic, so they are commented heavily.
"""
import os
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from .vehicles import get_vehicle_or_404

router = APIRouter(prefix="/vehicles", tags=["analytics"])

# "imperial" -> miles + gallons -> MPG.  "metric" -> km + liters -> L/100km.
UNITS = os.getenv("UNITS", "imperial").lower()

# Defaults for "how close to due counts as due soon". Overridable per request.
DEFAULT_ODOMETER_THRESHOLD = 500.0  # miles/km of headroom before we warn
DEFAULT_DAYS_THRESHOLD = 30  # days of headroom before we warn
DEFAULT_ROLLING_WINDOW = 5  # number of readings in the trailing average


@router.get("/{vehicle_id}/fuel-economy", response_model=schemas.FuelEconomyResponse)
def fuel_economy(
    vehicle_id: int,
    rolling_window: int = Query(DEFAULT_ROLLING_WINDOW, ge=2, le=50),
    db: Session = Depends(get_db),
):
    """Compute economy between consecutive full-tank fill-ups.

    Why full tanks only: a fill-up is the only moment we know exactly how much fuel is in
    the tank. If the tank is full at odometer A and full again at odometer B, then every
    drop of fuel added in between (including any partial fills along the way) is exactly
    what was burned covering B - A. A partial fill on its own tells us nothing, because we
    do not know the tank level before or after it.

    So the algorithm is:
      1. Order fill-ups by odometer ascending (chronological driving order).
      2. Skip everything before the first full tank - there is no anchor to measure from.
      3. Accumulate fuel volume as we pass each fill-up.
      4. When we hit a full tank, close the interval: distance = odo - anchor_odo,
         fuel = everything accumulated since the anchor. That full tank then becomes the
         new anchor and the accumulators reset.
    """
    get_vehicle_or_404(vehicle_id, db)

    logs = db.scalars(
        select(models.FuelLog)
        .where(models.FuelLog.vehicle_id == vehicle_id)
        .order_by(models.FuelLog.odometer, models.FuelLog.date)
    ).all()

    points: list[schemas.FuelEconomyPoint] = []
    anchor: models.FuelLog | None = None  # last full tank we are measuring from
    pending_units = 0.0  # fuel added since the anchor
    pending_cost = 0.0  # money spent since the anchor
    economies: list[float] = []

    for log in logs:
        if anchor is None:
            # Nothing to measure against yet: the first full tank only starts the clock,
            # since its own volume filled a tank we never watched empty.
            if log.is_full_tank:
                anchor = log
            continue

        pending_units += log.gallons
        pending_cost += log.total_cost

        if not log.is_full_tank:
            # Partial fill: keep accumulating and wait for the next full tank to close out.
            continue

        distance = log.odometer - anchor.odometer
        if distance > 0 and pending_units > 0:
            if UNITS == "metric":
                # Liters per 100 km - lower is better.
                economy = (pending_units * 100.0) / distance
            else:
                # Miles per gallon - higher is better.
                economy = distance / pending_units

            economies.append(economy)
            # Trailing average over the last `rolling_window` readings (fewer early on).
            window = economies[-rolling_window:]
            points.append(
                schemas.FuelEconomyPoint(
                    date=log.date,
                    odometer=log.odometer,
                    miles_driven=round(distance, 2),
                    units_used=round(pending_units, 3),
                    economy=round(economy, 2),
                    cost=round(pending_cost, 2),
                    rolling_average=round(sum(window) / len(window), 2),
                )
            )

        # This full tank becomes the anchor for the next interval.
        anchor = log
        pending_units = 0.0
        pending_cost = 0.0

    # All-time average is distance-weighted rather than a mean of the per-interval numbers:
    # total distance / total fuel is the honest figure, since intervals differ in length.
    all_time = None
    if points:
        total_distance = sum(p.miles_driven for p in points)
        total_units = sum(p.units_used for p in points)
        if total_units > 0 and total_distance > 0:
            all_time = (
                round((total_units * 100.0) / total_distance, 2)
                if UNITS == "metric"
                else round(total_distance / total_units, 2)
            )

    return schemas.FuelEconomyResponse(
        vehicle_id=vehicle_id,
        units=UNITS,
        economy_label="L/100km" if UNITS == "metric" else "MPG",
        rolling_window=rolling_window,
        all_time_average=all_time,
        latest=points[-1].economy if points else None,
        points=points,
    )


@router.get("/{vehicle_id}/maintenance-due", response_model=schemas.MaintenanceDueResponse)
def maintenance_due(
    vehicle_id: int,
    odometer_threshold: float = Query(DEFAULT_ODOMETER_THRESHOLD, ge=0),
    days_threshold: int = Query(DEFAULT_DAYS_THRESHOLD, ge=0),
    db: Session = Depends(get_db),
):
    """Flag service items that are overdue or coming up soon.

    Only the most recent record per service_type is considered: if you logged three oil
    changes, the first two are history and their old due targets are already satisfied.
    Records with neither next_due_odometer nor next_due_date are one-off repairs with
    nothing to schedule, so they are skipped entirely.

    A record can come due on two independent axes (distance and date). We evaluate both
    and keep the worse of the two - whichever arrives first is what makes it due.
    """
    vehicle = get_vehicle_or_404(vehicle_id, db)
    today = date.today()

    logs = db.scalars(
        select(models.ServiceLog)
        .where(models.ServiceLog.vehicle_id == vehicle_id)
        .order_by(models.ServiceLog.date, models.ServiceLog.odometer)
    ).all()

    # Ordered ascending, so the last write per service_type wins = the newest record.
    latest_by_type: dict[str, models.ServiceLog] = {}
    for log in logs:
        latest_by_type[log.service_type.strip().lower()] = log

    items: list[schemas.MaintenanceItem] = []
    for log in latest_by_type.values():
        if log.next_due_odometer is None and log.next_due_date is None:
            continue

        miles_remaining = None
        days_remaining = None
        # Rank statuses numerically so we can keep the most severe of the two axes.
        severity = 0  # 0 = ok, 1 = due soon, 2 = overdue
        reasons: list[str] = []

        if log.next_due_odometer is not None:
            miles_remaining = log.next_due_odometer - vehicle.current_odometer
            if miles_remaining <= 0:
                severity = max(severity, 2)
                reasons.append(f"{abs(miles_remaining):,.0f} past due odometer")
            elif miles_remaining <= odometer_threshold:
                severity = max(severity, 1)
                reasons.append(f"{miles_remaining:,.0f} until due odometer")

        if log.next_due_date is not None:
            days_remaining = (log.next_due_date - today).days
            if days_remaining <= 0:
                severity = max(severity, 2)
                reasons.append(f"{abs(days_remaining)} days past due date")
            elif days_remaining <= days_threshold:
                severity = max(severity, 1)
                reasons.append(f"{days_remaining} days until due date")

        status_name = {0: "ok", 1: "due_soon", 2: "overdue"}[severity]
        items.append(
            schemas.MaintenanceItem(
                service_log_id=log.id,
                service_type=log.service_type,
                last_serviced_date=log.date,
                last_serviced_odometer=log.odometer,
                next_due_odometer=log.next_due_odometer,
                next_due_date=log.next_due_date,
                miles_remaining=None if miles_remaining is None else round(miles_remaining, 1),
                days_remaining=days_remaining,
                status=status_name,
                reason="; ".join(reasons) if reasons else "Not due yet",
            )
        )

    # Most urgent first, then by whichever axis has the least headroom left.
    severity_rank = {"overdue": 0, "due_soon": 1, "ok": 2}
    items.sort(
        key=lambda i: (
            severity_rank[i.status],
            i.miles_remaining if i.miles_remaining is not None else float("inf"),
            i.days_remaining if i.days_remaining is not None else float("inf"),
        )
    )

    return schemas.MaintenanceDueResponse(
        vehicle_id=vehicle_id,
        current_odometer=vehicle.current_odometer,
        as_of=today,
        odometer_warning_threshold=odometer_threshold,
        days_warning_threshold=days_threshold,
        items=items,
    )
