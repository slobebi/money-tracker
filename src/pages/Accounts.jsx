import { useEffect, useState } from 'react'
import { Button, Form, InputNumber, Input, Modal, Table, Popconfirm, Select, DatePicker, App, Progress } from 'antd'
import { EditOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  fetchDebitSettings, upsertDebitSettings,
  fetchCardPayments, addCardPayment, deleteCardPayment,
  fetchTotalIncome, fetchBCADirectExpenses,
  fetchRecurring, addRecurring, updateRecurring, deleteRecurring,
  fetchInstallments, addInstallment, updateInstallment, deleteInstallment,
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
  const [installments, setInstallments] = useState([])
  const [categories, setCategories]     = useState([])
  const [loading, setLoading]           = useState(true)

  const [balanceOpen, setBalanceOpen]         = useState(false)
  const [paymentOpen, setPaymentOpen]         = useState(false)
  const [recurringOpen, setRecurringOpen]     = useState(false)
  const [installmentOpen, setInstallmentOpen] = useState(false)
  const [editingRec, setEditingRec]           = useState(null)
  const [editingInst, setEditingInst]         = useState(null)

  const [balanceForm] = Form.useForm()
  const [payForm]     = Form.useForm()
  const [recForm]     = Form.useForm()
  const [instForm]    = Form.useForm()

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [s, inc, exp, pays, recs, insts, cats] = await Promise.all([
        fetchDebitSettings(), fetchTotalIncome(), fetchBCADirectExpenses(),
        fetchCardPayments(), fetchRecurring(), fetchInstallments(), fetchCategories(),
      ])
      setSettings(s); setTotalIncome(inc); setDirectExp(exp)
      setPayments(pays); setRecurring(recs); setInstallments(insts); setCategories(cats)
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
        description: inst.description,
        card_id: inst.card_id,
        monthly_amount: inst.monthly_amount,
        total_months: inst.total_months,
        paid_months: inst.paid_months,
        start_year_month: dayjs(`${inst.start_year_month}-01`),
        category: inst.category,
        note: inst.note,
      })
    } else {
      instForm.resetFields()
      instForm.setFieldsValue({ paid_months: 0, card_id: 'card1', start_year_month: dayjs() })
    }
    setInstallmentOpen(true)
  }

  async function handleSaveInstallment() {
    try {
      const v = await instForm.validateFields()
      const payload = {
        description:      v.description,
        card_id:          v.card_id,
        monthly_amount:   v.monthly_amount,
        total_months:     v.total_months,
        paid_months:      v.paid_months ?? 0,
        start_year_month: v.start_year_month.format('YYYY-MM'),
        category:         v.category,
        note:             v.note || '',
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

      {/* Installments */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, marginTop: 8 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Installments</h3>
        <Button type="primary" icon={<PlusOutlined />} size="small" onClick={() => openInstallmentModal()}>
          Add
        </Button>
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
                <div style={{ background: '#0f1117', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e4ef' }}>{fmt(inst.monthly_amount)}</div>
                  <div style={{ fontSize: 10, color: '#6b7080', marginTop: 2 }}>per month</div>
                </div>
                <div style={{ background: '#0f1117', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: done ? '#3ecf8e' : '#f5a623' }}>{done ? '✓' : remaining}</div>
                  <div style={{ fontSize: 10, color: '#6b7080', marginTop: 2 }}>months left</div>
                </div>
                <div style={{ background: '#0f1117', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: done ? '#3ecf8e' : '#f25f5c' }}>
                    {done ? '✓ 0' : fmt(remaining * inst.monthly_amount)}
                  </div>
                  <div style={{ fontSize: 10, color: '#6b7080', marginTop: 2 }}>remaining</div>
                </div>
              </div>
            </div>
          )
        })
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
                {Object.entries(CARDS).filter(([k]) => k !== 'cash').map(([k, v]) => (
                  <Select.Option key={k} value={k}><span style={{ color: CARD_BADGE_COLOR[k]?.color }}>{v}</span></Select.Option>
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
            label="Already Paid Months"
            name="paid_months"
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
