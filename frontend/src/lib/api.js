// One place for all backend calls. Usage: const data = await api('/ping')
const BASE = (import.meta.env.VITE_API_URL || 'http://backend.test').replace(/\/$/, '')

export async function api(path, { body, headers, ...options } = {}) {
  const res = await fetch(`${BASE}/api${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`Request failed (${res.status})`)
  return res.json()
}
