// App shell: sidebar navigation (collapses to a top bar on small screens), a global
// vehicle picker, and the routed page content.
import { useState } from 'react'
import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { VehicleProvider, useVehicles } from './context/VehicleContext'
import Dashboard from './pages/Dashboard'
import Vehicles from './pages/Vehicles'
import FuelLogs from './pages/FuelLogs'
import ServiceLogs from './pages/ServiceLogs'
import { vehicleName } from './utils/format'

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: '📊' },
  { to: '/vehicles', label: 'Vehicles', icon: '🚗' },
  { to: '/fuel', label: 'Fuel Logs', icon: '⛽' },
  { to: '/service', label: 'Service Logs', icon: '🔧' },
]

function NavLinks({ onNavigate }) {
  return (
    <nav className="flex gap-1 lg:flex-col">
      {NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex flex-1 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition lg:flex-none ${
              isActive
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
            }`
          }
        >
          <span aria-hidden="true">{item.icon}</span>
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

// Global vehicle selector. Fuel/Service/Dashboard all read the selection from context.
function VehiclePicker() {
  const { vehicles, selectedId, selectVehicle } = useVehicles()
  if (vehicles.length === 0) return null
  return (
    <div className="min-w-0">
      <label className="label" htmlFor="vehicle-picker">
        Active vehicle
      </label>
      <select
        id="vehicle-picker"
        className="input"
        value={selectedId ?? ''}
        onChange={(e) => selectVehicle(Number(e.target.value))}
      >
        {vehicles.map((v) => (
          <option key={v.id} value={v.id}>
            {vehicleName(v)}
          </option>
        ))}
      </select>
    </div>
  )
}

function Shell() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="min-h-screen lg:flex">
      {/* Sidebar on desktop, collapsible top bar on mobile. */}
      <aside className="border-b border-slate-200 bg-white lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between p-4">
          <div>
            <h1 className="text-base font-bold tracking-tight text-slate-900">Vehicle Tracker</h1>
            <p className="text-xs text-slate-500">Fuel &amp; maintenance</p>
          </div>
          <button
            className="btn-secondary lg:hidden"
            onClick={() => setMenuOpen((o) => !o)}
            aria-expanded={menuOpen}
          >
            Menu
          </button>
        </div>
        <div className={`${menuOpen ? 'block' : 'hidden'} space-y-4 px-4 pb-4 lg:block`}>
          <NavLinks onNavigate={() => setMenuOpen(false)} />
          <VehiclePicker />
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/vehicles" element={<Vehicles />} />
          <Route path="/fuel" element={<FuelLogs />} />
          <Route path="/service" element={<ServiceLogs />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <VehicleProvider>
      <Shell />
    </VehicleProvider>
  )
}
