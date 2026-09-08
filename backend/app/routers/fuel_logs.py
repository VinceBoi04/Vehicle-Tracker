"""CRUD endpoints for fuel logs.

Logs are nested under a vehicle for listing/creating (/vehicles/{id}/fuel-logs) and
addressed directly by id for update/delete (/fuel-logs/{id}).
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from .vehicles import get_vehicle_or_404

router = APIRouter(tags=["fuel-logs"])


def get_fuel_log_or_404(log_id: int, db: Session) -> models.FuelLog:
    log = db.get(models.FuelLog, log_id)
    if log is None:
        raise HTTPException(status_code=404, detail=f"Fuel log {log_id} not found")
    return log


@router.get("/vehicles/{vehicle_id}/fuel-logs", response_model=list[schemas.FuelLogRead])
def list_fuel_logs(vehicle_id: int, db: Session = Depends(get_db)):
    get_vehicle_or_404(vehicle_id, db)
    stmt = (
        select(models.FuelLog)
        .where(models.FuelLog.vehicle_id == vehicle_id)
        # Odometer is the tiebreaker so same-day fill-ups stay in driving order.
        .order_by(models.FuelLog.date.desc(), models.FuelLog.odometer.desc())
    )
    return db.scalars(stmt).all()


@router.post(
    "/vehicles/{vehicle_id}/fuel-logs",
    response_model=schemas.FuelLogRead,
    status_code=status.HTTP_201_CREATED,
)
def create_fuel_log(
    vehicle_id: int, payload: schemas.FuelLogCreate, db: Session = Depends(get_db)
):
    vehicle = get_vehicle_or_404(vehicle_id, db)
    log = models.FuelLog(vehicle_id=vehicle_id, **payload.model_dump())
    db.add(log)
    # A fill-up at a higher reading than we have on file means the odometer moved on.
    if log.odometer > vehicle.current_odometer:
        vehicle.current_odometer = log.odometer
    db.commit()
    db.refresh(log)
    return log


@router.get("/fuel-logs/{log_id}", response_model=schemas.FuelLogRead)
def get_fuel_log(log_id: int, db: Session = Depends(get_db)):
    return get_fuel_log_or_404(log_id, db)


@router.put("/fuel-logs/{log_id}", response_model=schemas.FuelLogRead)
def update_fuel_log(log_id: int, payload: schemas.FuelLogUpdate, db: Session = Depends(get_db)):
    log = get_fuel_log_or_404(log_id, db)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(log, field, value)
    if log.odometer > log.vehicle.current_odometer:
        log.vehicle.current_odometer = log.odometer
    db.commit()
    db.refresh(log)
    return log


@router.delete("/fuel-logs/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_fuel_log(log_id: int, db: Session = Depends(get_db)):
    log = get_fuel_log_or_404(log_id, db)
    db.delete(log)
    db.commit()
