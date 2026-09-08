// Small formatting helpers shared by every page, so numbers look the same everywhere.

const currencyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const numberFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 })

export const money = (n) => (n == null || Number.isNaN(n) ? '—' : currencyFmt.format(n))
export const num = (n, digits = 1) =>
  n == null || Number.isNaN(n)
    ? '—'
    : new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(n)
export const odo = (n) => (n == null ? '—' : numberFmt.format(n))

// Dates come back from the API as plain "YYYY-MM-DD" strings. Parsing those with
// `new Date(str)` treats them as UTC midnight, which renders as the previous day in
// negative-offset timezones — so split the parts and build a local date instead.
export const parseDate = (iso) => {
  if (!iso) return null
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const prettyDate = (iso) => {
  const d = parseDate(iso)
  return d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
}

export const shortDate = (iso) => {
  const d = parseDate(iso)
  return d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''
}

export const monthKey = (iso) => iso?.slice(0, 7) ?? '' // "2026-04"

export const monthLabel = (key) => {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

export const todayISO = () => {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export const vehicleName = (v) =>
  v ? (v.nickname ? `${v.nickname} (${v.year} ${v.make} ${v.model})` : `${v.year} ${v.make} ${v.model}`) : ''

export const vehicleShortName = (v) => (v ? v.nickname || `${v.year} ${v.make} ${v.model}` : '')
