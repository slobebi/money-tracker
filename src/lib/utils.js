export const CARDS = {
  card1: 'Tokopedia BRI',
  card2: 'Atome Mayapada',
  card3: 'BCA',
  cash:  'BCA Debit',
}

export const CARD_BADGE_COLOR = {
  card1: { bg: '#6c63ff22', color: '#9b94ff' },
  card2: { bg: '#f5a62322', color: '#f5a623' },
  card3: { bg: '#3ecf8e22', color: '#3ecf8e' },
  cash:  { bg: '#f25f5c22', color: '#f25f5c' },
}

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

// Bill day = the statement cutoff day per card
export const CARD_BILL_DAY = { card1: 16, card2: 15, card3: 3 }

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
