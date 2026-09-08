// Dashboard: headline numbers for the selected vehicle plus two charts —
// fuel economy over time (line) and spend per month split by fuel vs service (bar).
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import api from '../api/client'
import { useVehicles } from '../context/VehicleContext'
import { EmptyState, ErrorBanner, Spinner, StatCard, StatusBadge } from '../components/ui'
import { money, monthKey, monthLabel, num, odo, prettyDate, shortDate, vehicleShortName } from '../utils/format'

// Two categorical series only, so slots 1 and 2 of the palette: blue and orange.
const SERIES = { primary: '#2a78d6', secondary: '#eb6834' }
const AXIS = '#94a3b8'
const GRID = '#e2e8f0'

// Shared tooltip so both charts present values the same way.
function ChartTooltip({ active, payload, label, formatter }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold text-slate-900">{label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} className="flex items-center gap-2 text-slate-600">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span>{entry.name}</span>
          <span className="ml-auto font-medium tabular-nums text-slate-900">
            {formatter(entry.value)}
          </span>
        </p>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const { selectedVehicle, selectedId, vehicles, loading: vehiclesLoading } = useVehicles()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (selectedId == null) {
      setData(null)
      return
    }
    let cancelled = false
    setLoading(true)
    // One round trip per data source; Promise.all keeps them parallel.
    Promise.all([
      api.fuelEconomy(selectedId),
      api.maintenanceDue(selectedId),
      api.listFuelLogs(selectedId),
      api.listServiceLogs(selectedId),
    ])
      .then(([economy, maintenance, fuelLogs, serviceLogs]) => {
        if (cancelled) return
        setData({ economy, maintenance, fuelLogs, serviceLogs })
        setError(null)
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false))
    // The cleanup flag stops a slow response for an old vehicle overwriting a newer one.
    return () => {
      cancelled = true
    }
  }, [selectedId])

  // Roll fuel and service costs up into one row per calendar month.
  const monthlySpend = useMemo(() => {
    if (!data) return []
    const buckets = new Map()
    const bump = (iso, key, amount) => {
      const m = monthKey(iso)
      if (!buckets.has(m)) buckets.set(m, { month: m, fuel: 0, service: 0 })
      buckets.get(m)[key] += amount
    }
    data.fuelLogs.forEach((l) => bump(l.date, 'fuel', l.total_cost))
    data.serviceLogs.forEach((l) => bump(l.date, 'service', l.cost))
    return [...buckets.values()]
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12) // last 12 months keeps the axis readable
      .map((b) => ({
        ...b,
        label: monthLabel(b.month),
        fuel: Math.round(b.fuel * 100) / 100,
        service: Math.round(b.service * 100) / 100,
      }))
  }, [data])

  const totals = useMemo(() => {
    if (!data) return null
    const fuel = data.fuelLogs.reduce((sum, l) => sum + l.total_cost, 0)
    const service = data.serviceLogs.reduce((sum, l) => sum + l.cost, 0)
    return { fuel, service, all: fuel + service }
  }, [data])

  const economySeries = useMemo(
    () =>
      data?.economy.points.map((p) => ({
        ...p,
        label: shortDate(p.date),
      })) ?? [],
    [data],
  )

  const upcoming = data?.maintenance.items.filter((i) => i.status !== 'ok') ?? []

  if (vehiclesLoading) return <Spinner />
  if (vehicles.length === 0) {
    return (
      <EmptyState
        title="No vehicles yet"
        body="Add your first vehicle to start logging fuel fill-ups and service history."
        action={
          <Link to="/vehicles" className="btn-primary mt-2">
            Add a vehicle
          </Link>
        }
      />
    )
  }

  const label = data?.economy.economy_label ?? 'L/100km'

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard</h2>
        <p className="text-sm text-slate-500">
          {vehicleShortName(selectedVehicle)} · {odo(selectedVehicle?.current_odometer)} on the odometer
        </p>
      </header>

      <ErrorBanner message={error} />
      {loading && !data ? (
        <Spinner />
      ) : !data ? null : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Total spent"
              value={money(totals.all)}
              sub={`${money(totals.fuel)} fuel · ${money(totals.service)} service`}
            />
            <StatCard
              label={`Average ${label}`}
              value={data.economy.all_time_average != null ? num(data.economy.all_time_average, 2) : '—'}
              sub={
                data.economy.latest != null
                  ? `Latest fill-up: ${num(data.economy.latest, 2)} ${label}`
                  : 'Needs two full-tank fill-ups'
              }
            />
            <StatCard
              label="Fill-ups logged"
              value={data.fuelLogs.length}
              sub={`${data.serviceLogs.length} service records`}
            />
            <StatCard
              label="Needs attention"
              value={upcoming.length}
              accent={
                upcoming.some((i) => i.status === 'overdue')
                  ? 'text-red-600'
                  : upcoming.length
                    ? 'text-amber-600'
                    : 'text-emerald-600'
              }
              sub={upcoming.length ? 'Service items due soon or overdue' : 'Everything is up to date'}
            />
          </section>

          <section className="card">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h3 className="font-semibold text-slate-900">Fuel economy over time</h3>
                <p className="text-sm text-slate-500">
                  Measured between consecutive full-tank fill-ups, in {label}
                </p>
              </div>
              {data.economy.all_time_average != null && (
                <p className="text-sm text-slate-500">
                  All-time {num(data.economy.all_time_average, 2)} {label}
                </p>
              )}
            </div>
            {economySeries.length === 0 ? (
              <p className="py-12 text-center text-sm text-slate-500">
                Log at least two full-tank fill-ups to see economy here.
              </p>
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={economySeries} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 12, fill: AXIS }}
                      tickLine={false}
                      axisLine={{ stroke: GRID }}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: AXIS }}
                      tickLine={false}
                      axisLine={false}
                      width={48}
                      // A zero-based axis flattens the curve; economy only varies in a narrow band,
                      // so let recharts pick a domain padded around the actual values.
                      domain={['dataMin - 2', 'dataMax + 2']}
                    />
                    <Tooltip
                      cursor={{ stroke: AXIS, strokeDasharray: '3 3' }}
                      content={<ChartTooltip formatter={(v) => `${num(v, 2)} ${label}`} />}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                    <Line
                      type="monotone"
                      dataKey="economy"
                      name={`Per fill-up (${label})`}
                      stroke={SERIES.primary}
                      strokeWidth={2}
                      dot={{ r: 4, strokeWidth: 0, fill: SERIES.primary }}
                      activeDot={{ r: 6 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="rolling_average"
                      name={`${data.economy.rolling_window}-fill rolling average`}
                      stroke={SERIES.secondary}
                      strokeWidth={2}
                      strokeDasharray="5 4"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          <div className="grid gap-6 xl:grid-cols-5">
            <section className="card xl:col-span-3">
              <h3 className="font-semibold text-slate-900">Monthly spend</h3>
              <p className="mb-4 text-sm text-slate-500">Fuel and service costs, last 12 months</p>
              {monthlySpend.length === 0 ? (
                <p className="py-12 text-center text-sm text-slate-500">No costs logged yet.</p>
              ) : (
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlySpend} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
                      <CartesianGrid stroke={GRID} vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 12, fill: AXIS }}
                        tickLine={false}
                        axisLine={{ stroke: GRID }}
                      />
                      <YAxis
                        tick={{ fontSize: 12, fill: AXIS }}
                        tickLine={false}
                        axisLine={false}
                        width={56}
                        tickFormatter={(v) => `$${v}`}
                      />
                      <Tooltip
                        cursor={{ fill: 'rgba(148,163,184,0.12)' }}
                        content={<ChartTooltip formatter={money} />}
                      />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                      {/* Stacked so each bar reads as that month's total spend. */}
                      <Bar dataKey="fuel" name="Fuel" stackId="spend" fill={SERIES.primary} />
                      <Bar
                        dataKey="service"
                        name="Service"
                        stackId="spend"
                        fill={SERIES.secondary}
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>

            <section className="card xl:col-span-2">
              <div className="mb-4 flex items-baseline justify-between">
                <h3 className="font-semibold text-slate-900">Upcoming maintenance</h3>
                <Link to="/service" className="text-sm font-medium text-slate-500 hover:text-slate-900">
                  View all →
                </Link>
              </div>
              {upcoming.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">
                  Nothing due within {data.maintenance.days_warning_threshold} days or{' '}
                  {odo(data.maintenance.odometer_warning_threshold)} km.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {upcoming.map((item) => (
                    <li key={item.service_log_id} className="flex items-start gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-slate-900">{item.service_type}</p>
                        <p className="text-sm text-slate-500">{item.reason}</p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          Last done {prettyDate(item.last_serviced_date)} at{' '}
                          {odo(item.last_serviced_odometer)}
                        </p>
                      </div>
                      <StatusBadge status={item.status} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  )
}
