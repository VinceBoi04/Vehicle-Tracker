// Vehicles page: list, add, edit, delete. Uses the shared vehicle context so any change
// here immediately updates the picker in the sidebar and every other page.
import { useState } from 'react'
import api from '../api/client'
import { useVehicles } from '../context/VehicleContext'
import { EmptyState, ErrorBanner, Field, Modal, Spinner } from '../components/ui'
import { odo, prettyDate } from '../utils/format'

const EMPTY = { make: '', model: '', year: new Date().getFullYear(), nickname: '', current_odometer: 0 }

export default function Vehicles() {
  const { vehicles, loading, error, refresh, selectVehicle, selectedId } = useVehicles()
  const [editing, setEditing] = useState(null) // null = modal closed; {} = new; {id...} = edit
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)

  const openNew = () => {
    setForm(EMPTY)
    setFormError(null)
    setEditing({})
  }

  const openEdit = (v) => {
    setForm({
      make: v.make,
      model: v.model,
      year: v.year,
      nickname: v.nickname ?? '',
      current_odometer: v.current_odometer,
    })
    setFormError(null)
    setEditing(v)
  }

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setFormError(null)
    try {
      const body = {
        make: form.make.trim(),
        model: form.model.trim(),
        year: Number(form.year),
        // An empty nickname field means "no nickname", which the API models as null.
        nickname: form.nickname.trim() || null,
        current_odometer: Number(form.current_odometer),
      }
      const saved = editing.id
        ? await api.updateVehicle(editing.id, body)
        : await api.createVehicle(body)
      await refresh()
      if (!editing.id) selectVehicle(saved.id) // jump straight to the vehicle just added
      setEditing(null)
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const remove = async (v) => {
    if (!window.confirm(`Delete ${v.nickname || `${v.year} ${v.make} ${v.model}`}? This also deletes its fuel and service logs.`))
      return
    try {
      await api.deleteVehicle(v.id)
      await refresh()
    } catch (err) {
      window.alert(err.message)
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Vehicles</h2>
          <p className="text-sm text-slate-500">Everything else in the app is scoped to one of these.</p>
        </div>
        <button className="btn-primary" onClick={openNew}>
          + Add vehicle
        </button>
      </header>

      <ErrorBanner message={error} onRetry={refresh} />

      {loading ? (
        <Spinner />
      ) : vehicles.length === 0 ? (
        <EmptyState
          title="No vehicles yet"
          body="Add a vehicle to start tracking its fuel and maintenance."
          action={
            <button className="btn-primary mt-2" onClick={openNew}>
              Add vehicle
            </button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {vehicles.map((v) => (
            <article
              key={v.id}
              className={`card flex flex-col gap-3 ${
                v.id === selectedId ? 'ring-2 ring-slate-900 ring-offset-2' : ''
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-slate-900">
                    {v.nickname || `${v.year} ${v.make} ${v.model}`}
                  </h3>
                  {v.id === selectedId && (
                    <span className="rounded-full bg-slate-900 px-2 py-0.5 text-xs font-medium text-white">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-500">
                  {v.year} {v.make} {v.model}
                </p>
              </div>
              <dl className="text-sm">
                <div className="flex justify-between py-1">
                  <dt className="text-slate-500">Odometer</dt>
                  <dd className="font-medium tabular-nums text-slate-900">{odo(v.current_odometer)}</dd>
                </div>
                <div className="flex justify-between py-1">
                  <dt className="text-slate-500">Added</dt>
                  <dd className="text-slate-700">{prettyDate(v.created_at)}</dd>
                </div>
              </dl>
              <div className="mt-auto flex flex-wrap gap-2">
                <button className="btn-secondary" onClick={() => selectVehicle(v.id)} disabled={v.id === selectedId}>
                  Select
                </button>
                <button className="btn-secondary" onClick={() => openEdit(v)}>
                  Edit
                </button>
                <button className="btn-danger ml-auto" onClick={() => remove(v)}>
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal
        open={editing !== null}
        title={editing?.id ? 'Edit vehicle' : 'Add vehicle'}
        onClose={() => setEditing(null)}
      >
        <form onSubmit={submit} className="space-y-4">
          <ErrorBanner message={formError} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Make">
              <input className="input" required value={form.make} onChange={setField('make')} placeholder="Honda" />
            </Field>
            <Field label="Model">
              <input className="input" required value={form.model} onChange={setField('model')} placeholder="Civic" />
            </Field>
            <Field label="Year">
              <input
                className="input"
                type="number"
                required
                min="1900"
                max="2100"
                value={form.year}
                onChange={setField('year')}
              />
            </Field>
            <Field label="Current odometer">
              <input
                className="input"
                type="number"
                min="0"
                step="0.1"
                value={form.current_odometer}
                onChange={setField('current_odometer')}
              />
            </Field>
          </div>
          <Field label="Nickname" hint="Optional — shown instead of make/model where space is tight.">
            <input className="input" value={form.nickname} onChange={setField('nickname')} placeholder="Daily driver" />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save vehicle'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
