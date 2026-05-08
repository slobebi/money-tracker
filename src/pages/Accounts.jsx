import { useEffect, useState } from 'react'
import { Button, Form, InputNumber, Modal, Table, Popconfirm, Select, DatePicker, Input, App } from 'antd'
import { EditOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  fetchDebitSettings, upsertDebitSettings,
  fetchCardPayments, addCardPayment, deleteCardPayment,
  fetchTotalIncome, fetchBCADirectExpenses,
} from '../lib/supabase'
import { fmt, fmtDate, CARDS, CARD_BADGE_COLOR } from '../lib/utils'
import Badge from '../components/Badge'

const CREDIT_CARDS = Object.entries(CARDS).filter(([k]) => k !== 'cash')

export default function Accounts() {
  const { message } = App.useApp()

  // Balance state
  const [initialBalance, setInitialBalance] = useState(0)
  const [totalIncome, setTotalIncome]         = useState(0)
  const [directExpenses, setDirectExpenses]   = useState(0)
  const [payments, setPayments]               = useState([])
  const [loading, setLoading]                 = useState(true)

  // Modals
  const [balanceOpen, setBalanceOpen] = useState(false)
  const [paymentOpen, setPaymentOpen] = useState(false)

  const [balanceForm] = Form.useForm()
  const [payForm]     = Form.useForm()
  const [savingBal, setSavingBal]   = useState(false)
  const [savingPay, setSavingPay]   = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [settings, income, expenses, pays] = await Promise.all([
        fetchDebitSettings(),
        fetchTotalIncome(),
        fetchBCADirectExpenses(),
        fetchCardPayments(),
      ])
      setInitialBalance(settings?.initial_balance || 0)
      setTotalIncome(income)
      setDirectExpenses(expenses)
      setPayments(pays)
    } catch (e) {
      message.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  const totalCardPayments = payments.reduce((s, p) => s + p.amount, 0)
  const currentBalance    = initialBalance + totalIncome - directExpenses - totalCardPayments

  async function handleSaveBalance() {
    try {
      const values = await balanceForm.validateFields()
      setSavingBal(true)
      await upsertDebitSettings(values.initial_balance)
      setInitialBalance(values.initial_balance)
      setBalanceOpen(false)
      message.success('Initial balance saved')
    } catch (e) {
      if (e?.errorFields) return
      message.error(e.message)
    } finally {
      setSavingBal(false)
    }
  }

  async function handleAddPayment() {
    try {
      const values = await payForm.validateFields()
      setSavingPay(true)
      const payment = await addCardPayment({
        date:    values.date.format('YYYY-MM-DD'),
        card_id: values.card_id,
        amount:  values.amount,
        note:    values.note || '',
      })
      setPayments(prev => [payment, ...prev])
      setPaymentOpen(false)
      payForm.resetFields()
      message.success('Payment logged')
    } catch (e) {
      if (e?.errorFields) return
      message.error(e.message)
    } finally {
      setSavingPay(false)
    }
  }

  async function handleDeletePayment(id) {
    try {
      await deleteCardPayment(id)
      setPayments(prev => prev.filter(p => p.id !== id))
      message.success('Deleted')
    } catch (e) {
      message.error(e.message)
    }
  }

  const paymentColumns = [
    { title: 'Date',   dataIndex: 'date',    key: 'date',    render: d => fmtDate(d), width: 120 },
    { title: 'Card',   dataIndex: 'card_id', key: 'card_id', render: m => <Badge method={m} /> },
    { title: 'Note',   dataIndex: 'note',    key: 'note',    render: n => n || '—', responsive: ['sm'] },
    {
      title: 'Amount', dataIndex: 'amount', key: 'amount', align: 'right', width: 130,
      render: amt => <span style={{ fontWeight: 600, color: '#f25f5c' }}>- {fmt(amt)}</span>,
    },
    {
      title: '', key: 'action', width: 50,
      render: (_, r) => (
        <Popconfirm title="Delete this payment?" onConfirm={() => handleDeletePayment(r.id)}
          okText="Delete" okButtonProps={{ danger: true }} cancelText="Cancel">
          <Button type="text" size="small" style={{ color: '#6b7080' }}>✕</Button>
        </Popconfirm>
      ),
    },
  ]

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 20, color: '#e2e4ef' }}>Accounts</h2>

      {/* BCA Debit Balance Card */}
      <div className="card" style={{ marginBottom: 16, border: '1px solid #f25f5c44' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: '#6b7080', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
              BCA Debit
            </div>
            {loading ? (
              <div style={{ fontSize: 13, color: '#6b7080' }}>Loading...</div>
            ) : (
              <div style={{ fontSize: 36, fontWeight: 700, color: currentBalance >= 0 ? '#3ecf8e' : '#f25f5c' }}>
                {currentBalance < 0 ? '-' : ''}{fmt(currentBalance)}
              </div>
            )}
            <div style={{ fontSize: 12, color: '#6b7080', marginTop: 4 }}>Current Balance</div>
          </div>
          <Button
            icon={<EditOutlined />}
            onClick={() => {
              balanceForm.setFieldsValue({ initial_balance: initialBalance })
              setBalanceOpen(true)
            }}
          >
            Set Balance
          </Button>
        </div>

        {/* Breakdown */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: 'Initial',          val: fmt(initialBalance),    color: '#e2e4ef' },
            { label: '+ Income',         val: fmt(totalIncome),       color: '#3ecf8e' },
            { label: '− BCA Expenses',   val: fmt(directExpenses),    color: '#f25f5c' },
            { label: '− Card Payments',  val: fmt(totalCardPayments), color: '#f25f5c' },
          ].map(s => (
            <div key={s.label} style={{ background: '#0f1117', borderRadius: 8, padding: '10px', textAlign: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: s.color }}>{s.val}</div>
              <div style={{ fontSize: 11, color: '#6b7080', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 12, padding: '10px 0 0', borderTop: '1px solid #2a2d3a', fontSize: 12, color: '#6b7080', lineHeight: 1.6 }}>
          <strong style={{ color: '#9b94ff' }}>How balance is calculated:</strong>
          {' '}Initial balance + all income − BCA direct expenses − credit card bill payments
        </div>
      </div>

      {/* Card Payments */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: '#e2e4ef', margin: 0 }}>Credit Card Bill Payments</h3>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => {
          payForm.setFieldsValue({ date: dayjs() })
          setPaymentOpen(true)
        }}>
          Log Payment
        </Button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <Table
          dataSource={payments}
          columns={paymentColumns}
          rowKey="id"
          loading={loading}
          scroll={{ x: 420 }}
          pagination={{ pageSize: 10, showSizeChanger: false }}
          locale={{ emptyText: 'No card payments logged yet.' }}
        />
      </div>

      {/* Set Initial Balance Modal */}
      <Modal
        title="Set BCA Debit Initial Balance"
        open={balanceOpen}
        onCancel={() => setBalanceOpen(false)}
        onOk={handleSaveBalance}
        confirmLoading={savingBal}
        okText="Save"
        width={380}
      >
        <p style={{ fontSize: 13, color: '#6b7080', marginBottom: 16 }}>
          Enter your current BCA Debit balance. All future income and expense transactions will be calculated on top of this.
        </p>
        <Form form={balanceForm} layout="vertical">
          <Form.Item label="Current Balance" name="initial_balance" rules={[{ required: true, type: 'number', min: 0, message: 'Required' }]}>
            <InputNumber style={{ width: '100%' }} min={0} step={100000} placeholder="e.g. 5000000" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Log Card Payment Modal */}
      <Modal
        title="Log Credit Card Bill Payment"
        open={paymentOpen}
        onCancel={() => setPaymentOpen(false)}
        onOk={handleAddPayment}
        confirmLoading={savingPay}
        okText="Log Payment"
        width={420}
      >
        <p style={{ fontSize: 13, color: '#6b7080', marginBottom: 16 }}>
          Record when you pay a credit card bill from your BCA Debit account.
        </p>
        <Form form={payForm} layout="vertical" initialValues={{ date: dayjs() }}>
          <Form.Item label="Date" name="date" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" allowClear={false} />
          </Form.Item>
          <Form.Item label="Credit Card" name="card_id" rules={[{ required: true, message: 'Select card' }]}>
            <Select placeholder="Which card did you pay?">
              {CREDIT_CARDS.map(([k, v]) => (
                <Select.Option key={k} value={k}>
                  <span style={{ color: CARD_BADGE_COLOR[k]?.color }}>{v}</span>
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label="Amount Paid" name="amount" rules={[{ required: true, type: 'number', min: 1, message: 'Required' }]}>
            <InputNumber style={{ width: '100%' }} min={0} step={100000} placeholder="Amount you paid to the card" />
          </Form.Item>
          <Form.Item label="Note" name="note">
            <Input placeholder="e.g. full payment, min payment..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
