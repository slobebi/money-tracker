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
  ] = await Promise.all([
    supabase.from('cards').select('id,type,bill_day').eq('active', true),
    supabase.from('installments').select('card_id,monthly_amount,total_months,paid_months'),
  ])
  if (cardErr) throw cardErr
  if (instErr) throw instErr

  const creditCards = (cardData || []).filter(c => c.type === 'credit')

  // Fetch current-cycle expenses for each card in parallel
  const cycleAmounts = await Promise.all(
    creditCards.map(c => {
      const { from, to } = currentBillingCycle(c.bill_day || 1)
      return fetchCycleSpending(c.id, from, to)
    })
  )

  const result = {}
  creditCards.forEach((card, i) => {
    const cycleSpent = cycleAmounts[i] || 0
    const instRem = (instData || [])
      .filter(inst => inst.card_id === card.id)
      .reduce((s, inst) => s + Math.max(inst.total_months - inst.paid_months, 0) * inst.monthly_amount, 0)

    // Debt = current-cycle charges only. Card payments settle previous-cycle bills
    // so they never reduce the current cycle's running balance.
    result[card.id] = cycleSpent
    result[`installment_${card.id}`] = instRem
  })

  result.total = creditCards.reduce((s, c) => s + (result[c.id] || 0), 0)
  result.installmentTotal = creditCards.reduce((s, c) => s + (result[`installment_${c.id}`] || 0), 0)
  result._creditCardIds = creditCards.map(c => c.id)

  return result
}
