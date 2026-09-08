"""CRUD endpoints for vehicles."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/vehicles", tags=["vehicles"])


def get_vehicle_or_404(vehicle_id: int, db: Session) -> models.Vehicle:
    vehicle = db.get(models.Vehicle, vehicle_id)
    if vehicle is None:
        raise HTTPException(status_code=404, detail=f"Vehicle {vehicle_id} not found")
    return vehicle


@router.get("", response_model=list[schemas.VehicleRead])
def list_vehicles(db: Session = Depends(get_db)):
    return db.scalars(select(models.Vehicle).order_by(models.Vehicle.id)).all()


@router.post("", response_model=schemas.VehicleRead, status_code=status.HTTP_201_CREATED)
def create_vehicle(payload: schemas.VehicleCreate, db: Session = Depends(get_db)):
    vehicle = models.Vehicle(**payload.model_dump())
    db.add(vehicle)
    db.commit()
    db.refresh(vehicle)
    return vehicle


@router.get("/{vehicle_id}", response_model=schemas.VehicleRead)
def get_vehicle(vehicle_id: int, db: Session = Depends(get_db)):
    return get_vehicle_or_404(vehicle_id, db)


@router.put("/{vehicle_id}", response_model=schemas.VehicleRead)
def update_vehicle(vehicle_id: int, payload: schemas.VehicleUpdate, db: Session = Depends(get_db)):
    vehicle = get_vehicle_or_404(vehicle_id, db)
    # exclude_unset means omitted fields keep their current value (partial update).
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(vehicle, field, value)
    db.commit()
    db.refresh(vehicle)
    return vehicle


@router.delete("/{vehicle_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_vehicle(vehicle_id: int, db: Session = Depends(get_db)):
    vehicle = get_vehicle_or_404(vehicle_id, db)
    db.delete(vehicle)  # cascades to fuel + service logs
    db.commit()
