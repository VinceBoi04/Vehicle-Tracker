// Service logs for the selected vehicle, with a due-soon / overdue badge on each row.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/client'
import { useVehicles } from '../context/VehicleContext'
import { EmptyState, ErrorBanner, Field, Modal, Spinner, StatusBadge } from '../components/ui'
import { money, odo, prettyDate, todayISO, vehicleShortName } from '../utils/format'

const EMPTY = {
  date: todayISO(),
  odometer: '',
  service_type: '',
  cost: '',
  notes: '',
  next_due_odometer: '',
  next_due_date: '',
}

// Common services, offered as datalist suggestions. The field stays free text: the
// backend groups "due" status by service_type, so consistent naming keeps history tidy.
const SERVICE_SUGGESTIONS = [
  'Oil Change',
  'Tire Rotation',
  'Brake Pads',
  'Air Filter',
  'Cabin Air Filter',
  'Transmission Fluid',
  'Coolant Flush',
  'Spark Plugs',
  'Battery',
  'State Inspection',
  'Alignment',
]

export default function ServiceLogs() {
  const { selectedId, selectedVehicle, vehicles, refresh: refreshVehicles } = useVehicles()
  const [logs, setLogs] = useState([])
  const [due, setDue] = useState(null)
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
      const [logsData, dueData] = await Promise.all([
        api.listServiceLogs(selectedId),
        api.maintenanceDue(selectedId),
      ])
      setLogs(logsData)
      setDue(dueData)
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

  // The maintenance endpoint only reports the newest record per service type, so index
  // its results by service_log_id — a row with no entry is superseded history, not "OK".
  const statusById = useMemo(() => {
    const map = new Map()
    due?.items.forEach((item) => map.set(item.service_log_id, item))
    return map
  }, [due])

  const openNew = () => {
    setForm({ ...EMPTY, odometer: selectedVehicle?.current_odometer ?? '' })
    setFormError(null)
    setEditing({})
  }

  const openEdit = (log) => {
    setForm({
      date: log.date,
      odometer: log.odometer,
      service_type: log.service_type,
      cost: log.cost,
      notes: log.notes ?? '',
      next_due_odometer: log.next_due_odometer ?? '',
      next_due_date: log.next_due_date ?? '',
    })
    setFormError(null)
    setEditing(log)
  }

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setFormError(null)
    try {
      const body = {
        date: form.date,
        odometer: Number(form.odometer),
        service_type: form.service_type.trim(),
        cost: Number(form.cost || 0),
        notes: form.notes.trim() || null,
        // Blank means "nothing scheduled on this axis"; the API expects null, not "".
        next_due_odometer: form.next_due_odometer === '' ? null : Number(form.next_due_odometer),
        next_due_date: form.next_due_date === '' ? null : form.next_due_date,
      }
      if (editing.id) await api.updateServiceLog(editing.id, body)
      else await api.createServiceLog(selectedId, body)
      await load()
      await refreshVehicles()
      setEditing(null)
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const remove = async (log) => {
    if (!window.confirm(`Delete the "${log.service_type}" record from ${prettyDate(log.date)}?`)) return
    try {
      await api.deleteServiceLog(log.id)
      await load()
    } catch (err) {
      window.alert(err.message)
    }
  }

  if (vehicles.length === 0) {
    return (
      <EmptyState
        title="No vehicles yet"
        body="Service logs belong to a vehicle, so add one first."
        action={
          <Link to="/vehicles" className="btn-primary mt-2">
            Add a vehicle
          </Link>
        }
      />
    )
  }

  const attention = due?.items.filter((i) => i.status !== 'ok') ?? []

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Service Logs</h2>
          <p className="text-sm text-slate-500">
            {vehicleShortName(selectedVehicle)} · {odo(selectedVehicle?.current_odometer)} on the odometer
          </p>
        </div>
        <button className="btn-primary" onClick={openNew}>
          + Add service
        </button>
      </header>

      <ErrorBanner message={error} onRetry={load} />

      {attention.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">
            {attention.length} item{attention.length > 1 ? 's' : ''} need attention
          </p>
          <ul className="mt-2 space-y-1 text-sm text-amber-800">
            {attention.map((item) => (
              <li key={item.service_log_id} className="flex flex-wrap items-center gap-2">
                <StatusBadge status={item.status} />
                <span className="font-medium">{item.service_type}</span>
                <span className="text-amber-700">— {item.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {loading ? (
        <Spinner />
      ) : logs.length === 0 ? (
        <EmptyState
          title="No service records"
          body="Log a service and set a next-due odometer or date to get reminders here."
          action={
            <button className="btn-primary mt-2" onClick={openNew}>
              Add service
            </button>
          }
        />
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="th">Date</th>
                <th className="th">Service</th>
                <th className="th">Odometer</th>
                <th className="th">Cost</th>
                <th className="th">Next due</th>
                <th className="th">Status</th>
                <th className="th">Notes</th>
                <th className="th text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((log) => {
                const item = statusById.get(log.id)
                return (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="td">{prettyDate(log.date)}</td>
                    <td className="td font-medium text-slate-900">{log.service_type}</td>
                    <td className="td tabular-nums">{odo(log.odometer)}</td>
                    <td className="td tabular-nums">{money(log.cost)}</td>
                    <td className="td text-slate-500">
                      {log.next_due_odometer == null && log.next_due_date == null
                        ? '—'
                        : [
                            log.next_due_odometer != null ? odo(log.next_due_odometer) : null,
                            log.next_due_date ? prettyDate(log.next_due_date) : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                    </td>
                    <td className="td">
                      {item ? (
                        <span title={item.reason}>
                          <StatusBadge status={item.status} />
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">
                          {log.next_due_odometer == null && log.next_due_date == null
                            ? 'Not scheduled'
                            : 'Superseded'}
                        </span>
                      )}
                    </td>
                    <td className="td max-w-[14rem] truncate text-slate-500">{log.notes || '—'}</td>
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
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={editing !== null}
        title={editing?.id ? 'Edit service record' : 'Add service record'}
        onClose={() => setEditing(null)}
      >
        <form onSubmit={submit} className="space-y-4">
          <ErrorBanner message={formError} />
          <Field label="Service type" hint="Reuse the same wording so repeat services group together.">
            <input
              className="input"
              required
              list="service-types"
              value={form.service_type}
              onChange={(e) => setForm((f) => ({ ...f, service_type: e.target.value }))}
              placeholder="Oil Change"
            />
            <datalist id="service-types">
              {SERVICE_SUGGESTIONS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </Field>
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
            <Field label="Cost">
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                value={form.cost}
                onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))}
                placeholder="0.00"
              />
            </Field>
            <Field label="Next due odometer" hint="Optional">
              <input
                className="input"
                type="number"
                min="0"
                step="0.1"
                value={form.next_due_odometer}
                onChange={(e) => setForm((f) => ({ ...f, next_due_odometer: e.target.value }))}
              />
            </Field>
          </div>
          <Field label="Next due date" hint="Optional — either or both due fields can be set.">
            <input
              className="input"
              type="date"
              value={form.next_due_date}
              onChange={(e) => setForm((f) => ({ ...f, next_due_date: e.target.value }))}
            />
          </Field>
          <Field label="Notes">
            <input
              className="input"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Shop, parts used, warranty…"
            />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save service'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
