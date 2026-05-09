import { useEffect, useState } from 'react'
import { Button, Form, InputNumber, Input, Modal, Table, Popconfirm, Select, DatePicker, Collapse, App } from 'antd'
import { EditOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  fetchDebitSettings, upsertDebitSettings,
  fetchCardPayments, addCardPayment, deleteCardPayment,
  fetchTotalIncome, fetchBCADirectExpenses,
  fetchRecurring, addRecurring, updateRecurring, deleteRecurring,
  fetchCategories,
} from '../lib/supabase'
import { fmt, fmtDate, CARDS, CARD_BADGE_COLOR } from '../lib/utils'
import Badge from '../components/Badge'

const CREDIT_CARDS = Object.entries(CARDS).filter(([k]) => k !== 'cash')

export default function Accounts() {
  const { message } = App.useApp()

  const [settings, setSettings]         = useState(null)
  const [totalIncome, setTotalIncome]   = useState(0)
  const [directExp, setDirectExp]       = useState(0)
  const [payments, setPayments]         = useState([])
  const [recurring, setRecurring]       = useState([])
  const [categories, setCategories]     = useState([])
  const [loading, setLoading]           = useState(true)

  const [balanceOpen, setBalanceOpen]   = useState(false)
  const [paymentOpen, setPaymentOpen]   = useState(false)
  const [recurringOpen, setRecurringOpen] = useState(false)
  const [editingRec, setEditingRec]     = useState(null)

  const [balanceForm] = Form.useForm()
  const [payForm]     = Form.useForm()
  const [recForm]     = Form.useForm()

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [s, inc, exp, pays, recs, cats] = await Promise.all([
        fetchDebitSettings(), fetchTotalIncome(), fetchBCADirectExpenses(),
        fetchCardPayments(), fetchRecurring(), fetchCategories(),
      ])
      setSettings(s); setTotalIncome(inc); setDirectExp(exp)
      setPayments(pays); setRecurring(recs); setCategories(cats)
    } catch (e) {
      message.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  const totalCardPay  = payments.reduce((s, p) => s + p.amount, 0)
  const currentBalance = (settings?.initial_balance || 0) + totalIncome - directExp - totalCardPay
  const salary         = settings?.monthly_salary || 0

  async function handleSaveBalance() {
    try {
      const v = await balanceForm.validateFields()
      await upsertDebitSettings({ initial_balance: v.initial_balance, monthly_salary: v.monthly_salary })
      setSettings(prev => ({ ...prev, initial_balance: v.initial_balance, monthly_salary: v.monthly_salary }))
      setBalanceOpen(false)
      message.success('Saved')
    } catch (e) {
      if (e?.errorFields) return
      message.error(e.message)
    }
  }

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

  function openRecurringModal(rec = null) {
    setEditingRec(rec)
    if (rec) {
      recForm.setFieldsValue({ name: rec.name, amount: rec.amount, type: rec.type, method: rec.method, category: rec.category, note: rec.note, day_of_month: rec.day_of_month })
    } else {
      recForm.resetFields()
      recForm.setFieldsValue({ type: 'expense', method: 'card1' })
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

  const paymentCols = [
    { title: 'Date',   dataIndex: 'date',    key: 'date',    render: d => fmtDate(d), width: 110 },
    { title: 'Card',   dataIndex: 'card_id', key: 'card',    render: m => <Badge method={m} /> },
    { title: 'Note',   dataIndex: 'note',    key: 'note',    render: n => n || '—', responsive: ['sm'] },
    { title: 'Amount', dataIndex: 'amount',  key: 'amount',  align: 'right', width: 120, render: a => <span style={{ fontWeight: 600, color: '#f25f5c' }}>-{fmt(a)}</span> },
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

      {/* BCA Debit Balance */}
      <div className="card" style={{ marginBottom: 12, border: `1px solid ${currentBalance >= 0 ? '#3ecf8e33' : '#f25f5c33'}`, background: currentBalance >= 0 ? '#1a2e2a' : '#2e1a1a' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 11, color: '#6b7080', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>BCA Debit</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: currentBalance >= 0 ? '#3ecf8e' : '#f25f5c', lineHeight: 1.1 }}>
              {loading ? '...' : (currentBalance < 0 ? '-' : '') + fmt(currentBalance)}
            </div>
            {salary > 0 && <div style={{ fontSize: 12, color: '#6b7080', marginTop: 6 }}>Monthly salary: <span style={{ color: '#e2e4ef', fontWeight: 500 }}>{fmt(salary)}</span></div>}
          </div>
          <Button icon={<EditOutlined />} onClick={() => {
            balanceForm.setFieldsValue({ initial_balance: settings?.initial_balance || 0, monthly_salary: settings?.monthly_salary || 0 })
            setBalanceOpen(true)
          }}>Edit</Button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: 'Initial',         val: fmt(settings?.initial_balance || 0), color: '#e2e4ef' },
            { label: '+ Income',        val: fmt(totalIncome),                    color: '#3ecf8e' },
            { label: '− BCA Expenses',  val: fmt(directExp),                      color: '#f25f5c' },
            { label: '− Card Payments', val: fmt(totalCardPay),                   color: '#f25f5c' },
          ].map(s => (
            <div key={s.label} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: s.color }}>{s.val}</div>
              <div style={{ fontSize: 10, color: '#6b7080', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

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

      {/* Recurring Transactions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Recurring Transactions</h3>
        <Button type="primary" icon={<PlusOutlined />} size="small" onClick={() => openRecurringModal()}>
          Add
        </Button>
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

      {/* Balance modal */}
      <Modal title="BCA Debit Settings" open={balanceOpen} onCancel={() => setBalanceOpen(false)} onOk={handleSaveBalance} okText="Save" width={380}>
        <Form form={balanceForm} layout="vertical">
          <Form.Item label="Current Balance (initial)" name="initial_balance" rules={[{ required: true, type: 'number', min: 0 }]}>
            <InputNumber style={{ width: '100%' }} min={0} step={100000} placeholder="Your current BCA balance" />
          </Form.Item>
          <Form.Item label="Monthly Salary" name="monthly_salary" rules={[{ required: true, type: 'number', min: 0 }]}>
            <InputNumber style={{ width: '100%' }} min={0} step={500000} placeholder="Your monthly salary" />
          </Form.Item>
          <p style={{ fontSize: 12, color: '#6b7080' }}>
            Balance = Initial + All Income − BCA Direct Expenses − Card Payments
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
              {CREDIT_CARDS.map(([k, v]) => (
                <Select.Option key={k} value={k}><span style={{ color: CARD_BADGE_COLOR[k]?.color }}>{v}</span></Select.Option>
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
                {Object.entries(CARDS).map(([k, v]) => <Select.Option key={k} value={k}>{v}</Select.Option>)}
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
    </div>
  )
}
