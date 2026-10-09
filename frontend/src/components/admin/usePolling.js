import { useCallback, useEffect, useRef, useState } from 'react'

// Loads data now and again every `interval` ms. Keeps showing the last good data
// if a refresh fails (so a Wi-Fi blip does not blank the board), pauses while the
// tab is hidden, and reloads as soon as it becomes visible again.
//   const { data, error, loading, updatedAt, refresh } = usePolling(
//     (signal) => api('/exams', { signal }), { key: 'exams', interval: 5000 })
// `key` identifies what is being loaded; change it (e.g. an exam id) to start over.
export function usePolling(load, { key, interval = 5000 } = {}) {
  const [state, setState] = useState({ key: null, data: null, error: null, updatedAt: null })
  const [kick, setKick] = useState(0)
  const loadRef = useRef(load)
  useEffect(() => {
    loadRef.current = load
  })

  useEffect(() => {
    let alive = true
    let timer = null
    let ctrl = null

    const run = async () => {
      ctrl = new AbortController()
      try {
        const data = await loadRef.current(ctrl.signal)
        if (alive) setState({ key, data, error: null, updatedAt: Date.now() })
      } catch (err) {
        if (!alive || err.name === 'AbortError') return
        setState((s) => ({ key, data: s.key === key ? s.data : null, error: err, updatedAt: s.key === key ? s.updatedAt : null }))
      }
      schedule()
    }
    const schedule = () => {
      if (!alive || !interval) return
      timer = setTimeout(() => (document.hidden ? schedule() : run()), interval)
    }
    const onVisible = () => {
      if (document.hidden) return
      clearTimeout(timer)
      ctrl?.abort()
      run()
    }

    run()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      alive = false
      clearTimeout(timer)
      ctrl?.abort()
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [key, interval, kick])

  const current = state.key === key
  return {
    data: current ? state.data : null,
    error: current ? state.error : null,
    loading: !current,
    updatedAt: current ? state.updatedAt : null,
    refresh: useCallback(() => setKick((k) => k + 1), []),
  }
}