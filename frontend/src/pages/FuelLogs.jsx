// Fuel logs for the selected vehicle: table plus an add/edit modal.
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/client'
import { useVehicles } from '../context/VehicleContext'
import { EmptyState, ErrorBanner, Field, Modal, Spinner } from '../components/ui'
import { money, num, odo, prettyDate, todayISO, vehicleShortName } from '../utils/format'

const EMPTY = {
  date: todayISO(),
  odometer: '',
  gallons: '',
  price_per_unit: '',
  total_cost: '',
  is_full_tank: true,
  notes: '',
}

export default function FuelLogs() {
  const { selectedId, selectedVehicle, vehicles, refresh: refreshVehicles } = useVehicles()
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)

  const load = useCallback(async () => {
    if (selectedId == null) return
    setLoading(true)
    try {
      setLogs(await api.listFuelLogs(selectedId))
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [selectedId])

  useEffect(() => {
    load()
  }, [load])

  const openNew = () => {
    // Pre-fill the odometer with the vehicle's current reading — the next fill-up is
    // almost always at or above it, so it saves typing and avoids typos.
    setForm({ ...EMPTY, odometer: selectedVehicle?.current_odometer ?? '' })
    setFormError(null)
    setEditing({})
  }

  const openEdit = (log) => {
    setForm({
      date: log.date,
      odometer: log.odometer,
      gallons: log.gallons,
      price_per_unit: log.price_per_unit,
      total_cost: log.total_cost,
      is_full_tank: log.is_full_tank,
      notes: log.notes ?? '',
    })
    setFormError(null)
    setEditing(log)
  }

  // Volume × price and total cost are redundant by design (receipts show all three, and
  // rounding means they rarely multiply out exactly). Auto-fill total from the other two
  // as a convenience, but leave it editable so the receipt total always wins.
  const updateAmounts = (patch) => {
    setForm((f) => {
      const next = { ...f, ...patch }
      const gallons = parseFloat(next.gallons)
      const price = parseFloat(next.price_per_unit)
      if (('gallons' in patch || 'price_per_unit' in patch) && gallons > 0 && price > 0) {
        next.total_cost = (gallons * price).toFixed(2)
      }
      return next
    })
  }

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setFormError(null)
    try {
      const body = {
        date: form.date,
        odometer: Number(form.odometer),
        gallons: Number(form.gallons),
        price_per_unit: Number(form.price_per_unit),
        total_cost: Number(form.total_cost),
        is_full_tank: form.is_full_tank,
        notes: form.notes.trim() || null,
      }
      if (editing.id) await api.updateFuelLog(editing.id, body)
      else await api.createFuelLog(selectedId, body)
      await load()
      await refreshVehicles() // the backend may have bumped the vehicle's odometer
      setEditing(null)
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const remove = async (log) => {
    if (!window.confirm(`Delete the fill-up from ${prettyDate(log.date)}?`)) return
    try {
      await api.deleteFuelLog(log.id)
      await load()
    } catch (err) {
      window.alert(err.message)
    }
  }

  if (vehicles.length === 0) {
    return (
      <EmptyState
        title="No vehicles yet"
        body="Fuel logs belong to a vehicle, so add one first."
        action={
          <Link to="/vehicles" className="btn-primary mt-2">
            Add a vehicle
          </Link>
        }
      />
    )
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Fuel Logs</h2>
          <p className="text-sm text-slate-500">{vehicleShortName(selectedVehicle)}</p>
        </div>
        <button className="btn-primary" onClick={openNew}>
          + Add fill-up
        </button>
      </header>

      <ErrorBanner message={error} onRetry={load} />

      {loading ? (
        <Spinner />
      ) : logs.length === 0 ? (
        <EmptyState
          title="No fill-ups logged"
          body="Add two or more full-tank fill-ups and the dashboard will start charting fuel economy."
          action={
            <button className="btn-primary mt-2" onClick={openNew}>
              Add fill-up
            </button>
          }
        />
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="th">Date</th>
                <th className="th">Odometer</th>
                <th className="th">Volume (L)</th>
                <th className="th">Price/unit ($/L)</th>
                <th className="th">Total</th>
                <th className="th">Tank</th>
                <th className="th">Notes</th>
                <th className="th text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="td">{prettyDate(log.date)}</td>
                  <td className="td tabular-nums">{odo(log.odometer)}</td>
                  <td className="td tabular-nums">{num(log.gallons, 2)}</td>
                  <td className="td tabular-nums">{money(log.price_per_unit)}</td>
                  <td className="td font-medium tabular-nums">{money(log.total_cost)}</td>
                  <td className="td">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        log.is_full_tank ? 'bg-slate-100 text-slate-700' : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {log.is_full_tank ? 'Full' : 'Partial'}
                    </span>
                  </td>
                  <td className="td max-w-[16rem] truncate text-slate-500">{log.notes || '—'}</td>
                  <td className="td text-right">
                    <div className="flex justify-end gap-2">
                      <button className="btn-secondary" onClick={() => openEdit(log)}>
                        Edit
                      </button>
                      <button className="btn-danger" onClick={() => remove(log)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={editing !== null}
        title={editing?.id ? 'Edit fill-up' : 'Add fill-up'}
        onClose={() => setEditing(null)}
      >
        <form onSubmit={submit} className="space-y-4">
          <ErrorBanner message={formError} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Date">
              <input
                className="input"
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              />
            </Field>
            <Field label="Odometer">
              <input
                className="input"
                type="number"
                required
                min="0"
                step="0.1"
                value={form.odometer}
                onChange={(e) => setForm((f) => ({ ...f, odometer: e.target.value }))}
              />
            </Field>
            <Field label="Volume (L)">
              <input
                className="input"
                type="number"
                required
                min="0.001"
                step="0.001"
                value={form.gallons}
                onChange={(e) => updateAmounts({ gallons: e.target.value })}
              />
            </Field>
            <Field label="Price per unit ($/L)">
              <input
                className="input"
                type="number"
                required
                min="0"
                step="0.001"
                value={form.price_per_unit}
                onChange={(e) => updateAmounts({ price_per_unit: e.target.value })}
              />
            </Field>
            <Field label="Total cost" hint="Auto-calculated; edit to match the receipt.">
              <input
                className="input"
                type="number"
                required
                min="0"
                step="0.01"
                value={form.total_cost}
                onChange={(e) => setForm((f) => ({ ...f, total_cost: e.target.value }))}
              />
            </Field>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300"
                  checked={form.is_full_tank}
                  onChange={(e) => setForm((f) => ({ ...f, is_full_tank: e.target.checked }))}
                />
                Filled the tank completely
              </label>
            </div>
          </div>
          <Field label="Notes" hint="Only full-tank fill-ups anchor the fuel-economy calculation.">
            <input
              className="input"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Station, fuel grade, road trip…"
            />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save fill-up'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
