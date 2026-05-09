import { useEffect, useState, useMemo } from 'react'
import { Table, Button, Popconfirm, Input, Select, DatePicker, App } from 'antd'
import { SearchOutlined, FilterOutlined, CloseOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { fetchTransactions, deleteTransaction, fetchCategories } from '../lib/supabase'
import { fmt, fmtDate, CARDS } from '../lib/utils'
import Badge from '../components/Badge'

const { RangePicker } = DatePicker

export default function Transactions() {
  const { message } = App.useApp()
  const [txs, setTxs]             = useState([])
  const [loading, setLoading]     = useState(true)
  const [categories, setCategories] = useState([])
  const [showFilter, setShowFilter] = useState(false)

  // Filters
  const [search, setSearch]       = useState('')
  const [dateRange, setDateRange] = useState(null)
  const [selCats, setSelCats]     = useState([])
  const [selMethods, setSelMethods] = useState([])
  const [selType, setSelType]     = useState(null)

  useEffect(() => {
    Promise.all([fetchTransactions(), fetchCategories()])
      .then(([data, cats]) => { setTxs(data); setCategories(cats) })
      .catch(e => message.error(e.message))
      .finally(() => setLoading(false))
  }, [])

  const hasFilters = search || dateRange || selCats.length || selMethods.length || selType

  function clearFilters() {
    setSearch(''); setDateRange(null); setSelCats([]); setSelMethods([]); setSelType(null)
  }

  const filtered = useMemo(() => {
    let data = txs
    if (search) {
      const q = search.toLowerCase()
      data = data.filter(t => (t.note || '').toLowerCase().includes(q) || t.category.toLowerCase().includes(q))
    }
    if (dateRange && dateRange[0] && dateRange[1]) {
      const from = dateRange[0].format('YYYY-MM-DD')
      const to   = dateRange[1].format('YYYY-MM-DD')
      data = data.filter(t => t.date >= from && t.date <= to)
    }
    if (selCats.length)    data = data.filter(t => selCats.includes(t.category))
    if (selMethods.length) data = data.filter(t => selMethods.includes(t.method))
    if (selType)           data = data.filter(t => t.type === selType)
    return data
  }, [txs, search, dateRange, selCats, selMethods, selType])

  async function handleDelete(id) {
    try {
      await deleteTransaction(id)
      setTxs(prev => prev.filter(t => t.id !== id))
      message.success('Deleted')
    } catch (e) {
      message.error(e.message)
    }
  }

  function exportCSV() {
    if (!filtered.length) return
    const rows = [['Date', 'Note', 'Category', 'Method', 'Type', 'Amount']]
    filtered.forEach(t => rows.push([t.date, t.note || '', t.category, t.method, t.type, t.amount]))
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv)
    a.download = 'transactions.csv'
    a.click()
  }

  const columns = [
    { title: 'Date',     dataIndex: 'date',     key: 'date',     render: d => fmtDate(d), width: 110 },
    { title: 'Note',     dataIndex: 'note',     key: 'note',     render: (n, r) => (
      <div>
        <div style={{ fontSize: 13 }}>{n || <span style={{ color: '#6b7080' }}>—</span>}</div>
        {r.split_id && <span style={{ fontSize: 10, background: '#6c63ff22', color: '#9b94ff', padding: '1px 5px', borderRadius: 8, fontWeight: 600 }}>SPLIT</span>}
      </div>
    ), ellipsis: true },
    { title: 'Category', dataIndex: 'category', key: 'category', responsive: ['sm'] },
    { title: 'Method',   dataIndex: 'method',   key: 'method',   render: m => <Badge method={m} />, width: 140 },
    {
      title: 'Amount', dataIndex: 'amount', key: 'amount', align: 'right', width: 120,
      render: (a, r) => <span style={{ fontWeight: 600, color: r.type === 'expense' ? '#f25f5c' : '#3ecf8e' }}>{r.type === 'expense' ? '-' : '+'}{fmt(a)}</span>,
    },
    {
      title: '', key: 'action', width: 44,
      render: (_, r) => (
        <Popconfirm title="Delete?" onConfirm={() => handleDelete(r.id)} okText="Delete" okButtonProps={{ danger: true }} cancelText="No">
          <Button type="text" size="small" style={{ color: '#6b7080' }}>✕</Button>
        </Popconfirm>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: '#e2e4ef', margin: 0 }}>Transactions</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button icon={<FilterOutlined />} onClick={() => setShowFilter(v => !v)}
            type={hasFilters ? 'primary' : 'default'}>
            <span className="hidden sm:inline">Filter</span>
          </Button>
          <Button onClick={exportCSV}>
            <span className="hidden sm:inline">Export CSV</span>
            <span className="inline sm:hidden">CSV</span>
          </Button>
        </div>
      </div>

      {/* Filter panel */}
      {showFilter && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Input
              prefix={<SearchOutlined style={{ color: '#6b7080' }} />}
              placeholder="Search note or category..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              allowClear
            />
            <RangePicker
              style={{ width: '100%' }}
              value={dateRange}
              onChange={setDateRange}
              format="DD MMM YYYY"
            />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Select mode="multiple" placeholder="Category" value={selCats} onChange={setSelCats} allowClear maxTagCount={1}>
                {categories.map(c => <Select.Option key={c.id} value={c.name}>{c.name}</Select.Option>)}
              </Select>
              <Select mode="multiple" placeholder="Payment method" value={selMethods} onChange={setSelMethods} allowClear maxTagCount={1}>
                {Object.entries(CARDS).map(([k, v]) => <Select.Option key={k} value={k}>{v}</Select.Option>)}
              </Select>
              <Select placeholder="Type" value={selType} onChange={setSelType} allowClear>
                <Select.Option value="expense">Expense</Select.Option>
                <Select.Option value="income">Income</Select.Option>
              </Select>
            </div>
            {hasFilters && (
              <Button icon={<CloseOutlined />} size="small" onClick={clearFilters} style={{ alignSelf: 'flex-start' }}>
                Clear filters
              </Button>
            )}
          </div>
        </div>
      )}

      {hasFilters && (
        <div style={{ fontSize: 12, color: '#6b7080', marginBottom: 8 }}>
          Showing {filtered.length} of {txs.length} transactions
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <Table
          dataSource={filtered}
          columns={columns}
          rowKey="id"
          loading={loading}
          scroll={{ x: 480 }}
          pagination={{ pageSize: 20, showSizeChanger: false }}
          locale={{ emptyText: 'No transactions found.' }}
        />
      </div>
    </div>
  )
}
