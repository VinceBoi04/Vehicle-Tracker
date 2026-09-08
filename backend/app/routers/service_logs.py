"""CRUD endpoints for service logs (same nesting convention as fuel logs)."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from .vehicles import get_vehicle_or_404

router = APIRouter(tags=["service-logs"])


def get_service_log_or_404(log_id: int, db: Session) -> models.ServiceLog:
    log = db.get(models.ServiceLog, log_id)
    if log is None:
        raise HTTPException(status_code=404, detail=f"Service log {log_id} not found")
    return log


@router.get("/vehicles/{vehicle_id}/service-logs", response_model=list[schemas.ServiceLogRead])
def list_service_logs(vehicle_id: int, db: Session = Depends(get_db)):
    get_vehicle_or_404(vehicle_id, db)
    stmt = (
        select(models.ServiceLog)
        .where(models.ServiceLog.vehicle_id == vehicle_id)
        .order_by(models.ServiceLog.date.desc(), models.ServiceLog.odometer.desc())
    )
    return db.scalars(stmt).all()


@router.post(
    "/vehicles/{vehicle_id}/service-logs",
    response_model=schemas.ServiceLogRead,
    status_code=status.HTTP_201_CREATED,
)
def create_service_log(
    vehicle_id: int, payload: schemas.ServiceLogCreate, db: Session = Depends(get_db)
):
    vehicle = get_vehicle_or_404(vehicle_id, db)
    log = models.ServiceLog(vehicle_id=vehicle_id, **payload.model_dump())
    db.add(log)
    if log.odometer > vehicle.current_odometer:
        vehicle.current_odometer = log.odometer
    db.commit()
    db.refresh(log)
    return log


@router.get("/service-logs/{log_id}", response_model=schemas.ServiceLogRead)
def get_service_log(log_id: int, db: Session = Depends(get_db)):
    return get_service_log_or_404(log_id, db)


@router.put("/service-logs/{log_id}", response_model=schemas.ServiceLogRead)
def update_service_log(
    log_id: int, payload: schemas.ServiceLogUpdate, db: Session = Depends(get_db)
):
    log = get_service_log_or_404(log_id, db)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(log, field, value)
    if log.odometer > log.vehicle.current_odometer:
        log.vehicle.current_odometer = log.odometer
    db.commit()
    db.refresh(log)
    return log


@router.delete("/service-logs/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_service_log(log_id: int, db: Session = Depends(get_db)):
    log = get_service_log_or_404(log_id, db)
    db.delete(log)
    db.commit()
