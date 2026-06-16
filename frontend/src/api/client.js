const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || `Request failed: ${response.status}`)
  }

  if (response.status === 204) {
    return null
  }
  return response.json()
}

export const api = {
  listLicenses: (params = {}) => request(`/licenses/?${new URLSearchParams(params)}`),
  createLicense: (data) => request('/licenses/', { method: 'POST', body: JSON.stringify(data) }),
  updateLicense: (id, data) => request(`/licenses/${id}/`, { method: 'PUT', body: JSON.stringify(data) }),
  getLicenseHistory: (id) => request(`/licenses/${id}/history/`),
  getLicenseRenewals: (id) => request(`/licenses/${id}/renewals/`),
  listBorrowRecords: (params = {}) => request(`/borrow-records/?${new URLSearchParams(params)}`),
  createBorrowRecord: (data) => request('/borrow-records/', { method: 'POST', body: JSON.stringify(data) }),
  updateBorrowRecord: (id, data) => request(`/borrow-records/${id}/`, { method: 'PUT', body: JSON.stringify(data) }),
  listRenewals: (params = {}) => request(`/renewals/?${new URLSearchParams(params)}`),
  createRenewal: (data) => request('/renewals/', { method: 'POST', body: JSON.stringify(data) }),
  updateRenewal: (id, data) => request(`/renewals/${id}/`, { method: 'PUT', body: JSON.stringify(data) }),
  submitRenewal: (id) => request(`/renewals/${id}/submit/`, { method: 'POST' }),
  approveRenewal: (id, data) => request(`/renewals/${id}/approve/`, { method: 'POST', body: JSON.stringify(data) }),
  rejectRenewal: (id, data) => request(`/renewals/${id}/reject/`, { method: 'POST', body: JSON.stringify(data) }),
  startRenewal: (id) => request(`/renewals/${id}/start/`, { method: 'POST' }),
  completeRenewal: (id, data) => request(`/renewals/${id}/complete/`, { method: 'POST', body: JSON.stringify(data) }),
  stats: () => request('/stats/'),
}
