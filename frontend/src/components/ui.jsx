// Small presentational building blocks reused across pages.
import { useEffect } from 'react'

export function StatusBadge({ status }) {
  // Maps the backend status strings to colour + wording.
  const styles = {
    overdue: 'bg-red-100 text-red-800 ring-red-200',
    due_soon: 'bg-amber-100 text-amber-800 ring-amber-200',
    ok: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  }
  const labels = { overdue: 'Overdue', due_soon: 'Due soon', ok: 'OK' }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${
        styles[status] ?? 'bg-slate-100 text-slate-700 ring-slate-200'
      }`}
    >
      {labels[status] ?? status}
    </span>
  )
}

export function StatCard({ label, value, sub, accent = 'text-slate-900' }) {
  return (
    <div className="card">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-2 text-3xl font-semibold tabular-nums ${accent}`}>{value}</p>
      {sub && <p className="mt-1 text-sm text-slate-500">{sub}</p>}
    </div>
  )
}

export function Modal({ open, title, onClose, children }) {
  // Close on Escape; the effect is a no-op while the modal is closed.
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:items-center">
      {/* Clicking the backdrop closes; clicks inside the panel must not bubble up to it. */}
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  )
}

export function ErrorBanner({ message, onRetry }) {
  if (!message) return null
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      <span>{message}</span>
      {onRetry && (
        <button onClick={onRetry} className="font-semibold underline">
          Retry
        </button>
      )}
    </div>
  )
}

export function EmptyState({ title, body, action }) {
  return (
    <div className="card flex flex-col items-center gap-2 py-12 text-center">
      <p className="font-medium text-slate-700">{title}</p>
      {body && <p className="max-w-md text-sm text-slate-500">{body}</p>}
      {action}
    </div>
  )
}

export function Spinner({ label = 'Loading…' }) {
  return <p className="py-10 text-center text-sm text-slate-500">{label}</p>
}
