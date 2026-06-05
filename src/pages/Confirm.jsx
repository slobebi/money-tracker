import { useEffect, useState } from 'react'
import { App } from 'antd'
import { ClockCircleOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  fetchRecurring, fetchMonthConfirmations, fetchInstallments,
  addTransaction, confirmRecurring, skipRecurring, confirmInstallmentPayment,
} from '../lib/supabase'
import { fmt } from '../lib/utils'
import Badge from '../components/Badge'

export default function Confirm() {
  const { message } = App.useApp()
  const now = new Date()
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const [loading, setLoading]         = useState(true)
  const [pending, setPending]         = useState([])
  const [pendingInst, setPendingInst] = useState([])
  const [confirming, setConfirming]     = useState(null)
  const [confirmingInst, setConfInst]   = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [recurring, confirmations, installments] = await Promise.all([
        fetchRecurring(),
        fetchMonthConfirmations(monthStr),
        fetchInstallments(),
      ])

      const confirmedIds = new Set(confirmations.map(c => c.recurring_id))
      setPending(recurring.filter(r =>
        r.active && r.day_of_month <= now.getDate() && !confirmedIds.has(r.id)
      ))

      setPendingInst(installments.filter(inst => {
        if (inst.paid_months >= inst.total_months) return false
        const [y, m] = inst.start_year_month.split('-').map(Number)
        const d = new Date(y, m - 1 + inst.paid_months, 1)
        const nextDue = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        return nextDue <= monthStr
      }))
    } catch (e) {
      message.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirm(rec) {
    setConfirming(rec.id)
    try {
      const tx = await addTransaction({
        date: dayjs().format('YYYY-MM-DD'), amount: rec.amount,
        type: rec.type, method: rec.method, category: rec.category, note: rec.note || rec.name,
      })
      await confirmRecurring(rec.id, monthStr, tx.id)
      setPending(prev => prev.filter(r => r.id !== rec.id))
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
      setPending(prev => prev.filter(r => r.id !== rec.id))
      message.info(`"${rec.name}" skipped for this month`)
    } catch (e) {
      message.error(e.message)
    } finally {
      setConfirming(null)
    }
  }

  async function handleConfirmInstallment(inst) {
    setConfInst(inst.id)
    try {
      const { newPaid } = await confirmInstallmentPayment(inst.id, {
        date: dayjs().format('YYYY-MM-DD'), amount: inst.monthly_amount,
        type: 'expense', method: inst.card_id, category: inst.category, note: inst.note || inst.description,
      })
      setPendingInst(prev => prev.filter(i => i.id !== inst.id))
      message.success(newPaid >= inst.total_months ? `"${inst.description}" fully paid off!` : `Month ${newPaid}/${inst.total_months} logged`)
    } catch (e) {
      message.error(e.message)
    } finally {
      setConfInst(null)
    }
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200, color: '#6b7080' }}>
      Loading...
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h2 style={{ fontSize: 20, fontWeight: 600, color: '#e2e4ef', margin: 0 }}>Confirm</h2>

      {/* Pending Recurring */}
      {pending.length > 0 ? (
        <div className="card" style={{ border: '1px solid #f5a62344' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <ClockCircleOutlined style={{ color: '#f5a623' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#f5a623' }}>
              {pending.length} recurring transaction{pending.length > 1 ? 's' : ''} pending
            </span>
          </div>
          {pending.map(rec => (
            <div key={rec.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #2a2d3a' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 2 }}>{rec.name}</div>
                <div style={{ fontSize: 12, color: '#6b7080' }}>
                  <Badge method={rec.method} /> · {rec.category}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#f25f5c' }}>{fmt(rec.amount)}</span>
                <button onClick={() => handleConfirm(rec)} disabled={confirming === rec.id}
                  style={{ background: '#3ecf8e22', border: 'none', borderRadius: 6, padding: '5px 8px', color: '#3ecf8e', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>
                  <CheckCircleOutlined />
                </button>
                <button onClick={() => handleSkip(rec)} disabled={confirming === rec.id}
                  style={{ background: '#f25f5c22', border: 'none', borderRadius: 6, padding: '5px 8px', color: '#f25f5c', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>
                  <CloseCircleOutlined />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center', color: '#6b7080' }}>
          <ClockCircleOutlined style={{ fontSize: 24, marginBottom: 8, color: '#3ecf8e' }} />
          <div style={{ fontSize: 13 }}>No pending recurring transactions</div>
        </div>
      )}

      {/* Pending Installments */}
      {pendingInst.length > 0 ? (
        <div className="card" style={{ border: '1px solid #6c63ff44' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 16 }}>💳</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#9b94ff' }}>
              {pendingInst.length} installment{pendingInst.length > 1 ? 's' : ''} due this month
            </span>
          </div>
          {pendingInst.map(inst => (
            <div key={inst.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #2a2d3a' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 2 }}>{inst.description}</div>
                <div style={{ fontSize: 12, color: '#6b7080' }}>
                  <Badge method={inst.card_id} /> · {inst.paid_months + 1}/{inst.total_months} · {inst.category}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#f25f5c' }}>{fmt(inst.monthly_amount)}</span>
                <button onClick={() => handleConfirmInstallment(inst)} disabled={confirmingInst === inst.id}
                  style={{ background: '#3ecf8e22', border: 'none', borderRadius: 6, padding: '5px 8px', color: '#3ecf8e', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>
                  <CheckCircleOutlined />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center', color: '#6b7080' }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>💳</div>
          <div style={{ fontSize: 13 }}>No pending installments</div>
        </div>
      )}
    </div>
  )
}
