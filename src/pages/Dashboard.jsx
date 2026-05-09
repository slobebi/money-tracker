import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { App } from 'antd'
import { RightOutlined, ClockCircleOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  fetchDebitSettings, fetchTotalIncome, fetchBCADirectExpenses,
  fetchCardPayments, fetchMonthTransactions, fetchCardLimits,
  fetchCycleSpending, fetchBudgets, fetchRecurring,
  fetchMonthConfirmations, fetchRecentTransactions,
  addTransaction, confirmRecurring, skipRecurring,
} from '../lib/supabase'
import { fmt, fmtDate, CARDS, CARD_BADGE_COLOR, CARD_BILL_DAY, currentBillingCycle } from '../lib/utils'
import Badge from '../components/Badge'

const CARD_META = [
  { id: 'card1', title: 'Tokopedia BRI', color: '#9b94ff', barColor: '#6c63ff' },
  { id: 'card2', title: 'Atome Mayapada', color: '#f5a623', barColor: '#f5a623' },
  { id: 'card3', title: 'BCA', color: '#3ecf8e', barColor: '#3ecf8e' },
]

export default function Dashboard() {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const now = new Date()
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState({
    settings: null, totalIncome: 0, bcaExpenses: 0, cardPayments: [],
    monthTxs: [], cardLimits: {}, cycleSpending: {}, budgets: {},
    pending: [], recentTxs: [],
  })
  const [confirming, setConfirming] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [
        settings, totalIncome, bcaExpenses, cardPayments,
        monthTxs, cardLimits, budgets, recurring, confirmations, recentTxs,
        ...cycleArr
      ] = await Promise.all([
        fetchDebitSettings(),
        fetchTotalIncome(),
        fetchBCADirectExpenses(),
        fetchCardPayments(),
        fetchMonthTransactions(now.getFullYear(), now.getMonth()),
        fetchCardLimits(),
        fetchBudgets(),
        fetchRecurring(),
        fetchMonthConfirmations(monthStr),
        fetchRecentTransactions(5),
        ...CARD_META.map(c => {
          const { from, to } = currentBillingCycle(CARD_BILL_DAY[c.id])
          return fetchCycleSpending(c.id, from, to)
        }),
      ])

      const cycleSpending = {}
      CARD_META.forEach((c, i) => { cycleSpending[c.id] = cycleArr[i] })

      const confirmedIds = new Set(confirmations.map(c => c.recurring_id))
      const pending = recurring.filter(r =>
        r.active && r.day_of_month <= now.getDate() && !confirmedIds.has(r.id)
      )

      setData({ settings, totalIncome, bcaExpenses, cardPayments, monthTxs, cardLimits, cycleSpending, budgets, pending, recentTxs })
    } catch (e) {
      message.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  const totalCardPay  = data.cardPayments.reduce((s, p) => s + p.amount, 0)
  const bcaBalance    = (data.settings?.initial_balance || 0) + data.totalIncome - data.bcaExpenses - totalCardPay
  const salary        = data.settings?.monthly_salary || 0
  const monthExpenses = data.monthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const monthIncome   = data.monthTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)

  // Budget progress for this month
  const byCat = {}
  data.monthTxs.filter(t => t.type === 'expense').forEach(t => {
    byCat[t.category] = (byCat[t.category] || 0) + t.amount
  })
  const budgetEntries = Object.entries(data.budgets).map(([cat, budget]) => ({
    cat, budget, spent: byCat[cat] || 0,
  })).sort((a, b) => (b.spent / b.budget) - (a.spent / a.budget))

  async function handleConfirm(rec) {
    setConfirming(rec.id)
    try {
      const tx = await addTransaction({
        date:     dayjs().format('YYYY-MM-DD'),
        amount:   rec.amount,
        type:     rec.type,
        method:   rec.method,
        category: rec.category,
        note:     rec.note || rec.name,
      })
      await confirmRecurring(rec.id, monthStr, tx.id)
      setData(prev => ({ ...prev, pending: prev.pending.filter(r => r.id !== rec.id) }))
      message.success(`"${rec.name}" added to transactions`)
    } catch (e) {
      message.error(e.message)
    } finally {
      setConfirming(null)
    }
  }

  async function handleSkip(rec) {
    setConfirming(rec.id)
    try {
      await skipRecurring(rec.id, monthStr)
      setData(prev => ({ ...prev, pending: prev.pending.filter(r => r.id !== rec.id) }))
      message.info(`"${rec.name}" skipped for this month`)
    } catch (e) {
      message.error(e.message)
    } finally {
      setConfirming(null)
    }
  }

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

      {/* BCA Balance */}
      <div className="card" style={{ background: bcaBalance >= 0 ? '#1a2e2a' : '#2e1a1a', border: `1px solid ${bcaBalance >= 0 ? '#3ecf8e33' : '#f25f5c33'}` }}>
        <div style={{ fontSize: 11, color: '#6b7080', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>BCA Debit Balance</div>
        <div style={{ fontSize: 34, fontWeight: 800, color: bcaBalance >= 0 ? '#3ecf8e' : '#f25f5c', lineHeight: 1.1 }}>
          {bcaBalance < 0 ? '-' : ''}{fmt(bcaBalance)}
        </div>
        {salary > 0 && (
          <div style={{ fontSize: 12, color: '#6b7080', marginTop: 6 }}>
            Monthly salary: <span style={{ color: '#e2e4ef', fontWeight: 500 }}>{fmt(salary)}</span>
          </div>
        )}
      </div>

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

      {/* Pending Recurring */}
      {data.pending.length > 0 && (
        <div className="card" style={{ border: '1px solid #f5a62344' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <ClockCircleOutlined style={{ color: '#f5a623' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#f5a623' }}>
              {data.pending.length} recurring transaction{data.pending.length > 1 ? 's' : ''} pending
            </span>
          </div>
          {data.pending.map(rec => (
            <div key={rec.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 0', borderBottom: '1px solid #2a2d3a',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 2 }}>{rec.name}</div>
                <div style={{ fontSize: 12, color: '#6b7080' }}>
                  <Badge method={rec.method} /> · {rec.category}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#f25f5c' }}>{fmt(rec.amount)}</span>
                <button
                  onClick={() => handleConfirm(rec)}
                  disabled={confirming === rec.id}
                  style={{ background: '#3ecf8e22', border: 'none', borderRadius: 6, padding: '5px 8px', color: '#3ecf8e', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
                  title="Confirm"
                >
                  <CheckCircleOutlined />
                </button>
                <button
                  onClick={() => handleSkip(rec)}
                  disabled={confirming === rec.id}
                  style={{ background: '#f25f5c22', border: 'none', borderRadius: 6, padding: '5px 8px', color: '#f25f5c', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
                  title="Skip this month"
                >
                  <CloseCircleOutlined />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Card Utilization */}
      <div className="card">
        <div style={{ fontSize: 11, color: '#6b7080', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
          Credit Card Utilization
        </div>
        {CARD_META.map(c => {
          const lim       = data.cardLimits[c.id]
          const totalLim  = lim?.total_limit || 0
          const outstanding = lim?.current_balance || 0
          const cycle     = data.cycleSpending[c.id] || 0
          const projected = outstanding + cycle
          const pct       = totalLim > 0 ? Math.min((projected / totalLim) * 100, 100) : 0
          const barColor  = pct >= 90 ? '#f25f5c' : pct >= 70 ? '#f5a623' : c.barColor

          return (
            <div key={c.id} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
                <span style={{ color: c.color, fontWeight: 500 }}>{c.title}</span>
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
        <button
          onClick={() => navigate('/cards')}
          style={{ background: 'none', border: 'none', color: '#6c63ff', fontSize: 12, cursor: 'pointer', padding: 0, marginTop: 4 }}
        >
          Manage limits <RightOutlined />
        </button>
      </div>

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
            const pct = Math.min((spent / budget) * 100, 100)
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
                <div style={{ fontSize: 12, color: '#6b7080' }}>
                  {t.category} · {fmtDate(t.date)}
                </div>
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
