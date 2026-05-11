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

// Returns { from, to } as 'YYYY-MM-DD' for the current open billing cycle
export function currentBillingCycle(billDay) {
  const today = new Date()
  const d = today.getDate()
  const y = today.getFullYear()
  const m = today.getMonth()

  let startYear, startMonth, startDay
  if (d > billDay) {
    startYear = y; startMonth = m; startDay = billDay + 1
  } else {
    const prev = new Date(y, m - 1, 1)
    startYear = prev.getFullYear(); startMonth = prev.getMonth(); startDay = billDay + 1
  }

  const from = `${startYear}-${String(startMonth + 1).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`
  const endDate = d > billDay ? new Date(y, m + 1, billDay) : new Date(y, m, billDay)
  const to = endDate.toISOString().slice(0, 10)

  return { from, to }
}
