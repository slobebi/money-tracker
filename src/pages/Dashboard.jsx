import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { App } from 'antd'
import { RightOutlined } from '@ant-design/icons'
import {
  fetchDebitSettings, fetchTotalIncome, fetchBCADirectExpenses,
  fetchCardPayments, fetchMonthTransactions,
  fetchCycleSpending, fetchBudgets, fetchRecurring,
  fetchMonthConfirmations, fetchRecentTransactions,
  fetchCardDebt, fetchInstallments,
} from '../lib/supabase'
import { fmt, fmtDate, currentBillingCycle } from '../lib/utils'
import Badge from '../components/Badge'
import { useCards } from '../contexts/CardsContext'

export default function Dashboard() {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const { creditCards, debitCards } = useCards()
  const now = new Date()
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState({
    settings: null, totalIncome: 0, bcaExpenses: 0, cardPayments: [],
    monthTxs: [], cycleSpending: {}, budgets: {},
    pending: [], recentTxs: [],
    cardDebt: { total: 0, installmentTotal: 0, _creditCardIds: [] },
    pendingInstallments: [], totalUnpaidRecurring: 0,
  })

  useEffect(() => {
    if (creditCards.length === 0) return
    load()
  }, [creditCards])

  async function load() {
    setLoading(true)
    try {
      const [
        settings, totalIncome, bcaExpenses, cardPayments,
        monthTxs, budgets, recurring, confirmations, recentTxs, cardDebt, installments,
        ...cycleArr
      ] = await Promise.all([
        fetchDebitSettings(),
        fetchTotalIncome(),
        fetchBCADirectExpenses(),
        fetchCardPayments(),
        fetchMonthTransactions(now.getFullYear(), now.getMonth()),
        fetchBudgets(),
        fetchRecurring(),
        fetchMonthConfirmations(monthStr),
        fetchRecentTransactions(5),
        fetchCardDebt(),
        fetchInstallments(),
        ...creditCards.map(c => {
          const { from, to } = currentBillingCycle(c.bill_day || 1)
          return fetchCycleSpending(c.id, from, to)
        }),
      ])

      const cycleSpending = {}
      creditCards.forEach((c, i) => { cycleSpending[c.id] = cycleArr[i] })

      const confirmedIds = new Set(confirmations.map(c => c.recurring_id))
      const pending = recurring.filter(r =>
        r.active && r.day_of_month <= now.getDate() && !confirmedIds.has(r.id)
      )
      const totalUnpaidRecurring = recurring
        .filter(r => r.active && !confirmedIds.has(r.id))
        .reduce((s, r) => s + r.amount, 0)

      const pendingInstallments = installments.filter(inst => {
        if (inst.paid_months >= inst.total_months) return false
        const [y, m] = inst.start_year_month.split('-').map(Number)
        const d = new Date(y, m - 1 + inst.paid_months, 1)
        const nextDue = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        return nextDue <= monthStr
      })

      setData({ settings, totalIncome, bcaExpenses, cardPayments, monthTxs, cycleSpending, budgets, pending, recentTxs, cardDebt, pendingInstallments, totalUnpaidRecurring })
    } catch (e) {
      message.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  const totalCardPay  = data.cardPayments.reduce((s, p) => s + p.amount, 0)
  const totalInitBal  = debitCards.reduce((s, c) => s + (c.current_balance || 0), 0)
  const bcaBalance    = totalInitBal + data.totalIncome - data.bcaExpenses - totalCardPay
  const salary        = debitCards.reduce((s, c) => s + (c.monthly_salary || 0), 0)
  const monthExpenses = data.monthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const monthIncome   = data.monthTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)

  const byCat = {}
  data.monthTxs.filter(t => t.type === 'expense').forEach(t => {
    byCat[t.category] = (byCat[t.category] || 0) + t.amount
  })
  const budgetEntries = Object.entries(data.budgets).map(([cat, budget]) => ({
    cat, budget, spent: byCat[cat] || 0,
  })).sort((a, b) => (b.spent / b.budget) - (a.spent / a.budget))

  // ── Derived values for savings ─────────────────────────────────────────────────
  const debitIds = new Set(debitCards.map(c => c.id))
  const debitIncome  = data.monthTxs.filter(t => debitIds.has(t.method) && t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const debitExpenses = data.monthTxs.filter(t => debitIds.has(t.method) && t.type === 'expense').reduce((s, t) => s + t.amount, 0)

  // Due this cycle = sum of current cycle charges + pending installments
  const pendingInstByCard = {}
  data.pendingInstallments.forEach(inst => {
    pendingInstByCard[inst.card_id] = (pendingInstByCard[inst.card_id] || 0) + inst.monthly_amount
  })
  const dueThisCycle = creditCards.reduce((s, c) =>
    s + (data.cardDebt[`current_${c.id}`] || 0) + (pendingInstByCard[c.id] || 0), 0)
  const dueSalaryPeriod = creditCards.reduce((s, c) =>
    s + (data.cardDebt[c.id] || 0) + (pendingInstByCard[c.id] || 0), 0)

  const unpaidRecurring = data.totalUnpaidRecurring
  const expectedSavings = salary + debitIncome - debitExpenses - dueSalaryPeriod - unpaidRecurring

  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening'

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300, color: '#6b7080' }}>
      Loading...
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Greeting */}
      <div style={{ paddingBottom: 4 }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{greeting} 👋</div>
        <div style={{ fontSize: 13, color: '#6b7080' }}>
          {now.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })}
        </div>
      </div>

      {/* Debit Balance */}
      <div className="card" style={{ background: bcaBalance >= 0 ? '#1a2e2a' : '#2e1a1a', border: `1px solid ${bcaBalance >= 0 ? '#3ecf8e33' : '#f25f5c33'}` }}>
        <div style={{ fontSize: 11, color: '#6b7080', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
          {debitCards.length === 1 ? debitCards[0].name : 'Debit Balance'}
        </div>
        <div style={{ fontSize: 34, fontWeight: 800, color: bcaBalance >= 0 ? '#3ecf8e' : '#f25f5c', lineHeight: 1.1 }}>
          {bcaBalance < 0 ? '-' : ''}{fmt(bcaBalance)}
        </div>
        {salary > 0 && (
          <div style={{ fontSize: 12, color: '#6b7080', marginTop: 6 }}>
            Monthly salary: <span style={{ color: '#e2e4ef', fontWeight: 500 }}>{fmt(salary)}</span>
          </div>
        )}
      </div>

      {/* Expected Savings */}
      {salary > 0 && (
        <div className="card" style={{ background: expectedSavings >= 0 ? '#1a2e2a' : '#2e1a1a', border: `1px solid ${expectedSavings >= 0 ? '#3ecf8e33' : '#f25f5c33'}` }}>
          <div style={{ fontSize: 11, color: '#6b7080', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Expected Savings</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: expectedSavings >= 0 ? '#3ecf8e' : '#f25f5c', lineHeight: 1.1 }}>
            {expectedSavings < 0 ? '-' : ''}{fmt(expectedSavings)}
          </div>
          <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid #2a2d3a', fontSize: 11, color: '#6b7080', display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Salary + debit income</span>
              <span style={{ color: '#3ecf8e' }}>{fmt(salary + debitIncome)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>− Debit expenses</span>
              <span style={{ color: '#f25f5c' }}>−{fmt(debitExpenses)}</span>
            </div>
            {dueSalaryPeriod > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>− Card bills</span>
                <span style={{ color: '#f5a623' }}>−{fmt(dueSalaryPeriod)}</span>
              </div>
            )}
            {unpaidRecurring > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>− Unpaid recurring</span>
                <span style={{ color: '#f5a623' }}>−{fmt(unpaidRecurring)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Total Bill This Cycle */}
      {creditCards.length > 0 && (() => {
        const pendingInstByCard = {}
        data.pendingInstallments.forEach(inst => {
          pendingInstByCard[inst.card_id] = (pendingInstByCard[inst.card_id] || 0) + inst.monthly_amount
        })

        const cardBills = {}
        creditCards.forEach(c => {
          const outstanding = c.current_balance || 0
          const instRem     = data.cardDebt[`installment_${c.id}`] || 0
          const pending     = pendingInstByCard[c.id] || 0
          const cycleSpent  = data.cycleSpending[c.id] || 0
          cardBills[c.id]   = Math.max(outstanding - instRem, 0) + cycleSpent + pending
        })

        const totalBill        = Object.values(cardBills).reduce((s, v) => s + v, 0)
        const totalPendingInst = Object.values(pendingInstByCard).reduce((s, v) => s + v, 0)

        const dueStr = (c) => {
          if (!c.due_day) return '—'
          return `${c.due_day}${['st','nd','rd'][c.due_day-1]||'th'}${c.due_next_month ? ' next month' : ''}`
        }

        return (
          <div className="card" style={{ border: '1px solid #f5a62333', background: '#2a2000' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: '#6b7080', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Total Bill This Cycle</div>
                <div style={{ fontSize: 30, fontWeight: 800, color: '#f5a623', lineHeight: 1.1 }}>{fmt(totalBill)}</div>
                {totalPendingInst > 0 && (
                  <div style={{ fontSize: 11, color: '#9b94ff', marginTop: 4 }}>
                    incl. {fmt(totalPendingInst)} unconfirmed installments
                  </div>
                )}
              </div>
              <button onClick={() => navigate('/cards')}
                style={{ background: 'none', border: 'none', color: '#6c63ff', fontSize: 12, cursor: 'pointer', padding: 0, marginTop: 4 }}>
                Details <RightOutlined />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {creditCards.map(c => {
                const outstanding = c.current_balance || 0
                const instRem     = data.cardDebt[`installment_${c.id}`] || 0
                const pending     = pendingInstByCard[c.id] || 0
                const cycleSpent  = data.cycleSpending[c.id] || 0
                const amount      = cardBills[c.id]
                return (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: 'rgba(0,0,0,0.2)', borderRadius: 8 }}>
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: c.color }}>{c.name}</span>
                      {c.due_day && <span style={{ fontSize: 11, color: '#6b7080', marginLeft: 8 }}>due {dueStr(c)}</span>}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: amount > 0 ? '#f5a623' : '#6b7080' }}>
                        {amount > 0 ? fmt(amount) : '—'}
                      </div>
                      {outstanding > 0 && (
                        <div style={{ fontSize: 10, color: '#6b7080' }}>
                          {fmt(outstanding)} outstanding{instRem > 0 ? ` −${fmt(instRem)} cicilan` : ''}
                        </div>
                      )}
                      {pending > 0 && <div style={{ fontSize: 10, color: '#9b94ff' }}>+{fmt(pending)} cicilan this cycle</div>}
                      {cycleSpent > 0 && <div style={{ fontSize: 10, color: '#6b7080' }}>+{fmt(cycleSpent)} this cycle</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* Total Debt */}
      {(data.cardDebt.total > 0 || data.cardDebt.installmentTotal > 0) && (
        <div className="card" style={{ border: '1px solid #f25f5c33', background: '#2e1a1a' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: '#6b7080', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Total Credit Card Debt</div>
              <div style={{ fontSize: 30, fontWeight: 800, color: '#f25f5c', lineHeight: 1.1 }}>{fmt(data.cardDebt.total)}</div>
              {data.cardDebt.installmentTotal > 0 && (
                <div style={{ fontSize: 12, color: '#f5a623', marginTop: 4 }}>
                  + {fmt(data.cardDebt.installmentTotal)} future installments
                </div>
              )}
            </div>
            <button onClick={() => navigate('/accounts')}
              style={{ background: 'none', border: 'none', color: '#6c63ff', fontSize: 12, cursor: 'pointer', padding: 0, marginTop: 4 }}>
              Manage <RightOutlined />
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {creditCards.map(c => (
              <div key={c.id} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: '8px 10px', textAlign: 'center', minWidth: 90 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: data.cardDebt[c.id] > 0 ? '#f25f5c' : '#3ecf8e' }}>
                  {data.cardDebt[c.id] > 0 ? fmt(data.cardDebt[c.id]) : '✓ Paid'}
                </div>
                <div style={{ fontSize: 10, color: c.color, marginTop: 2, fontWeight: 600 }}>{c.name}</div>
                {data.cardDebt[`installment_${c.id}`] > 0 && (
                  <div style={{ fontSize: 9, color: '#f5a623', marginTop: 1 }}>
                    +{fmt(data.cardDebt[`installment_${c.id}`])} cicilan
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* This month stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card">
          <div style={{ fontSize: 11, color: '#6b7080', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Spent this month</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#f25f5c' }}>{fmt(monthExpenses)}</div>
          {salary > 0 && (
            <div style={{ marginTop: 6 }}>
              <div style={{ background: '#0f1117', borderRadius: 6, height: 6, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 6,
                  background: monthExpenses / salary > 0.9 ? '#f25f5c' : monthExpenses / salary > 0.7 ? '#f5a623' : '#6c63ff',
                  width: `${Math.min((monthExpenses / salary) * 100, 100).toFixed(1)}%`,
                  transition: 'width .4s',
                }} />
              </div>
              <div style={{ fontSize: 11, color: '#6b7080', marginTop: 4 }}>
                {((monthExpenses / salary) * 100).toFixed(0)}% of salary
              </div>
            </div>
          )}
        </div>
        <div className="card">
          <div style={{ fontSize: 11, color: '#6b7080', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Income this month</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#3ecf8e' }}>{fmt(monthIncome)}</div>
          {monthIncome > 0 && monthExpenses > 0 && (
            <div style={{ fontSize: 11, color: '#6b7080', marginTop: 10 }}>
              {monthIncome >= monthExpenses
                ? <span style={{ color: '#3ecf8e' }}>+{fmt(monthIncome - monthExpenses)} saved</span>
                : <span style={{ color: '#f25f5c' }}>-{fmt(monthExpenses - monthIncome)} over income</span>
              }
            </div>
          )}
        </div>
      </div>

      {/* Card Utilization */}
      {creditCards.length > 0 && (
        <div className="card">
          <div style={{ fontSize: 11, color: '#6b7080', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
            Credit Card Utilization
          </div>
          {creditCards.map(c => {
            const totalLim    = c.credit_limit    || 0
            const outstanding = c.current_balance || 0
            const cycle       = data.cycleSpending[c.id] || 0
            const projected   = outstanding + cycle
            const pct         = totalLim > 0 ? Math.min((projected / totalLim) * 100, 100) : 0
            const barColor    = pct >= 90 ? '#f25f5c' : pct >= 70 ? '#f5a623' : c.color || '#6c63ff'

            return (
              <div key={c.id} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
                  <span style={{ color: c.color, fontWeight: 500 }}>{c.name}</span>
                  {totalLim > 0
                    ? <span style={{ color: '#6b7080', fontSize: 12 }}>{fmt(projected)} / {fmt(totalLim)}</span>
                    : <span style={{ color: '#6b7080', fontSize: 11, fontStyle: 'italic' }}>No limit set</span>
                  }
                </div>
                {totalLim > 0 && (
                  <div style={{ background: '#0f1117', borderRadius: 6, height: 8, overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 6, background: barColor, width: `${pct.toFixed(1)}%`, transition: 'width .4s' }} />
                  </div>
                )}
              </div>
            )
          })}
          <button onClick={() => navigate('/cards')}
            style={{ background: 'none', border: 'none', color: '#6c63ff', fontSize: 12, cursor: 'pointer', padding: 0, marginTop: 4 }}>
            Manage limits <RightOutlined />
          </button>
        </div>
      )}

      {/* Budget Progress */}
      {budgetEntries.length > 0 && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: '#6b7080', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Budget Progress
            </div>
            <button onClick={() => navigate('/monthly')} style={{ background: 'none', border: 'none', color: '#6c63ff', fontSize: 12, cursor: 'pointer', padding: 0 }}>
              Manage <RightOutlined />
            </button>
          </div>
          {budgetEntries.slice(0, 5).map(({ cat, budget, spent }) => {
            const pct  = Math.min((spent / budget) * 100, 100)
            const over = spent > budget
            return (
              <div key={cat} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span>{cat}</span>
                  <span style={{ fontWeight: 600, color: over ? '#f25f5c' : '#e2e4ef' }}>
                    {fmt(spent)}<span style={{ color: '#6b7080', fontWeight: 400 }}> / {fmt(budget)}</span>
                  </span>
                </div>
                <div style={{ background: '#0f1117', borderRadius: 6, height: 6, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 6, background: over ? '#f25f5c' : pct > 80 ? '#f5a623' : '#6c63ff', width: `${pct.toFixed(1)}%`, transition: 'width .4s' }} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Recent Transactions */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid #2a2d3a' }}>
          <span style={{ fontSize: 11, color: '#6b7080', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Recent Transactions</span>
          <button onClick={() => navigate('/transactions')} style={{ background: 'none', border: 'none', color: '#6c63ff', fontSize: 12, cursor: 'pointer', padding: 0 }}>
            See all <RightOutlined />
          </button>
        </div>
        {data.recentTxs.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#6b7080', padding: '24px 0', fontSize: 13 }}>No transactions yet.</div>
        ) : (
          data.recentTxs.map(t => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #2a2d3a' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.note || t.category}
                </div>
                <div style={{ fontSize: 12, color: '#6b7080' }}>{t.category} · {fmtDate(t.date)}</div>
              </div>
              <div style={{ marginLeft: 12, textAlign: 'right' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: t.type === 'expense' ? '#f25f5c' : '#3ecf8e' }}>
                  {t.type === 'expense' ? '-' : '+'}{fmt(t.amount)}
                </div>
                <Badge method={t.method} />
              </div>
            </div>
          ))
        )}
      </div>

    </div>
  )
}
