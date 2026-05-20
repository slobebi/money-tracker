export function fmt(n) {
  return new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0 }).format(Math.abs(n))
}

export function fmtDate(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

export function monthLabel(year, month) {
  return new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

// Returns { from, to } as 'YYYY-MM-DD' for the current open billing cycle.
// e.g. bill_day=15, today=May 20 → { from: '2026-05-15', to: '2026-06-14' }
export function currentBillingCycle(billDay) {
  const today = new Date()
  const d = today.getDate()
  const y = today.getFullYear()
  const m = today.getMonth()

  const pad = n => String(n).padStart(2, '0')
  const fmt = dt => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`

  // Cycle starts ON billDay of this month if we're on/past it, otherwise last month
  const start = d >= billDay ? new Date(y, m, billDay) : new Date(y, m - 1, billDay)
  // Cycle ends the day before the next billDay
  const end   = new Date(start.getFullYear(), start.getMonth() + 1, billDay - 1)

  return { from: fmt(start), to: fmt(end) }
}
