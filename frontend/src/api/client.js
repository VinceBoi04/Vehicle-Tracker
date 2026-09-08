// Thin axios wrapper around the FastAPI backend.
// The base URL is never hardcoded: it comes from VITE_API_BASE_URL so the same build
// works locally and on Vercel (set the var in the Vercel project settings).
import axios from 'axios'

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

const http = axios.create({ baseURL, headers: { 'Content-Type': 'application/json' } })

// Unwrap axios responses so callers deal in plain data, and surface FastAPI's
// `detail` field as the error message instead of a generic "Request failed".
http.interceptors.response.use(
  (res) => res,
  (err) => {
    const detail = err.response?.data?.detail
    const message =
      typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? detail.map((d) => `${d.loc?.slice(1).join('.')}: ${d.msg}`).join(', ')
          : err.message
    return Promise.reject(new Error(message))
  },
)

export const api = {
  baseURL,

  // Vehicles
  listVehicles: () => http.get('/vehicles').then((r) => r.data),
  createVehicle: (body) => http.post('/vehicles', body).then((r) => r.data),
  updateVehicle: (id, body) => http.put(`/vehicles/${id}`, body).then((r) => r.data),
  deleteVehicle: (id) => http.delete(`/vehicles/${id}`).then((r) => r.data),

  // Fuel logs
  listFuelLogs: (vehicleId) => http.get(`/vehicles/${vehicleId}/fuel-logs`).then((r) => r.data),
  createFuelLog: (vehicleId, body) =>
    http.post(`/vehicles/${vehicleId}/fuel-logs`, body).then((r) => r.data),
  updateFuelLog: (id, body) => http.put(`/fuel-logs/${id}`, body).then((r) => r.data),
  deleteFuelLog: (id) => http.delete(`/fuel-logs/${id}`).then((r) => r.data),

  // Service logs
  listServiceLogs: (vehicleId) =>
    http.get(`/vehicles/${vehicleId}/service-logs`).then((r) => r.data),
  createServiceLog: (vehicleId, body) =>
    http.post(`/vehicles/${vehicleId}/service-logs`, body).then((r) => r.data),
  updateServiceLog: (id, body) => http.put(`/service-logs/${id}`, body).then((r) => r.data),
  deleteServiceLog: (id) => http.delete(`/service-logs/${id}`).then((r) => r.data),

  // Analytics
  fuelEconomy: (vehicleId) => http.get(`/vehicles/${vehicleId}/fuel-economy`).then((r) => r.data),
  maintenanceDue: (vehicleId) =>
    http.get(`/vehicles/${vehicleId}/maintenance-due`).then((r) => r.data),
}

export default api
