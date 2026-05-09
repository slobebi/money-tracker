import { useEffect, useState } from 'react'
import { Button, InputNumber, Form, App } from 'antd'
import { fetchCardLimits, upsertCardLimit, fetchCycleSpending, fetchCardDebt } from '../lib/supabase'
import { fmt, currentBillingCycle, CARD_BILL_DAY } from '../lib/utils'

const CARD_META = [
  {
    id: 'card1',
    title: 'Tokopedia BRI',
    accentColor: '#9b94ff',
    borderColor: '#6c63ff44',
    barColor: '#6c63ff',
    billDate: '16th of each month',
    dueDate: '31st or 1st (next month)',
    payOn: 'Payday (last working day)',
    payColor: '#3ecf8e',
    trackCycle: '17th → 16th next month',
    warn: null,
  },
  {
    id: 'card2',
    title: 'Atome Mayapada',
    accentColor: '#f5a623',
    borderColor: '#f5a62344',
    barColor: '#f5a623',
    billDate: '15th of each month',
    dueDate: '4th of next month',
    payOn: 'Payday (last working day)',
    payColor: '#3ecf8e',
    trackCycle: '16th → 15th next month',
    warn: null,
  },
  {
    id: 'card3',
    title: 'BCA',
    accentColor: '#3ecf8e',
    borderColor: '#3ecf8e44',
    barColor: '#3ecf8e',
    billDate: '3rd of each month',
    dueDate: '19th of each month',
    payOn: '15th–17th (before due date)',
    payColor: '#f5a623',
    trackCycle: '4th → 3rd next month',
    warn: 'Due date (19th) falls BEFORE payday. Pre-allocate this bill from your previous paycheck.',
  },
]

const rhythm = [
  { date: '1st',              action: 'Review previous month total spending' },
  { date: '4th',              action: 'Atome Mayapada due date (already paid on payday)' },
  { date: '15th–17th',        action: '💳 Pay BCA card (due 19th)' },
  { date: 'Last working day', action: '💳 Pay Tokopedia BRI & Atome Mayapada — review full month' },
]

export default function Cards() {
  const { message } = App.useApp()
  const [limits, setLimits]   = useState({})
  const [cycling, setCycling] = useState({})
  const [debt, setDebt]       = useState({ card1: 0, card2: 0, card3: 0, total: 0 })
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [form] = Form.useForm()
  const [saving, setSaving]   = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const [lims, debtData, ...spending] = await Promise.all([
          fetchCardLimits(),
          fetchCardDebt(),
          ...CARD_META.map(c => {
            const { from, to } = currentBillingCycle(CARD_BILL_DAY[c.id])
            return fetchCycleSpending(c.id, from, to)
          }),
        ])
        setLimits(lims)
        setDebt(debtData)
        const cyc = {}
        CARD_META.forEach((c, i) => { cyc[c.id] = spending[i] })
        setCycling(cyc)
      } catch (e) {
        message.error(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  function openEdit(cardId) {
    const l = limits[cardId]
    form.setFieldsValue({
      total_limit:     l?.total_limit     ?? null,
      current_balance: l?.current_balance ?? null,
    })
    setEditing(cardId)
  }

  async function handleSave(cardId) {
    try {
      const values = await form.validateFields()
      setSaving(true)
      await upsertCardLimit(cardId, values.total_limit, values.current_balance)
      setLimits(prev => ({
        ...prev,
        [cardId]: { card_id: cardId, total_limit: values.total_limit, current_balance: values.current_balance },
      }))
      setEditing(null)
      message.success('Saved')
    } catch (e) {
      if (e?.errorFields) return // antd validation error, already shown
      message.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 20, color: '#e2e4ef' }}>Credit Cards</h2>

      <div style={{ marginBottom: 16, padding: '10px 16px', borderRadius: 8, fontSize: 13, background: '#6c63ff18', border: '1px solid #6c63ff44', color: '#9b94ff' }}>
        Your payday is the last working day of the month. Use this schedule every month.
      </div>

      {/* Total debt summary */}
      <div className="card" style={{ marginBottom: 16, border: `1px solid ${debt.total > 0 ? '#f25f5c33' : '#3ecf8e33'}`, background: debt.total > 0 ? '#2e1a1a' : '#1a2e2a' }}>
        <div style={{ fontSize: 11, color: '#6b7080', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Total Outstanding Debt</div>
        <div style={{ fontSize: 28, fontWeight: 800, color: debt.total > 0 ? '#f25f5c' : '#3ecf8e', marginBottom: 10 }}>
          {debt.total > 0 ? fmt(debt.total) : '✓ All clear'}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {CARD_META.map(c => (
            <div key={c.id} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: debt[c.id] > 0 ? '#f25f5c' : '#3ecf8e' }}>
                {debt[c.id] > 0 ? fmt(debt[c.id]) : '✓ Paid'}
              </div>
              <div style={{ fontSize: 10, color: c.accentColor, marginTop: 2, fontWeight: 600 }}>{c.title}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: '#6b7080', marginTop: 10 }}>
          Debt = initial outstanding + tracked expenses − bill payments logged
        </div>
      </div>

      {CARD_META.map(c => {
        const lim         = limits[c.id]
        const totalLimit  = lim?.total_limit     || 0
        const outstanding = lim?.current_balance || 0
        const thisCycle   = cycling[c.id]        || 0
        const projected   = outstanding + thisCycle
        const available   = totalLimit - projected
        const utilPct     = totalLimit > 0 ? Math.min((projected / totalLimit) * 100, 100) : 0
        const utilColor   = utilPct >= 90 ? '#f25f5c' : utilPct >= 70 ? '#f5a623' : '#3ecf8e'
        const { from, to } = currentBillingCycle(CARD_BILL_DAY[c.id])

        return (
          <div key={c.id} className="card" style={{ marginBottom: 16, border: `1px solid ${c.borderColor}` }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: c.accentColor, textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>
                {c.title}
              </h3>
              <Button
                size="small"
                onClick={() => editing === c.id ? setEditing(null) : openEdit(c.id)}
              >
                {editing === c.id ? 'Cancel' : (lim ? 'Edit Limit' : 'Set Limit')}
              </Button>
            </div>

            {c.warn && (
              <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 8, fontSize: 12, background: '#f5a62318', border: '1px solid #f5a62344', color: '#f5a623' }}>
                ⚠️ {c.warn}
              </div>
            )}

            {/* Limit editor */}
            {editing === c.id && (
              <div style={{ marginBottom: 16, padding: 12, background: '#0f1117', borderRadius: 8, border: '1px solid #2a2d3a' }}>
                <Form form={form} layout="vertical">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Form.Item label="Credit Limit" name="total_limit" rules={[{ required: true, type: 'number', min: 1, message: 'Required' }]} style={{ marginBottom: 8 }}>
                      <InputNumber style={{ width: '100%' }} min={0} placeholder="e.g. 10000000" step={100000} />
                    </Form.Item>
                    <Form.Item label="Current Outstanding" name="current_balance" rules={[{ required: true, type: 'number', min: 0, message: 'Required' }]} style={{ marginBottom: 8 }}>
                      <InputNumber style={{ width: '100%' }} min={0} placeholder="Balance you currently owe" step={100000} />
                    </Form.Item>
                  </div>
                  <p style={{ fontSize: 11, color: '#6b7080', marginBottom: 10 }}>
                    "Current Outstanding" = what you already owe before logging new transactions here.
                  </p>
                  <Button type="primary" size="small" onClick={() => handleSave(c.id)} loading={saving}>
                    Save
                  </Button>
                </Form>
              </div>
            )}

            {/* Utilization */}
            {loading ? (
              <div style={{ color: '#6b7080', fontSize: 12, marginBottom: 12 }}>Loading...</div>
            ) : totalLimit > 0 ? (
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6b7080', marginBottom: 6 }}>
                  <span>Utilization ({utilPct.toFixed(0)}%)</span>
                  <span style={{ color: available >= 0 ? '#3ecf8e' : '#f25f5c' }}>
                    {available >= 0 ? `${fmt(available)} available` : `${fmt(Math.abs(available))} over limit`}
                  </span>
                </div>
                <div style={{ background: '#0f1117', borderRadius: 8, height: 10, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 8, background: utilColor, width: `${utilPct.toFixed(1)}%`, transition: 'width .4s' }} />
                </div>
                <div className="grid grid-cols-3 gap-2" style={{ marginTop: 12 }}>
                  {[
                    { label: 'Credit Limit',   val: fmt(totalLimit), color: '#e2e4ef' },
                    { label: 'Projected Bill',  val: fmt(projected),  color: '#f25f5c' },
                    { label: 'Available',       val: fmt(Math.max(available, 0)), color: '#3ecf8e' },
                  ].map(s => (
                    <div key={s.label} style={{ background: '#0f1117', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: s.color }}>{s.val}</div>
                      <div style={{ fontSize: 11, color: '#6b7080', marginTop: 2 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 10, paddingTop: 10, borderTop: '1px solid #2a2d3a', fontSize: 12, color: '#6b7080' }}>
                  <div>
                    <span style={{ display: 'block', color: '#e2e4ef', fontWeight: 500 }}>{fmt(outstanding)}</span>
                    Outstanding (manual)
                  </div>
                  <div>
                    <span style={{ display: 'block', color: '#e2e4ef', fontWeight: 500 }}>+ {fmt(thisCycle)}</span>
                    This cycle ({from.slice(5)} → {to.slice(5)})
                  </div>
                  <div>
                    <span style={{ display: 'block', fontWeight: 600, color: debt[c.id] > 0 ? '#f25f5c' : '#3ecf8e' }}>
                      {debt[c.id] > 0 ? fmt(debt[c.id]) : '✓ Paid'}
                    </span>
                    Total debt owed
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: '#6b7080', fontStyle: 'italic', marginBottom: 12 }}>
                No limit set — click "Set Limit" to track utilization.
              </div>
            )}

            {/* Schedule */}
            <div style={{ paddingTop: 12, borderTop: '1px solid #2a2d3a' }}>
              {[
                ['Bill cuts',   c.billDate,   '#e2e4ef'],
                ['Due date',    c.dueDate,    '#e2e4ef'],
                ['Pay on',      c.payOn,      c.payColor],
                ['Cycle',       c.trackCycle, '#e2e4ef'],
              ].map(([label, val, color]) => (
                <div key={label} style={{ display: 'flex', gap: 8, fontSize: 13, marginBottom: 6 }}>
                  <span style={{ color: '#6b7080', width: 80, flexShrink: 0 }}>{label}:</span>
                  <span style={{ color, fontWeight: 500 }}>{val}</span>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {/* Monthly rhythm */}
      <div className="card">
        <h3 style={{ fontSize: 11, color: '#6b7080', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 16 }}>
          Monthly Rhythm
        </h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #2a2d3a' }}>
              <th style={{ textAlign: 'left', color: '#6b7080', fontWeight: 500, paddingBottom: 8, paddingRight: 24 }}>Date</th>
              <th style={{ textAlign: 'left', color: '#6b7080', fontWeight: 500, paddingBottom: 8 }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {rhythm.map(r => (
              <tr key={r.date} style={{ borderBottom: '1px solid #2a2d3a' }}>
                <td style={{ padding: '10px 24px 10px 0', fontWeight: 500, whiteSpace: 'nowrap' }}>{r.date}</td>
                <td style={{ padding: '10px 0', color: '#6b7080' }}>{r.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
