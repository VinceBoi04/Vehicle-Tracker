"""SQLAlchemy ORM models."""
# Module-style import: `date` is also a column name below, which would shadow the type.
import datetime as dt

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class Vehicle(Base):
    __tablename__ = "vehicles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    make: Mapped[str] = mapped_column(String(80), nullable=False)
    model: Mapped[str] = mapped_column(String(80), nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    nickname: Mapped[str | None] = mapped_column(String(80), nullable=True)
    current_odometer: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime, nullable=False, default=lambda: dt.datetime.now(dt.timezone.utc)
    )

    # Deleting a vehicle removes its logs too - orphaned logs would be meaningless.
    fuel_logs: Mapped[list["FuelLog"]] = relationship(
        back_populates="vehicle", cascade="all, delete-orphan"
    )
    service_logs: Mapped[list["ServiceLog"]] = relationship(
        back_populates="vehicle", cascade="all, delete-orphan"
    )


class FuelLog(Base):
    __tablename__ = "fuel_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    vehicle_id: Mapped[int] = mapped_column(
        ForeignKey("vehicles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    date: Mapped[dt.date] = mapped_column(Date, nullable=False)
    odometer: Mapped[float] = mapped_column(Float, nullable=False)
    # "units" = gallons in imperial mode, liters in metric mode.
    gallons: Mapped[float] = mapped_column(Float, nullable=False)
    price_per_unit: Mapped[float] = mapped_column(Float, nullable=False)
    total_cost: Mapped[float] = mapped_column(Float, nullable=False)
    # Only full-tank fill-ups can anchor a fuel-economy calculation; see routers/analytics.py.
    is_full_tank: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    vehicle: Mapped[Vehicle] = relationship(back_populates="fuel_logs")


class ServiceLog(Base):
    __tablename__ = "service_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    vehicle_id: Mapped[int] = mapped_column(
        ForeignKey("vehicles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    date: Mapped[dt.date] = mapped_column(Date, nullable=False)
    odometer: Mapped[float] = mapped_column(Float, nullable=False)
    service_type: Mapped[str] = mapped_column(String(120), nullable=False)
    cost: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Either or both may be set; both are optional because not every service repeats.
    next_due_odometer: Mapped[float | None] = mapped_column(Float, nullable=True)
    next_due_date: Mapped[dt.date | None] = mapped_column(Date, nullable=True)

    vehicle: Mapped[Vehicle] = relationship(back_populates="service_logs")
