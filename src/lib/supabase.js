import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('Missing Supabase env vars. Copy .env.example to .env and fill in your credentials.')
}

export const supabase = createClient(url, key)

// ─── Transactions ──────────────────────────────────────────────────────────────

export async function fetchTransactions() {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .order('date', { ascending: false })
  if (error) throw error
  return data
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

export async function fetchMonthTransactions(year, month) {
  const from = `${year}-${String(month + 1).padStart(2, '0')}-01`
  const lastDay = new Date(year, month + 1, 0).getDate()
  const to   = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: false })
  if (error) throw error
  return data
}

// ─── Card Limits ───────────────────────────────────────────────────────────────

export async function fetchCardLimits() {
  const { data, error } = await supabase.from('card_limits').select('*')
  if (error) throw error
  return Object.fromEntries((data || []).map(r => [r.card_id, r]))
}

export async function upsertCardLimit(cardId, totalLimit, currentBalance) {
  const { error } = await supabase
    .from('card_limits')
    .upsert({ card_id: cardId, total_limit: totalLimit, current_balance: currentBalance, updated_at: new Date().toISOString() })
  if (error) throw error
}

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

// ─── BCA Debit Settings ────────────────────────────────────────────────────────

export async function fetchDebitSettings() {
  const { data, error } = await supabase.from('debit_settings').select('*').eq('id', 1).maybeSingle()
  if (error) throw error
  return data
}

export async function upsertDebitSettings(fields) {
  const { error } = await supabase
    .from('debit_settings')
    .upsert({ id: 1, ...fields, updated_at: new Date().toISOString() })
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

export async function fetchTotalIncome() {
  const { data, error } = await supabase.from('transactions').select('amount').eq('type', 'income')
  if (error) throw error
  return (data || []).reduce((s, t) => s + t.amount, 0)
}

export async function fetchBCADirectExpenses() {
  const { data, error } = await supabase
    .from('transactions').select('amount').eq('method', 'cash').eq('type', 'expense')
  if (error) throw error
  return (data || []).reduce((s, t) => s + t.amount, 0)
}

// Returns { card1, card2, card3, total }
// debt = card_limits.current_balance (pre-app seed) + tracked expenses − logged payments
export async function fetchCardDebt() {
  const [{ data: txData, error: txErr }, { data: payData, error: payErr }, { data: limData, error: limErr }] = await Promise.all([
    supabase.from('transactions').select('method,amount').eq('type', 'expense').in('method', ['card1', 'card2', 'card3']),
    supabase.from('card_payments').select('card_id,amount'),
    supabase.from('card_limits').select('card_id,current_balance'),
  ])
  if (txErr) throw txErr
  if (payErr) throw payErr
  if (limErr) throw limErr

  const seed = { card1: 0, card2: 0, card3: 0 }
  for (const l of limData || []) seed[l.card_id] = l.current_balance || 0

  const spent = { card1: 0, card2: 0, card3: 0 }
  for (const t of txData || []) spent[t.method] = (spent[t.method] || 0) + t.amount

  const paid = { card1: 0, card2: 0, card3: 0 }
  for (const p of payData || []) paid[p.card_id] = (paid[p.card_id] || 0) + p.amount

  const card1 = Math.max(seed.card1 + spent.card1 - paid.card1, 0)
  const card2 = Math.max(seed.card2 + spent.card2 - paid.card2, 0)
  const card3 = Math.max(seed.card3 + spent.card3 - paid.card3, 0)
  return { card1, card2, card3, total: card1 + card2 + card3 }
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

// Confirmations for a given month string (YYYY-MM)
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
