"""Pydantic request/response schemas.

Each resource has a Base (shared fields), a Create, an Update (all fields optional so
PATCH-style partial updates work), and a Read model configured with from_attributes so
SQLAlchemy objects serialize directly.
"""
# Imported as a module (not `from datetime import date`) because several schemas have a
# field literally named `date`; a bare `date` type would be shadowed by that field.
import datetime as dt

from pydantic import BaseModel, ConfigDict, Field


# --------------------------------------------------------------------------- Vehicle
class VehicleBase(BaseModel):
    make: str = Field(..., min_length=1, max_length=80)
    model: str = Field(..., min_length=1, max_length=80)
    year: int = Field(..., ge=1900, le=2100)
    nickname: str | None = Field(None, max_length=80)
    current_odometer: float = Field(0, ge=0)


class VehicleCreate(VehicleBase):
    pass


class VehicleUpdate(BaseModel):
    make: str | None = Field(None, min_length=1, max_length=80)
    model: str | None = Field(None, min_length=1, max_length=80)
    year: int | None = Field(None, ge=1900, le=2100)
    nickname: str | None = Field(None, max_length=80)
    current_odometer: float | None = Field(None, ge=0)


class VehicleRead(VehicleBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: dt.datetime


# -------------------------------------------------------------------------- Fuel log
class FuelLogBase(BaseModel):
    date: dt.date
    odometer: float = Field(..., ge=0)
    gallons: float = Field(..., gt=0, description="Gallons (imperial) or liters (metric)")
    price_per_unit: float = Field(..., ge=0)
    total_cost: float = Field(..., ge=0)
    is_full_tank: bool = True
    notes: str | None = None


class FuelLogCreate(FuelLogBase):
    pass


class FuelLogUpdate(BaseModel):
    date: dt.date | None = None
    odometer: float | None = Field(None, ge=0)
    gallons: float | None = Field(None, gt=0)
    price_per_unit: float | None = Field(None, ge=0)
    total_cost: float | None = Field(None, ge=0)
    is_full_tank: bool | None = None
    notes: str | None = None


class FuelLogRead(FuelLogBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    vehicle_id: int


# ----------------------------------------------------------------------- Service log
class ServiceLogBase(BaseModel):
    date: dt.date
    odometer: float = Field(..., ge=0)
    service_type: str = Field(..., min_length=1, max_length=120)
    cost: float = Field(0, ge=0)
    notes: str | None = None
    next_due_odometer: float | None = Field(None, ge=0)
    next_due_date: dt.date | None = None


class ServiceLogCreate(ServiceLogBase):
    pass


class ServiceLogUpdate(BaseModel):
    date: dt.date | None = None
    odometer: float | None = Field(None, ge=0)
    service_type: str | None = Field(None, min_length=1, max_length=120)
    cost: float | None = Field(None, ge=0)
    notes: str | None = None
    next_due_odometer: float | None = Field(None, ge=0)
    next_due_date: dt.date | None = None


class ServiceLogRead(ServiceLogBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    vehicle_id: int


# ------------------------------------------------------------------------- Analytics
class FuelEconomyPoint(BaseModel):
    """One computed tank-to-tank economy reading."""

    date: dt.date
    odometer: float
    miles_driven: float = Field(..., description="Distance covered since the previous full tank")
    units_used: float = Field(..., description="Fuel burned over that distance")
    economy: float = Field(..., description="MPG (imperial) or L/100km (metric)")
    cost: float = Field(..., description="Cost of the fill-ups attributed to this interval")
    rolling_average: float = Field(..., description="Trailing average of the last N readings")


class FuelEconomyResponse(BaseModel):
    vehicle_id: int
    units: str = Field(..., description="'imperial' or 'metric'")
    economy_label: str = Field(..., description="'MPG' or 'L/100km'")
    rolling_window: int
    all_time_average: float | None
    latest: float | None
    points: list[FuelEconomyPoint]


class MaintenanceItem(BaseModel):
    service_log_id: int
    service_type: str
    last_serviced_date: dt.date
    last_serviced_odometer: float
    next_due_odometer: float | None
    next_due_date: dt.date | None
    miles_remaining: float | None = Field(None, description="Negative when overdue by distance")
    days_remaining: int | None = Field(None, description="Negative when overdue by date")
    status: str = Field(..., description="'overdue' | 'due_soon' | 'ok'")
    reason: str


class MaintenanceDueResponse(BaseModel):
    vehicle_id: int
    current_odometer: float
    as_of: dt.date
    odometer_warning_threshold: float
    days_warning_threshold: int
    items: list[MaintenanceItem]
