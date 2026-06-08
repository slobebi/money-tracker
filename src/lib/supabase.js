import { createClient } from '@supabase/supabase-js'
import { currentBillingCycle } from './utils'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('Missing Supabase env vars. Copy .env.example to .env and fill in your credentials.')
}

export const supabase = createClient(url, key)

// ─── Cards ─────────────────────────────────────────────────────────────────────

export async function fetchCards() {
  const { data, error } = await supabase
    .from('cards').select('*').eq('active', true).order('sort_order').order('name')
  if (error) throw error
  return data || []
}

export async function addCard(card) {
  const { data, error } = await supabase
    .from('cards').insert([{ ...card, updated_at: new Date().toISOString() }]).select().single()
  if (error) throw error
  return data
}

export async function updateCard(id, fields) {
  const { data, error } = await supabase
    .from('cards').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteCard(id) {
  const { error } = await supabase.from('cards').delete().eq('id', id)
  if (error) throw error
}

// ─── Transactions ──────────────────────────────────────────────────────────────

export async function fetchTransactions({
  page = 1,
  pageSize = 20,
  search = '',
  dateFrom = null,
  dateTo = null,
  categories = [],
  methods = [],
  type = null,
  sortField = 'date',
  sortOrder = 'descend',
} = {}) {
  let query = supabase
    .from('transactions')
    .select('*', { count: 'exact' })
    .order(sortField, { ascending: sortOrder === 'ascend' })

  if (sortField !== 'date') query = query.order('date', { ascending: false })

  if (search) query = query.or(`note.ilike.%${search}%,category.ilike.%${search}%`)
  if (dateFrom) query = query.gte('date', dateFrom)
  if (dateTo)   query = query.lte('date', dateTo)
  if (categories.length) query = query.in('category', categories)
  if (methods.length)    query = query.in('method', methods)
  if (type)              query = query.eq('type', type)

  const from = (page - 1) * pageSize
  query = query.range(from, from + pageSize - 1)

  const { data, error, count } = await query
  if (error) throw error
  return { data: data || [], count: count || 0 }
}

export async function fetchRecentTransactions(limit = 5) {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .order('date', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}

export async function addTransaction(tx) {
  const { data, error } = await supabase
    .from('transactions')
    .insert([tx])
    .select()
    .single()
  if (error) throw error
  return data
}

export async function addTransactions(txs) {
  const { data, error } = await supabase
    .from('transactions')
    .insert(txs)
    .select()
  if (error) throw error
  return data
}

export async function deleteTransaction(id) {
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id)
  if (error) throw error
}

export async function updateTransaction(id, fields) {
  const { data, error } = await supabase
    .from('transactions')
    .update(fields)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function fetchMonthTransactions(year, month) {
  const from = `${year}-${String(month + 1).padStart(2, '0')}-01`
  const lastDay = new Date(year, month + 1, 0).getDate()
  const to = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .neq('category', 'Transfer')
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: false })
  if (error) throw error
  return data
}

export async function fetchTransactionsByRange(from, to) {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .neq('category', 'Transfer')
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: false })
  if (error) throw error
  return data
}

// ─── Categories ────────────────────────────────────────────────────────────────

export async function fetchCategories() {
  const { data, error } = await supabase.from('categories').select('*').order('name')
  if (error) throw error
  return data
}

export async function addCategory(name) {
  const { data, error } = await supabase.from('categories').insert([{ name }]).select().single()
  if (error) throw error
  return data
}

export async function deleteCategory(id) {
  const { error } = await supabase.from('categories').delete().eq('id', id)
  if (error) throw error
}

// ─── Card Payments ─────────────────────────────────────────────────────────────

export async function fetchCardPayments() {
  const { data, error } = await supabase.from('card_payments').select('*').order('date', { ascending: false })
  if (error) throw error
  return data
}

export async function addCardPayment(payment) {
  const { data, error } = await supabase.from('card_payments').insert([payment]).select().single()
  if (error) throw error
  return data
}

export async function deleteCardPayment(id) {
  const { error } = await supabase.from('card_payments').delete().eq('id', id)
  if (error) throw error
}

// ─── Income / Expense aggregates ───────────────────────────────────────────────

export async function fetchTotalIncome() {
  const { data, error } = await supabase.from('transactions').select('amount').eq('type', 'income')
  if (error) throw error
  return (data || []).reduce((s, t) => s + t.amount, 0)
}

// All-time expenses on debit-type cards (dynamically resolved from cards table)
export async function fetchDebitExpenses() {
  const { data: debitCards, error: cardErr } = await supabase
    .from('cards').select('id').eq('type', 'debit').eq('active', true)
  if (cardErr) throw cardErr
  const ids = (debitCards || []).map(c => c.id)
  if (!ids.length) return 0
  const { data, error } = await supabase
    .from('transactions').select('amount').in('method', ids).eq('type', 'expense')
  if (error) throw error
  return (data || []).reduce((s, t) => s + t.amount, 0)
}

// Kept as alias for backward compat
export const fetchBCADirectExpenses = fetchDebitExpenses

export async function fetchCycleSpending(cardId, from, to) {
  const { data, error } = await supabase
    .from('transactions')
    .select('amount')
    .eq('method', cardId)
    .eq('type', 'expense')
    .gte('date', from)
    .lte('date', to)
  if (error) throw error
  return (data || []).reduce((s, t) => s + t.amount, 0)
}

// ─── Debit settings (aggregated from all debit cards — backward compat) ─────────

export async function fetchDebitSettings() {
  const { data, error } = await supabase
    .from('cards').select('*').eq('type', 'debit').eq('active', true).order('sort_order')
  if (error) throw error
  const cards = data || []
  return {
    initial_balance: cards.reduce((s, c) => s + (c.current_balance || 0), 0),
    monthly_salary: cards.reduce((s, c) => s + (c.monthly_salary || 0), 0),
  }
}

// Update a specific debit card's settings
export async function upsertDebitSettings(fields, cardId) {
  if (cardId) {
    // Update specific debit card
    const mapped = {}
    if (fields.initial_balance !== undefined) mapped.current_balance = fields.initial_balance
    if (fields.monthly_salary !== undefined) mapped.monthly_salary = fields.monthly_salary
    await updateCard(cardId, mapped)
    return
  }
  // Legacy: update first debit card
  const { data, error } = await supabase
    .from('cards').select('id').eq('type', 'debit').order('sort_order').limit(1).maybeSingle()
  if (error) throw error
  if (!data) return
  const mapped = {}
  if (fields.initial_balance !== undefined) mapped.current_balance = fields.initial_balance
  if (fields.monthly_salary !== undefined) mapped.monthly_salary = fields.monthly_salary
  await updateCard(data.id, mapped)
}

// ─── Budgets ───────────────────────────────────────────────────────────────────

export async function fetchBudgets() {
  const { data, error } = await supabase.from('budgets').select('*')
  if (error) throw error
  return Object.fromEntries((data || []).map(r => [r.category, r.monthly_amount]))
}

export async function upsertBudget(category, monthlyAmount) {
  const { error } = await supabase
    .from('budgets')
    .upsert({ category, monthly_amount: monthlyAmount, updated_at: new Date().toISOString() })
  if (error) throw error
}

export async function deleteBudget(category) {
  const { error } = await supabase.from('budgets').delete().eq('category', category)
  if (error) throw error
}

// ─── Recurring Transactions ────────────────────────────────────────────────────

export async function fetchRecurring() {
  const { data, error } = await supabase
    .from('recurring_transactions')
    .select('*')
    .order('day_of_month')
  if (error) throw error
  return data
}

export async function addRecurring(rec) {
  const { data, error } = await supabase.from('recurring_transactions').insert([rec]).select().single()
  if (error) throw error
  return data
}

export async function updateRecurring(id, fields) {
  const { error } = await supabase.from('recurring_transactions').update(fields).eq('id', id)
  if (error) throw error
}

export async function deleteRecurring(id) {
  const { error } = await supabase.from('recurring_transactions').delete().eq('id', id)
  if (error) throw error
}

export async function fetchMonthConfirmations(monthStr) {
  const { data, error } = await supabase
    .from('recurring_confirmations')
    .select('*')
    .eq('month', monthStr)
  if (error) throw error
  return data || []
}

export async function confirmRecurring(recurringId, monthStr, transactionId) {
  const { error } = await supabase
    .from('recurring_confirmations')
    .insert([{ recurring_id: recurringId, month: monthStr, transaction_id: transactionId }])
  if (error) throw error
}

export async function skipRecurring(recurringId, monthStr) {
  const { error } = await supabase
    .from('recurring_confirmations')
    .insert([{ recurring_id: recurringId, month: monthStr, transaction_id: null }])
  if (error) throw error
}

// ─── Installments ──────────────────────────────────────────────────────────────

export async function fetchInstallments() {
  const { data, error } = await supabase
    .from('installments')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function addInstallment(inst) {
  const { data, error } = await supabase.from('installments').insert([inst]).select().single()
  if (error) throw error
  return data
}

export async function updateInstallment(id, fields) {
  const { error } = await supabase.from('installments').update(fields).eq('id', id)
  if (error) throw error
}

export async function deleteInstallment(id) {
  const { error } = await supabase.from('installments').delete().eq('id', id)
  if (error) throw error
}

export async function confirmInstallmentPayment(id, txData) {
  const tx = await addTransaction(txData)
  const { data: inst, error: fetchErr } = await supabase
    .from('installments').select('paid_months').eq('id', id).single()
  if (fetchErr) throw fetchErr
  const newPaid = inst.paid_months + 1
  const { error: updErr } = await supabase
    .from('installments').update({ paid_months: newPaid }).eq('id', id)
  if (updErr) throw updErr
  return { tx, newPaid }
}

// ─── Card Debt ─────────────────────────────────────────────────────────────────

export async function fetchCardDebt() {
  const [
    { data: cardData, error: cardErr },
    { data: instData, error: instErr },
    { data: payData,  error: payErr  },
  ] = await Promise.all([
    supabase.from('cards').select('id,type,bill_day').eq('active', true),
    supabase.from('installments').select('card_id,monthly_amount,total_months,paid_months'),
    supabase.from('card_payments').select('card_id,amount,date'),
  ])
  if (cardErr) throw cardErr
  if (instErr) throw instErr
  if (payErr)  throw payErr

  const creditCards = (cardData || []).filter(c => c.type === 'credit')

  const pad = n => String(n).padStart(2, '0')
  const fmtD = dt => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`

  // Compute cycle windows per card
  const cycles = creditCards.map(c => {
    const { from: cycleFrom, to: cycleTo } = currentBillingCycle(c.bill_day || 1)
    const cycleFromDate = new Date(cycleFrom + 'T00:00:00')

    // Previous cycle: same bill_day one month back → one day before current start
    const prevStartDate = new Date(cycleFromDate)
    prevStartDate.setMonth(prevStartDate.getMonth() - 1)
    const prevEndDate = new Date(cycleFromDate)
    prevEndDate.setDate(prevEndDate.getDate() - 1)

    return { card: c, cycleFrom, cycleTo, prevFrom: fmtD(prevStartDate), prevTo: fmtD(prevEndDate) }
  })

  // Fetch current + previous cycle spending for all cards in parallel
  const spending = await Promise.all(
    cycles.flatMap(({ card, cycleFrom, cycleTo, prevFrom, prevTo }) => [
      fetchCycleSpending(card.id, cycleFrom, cycleTo),
      fetchCycleSpending(card.id, prevFrom, prevTo),
    ])
  )

  const result = {}
  cycles.forEach(({ card, prevTo }, i) => {
    const currentSpent = spending[i * 2]     || 0
    const prevSpent    = spending[i * 2 + 1] || 0

    // Payments made AFTER the previous cycle ended are settling that cycle's bill
    const prevPayments = (payData || [])
      .filter(p => p.card_id === card.id && p.date > prevTo)
      .reduce((s, p) => s + p.amount, 0)

    const prevUnpaid = Math.max(0, prevSpent - prevPayments)

    const instRem = (instData || [])
      .filter(inst => inst.card_id === card.id)
      .reduce((s, inst) => s + Math.max(inst.total_months - inst.paid_months, 0) * inst.monthly_amount, 0)

    result[card.id]                    = prevUnpaid + currentSpent
    result[`prev_unpaid_${card.id}`]   = prevUnpaid
    result[`current_${card.id}`]       = currentSpent
    result[`installment_${card.id}`]   = instRem
  })

  result.total = creditCards.reduce((s, c) => s + (result[c.id] || 0), 0)
  result.installmentTotal = creditCards.reduce((s, c) => s + (result[`installment_${c.id}`] || 0), 0)
  result._creditCardIds = creditCards.map(c => c.id)

  return result
}

// ─── Salary periods ────────────────────────────────────────────────────────────

export async function fetchSalaryPeriods() {
  const { data, error } = await supabase
    .from('transactions')
    .select('date,amount')
    .eq('type', 'income')
    .eq('category', 'Salary')
    .order('date', { ascending: true })
  if (error) throw error
  const rows = data || []
  const today = new Date().toISOString().slice(0, 10)

  // Build periods: each salary date starts a period, ends day before next salary (or today for current)
  return rows.map((row, i) => {
    const start = row.date
    const end   = i + 1 < rows.length
      ? offsetDate(rows[i + 1].date, -1)
      : today
    return { start, end, salary: row.amount, isCurrent: i === rows.length - 1 }
  })
}

function offsetDate(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

// Given a salary period and the list of active cards, compute all savings components.
export async function fetchSalaryPeriodSavings(periodStart, periodEnd, creditCards, installments) {
  const pad = n => String(n).padStart(2, '0')

  // Transactions in the salary period (Transfer already excluded by fetchTransactionsByRange)
  const txs = await fetchTransactionsByRange(periodStart, periodEnd)

  // Card cycle spending: for each credit card find the cycle whose bill falls within this period
  const cardCycleSpending = {}
  await Promise.all(creditCards.map(async c => {
    const { from, to } = billingCycleForSalaryPeriod(c.bill_day || 1, periodStart)
    cardCycleSpending[c.id] = await fetchCycleSpending(c.id, from, to)
  }))

  // Installments due during the salary period month
  const periodMonth = periodStart.slice(0, 7)
  const instDue = installments
    .filter(inst => {
      if (inst.paid_months >= inst.total_months) return false
      const [y, m] = inst.start_year_month.split('-').map(Number)
      const d = new Date(y, m - 1 + inst.paid_months, 1)
      const nextDue = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
      return nextDue <= periodMonth
    })
    .reduce((s, inst) => s + inst.monthly_amount, 0)

  return { txs, cardCycleSpending, instDue }
}

// The billing cycle whose bill is generated (and paid) after a given salary date
function billingCycleForSalaryPeriod(billDay, salaryDate) {
  const s = new Date(salaryDate + 'T00:00:00')
  const pad = n => String(n).padStart(2, '0')
  const fmt = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

  // Find the first bill_day strictly after salaryDate
  let candidate = new Date(s.getFullYear(), s.getMonth(), billDay)
  if (candidate <= s) {
    candidate = new Date(s.getFullYear(), s.getMonth() + 1, billDay)
  }
  // Cycle ends the day before bill generation; starts bill_day of the month before that
  const cycleEnd   = new Date(candidate); cycleEnd.setDate(cycleEnd.getDate() - 1)
  const cycleStart = new Date(candidate.getFullYear(), candidate.getMonth() - 1, billDay)
  return { from: fmt(cycleStart), to: fmt(cycleEnd) }
}
