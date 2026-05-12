import { useEffect, useState, useMemo } from 'react'
import { Button, Table, Modal, InputNumber, Form, Select, App, DatePicker } from 'antd'
import { LeftOutlined, RightOutlined, SettingOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { fetchMonthTransactions, fetchBudgets, upsertBudget, deleteBudget, fetchDebitSettings, upsertDebitSettings, fetchCategories } from '../lib/supabase'
import { fmt, fmtDate, monthLabel } from '../lib/utils'
import Badge from '../components/Badge'
import BarRow from '../components/BarRow'

const { RangePicker } = DatePicker

export default function Monthly() {
  const { message } = App.useApp()
  const now = new Date()
  const [year, setYear]     = useState(now.getFullYear())
  const [month, setMonth]   = useState(now.getMonth())
  const [txs, setTxs]       = useState([])
  const [prevTxs, setPrevTxs] = useState([])
  const [budgets, setBudgets] = useState({})
  const [salary, setSalary]   = useState(0)
  const [categories, setCategories] = useState([])
  const [loading, setLoading]       = useState(true)
  const [dateRange, setDateRange]   = useState(null)
  const [budgetOpen, setBudgetOpen] = useState(false)
  const [budgetForm] = Form.useForm()
  const [savingBudget, setSavingBudget] = useState(false)

  function changeMonth(dir) {
    setDateRange(null)
    if (dir === -1) {
      if (month === 0) { setYear(y => y - 1); setMonth(11) }
      else setMonth(m => m - 1)
    } else {
      if (month === 11) { setYear(y => y + 1); setMonth(0) }
      else setMonth(m => m + 1)
    }
  }

  function jumpToMonth(dayjsVal) {
    if (!dayjsVal) return
    setDateRange(null)
    setYear(dayjsVal.year())
    setMonth(dayjsVal.month())
  }

  useEffect(() => {
    setLoading(true)
    const prevMonth = month === 0 ? 11 : month - 1
    const prevYear  = month === 0 ? year - 1 : year
    Promise.all([
      fetchMonthTransactions(year, month),
      fetchMonthTransactions(prevYear, prevMonth),
      fetchBudgets(),
      fetchDebitSettings(),
      fetchCategories(),
    ])
      .then(([cur, prev, b, settings, cats]) => {
        setTxs(cur)
        setPrevTxs(prev)
        setBudgets(b)
        setSalary(settings?.monthly_salary || 0)
        setCategories(cats)
      })
      .catch(e => message.error(e.message))
      .finally(() => setLoading(false))
  }, [year, month])

  const filteredTxs = useMemo(() => {
    if (!dateRange || !dateRange[0] || !dateRange[1]) return txs
    const from = dateRange[0].format('YYYY-MM-DD')
    const to   = dateRange[1].format('YYYY-MM-DD')
    return txs.filter(t => t.date >= from && t.date <= to)
  }, [txs, dateRange])

  const isFiltered = !!(dateRange && dateRange[0] && dateRange[1])

  const expenses  = filteredTxs.filter(t => t.type === 'expense')
  const incomes   = filteredTxs.filter(t => t.type === 'income')
  const totalExp  = expenses.reduce((s, t) => s + t.amount, 0)
  const totalInc  = incomes.reduce((s, t) => s + t.amount, 0)
  const prevExp   = prevTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const momDiff   = !isFiltered && prevExp > 0 ? ((totalExp - prevExp) / prevExp * 100) : null
  const totalBudgeted = Object.values(budgets).reduce((s, v) => s + v, 0)

  const byMethod = {}
  expenses.forEach(t => { byMethod[t.method] = (byMethod[t.method] || 0) + t.amount })

  const byCat = {}
  expenses.forEach(t => { byCat[t.category] = (byCat[t.category] || 0) + t.amount })

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth()
  const d = now.getDate()

  async function handleSaveBudget() {
    try {
      const values = await budgetForm.validateFields()
      setSavingBudget(true)
      await Promise.all([
        upsertBudget(values.category, values.monthly_amount),
        upsertDebitSettings({ monthly_salary: values.salary }),
      ])
      setBudgets(prev => ({ ...prev, [values.category]: values.monthly_amount }))
      setSalary(values.salary)
      setBudgetOpen(false)
      message.success('Budget saved')
    } catch (e) {
      if (e?.errorFields) return
      message.error(e.message)
    } finally {
      setSavingBudget(false)
    }
  }

  async function handleRemoveBudget(cat) {
    try {
      await deleteBudget(cat)
      setBudgets(prev => { const n = { ...prev }; delete n[cat]; return n })
      message.success(`Budget for "${cat}" removed`)
    } catch (e) {
      message.error(e.message)
    }
  }

  const columns = [
    { title: 'Date',     dataIndex: 'date',     key: 'date',     render: d => fmtDate(d), width: 110 },
    { title: 'Note',     dataIndex: 'note',     key: 'note',     render: n => n || '—', ellipsis: true, responsive: ['sm'] },
    { title: 'Category', dataIndex: 'category', key: 'category', ellipsis: true },
    { title: 'Method',   dataIndex: 'method',   key: 'method',   render: m => <Badge method={m} />, width: 140 },
    {
      title: 'Amount', dataIndex: 'amount', key: 'amount', align: 'right', width: 120,
      render: (a, r) => (
        <span style={{ fontWeight: 600, color: r.type === 'expense' ? '#f25f5c' : '#3ecf8e' }}>
          {r.type === 'expense' ? '-' : '+'}{fmt(a)}
        </span>
      ),
    },
  ]

  return (
    <div>
      {/* Month picker */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Button icon={<LeftOutlined />} onClick={() => changeMonth(-1)} />
          <DatePicker
            picker="month"
            value={dayjs(new Date(year, month, 1))}
            onChange={jumpToMonth}
            format="MMM YYYY"
            allowClear={false}
            style={{ width: 130 }}
          />
          <Button icon={<RightOutlined />} onClick={() => changeMonth(1)} />
        </div>
        <RangePicker
          value={dateRange}
          onChange={v => setDateRange(v)}
          format="DD MMM"
          placeholder={['From', 'To']}
          style={{ flex: 1, minWidth: 200 }}
          disabledDate={d => {
            const start = dayjs(new Date(year, month, 1))
            const end   = dayjs(new Date(year, month + 1, 0))
            return d.isBefore(start, 'day') || d.isAfter(end, 'day')
          }}
        />
        {isFiltered && (
          <Button size="small" onClick={() => setDateRange(null)} style={{ color: '#6b7080' }}>
            Clear
          </Button>
        )}
        <Button icon={<SettingOutlined />} onClick={() => setBudgetOpen(true)} style={{ marginLeft: 'auto' }}>
          <span className="hidden sm:inline">Budgets</span>
        </Button>
      </div>
      {isFiltered && (
        <div style={{ fontSize: 12, color: '#6b7080', marginBottom: 10 }}>
          Showing {filteredTxs.length} of {txs.length} transactions ·{' '}
          {dateRange[0].format('DD MMM')} – {dateRange[1].format('DD MMM YYYY')}
        </div>
      )}

      {/* Reminders */}
      {isCurrentMonth && d >= 13 && d <= 17 && (
        <div style={{ marginBottom: 12, padding: '10px 16px', borderRadius: 8, fontSize: 13, background: '#f5a62318', border: '1px solid #f5a62344', color: '#f5a623' }}>
          Reminder: Pay <strong>BCA</strong> card before the 19th!
        </div>
      )}
      {isCurrentMonth && d >= 27 && (
        <div style={{ marginBottom: 12, padding: '10px 16px', borderRadius: 8, fontSize: 13, background: '#6c63ff18', border: '1px solid #6c63ff44', color: '#9b94ff' }}>
          Payday soon — remember to pay <strong>Tokopedia BRI</strong> and <strong>Atome Mayapada</strong>.
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3" style={{ marginBottom: 12 }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#f25f5c' }}>{fmt(totalExp)}</div>
          <div style={{ fontSize: 11, color: '#6b7080', marginTop: 4 }}>Total Spending</div>
          {momDiff !== null && (
            <div style={{ fontSize: 11, marginTop: 4, color: momDiff > 0 ? '#f25f5c' : '#3ecf8e', fontWeight: 600 }}>
              {momDiff > 0 ? '▲' : '▼'} {Math.abs(momDiff).toFixed(0)}% vs last month
            </div>
          )}
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#3ecf8e' }}>{fmt(totalInc)}</div>
          <div style={{ fontSize: 11, color: '#6b7080', marginTop: 4 }}>Total Income</div>
          {salary > 0 && (
            <div style={{ fontSize: 11, color: '#6b7080', marginTop: 4 }}>
              Salary: <span style={{ color: '#e2e4ef' }}>{fmt(salary)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Salary vs budget */}
      {salary > 0 && totalBudgeted > 0 && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: '#6b7080', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
            Salary vs Budget
          </div>
          <div className="grid grid-cols-3 gap-2" style={{ marginBottom: 10 }}>
            {[
              { label: 'Salary',        val: fmt(salary),        color: '#3ecf8e' },
              { label: 'Total Budgeted', val: fmt(totalBudgeted), color: totalBudgeted > salary ? '#f25f5c' : '#f5a623' },
              { label: 'Actual Spent',  val: fmt(totalExp),      color: totalExp > salary ? '#f25f5c' : '#e2e4ef' },
            ].map(s => (
              <div key={s.label} style={{ background: '#0f1117', borderRadius: 8, padding: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: s.color }}>{s.val}</div>
                <div style={{ fontSize: 10, color: '#6b7080', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12, color: totalBudgeted > salary ? '#f25f5c' : '#3ecf8e' }}>
            {totalBudgeted > salary
              ? `⚠️ Budgets exceed salary by ${fmt(totalBudgeted - salary)}`
              : `✓ ${fmt(salary - totalBudgeted)} of salary unbudgeted (savings)`
            }
          </div>
        </div>
      )}

      {/* Budget Progress per category */}
      {Object.keys(budgets).length > 0 && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: '#6b7080', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 14 }}>
            Budget Progress
          </div>
          {Object.entries(budgets).sort((a, b) => b[1] - a[1]).map(([cat, budget]) => {
            const spent = byCat[cat] || 0
            const over  = spent > budget
            return (
              <div key={cat} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>{cat}</span>
                    {over && <span style={{ fontSize: 10, background: '#f25f5c22', color: '#f25f5c', padding: '1px 6px', borderRadius: 10, fontWeight: 600 }}>OVER</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontWeight: 600, color: over ? '#f25f5c' : '#e2e4ef' }}>
                      {fmt(spent)} <span style={{ color: '#6b7080', fontWeight: 400 }}>/ {fmt(budget)}</span>
                    </span>
                    <button onClick={() => handleRemoveBudget(cat)} style={{ background: 'none', border: 'none', color: '#6b7080', cursor: 'pointer', fontSize: 12, padding: 0 }}>✕</button>
                  </div>
                </div>
                <div style={{ background: '#0f1117', borderRadius: 6, height: 7, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 6, transition: 'width .4s',
                    background: over ? '#f25f5c' : (spent / budget) > 0.8 ? '#f5a623' : '#6c63ff',
                    width: `${Math.min((spent / budget) * 100, 100).toFixed(1)}%`,
                  }} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* By Method */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: '#6b7080', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 14 }}>By Payment Method</div>
        {Object.keys(byMethod).length === 0
          ? <div style={{ textAlign: 'center', color: '#6b7080', fontSize: 13, padding: '12px 0' }}>No expenses this month.</div>
          : Object.entries(byMethod).sort((a, b) => b[1] - a[1]).map(([method, amt]) => (
            <BarRow key={method} amount={amt} total={totalExp} color="#6c63ff" renderLabel={() => <Badge method={method} />} />
          ))
        }
      </div>

      {/* By Category */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: '#6b7080', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 14 }}>By Category</div>
        {Object.keys(byCat).length === 0
          ? <div style={{ textAlign: 'center', color: '#6b7080', fontSize: 13, padding: '12px 0' }}>No expenses this month.</div>
          : Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
            <BarRow key={cat} label={cat} amount={amt} total={totalExp} color="#f5a623" />
          ))
        }
      </div>

      {/* Transactions */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #2a2d3a' }}>
          <span style={{ fontSize: 11, color: '#6b7080', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Transactions</span>
        </div>
        <Table dataSource={filteredTxs} columns={columns} rowKey="id" loading={loading}
          scroll={{ x: 480 }} pagination={false} locale={{ emptyText: 'No transactions this month.' }} />
      </div>

      {/* Budget Management Modal */}
      <Modal
        title="Manage Budgets"
        open={budgetOpen}
        onCancel={() => setBudgetOpen(false)}
        onOk={handleSaveBudget}
        confirmLoading={savingBudget}
        okText="Save"
        width={420}
      >
        <Form form={budgetForm} layout="vertical">
          <Form.Item label="Monthly Salary" name="salary" initialValue={salary}
            rules={[{ required: true, type: 'number', min: 0, message: 'Required' }]}>
            <InputNumber style={{ width: '100%' }} min={0} step={500000} placeholder="Your monthly salary" />
          </Form.Item>
          <div style={{ borderTop: '1px solid #2a2d3a', paddingTop: 16, marginTop: 4 }}>
            <div style={{ fontSize: 13, color: '#6b7080', marginBottom: 12 }}>Set a monthly budget limit for a category:</div>
            <div className="grid grid-cols-2 gap-3">
              <Form.Item label="Category" name="category" rules={[{ required: true, message: 'Required' }]}>
                <Select showSearch placeholder="Select category">
                  {categories.map(c => <Select.Option key={c.id} value={c.name}>{c.name}</Select.Option>)}
                </Select>
              </Form.Item>
              <Form.Item label="Monthly Limit" name="monthly_amount" rules={[{ required: true, type: 'number', min: 1, message: 'Required' }]}>
                <InputNumber style={{ width: '100%' }} min={0} step={100000} placeholder="Amount" />
              </Form.Item>
            </div>
          </div>
          <div style={{ fontSize: 12, color: '#6b7080' }}>
            Existing budgets are shown on the Monthly page. Click ✕ next to a category to remove its budget.
          </div>
        </Form>
      </Modal>
    </div>
  )
}
