import { useEffect, useState, useRef } from 'react'
import { Table, Button, Popconfirm, Input, Select, DatePicker, App, Modal, Tag, Form, InputNumber } from 'antd'
import { SearchOutlined, FilterOutlined, CloseOutlined, UploadOutlined, DownloadOutlined, EditOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import { fetchTransactions, deleteTransaction, updateTransaction, fetchCategories, addTransactions } from '../lib/supabase'
import { fmt, fmtDate } from '../lib/utils'
import Badge from '../components/Badge'
import { useCards } from '../contexts/CardsContext'

dayjs.extend(customParseFormat)

// ─── CSV helpers ───────────────────────────────────────────────────────────────

function parseCSVText(text) {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []
  const parseRow = line => {
    const cells = []; let cell = '', inQ = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') { if (inQ && line[i+1] === '"') { cell += '"'; i++ } else inQ = !inQ }
      else if (ch === ',' && !inQ) { cells.push(cell.trim()); cell = '' }
      else cell += ch
    }
    cells.push(cell.trim()); return cells
  }
  const headers = parseRow(lines[0]).map(h => h.toLowerCase().replace(/\s/g, ''))
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const cells = parseRow(line)
    return Object.fromEntries(headers.map((h, i) => [h, (cells[i] || '').replace(/^"|"$/g, '')]))
  })
}

const METHOD_ALIASES = {
  card1: ['card1', 'tokopedia bri', 'tokopedia', 'bri'],
  card2: ['card2', 'atome mayapada', 'atome', 'mayapada'],
  card3: ['card3', 'bca', 'bca credit'],
  cash:  ['cash', 'bca debit', 'debit'],
}
function normalizeMethod(val) {
  const v = (val || '').toLowerCase().trim()
  for (const [key, aliases] of Object.entries(METHOD_ALIASES)) {
    if (aliases.includes(v)) return key
  }
  return null
}

function validateRows(rawRows) {
  return rawRows.map((row, idx) => {
    const errors = []
    const rawDate = (row.date || '').trim()
    const parsed  = dayjs(rawDate, ['YYYY-MM-DD', 'DD/MM/YYYY', 'DD-MM-YYYY'], true)
    const date    = parsed.isValid() ? parsed.format('YYYY-MM-DD') : null
    if (!date) errors.push('Invalid date')

    const amount = parseFloat((row.amount || '').toString().replace(/[,\s]/g, ''))
    if (isNaN(amount) || amount <= 0) errors.push('Invalid amount')

    const type = (row.type || '').toLowerCase().trim()
    if (!['expense', 'income'].includes(type)) errors.push('Type must be expense/income')

    const method = normalizeMethod(row.method)
    if (!method) errors.push(`Unknown method "${row.method}"`)

    const category = (row.category || '').trim()
    if (!category) errors.push('Category required')

    const note = (row.note || '').trim()

    return {
      key: idx,
      rowNum: idx + 2,
      valid: errors.length === 0,
      errors,
      display: { date: rawDate, amount: row.amount, type, method: row.method, category, note },
      parsed: errors.length === 0 ? { date, amount, type, method, category, note } : null,
    }
  })
}

const SAMPLE_CSV = `date,amount,type,method,category,note
2026-05-09,52908,expense,card3,Baby Care,Empeng
2026-05-01,5000000,income,cash,Other,May salary
2026-05-08,150000,expense,card1,Food & Dining,Lunch with team
2026-05-07,300000,expense,card2,Shopping,H&M shirt
2026-05-06,85000,expense,cash,Transport,Grab to office`

const { RangePicker } = DatePicker

const PAGE_SIZE = 20

export default function Transactions() {
  const { message } = App.useApp()
  const { cards } = useCards()
  const [txs, setTxs]             = useState([])
  const [total, setTotal]         = useState(0)
  const [page, setPage]           = useState(1)
  const [loading, setLoading]     = useState(true)
  const [categories, setCategories] = useState([])
  const [showFilter, setShowFilter] = useState(false)
  const [sortField, setSortField] = useState('date')
  const [sortOrder, setSortOrder] = useState('descend')

  const [importOpen, setImportOpen]     = useState(false)
  const [importRows, setImportRows]     = useState([])
  const [importing, setImporting]       = useState(false)
  const fileInputRef = useRef(null)

  const [editingTx, setEditingTx]   = useState(null)
  const [editSaving, setEditSaving] = useState(false)
  const [editForm]  = Form.useForm()

  // Filters
  const [search, setSearch]         = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [dateRange, setDateRange]   = useState(null)
  const [selCats, setSelCats]       = useState([])
  const [selMethods, setSelMethods] = useState([])
  const [selType, setSelType]       = useState(null)

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  // Load categories once
  useEffect(() => {
    fetchCategories().then(setCategories).catch(e => message.error(e.message))
  }, [])

  // Re-fetch page 1 whenever filters or sort changes
  useEffect(() => {
    loadPage(1)
  }, [debouncedSearch, dateRange, selCats, selMethods, selType, sortField, sortOrder])

  async function loadPage(p) {
    setLoading(true)
    try {
      const { data, count } = await fetchTransactions({
        page: p,
        pageSize: PAGE_SIZE,
        search: debouncedSearch,
        dateFrom: dateRange?.[0]?.format('YYYY-MM-DD') ?? null,
        dateTo:   dateRange?.[1]?.format('YYYY-MM-DD') ?? null,
        categories: selCats,
        methods:    selMethods,
        type:       selType,
        sortField,
        sortOrder,
      })
      setTxs(data)
      setTotal(count)
      setPage(p)
    } catch (e) {
      message.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  const hasFilters = search || dateRange || selCats.length || selMethods.length || selType

  function clearFilters() {
    setSearch(''); setDebouncedSearch(''); setDateRange(null)
    setSelCats([]); setSelMethods([]); setSelType(null)
  }

  async function handleDelete(id) {
    try {
      await deleteTransaction(id)
      message.success('Deleted')
      loadPage(page)
    } catch (e) {
      message.error(e.message)
    }
  }

  function openEdit(tx) {
    setEditingTx(tx)
    editForm.setFieldsValue({
      date:     dayjs(tx.date),
      amount:   tx.amount,
      type:     tx.type,
      method:   tx.method,
      category: tx.category,
      note:     tx.note || '',
    })
  }

  async function handleSaveEdit() {
    try {
      const v = await editForm.validateFields()
      setEditSaving(true)
      await updateTransaction(editingTx.id, {
        date:     v.date.format('YYYY-MM-DD'),
        amount:   v.amount,
        type:     v.type,
        method:   v.method,
        category: v.category,
        note:     v.note || '',
      })
      setEditingTx(null)
      message.success('Updated')
      loadPage(page)
    } catch (e) {
      if (e?.errorFields) return
      message.error(e.message)
    } finally {
      setEditSaving(false)
    }
  }

  function downloadSample() {
    const a = document.createElement('a')
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(SAMPLE_CSV)
    a.download = 'sample_transactions.csv'
    a.click()
  }

  function handleFileSelect(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const rows = validateRows(parseCSVText(ev.target.result))
      setImportRows(rows)
      setImportOpen(true)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  async function handleImport() {
    const valid = importRows.filter(r => r.valid).map(r => r.parsed)
    if (!valid.length) return
    setImporting(true)
    try {
      await addTransactions(valid)
      setImportOpen(false)
      setImportRows([])
      message.success(`${valid.length} transaction${valid.length > 1 ? 's' : ''} imported`)
      loadPage(1)
    } catch (e) {
      message.error(e.message)
    } finally {
      setImporting(false)
    }
  }

  async function exportCSV() {
    try {
      // Fetch all matching records (no pagination) for export
      const { data: all } = await fetchTransactions({
        page: 1, pageSize: 100000,
        search: debouncedSearch,
        dateFrom: dateRange?.[0]?.format('YYYY-MM-DD') ?? null,
        dateTo:   dateRange?.[1]?.format('YYYY-MM-DD') ?? null,
        categories: selCats, methods: selMethods, type: selType,
        sortField, sortOrder,
      })
      if (!all.length) return
      const rows = [['Date', 'Note', 'Category', 'Method', 'Type', 'Amount']]
      all.forEach(t => rows.push([t.date, t.note || '', t.category, t.method, t.type, t.amount]))
      const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
      const a = document.createElement('a')
      a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv)
      a.download = 'transactions.csv'
      a.click()
    } catch (e) {
      message.error(e.message)
    }
  }

  const columns = [
    {
      title: 'Date', dataIndex: 'date', key: 'date', width: 110,
      render: d => fmtDate(d),
      sorter: true,
      sortOrder: sortField === 'date' ? sortOrder : null,
    },
    { title: 'Note', dataIndex: 'note', key: 'note', render: (n, r) => (
      <div>
        <div style={{ fontSize: 13 }}>{n || <span style={{ color: '#6b7080' }}>—</span>}</div>
        {r.split_id && <span style={{ fontSize: 10, background: '#6c63ff22', color: '#9b94ff', padding: '1px 5px', borderRadius: 8, fontWeight: 600 }}>SPLIT</span>}
      </div>
    ), ellipsis: true },
    {
      title: 'Category', dataIndex: 'category', key: 'category', responsive: ['sm'],
      sorter: true,
      sortOrder: sortField === 'category' ? sortOrder : null,
    },
    { title: 'Method', dataIndex: 'method', key: 'method', render: m => <Badge method={m} />, width: 140 },
    {
      title: 'Amount', dataIndex: 'amount', key: 'amount', align: 'right', width: 120,
      render: (a, r) => <span style={{ fontWeight: 600, color: r.type === 'expense' ? '#f25f5c' : '#3ecf8e' }}>{r.type === 'expense' ? '-' : '+'}{fmt(a)}</span>,
      sorter: true,
      sortOrder: sortField === 'amount' ? sortOrder : null,
    },
    {
      title: '', key: 'action', width: 80,
      render: (_, r) => (
        <div style={{ display: 'flex', gap: 4 }}>
          <Button type="text" size="small" icon={<EditOutlined />} style={{ color: '#6b7080' }} onClick={() => openEdit(r)} />
          <Popconfirm title="Delete?" onConfirm={() => handleDelete(r.id)} okText="Delete" okButtonProps={{ danger: true }} cancelText="No">
            <Button type="text" size="small" style={{ color: '#6b7080' }}>✕</Button>
          </Popconfirm>
        </div>
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
          <Button icon={<UploadOutlined />} onClick={() => fileInputRef.current.click()}>
            <span className="hidden sm:inline">Import</span>
          </Button>
          <Button icon={<DownloadOutlined />} onClick={exportCSV}>
            <span className="hidden sm:inline">Export</span>
          </Button>
          <input ref={fileInputRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={handleFileSelect} />
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
                {cards.map(c => <Select.Option key={c.id} value={c.id}>{c.name}</Select.Option>)}
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

      {(hasFilters || total > 0) && (
        <div style={{ fontSize: 12, color: '#6b7080', marginBottom: 8 }}>
          {hasFilters ? `${total} matching transactions` : `${total} transactions`}
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <Table
          dataSource={txs}
          columns={columns}
          rowKey="id"
          loading={loading}
          scroll={{ x: 480 }}
          showSorterTooltip={false}
          pagination={{
            current: page,
            pageSize: PAGE_SIZE,
            total,
            showSizeChanger: false,
            onChange: p => loadPage(p),
          }}
          onChange={(_, __, sorter) => {
            if (sorter?.columnKey) {
              setSortField(sorter.columnKey)
              setSortOrder(sorter.order || 'descend')
            }
          }}
          locale={{ emptyText: 'No transactions found.' }}
        />
      </div>

      {/* Edit transaction modal */}
      <Modal
        title="Edit Transaction"
        open={!!editingTx}
        onCancel={() => setEditingTx(null)}
        onOk={handleSaveEdit}
        okText="Save"
        confirmLoading={editSaving}
        width={420}
      >
        <Form form={editForm} layout="vertical">
          <Form.Item label="Date" name="date" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" allowClear={false} />
          </Form.Item>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Form.Item label="Amount" name="amount" rules={[{ required: true, type: 'number', min: 0.01 }]}>
              <InputNumber style={{ width: '100%' }} min={0} step={1000} />
            </Form.Item>
            <Form.Item label="Type" name="type" rules={[{ required: true }]}>
              <Select>
                <Select.Option value="expense">Expense</Select.Option>
                <Select.Option value="income">Income</Select.Option>
              </Select>
            </Form.Item>
          </div>
          <Form.Item label="Payment Method" name="method" rules={[{ required: true }]}>
            <Select>
              {cards.map(c => <Select.Option key={c.id} value={c.id}>{c.name}</Select.Option>)}
            </Select>
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

      {/* Import preview modal */}
      <Modal
        title="Import Transactions from CSV"
        open={importOpen}
        onCancel={() => { setImportOpen(false); setImportRows([]) }}
        width={680}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button onClick={downloadSample} style={{ background: 'none', border: 'none', color: '#6c63ff', fontSize: 12, cursor: 'pointer', padding: 0 }}>
              Download sample CSV
            </button>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button onClick={() => { setImportOpen(false); setImportRows([]) }}>Cancel</Button>
              <Button
                type="primary"
                loading={importing}
                disabled={!importRows.some(r => r.valid)}
                onClick={handleImport}
              >
                Import {importRows.filter(r => r.valid).length} valid rows
              </Button>
            </div>
          </div>
        }
      >
        {/* Summary */}
        {importRows.length > 0 && (
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <div style={{ padding: '8px 14px', borderRadius: 8, background: '#1a2e2a', border: '1px solid #3ecf8e33', fontSize: 13 }}>
              <span style={{ color: '#3ecf8e', fontWeight: 700 }}>{importRows.filter(r => r.valid).length}</span>
              <span style={{ color: '#6b7080', marginLeft: 4 }}>valid</span>
            </div>
            {importRows.some(r => !r.valid) && (
              <div style={{ padding: '8px 14px', borderRadius: 8, background: '#2e1a1a', border: '1px solid #f25f5c33', fontSize: 13 }}>
                <span style={{ color: '#f25f5c', fontWeight: 700 }}>{importRows.filter(r => !r.valid).length}</span>
                <span style={{ color: '#6b7080', marginLeft: 4 }}>errors (will be skipped)</span>
              </div>
            )}
          </div>
        )}

        <Table
          dataSource={importRows}
          rowKey="key"
          size="small"
          scroll={{ x: 500 }}
          pagination={{ pageSize: 10, showSizeChanger: false }}
          rowClassName={r => r.valid ? '' : 'ant-table-row-error'}
          columns={[
            { title: '#', dataIndex: 'rowNum', key: 'rowNum', width: 40 },
            { title: 'Date',     key: 'date',     width: 95,  render: (_, r) => r.display.date },
            { title: 'Amount',   key: 'amount',   width: 100, render: (_, r) => r.valid
              ? <span style={{ color: r.parsed.type === 'expense' ? '#f25f5c' : '#3ecf8e', fontWeight: 600 }}>
                  {r.parsed.type === 'expense' ? '-' : '+'}{fmt(r.parsed.amount)}
                </span>
              : r.display.amount
            },
            { title: 'Method',   key: 'method',   width: 110, render: (_, r) => r.valid ? <Badge method={r.parsed.method} /> : <span style={{ color: '#f25f5c', fontSize: 11 }}>{r.display.method}</span> },
            { title: 'Category', key: 'category', render: (_, r) => r.display.category },
            { title: 'Status',   key: 'status',   width: 80,  render: (_, r) => r.valid
              ? <Tag color="green" style={{ fontSize: 10 }}>OK</Tag>
              : <Tag color="red" style={{ fontSize: 10 }} title={r.errors.join(', ')}>Error</Tag>
            },
          ]}
          expandable={{
            expandedRowRender: r => !r.valid ? (
              <div style={{ fontSize: 12, color: '#f25f5c', paddingLeft: 8 }}>
                {r.errors.map((e, i) => <div key={i}>• {e}</div>)}
              </div>
            ) : null,
            rowExpandable: r => !r.valid,
            showExpandColumn: importRows.some(r => !r.valid),
          }}
        />
      </Modal>
    </div>
  )
}
