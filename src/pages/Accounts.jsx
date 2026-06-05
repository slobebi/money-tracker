import { useEffect, useState } from 'react'
import { Button, Form, InputNumber, Input, Modal, Table, Popconfirm, Select, DatePicker, App, Switch } from 'antd'
import { EditOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  addCard, updateCard, deleteCard,
  fetchCardPayments, addCardPayment, deleteCardPayment,
  fetchTotalIncome, fetchDebitExpenses, fetchMonthTransactions,
  fetchRecurring, fetchMonthConfirmations, addRecurring, updateRecurring, deleteRecurring,
  fetchInstallments, addInstallment, updateInstallment, deleteInstallment,
  fetchCategories, fetchCardDebt,
} from '../lib/supabase'
import { fmt, fmtDate } from '../lib/utils'
import Badge from '../components/Badge'
import { useCards } from '../contexts/CardsContext'

const PRESET_COLORS = ['#6b7080', '#3ecf8e', '#38bdf8', '#a78bfa', '#fb7185', '#f5a623', '#9b94ff', '#6c63ff']

export default function Accounts() {
  const { message } = App.useApp()
  const { cards, debitCards, creditCards, cardMap, refresh: refreshCards } = useCards()

  const [totalIncome, setTotalIncome]   = useState(0)
  const [directExp, setDirectExp]       = useState(0)
  const [payments, setPayments]         = useState([])
  const [recurring, setRecurring]       = useState([])
  const [installments, setInstallments] = useState([])
  const [categories, setCategories]     = useState([])
  const [monthTxs, setMonthTxs]         = useState([])
  const [cardDebt, setCardDebt]         = useState({})
  const [confirmations, setConfirmations] = useState([])
  const [loading, setLoading]           = useState(true)

  // debit card add/edit modal
  const [debitModalOpen, setDebitModalOpen] = useState(false)
  const [editingDebit, setEditingDebit]     = useState(null)
  const [savingDebit, setSavingDebit]       = useState(false)
  const [debitForm] = Form.useForm()

  const [paymentOpen, setPaymentOpen]         = useState(false)
  const [recurringOpen, setRecurringOpen]     = useState(false)
  const [installmentOpen, setInstallmentOpen] = useState(false)
  const [editingRec, setEditingRec]           = useState(null)
  const [editingInst, setEditingInst]         = useState(null)

  const [payForm]  = Form.useForm()
  const [recForm]  = Form.useForm()
  const [instForm] = Form.useForm()

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const now = new Date()
      const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      const [inc, exp, pays, recs, insts, cats, mTxs, debt, confs] = await Promise.all([
        fetchTotalIncome(), fetchDebitExpenses(),
        fetchCardPayments(), fetchRecurring(), fetchInstallments(), fetchCategories(),
        fetchMonthTransactions(now.getFullYear(), now.getMonth()),
        fetchCardDebt(),
        fetchMonthConfirmations(monthStr),
      ])
      setTotalIncome(inc); setDirectExp(exp)
      setPayments(pays); setRecurring(recs); setInstallments(insts); setCategories(cats)
      setMonthTxs(mTxs); setCardDebt(debt); setConfirmations(confs)
    } catch (e) {
      message.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Debit card balance per card ──────────────────────────────────────────────
  const totalCardPay = payments.reduce((s, p) => s + p.amount, 0)

  function debitBalance(card) {
    return (card.current_balance || 0) + totalIncome - directExp - totalCardPay
  }

  // ── Expected savings ───────────────────────────────────────────────────────────
  const now = new Date()
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const debitIds = new Set(debitCards.map(c => c.id))
  const debitIncome  = monthTxs.filter(t => debitIds.has(t.method) && t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const debitExpenses = monthTxs.filter(t => debitIds.has(t.method) && t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const salary = debitCards.reduce((s, c) => s + (c.monthly_salary || 0), 0)

  // Pending installments per card
  const pendingInstByCard = {}
  installments.filter(inst => {
    if (inst.paid_months >= inst.total_months) return false
    const [y, m] = inst.start_year_month.split('-').map(Number)
    const d = new Date(y, m - 1 + inst.paid_months, 1)
    const nextDue = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    return nextDue <= monthStr
  }).forEach(inst => {
    pendingInstByCard[inst.card_id] = (pendingInstByCard[inst.card_id] || 0) + inst.monthly_amount
  })

  const dueThisCycle = creditCards.reduce((s, c) =>
    s + (cardDebt[`current_${c.id}`] || 0) + (pendingInstByCard[c.id] || 0), 0)
  const dueSalaryPeriod = creditCards.reduce((s, c) =>
    s + (cardDebt[c.id] || 0) + (pendingInstByCard[c.id] || 0), 0)

  const confirmedIds = new Set(confirmations.map(c => c.recurring_id))
  const unpaidRecurring = recurring
    .filter(r => r.active && !confirmedIds.has(r.id))
    .reduce((s, r) => s + r.amount, 0)

  const expectedSavings = salary + debitIncome - debitExpenses - dueSalaryPeriod - unpaidRecurring

  // ── Debit card modal ──────────────────────────────────────────────────────────
  function openAddDebit() {
    setEditingDebit(null)
    debitForm.resetFields()
    debitForm.setFieldsValue({ color: '#6b7080', active: true, sort_order: debitCards.length + 1 })
    setDebitModalOpen(true)
  }

  function openEditDebit(card) {
    setEditingDebit(card)
    debitForm.setFieldsValue({
      name:            card.name,
      color:           card.color,
      current_balance: card.current_balance,
      monthly_salary:  card.monthly_salary,
      active:          card.active,
      sort_order:      card.sort_order,
    })
    setDebitModalOpen(true)
  }

  async function handleSaveDebit() {
    try {
      const v = await debitForm.validateFields()
      setSavingDebit(true)
      const payload = {
        name:            v.name,
        type:            'debit',
        color:           v.color,
        current_balance: v.current_balance || 0,
        monthly_salary:  v.monthly_salary  || 0,
        active:          v.active ?? true,
        sort_order:      v.sort_order || 0,
      }
      if (editingDebit) {
        await updateCard(editingDebit.id, payload)
        message.success('Account updated')
      } else {
        const id = v.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') + '_' + Date.now()
        await addCard({ ...payload, id })
        message.success('Account added')
      }
      await refreshCards()
      setDebitModalOpen(false)
    } catch (e) {
      if (e?.errorFields) return
      message.error(e.message)
    } finally {
      setSavingDebit(false)
    }
  }

  async function handleDeleteDebit(card) {
    try {
      await deleteCard(card.id)
      await refreshCards()
      message.success(`"${card.name}" deleted`)
    } catch (e) {
      message.error(e.message)
    }
  }

  // ── Card payments ─────────────────────────────────────────────────────────────
  async function handleAddPayment() {
    try {
      const v = await payForm.validateFields()
      const pay = await addCardPayment({ date: v.date.format('YYYY-MM-DD'), card_id: v.card_id, amount: v.amount, note: v.note || '' })
      setPayments(prev => [pay, ...prev])
      setPaymentOpen(false); payForm.resetFields()
      message.success('Payment logged')
    } catch (e) {
      if (e?.errorFields) return
      message.error(e.message)
    }
  }

  async function handleDeletePayment(id) {
    try {
      await deleteCardPayment(id)
      setPayments(prev => prev.filter(p => p.id !== id))
      message.success('Deleted')
    } catch (e) { message.error(e.message) }
  }

  // ── Recurring ─────────────────────────────────────────────────────────────────
  function openRecurringModal(rec = null) {
    setEditingRec(rec)
    if (rec) {
      recForm.setFieldsValue({ name: rec.name, amount: rec.amount, type: rec.type, method: rec.method, category: rec.category, note: rec.note, day_of_month: rec.day_of_month })
    } else {
      recForm.resetFields()
      recForm.setFieldsValue({ type: 'expense', method: cards[0]?.id || '' })
    }
    setRecurringOpen(true)
  }

  async function handleSaveRecurring() {
    try {
      const v = await recForm.validateFields()
      if (editingRec) {
        await updateRecurring(editingRec.id, v)
        setRecurring(prev => prev.map(r => r.id === editingRec.id ? { ...r, ...v } : r))
        message.success('Updated')
      } else {
        const rec = await addRecurring(v)
        setRecurring(prev => [...prev, rec].sort((a, b) => a.day_of_month - b.day_of_month))
        message.success('Recurring added')
      }
      setRecurringOpen(false)
    } catch (e) {
      if (e?.errorFields) return
      message.error(e.message)
    }
  }

  async function handleDeleteRecurring(id, name) {
    try {
      await deleteRecurring(id)
      setRecurring(prev => prev.filter(r => r.id !== id))
      message.success(`"${name}" deleted`)
    } catch (e) { message.error(e.message) }
  }

  async function handleToggleRecurring(id, active) {
    try {
      await updateRecurring(id, { active: !active })
      setRecurring(prev => prev.map(r => r.id === id ? { ...r, active: !active } : r))
    } catch (e) { message.error(e.message) }
  }

  // ── Installments ─────────────────────────────────────────────────────────────
  function addMonthsToYM(ym, n) {
    const [y, m] = ym.split('-').map(Number)
    const d = new Date(y, m - 1 + n, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }
  function fmtYM(ym) {
    const [y, m] = ym.split('-').map(Number)
    return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  }

  function openInstallmentModal(inst = null) {
    setEditingInst(inst)
    if (inst) {
      instForm.setFieldsValue({
        description: inst.description, card_id: inst.card_id,
        monthly_amount: inst.monthly_amount, total_months: inst.total_months,
        paid_months: inst.paid_months, start_year_month: dayjs(`${inst.start_year_month}-01`),
        category: inst.category, note: inst.note,
      })
    } else {
      instForm.resetFields()
      instForm.setFieldsValue({ paid_months: 0, card_id: creditCards[0]?.id || '', start_year_month: dayjs() })
    }
    setInstallmentOpen(true)
  }

  async function handleSaveInstallment() {
    try {
      const v = await instForm.validateFields()
      const payload = {
        description: v.description, card_id: v.card_id,
        monthly_amount: v.monthly_amount, total_months: v.total_months,
        paid_months: v.paid_months ?? 0,
        start_year_month: v.start_year_month.format('YYYY-MM'),
        category: v.category, note: v.note || '',
      }
      if (editingInst) {
        await updateInstallment(editingInst.id, payload)
        setInstallments(prev => prev.map(i => i.id === editingInst.id ? { ...i, ...payload } : i))
        message.success('Updated')
      } else {
        const inst = await addInstallment(payload)
        setInstallments(prev => [inst, ...prev])
        message.success('Installment added')
      }
      setInstallmentOpen(false)
    } catch (e) {
      if (e?.errorFields) return
      message.error(e.message)
    }
  }

  async function handleDeleteInstallment(id, desc) {
    try {
      await deleteInstallment(id)
      setInstallments(prev => prev.filter(i => i.id !== id))
      message.success(`"${desc}" deleted`)
    } catch (e) { message.error(e.message) }
  }

  const paymentCols = [
    { title: 'Date',   dataIndex: 'date',    key: 'date',   render: d => fmtDate(d), width: 110 },
    { title: 'Card',   dataIndex: 'card_id', key: 'card',   render: m => <Badge method={m} /> },
    { title: 'Note',   dataIndex: 'note',    key: 'note',   render: n => n || '—', responsive: ['sm'] },
    { title: 'Amount', dataIndex: 'amount',  key: 'amount', align: 'right', width: 120,
      render: a => <span style={{ fontWeight: 600, color: '#f25f5c' }}>-{fmt(a)}</span> },
    { title: '', key: 'action', width: 44,
      render: (_, r) => (
        <Popconfirm title="Delete?" onConfirm={() => handleDeletePayment(r.id)} okText="Delete" okButtonProps={{ danger: true }} cancelText="No">
          <Button type="text" size="small" style={{ color: '#6b7080' }}>✕</Button>
        </Popconfirm>
      ),
    },
  ]

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16, color: '#e2e4ef' }}>Accounts</h2>

      {/* Debit accounts */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Debit Accounts</h3>
        <Button type="primary" icon={<PlusOutlined />} size="small" onClick={openAddDebit}>Add Account</Button>
      </div>

      {debitCards.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', color: '#6b7080', fontSize: 13, padding: '24px', marginBottom: 16 }}>
          No debit accounts yet. Add your bank account(s).
        </div>
      ) : (
        debitCards.map(card => {
          const bal = debitBalance(card)
          return (
            <div key={card.id} className="card" style={{ marginBottom: 12, border: `1px solid ${bal >= 0 ? '#3ecf8e33' : '#f25f5c33'}`, background: bal >= 0 ? '#1a2e2a' : '#2e1a1a' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 11, color: card.color || '#6b7080', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4, fontWeight: 600 }}>{card.name}</div>
                  <div style={{ fontSize: 32, fontWeight: 800, color: bal >= 0 ? '#3ecf8e' : '#f25f5c', lineHeight: 1.1 }}>
                    {loading ? '...' : (bal < 0 ? '-' : '') + fmt(bal)}
                  </div>
                  {card.monthly_salary > 0 && (
                    <div style={{ fontSize: 12, color: '#6b7080', marginTop: 6 }}>
                      Monthly salary: <span style={{ color: '#e2e4ef', fontWeight: 500 }}>{fmt(card.monthly_salary)}</span>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <Button icon={<EditOutlined />} size="small" onClick={() => openEditDebit(card)}>Edit</Button>
                  <Popconfirm
                    title={`Delete "${card.name}"?`}
                    onConfirm={() => handleDeleteDebit(card)}
                    okText="Delete" okButtonProps={{ danger: true }} cancelText="No"
                  >
                    <Button size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: 'Initial',         val: fmt(card.current_balance || 0), color: '#e2e4ef' },
                  { label: '+ Income',        val: fmt(totalIncome),               color: '#3ecf8e' },
                  { label: '− Debit Exp.',    val: fmt(directExp),                  color: '#f25f5c' },
                  { label: '− Card Payments', val: fmt(totalCardPay),               color: '#f25f5c' },
                ].map(s => (
                  <div key={s.label} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: s.color }}>{s.val}</div>
                    <div style={{ fontSize: 10, color: '#6b7080', marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )
        })
      )}

      {/* Expected Savings */}
      {salary > 0 && (
        <div className="card" style={{ marginBottom: 16, background: expectedSavings >= 0 ? '#1a2e2a' : '#2e1a1a', border: `1px solid ${expectedSavings >= 0 ? '#3ecf8e33' : '#f25f5c33'}` }}>
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

      {/* Card Payments */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Card Bill Payments</h3>
        <Button type="primary" icon={<PlusOutlined />} size="small" onClick={() => { payForm.setFieldsValue({ date: dayjs() }); setPaymentOpen(true) }}>
          Log Payment
        </Button>
      </div>
      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
        <Table dataSource={payments} columns={paymentCols} rowKey="id" loading={loading}
          scroll={{ x: 420 }} pagination={{ pageSize: 5, showSizeChanger: false }}
          locale={{ emptyText: 'No payments logged yet.' }} />
      </div>

      {/* Recurring */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Recurring Transactions</h3>
        <Button type="primary" icon={<PlusOutlined />} size="small" onClick={() => openRecurringModal()}>Add</Button>
      </div>

      {recurring.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', color: '#6b7080', fontSize: 13, padding: '24px' }}>
          No recurring transactions. Add subscriptions, salaries, or regular bills.
        </div>
      ) : (
        recurring.map(rec => (
          <div key={rec.id} className="card" style={{ marginBottom: 8, opacity: rec.active ? 1 : 0.5 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{rec.name}</span>
                  {!rec.active && <span style={{ fontSize: 10, background: '#6b707022', color: '#6b7080', padding: '1px 6px', borderRadius: 10 }}>PAUSED</span>}
                </div>
                <div style={{ fontSize: 12, color: '#6b7080', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Badge method={rec.method} />
                  <span>{rec.category}</span>
                  <span>· every {rec.day_of_month}{['st','nd','rd'][rec.day_of_month - 1] || 'th'}</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 8 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: rec.type === 'expense' ? '#f25f5c' : '#3ecf8e' }}>
                  {rec.type === 'expense' ? '-' : '+'}{fmt(rec.amount)}
                </span>
                <Button size="small" onClick={() => openRecurringModal(rec)}>Edit</Button>
                <Button size="small" onClick={() => handleToggleRecurring(rec.id, rec.active)}>
                  {rec.active ? 'Pause' : 'Resume'}
                </Button>
                <Popconfirm title={`Delete "${rec.name}"?`} onConfirm={() => handleDeleteRecurring(rec.id, rec.name)} okText="Delete" okButtonProps={{ danger: true }} cancelText="No">
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </div>
            </div>
          </div>
        ))
      )}

      {/* Installments */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, marginTop: 8 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Installments</h3>
        <Button type="primary" icon={<PlusOutlined />} size="small" onClick={() => openInstallmentModal()}>Add</Button>
      </div>

      {installments.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', color: '#6b7080', fontSize: 13, padding: '24px', marginBottom: 16 }}>
          No installments. Add existing or new cicilan from your credit cards.
        </div>
      ) : (
        installments.map(inst => {
          const remaining = inst.total_months - inst.paid_months
          const pct = Math.round((inst.paid_months / inst.total_months) * 100)
          const endYM = addMonthsToYM(inst.start_year_month, inst.total_months - 1)
          const done = remaining <= 0
          return (
            <div key={inst.id} className="card" style={{ marginBottom: 8, border: done ? '1px solid #3ecf8e33' : '1px solid #2a2d3a' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{inst.description}</span>
                    {done && <span style={{ fontSize: 10, background: '#3ecf8e22', color: '#3ecf8e', padding: '1px 6px', borderRadius: 10 }}>PAID OFF</span>}
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7080', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <Badge method={inst.card_id} />
                    <span>{inst.category}</span>
                    <span>· {fmtYM(inst.start_year_month)} → {fmtYM(endYM)}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, marginLeft: 8 }}>
                  <Button size="small" onClick={() => openInstallmentModal(inst)}>Edit</Button>
                  <Popconfirm title={`Delete "${inst.description}"?`} onConfirm={() => handleDeleteInstallment(inst.id, inst.description)} okText="Delete" okButtonProps={{ danger: true }} cancelText="No">
                    <Button size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </div>
              </div>

              <div style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6b7080', marginBottom: 4 }}>
                  <span>{inst.paid_months} of {inst.total_months} months paid</span>
                  <span style={{ color: done ? '#3ecf8e' : '#e2e4ef', fontWeight: 600 }}>{pct}%</span>
                </div>
                <div style={{ background: '#0f1117', borderRadius: 6, height: 6, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 6, background: done ? '#3ecf8e' : '#6c63ff', width: `${pct}%`, transition: 'width .4s' }} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'per month',     val: fmt(inst.monthly_amount),                                         color: '#e2e4ef' },
                  { label: 'months left',   val: done ? '✓' : remaining,                                           color: done ? '#3ecf8e' : '#f5a623' },
                  { label: 'remaining',     val: done ? '✓ 0' : fmt(remaining * inst.monthly_amount),              color: done ? '#3ecf8e' : '#f25f5c' },
                ].map(s => (
                  <div key={s.label} style={{ background: '#0f1117', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: s.color }}>{s.val}</div>
                    <div style={{ fontSize: 10, color: '#6b7080', marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )
        })
      )}

      {/* Debit account modal */}
      <Modal
        title={editingDebit ? `Edit ${editingDebit.name}` : 'Add Debit Account'}
        open={debitModalOpen} onCancel={() => setDebitModalOpen(false)}
        onOk={handleSaveDebit} okText="Save" confirmLoading={savingDebit} width={420}
      >
        <Form form={debitForm} layout="vertical">
          <Form.Item label="Account Name" name="name" rules={[{ required: true }]}>
            <Input placeholder="e.g. BCA Debit, Mandiri, GoPay" />
          </Form.Item>
          <Form.Item label="Color" name="color">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {PRESET_COLORS.map(col => (
                <div key={col} onClick={() => debitForm.setFieldValue('color', col)}
                  style={{ width: 28, height: 28, borderRadius: '50%', background: col, cursor: 'pointer',
                    border: debitForm.getFieldValue('color') === col ? '3px solid #fff' : '3px solid transparent', boxSizing: 'border-box' }} />
              ))}
            </div>
          </Form.Item>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Form.Item label="Current Balance (seed)" name="current_balance" rules={[{ required: true, type: 'number', min: 0 }]}>
              <InputNumber style={{ width: '100%' }} min={0} step={100000} placeholder="Your current balance" />
            </Form.Item>
            <Form.Item label="Monthly Salary" name="monthly_salary">
              <InputNumber style={{ width: '100%' }} min={0} step={500000} placeholder="0 if not applicable" />
            </Form.Item>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Form.Item label="Sort Order" name="sort_order">
              <InputNumber style={{ width: '100%' }} min={0} />
            </Form.Item>
            <Form.Item label="Active" name="active" valuePropName="checked">
              <Switch />
            </Form.Item>
          </div>
          <p style={{ fontSize: 11, color: '#6b7080', margin: 0 }}>
            Balance = Seed + All income − Debit expenses − Card payments
          </p>
        </Form>
      </Modal>

      {/* Card payment modal */}
      <Modal title="Log Card Bill Payment" open={paymentOpen} onCancel={() => setPaymentOpen(false)} onOk={handleAddPayment} okText="Log Payment" width={420}>
        <Form form={payForm} layout="vertical" initialValues={{ date: dayjs() }}>
          <Form.Item label="Date" name="date" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" allowClear={false} />
          </Form.Item>
          <Form.Item label="Credit Card" name="card_id" rules={[{ required: true }]}>
            <Select placeholder="Which card?">
              {creditCards.map(c => (
                <Select.Option key={c.id} value={c.id}>
                  <span style={{ color: c.color }}>{c.name}</span>
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label="Amount Paid" name="amount" rules={[{ required: true, type: 'number', min: 1 }]}>
            <InputNumber style={{ width: '100%' }} min={0} step={100000} placeholder="Amount paid" />
          </Form.Item>
          <Form.Item label="Note" name="note">
            <Input placeholder="e.g. full payment, min payment..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Recurring modal */}
      <Modal
        title={editingRec ? 'Edit Recurring' : 'Add Recurring Transaction'}
        open={recurringOpen} onCancel={() => setRecurringOpen(false)}
        onOk={handleSaveRecurring} okText="Save" width={440}
      >
        <Form form={recForm} layout="vertical">
          <Form.Item label="Name" name="name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Netflix, Electricity bill, Rent" />
          </Form.Item>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Form.Item label="Amount" name="amount" rules={[{ required: true, type: 'number', min: 0.01 }]}>
              <InputNumber style={{ width: '100%' }} min={0} step={10000} />
            </Form.Item>
            <Form.Item label="Day of Month" name="day_of_month" rules={[{ required: true, type: 'number', min: 1, max: 28 }]}>
              <InputNumber style={{ width: '100%' }} min={1} max={28} placeholder="1–28" />
            </Form.Item>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Form.Item label="Type" name="type" rules={[{ required: true }]}>
              <Select>
                <Select.Option value="expense">Expense</Select.Option>
                <Select.Option value="income">Income</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item label="Method" name="method" rules={[{ required: true }]}>
              <Select>
                {cards.map(c => <Select.Option key={c.id} value={c.id}>{c.name}</Select.Option>)}
              </Select>
            </Form.Item>
          </div>
          <Form.Item label="Category" name="category" rules={[{ required: true }]}>
            <Select showSearch placeholder="Select category">
              {categories.map(c => <Select.Option key={c.id} value={c.name}>{c.name}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item label="Note" name="note">
            <Input placeholder="Optional note" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Installment modal */}
      <Modal
        title={editingInst ? 'Edit Installment' : 'Add Installment'}
        open={installmentOpen} onCancel={() => setInstallmentOpen(false)}
        onOk={handleSaveInstallment} okText="Save" width={460}
      >
        <Form form={instForm} layout="vertical">
          <Form.Item label="Description" name="description" rules={[{ required: true }]}>
            <Input placeholder="e.g. iPhone 15, Samsung TV, Laptop" />
          </Form.Item>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Form.Item label="Credit Card" name="card_id" rules={[{ required: true }]}>
              <Select>
                {creditCards.map(c => (
                  <Select.Option key={c.id} value={c.id}>
                    <span style={{ color: c.color }}>{c.name}</span>
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item label="Start Month" name="start_year_month" rules={[{ required: true }]}>
              <DatePicker picker="month" style={{ width: '100%' }} format="MMM YYYY" allowClear={false} />
            </Form.Item>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Form.Item label="Monthly Amount" name="monthly_amount" rules={[{ required: true, type: 'number', min: 1 }]}>
              <InputNumber style={{ width: '100%' }} min={0} step={50000} placeholder="Amount per month" />
            </Form.Item>
            <Form.Item label="Total Months" name="total_months" rules={[{ required: true, type: 'number', min: 1 }]}>
              <InputNumber style={{ width: '100%' }} min={1} max={120} placeholder="e.g. 12, 24, 36" />
            </Form.Item>
          </div>
          <Form.Item
            label="Already Paid Months" name="paid_months"
            rules={[{ required: true, type: 'number', min: 0 }]}
            extra="Set > 0 if this installment already started before you used this app"
          >
            <InputNumber style={{ width: '100%' }} min={0} placeholder="0 = starts fresh" />
          </Form.Item>
          <Form.Item label="Category" name="category" rules={[{ required: true }]}>
            <Select showSearch placeholder="Select category">
              {categories.map(c => <Select.Option key={c.id} value={c.name}>{c.name}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item label="Note" name="note">
            <Input placeholder="Optional note" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
