// Holds the vehicle list and the currently selected vehicle.
// Every page except Vehicles is scoped to one vehicle, so keeping the selection here
// means switching pages preserves it, and the picker in the header only has to be built once.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import api from '../api/client'

const VehicleContext = createContext(null)

const STORAGE_KEY = 'vt.selectedVehicleId'

export function VehicleProvider({ children }) {
  const [vehicles, setVehicles] = useState([])
  const [selectedId, setSelectedId] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? Number(saved) : null
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.listVehicles()
      setVehicles(data)
      setError(null)
      // Keep the selection valid: fall back to the first vehicle if the saved one is gone.
      setSelectedId((current) =>
        data.some((v) => v.id === current) ? current : (data[0]?.id ?? null),
      )
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (selectedId != null) localStorage.setItem(STORAGE_KEY, String(selectedId))
  }, [selectedId])

  const value = useMemo(
    () => ({
      vehicles,
      selectedId,
      selectVehicle: setSelectedId,
      selectedVehicle: vehicles.find((v) => v.id === selectedId) ?? null,
      loading,
      error,
      refresh,
    }),
    [vehicles, selectedId, loading, error, refresh],
  )

  return <VehicleContext.Provider value={value}>{children}</VehicleContext.Provider>
}

export function useVehicles() {
  const ctx = useContext(VehicleContext)
  if (!ctx) throw new Error('useVehicles must be used inside a VehicleProvider')
  return ctx
}
