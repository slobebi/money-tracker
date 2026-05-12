import { useEffect, useState } from 'react'
import { Button, InputNumber, Form, App, Modal, Input, Select, Switch, Popconfirm } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { addCard, updateCard, deleteCard, fetchCycleSpending, fetchCardDebt, fetchInstallments } from '../lib/supabase'
import { fmt, currentBillingCycle } from '../lib/utils'
import { useCards } from '../contexts/CardsContext'

const PRESET_COLORS = ['#9b94ff', '#f5a623', '#3ecf8e', '#f25f5c', '#6c63ff', '#38bdf8', '#a78bfa', '#fb7185']

export default function Cards() {
  const { message } = App.useApp()
  const { creditCards, refresh } = useCards()

  const [cycling, setCycling]         = useState({})
  const [debt, setDebt]               = useState({ total: 0, installmentTotal: 0, _creditCardIds: [] })
  const [pendingInstByCard, setPendingInstByCard] = useState({})
  const [loading, setLoading]         = useState(true)

  const [cardModalOpen, setCardModalOpen] = useState(false)
  const [editingCard, setEditingCard]     = useState(null)
  const [saving, setSaving]               = useState(false)
  const [form] = Form.useForm()

  useEffect(() => {
    if (creditCards.length === 0 && !loading) return
    loadData()
  }, [creditCards])

  async function loadData() {
    if (creditCards.length === 0) { setLoading(false); return }
    try {
      const now = new Date()
      const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

      const [debtData, installments, ...spending] = await Promise.all([
        fetchCardDebt(),
        fetchInstallments(),
        ...creditCards.map(c => {
          const { from, to } = currentBillingCycle(c.bill_day || 1)
          return fetchCycleSpending(c.id, from, to)
        }),
      ])

      setDebt(debtData)

      const cyc = {}
      creditCards.forEach((c, i) => { cyc[c.id] = spending[i] })
      setCycling(cyc)

      // Pending installments = due this month but not yet confirmed
      const pending = {}
      installments.forEach(inst => {
        if (inst.paid_months >= inst.total_months) return
        const [y, m] = inst.start_year_month.split('-').map(Number)
        const d = new Date(y, m - 1 + inst.paid_months, 1)
        const nextDue = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        if (nextDue <= monthStr) {
          pending[inst.card_id] = (pending[inst.card_id] || 0) + inst.monthly_amount
        }
      })
      setPendingInstByCard(pending)
    } catch (e) {
      message.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  function openAdd() {
    setEditingCard(null)
    form.resetFields()
    form.setFieldsValue({ type: 'credit', color: '#9b94ff', active: true, due_next_month: false, sort_order: creditCards.length + 1 })
    setCardModalOpen(true)
  }

  function openEdit(card) {
    setEditingCard(card)
    form.setFieldsValue({
      name:            card.name,
      color:           card.color,
      bill_day:        card.bill_day,
      due_day:         card.due_day,
      due_next_month:  card.due_next_month,
      credit_limit:    card.credit_limit,
      current_balance: card.current_balance,
      active:          card.active,
      sort_order:      card.sort_order,
    })
    setCardModalOpen(true)
  }

  async function handleSaveCard() {
    try {
      const v = await form.validateFields()
      setSaving(true)
      const payload = {
        name:            v.name,
        type:            'credit',
        color:           v.color,
        bill_day:        v.bill_day || null,
        due_day:         v.due_day || null,
        due_next_month:  v.due_next_month ?? false,
        credit_limit:    v.credit_limit || 0,
        current_balance: v.current_balance || 0,
        active:          v.active ?? true,
        sort_order:      v.sort_order || 0,
      }
      if (editingCard) {
        await updateCard(editingCard.id, payload)
        message.success('Card updated')
      } else {
        const id = v.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') + '_' + Date.now()
        await addCard({ ...payload, id })
        message.success('Card added')
      }
      await refresh()
      setCardModalOpen(false)
      loadData()
    } catch (e) {
      if (e?.errorFields) return
      message.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteCard(card) {
    try {
      await deleteCard(card.id)
      await refresh()
      message.success(`"${card.name}" deleted`)
    } catch (e) {
      message.error(e.message)
    }
  }

  const rhythm = [
    { date: '1st',              action: 'Review previous month total spending' },
    { date: '15th–17th',        action: 'Pay cards due before payday (e.g. BCA)' },
    { date: 'Last working day', action: 'Pay remaining card bills — review full month' },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: '#e2e4ef', margin: 0 }}>Credit Cards</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>Add Card</Button>
      </div>

      {/* Total debt summary */}
      {(() => {
        const grandTotal = debt.total + debt.installmentTotal
        return (
          <div className="card" style={{ marginBottom: 16, border: `1px solid ${grandTotal > 0 ? '#f25f5c33' : '#3ecf8e33'}`, background: grandTotal > 0 ? '#2e1a1a' : '#1a2e2a' }}>
            <div style={{ fontSize: 11, color: '#6b7080', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Total Outstanding Debt</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: grandTotal > 0 ? '#f25f5c' : '#3ecf8e', marginBottom: 2 }}>
              {grandTotal > 0 ? fmt(grandTotal) : '✓ All clear'}
            </div>
            {debt.installmentTotal > 0 && (
              <div style={{ fontSize: 12, color: '#f5a623', marginBottom: 10 }}>
                incl. {fmt(debt.installmentTotal)} remaining installments
              </div>
            )}
            {creditCards.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                {creditCards.map(c => {
                  const cardInstRem = debt[`installment_${c.id}`] || 0
                  const cardTotal   = (debt[c.id] || 0) + cardInstRem
                  return (
                    <div key={c.id} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: '8px 10px', textAlign: 'center', minWidth: 90 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: cardTotal > 0 ? '#f25f5c' : '#3ecf8e' }}>
                        {cardTotal > 0 ? fmt(cardTotal) : '✓ Paid'}
                      </div>
                      {cardInstRem > 0 && (
                        <div style={{ fontSize: 10, color: '#f5a623', marginTop: 1 }}>
                          {fmt(cardInstRem)} cicilan
                        </div>
                      )}
                      <div style={{ fontSize: 10, color: c.color, marginTop: 2, fontWeight: 600 }}>{c.name}</div>
                    </div>
                  )
                })}
              </div>
            )}
            <div style={{ fontSize: 11, color: '#6b7080', marginTop: 10 }}>
              Debt = outstanding + tracked expenses − payments + remaining installments
            </div>
          </div>
        )
      })()}

      {creditCards.length === 0 && !loading && (
        <div className="card" style={{ textAlign: 'center', color: '#6b7080', padding: '32px', marginBottom: 16 }}>
          No credit cards added yet. Click "Add Card" to get started.
        </div>
      )}

      {creditCards.map(c => {
        const totalLimit   = c.credit_limit || 0
        const thisCycle    = cycling[c.id]  || 0
        const pendingInst  = pendingInstByCard[c.id]     || 0
        const instRem      = debt[`installment_${c.id}`] || 0
        const futureInst   = Math.max(instRem - pendingInst, 0)

        // Projected bill = current cycle charges + installment due this month
        const projected      = thisCycle + pendingInst
        // Total committed = current cycle + all remaining installments
        const totalCommitted = thisCycle + instRem
        const available    = totalLimit - totalCommitted
        const utilPct      = totalLimit > 0 ? Math.min((totalCommitted / totalLimit) * 100, 100) : 0
        const utilColor    = utilPct >= 90 ? '#f25f5c' : utilPct >= 70 ? '#f5a623' : '#3ecf8e'
        const { from, to } = c.bill_day ? currentBillingCycle(c.bill_day) : { from: '—', to: '—' }
        const accentColor = c.color || '#9b94ff'
        const borderColor = accentColor + '44'

        const dueStr = c.due_day
          ? `${c.due_day}${['st','nd','rd'][c.due_day-1]||'th'}${c.due_next_month ? ' (next month)' : ''}`
          : '—'
        const billStr = c.bill_day
          ? `${c.bill_day}${['st','nd','rd'][c.bill_day-1]||'th'} of each month`
          : '—'

        return (
          <div key={c.id} className="card" style={{ marginBottom: 16, border: `1px solid ${borderColor}`, opacity: c.active ? 1 : 0.6 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: accentColor, flexShrink: 0 }} />
                <h3 style={{ fontSize: 14, fontWeight: 600, color: accentColor, textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>
                  {c.name}
                </h3>
                {!c.active && <span style={{ fontSize: 10, background: '#6b707022', color: '#6b7080', padding: '1px 6px', borderRadius: 10 }}>INACTIVE</span>}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(c)}>Edit</Button>
                <Popconfirm
                  title={`Delete "${c.name}"?`}
                  description="All transactions referencing this card will remain but lose the card label."
                  onConfirm={() => handleDeleteCard(c)}
                  okText="Delete" okButtonProps={{ danger: true }} cancelText="No"
                >
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </div>
            </div>

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
                    { label: 'Credit Limit',    val: fmt(totalLimit),             color: '#e2e4ef' },
                    { label: 'This Cycle Bill', val: fmt(projected),              color: '#f25f5c' },
                    { label: 'Available',        val: available >= 0 ? fmt(available) : `−${fmt(Math.abs(available))}`, color: available >= 0 ? '#3ecf8e' : '#f25f5c' },
                  ].map(s => (
                    <div key={s.label} style={{ background: '#0f1117', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: s.color }}>{s.val}</div>
                      <div style={{ fontSize: 11, color: '#6b7080', marginTop: 2 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #2a2d3a', fontSize: 12, color: '#6b7080', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>This cycle {c.bill_day ? `(${from.slice(5)} → ${to.slice(5)})` : ''}</span>
                    <span style={{ color: '#e2e4ef', fontWeight: 500 }}>{fmt(thisCycle)}</span>
                  </div>
                  {pendingInst > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#9b94ff' }}>+ Installment due this month</span>
                      <span style={{ color: '#9b94ff', fontWeight: 600 }}>+ {fmt(pendingInst)}</span>
                    </div>
                  )}
                  {futureInst > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#f5a623' }}>+ Future installments</span>
                      <span style={{ color: '#f5a623', fontWeight: 600 }}>+ {fmt(futureInst)}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 4, borderTop: '1px solid #2a2d3a', marginTop: 2 }}>
                    <span>Current cycle debt</span>
                    <span style={{ fontWeight: 600, color: debt[c.id] > 0 ? '#f25f5c' : '#3ecf8e' }}>
                      {debt[c.id] > 0 ? fmt(debt[c.id]) : '✓ Cleared'}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: '#6b7080', fontStyle: 'italic', marginBottom: 12 }}>
                No limit set — edit card to set credit limit.
              </div>
            )}

            {/* Schedule */}
            <div style={{ paddingTop: 12, borderTop: '1px solid #2a2d3a' }}>
              {[
                ['Bill cuts', billStr, '#e2e4ef'],
                ['Due date',  dueStr,  '#e2e4ef'],
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

      {/* Add/Edit card modal */}
      <Modal
        title={editingCard ? `Edit ${editingCard.name}` : 'Add Credit Card'}
        open={cardModalOpen}
        onCancel={() => setCardModalOpen(false)}
        onOk={handleSaveCard}
        okText="Save"
        confirmLoading={saving}
        width={480}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="Card Name" name="name" rules={[{ required: true, message: 'Enter card name' }]}>
            <Input placeholder="e.g. BCA, Mandiri Visa, CIMB" />
          </Form.Item>

          <Form.Item label="Color" name="color">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {PRESET_COLORS.map(col => (
                <div
                  key={col}
                  onClick={() => form.setFieldValue('color', col)}
                  style={{
                    width: 28, height: 28, borderRadius: '50%', background: col, cursor: 'pointer',
                    border: form.getFieldValue('color') === col ? '3px solid #fff' : '3px solid transparent',
                    boxSizing: 'border-box',
                  }}
                />
              ))}
            </div>
          </Form.Item>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Form.Item label="Bill Day (statement cutoff)" name="bill_day">
              <InputNumber style={{ width: '100%' }} min={1} max={28} placeholder="e.g. 3, 15, 16" />
            </Form.Item>
            <Form.Item label="Due Day" name="due_day">
              <InputNumber style={{ width: '100%' }} min={1} max={31} placeholder="e.g. 4, 19, 31" />
            </Form.Item>
          </div>

          <Form.Item label="Due date is in next month" name="due_next_month" valuePropName="checked">
            <Switch />
          </Form.Item>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Form.Item label="Credit Limit" name="credit_limit">
              <InputNumber style={{ width: '100%' }} min={0} step={1000000} placeholder="e.g. 10000000" />
            </Form.Item>
            <Form.Item label="Current Outstanding" name="current_balance">
              <InputNumber style={{ width: '100%' }} min={0} step={100000} placeholder="Balance you owe now" />
            </Form.Item>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Form.Item label="Sort Order" name="sort_order">
              <InputNumber style={{ width: '100%' }} min={0} placeholder="1, 2, 3..." />
            </Form.Item>
            <Form.Item label="Active" name="active" valuePropName="checked">
              <Switch />
            </Form.Item>
          </div>

          <p style={{ fontSize: 11, color: '#6b7080', margin: 0 }}>
            "Current Outstanding" = what you already owe before logging transactions in this app.
          </p>
        </Form>
      </Modal>
    </div>
  )
}
