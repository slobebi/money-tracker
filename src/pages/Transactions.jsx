import { useEffect, useState } from 'react'
import { Table, Button, Popconfirm, App } from 'antd'
import { fetchTransactions, deleteTransaction } from '../lib/supabase'
import { fmt, fmtDate } from '../lib/utils'
import Badge from '../components/Badge'

export default function Transactions() {
  const { message } = App.useApp()
  const [txs, setTxs]         = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try { setTxs(await fetchTransactions()) }
    catch (e) { message.error(e.message) }
    finally { setLoading(false) }
  }

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
    if (!txs.length) return
    const rows = [['Date', 'Note', 'Category', 'Method', 'Type', 'Amount']]
    txs.forEach(t => rows.push([t.date, t.note || '', t.category, t.method, t.type, t.amount]))
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv)
    a.download = 'transactions.csv'
    a.click()
  }

  const columns = [
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      render: d => fmtDate(d),
      width: 120,
    },
    {
      title: 'Note',
      dataIndex: 'note',
      key: 'note',
      render: n => n || <span style={{ color: '#6b7080' }}>—</span>,
      ellipsis: true,
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      responsive: ['sm'],
    },
    {
      title: 'Method',
      dataIndex: 'method',
      key: 'method',
      render: m => <Badge method={m} />,
      width: 150,
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      align: 'right',
      render: (amount, record) => (
        <span style={{ fontWeight: 600, color: record.type === 'expense' ? '#f25f5c' : '#3ecf8e' }}>
          {record.type === 'expense' ? '-' : '+'}{fmt(amount)}
        </span>
      ),
      width: 130,
    },
    {
      title: '',
      key: 'action',
      width: 50,
      render: (_, record) => (
        <Popconfirm
          title="Delete this transaction?"
          onConfirm={() => handleDelete(record.id)}
          okText="Delete" okButtonProps={{ danger: true }}
          cancelText="Cancel"
        >
          <Button type="text" size="small" style={{ color: '#6b7080' }}>✕</Button>
        </Popconfirm>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: '#e2e4ef', margin: 0 }}>Transactions</h2>
        <Button onClick={exportCSV}>Export CSV</Button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <Table
          dataSource={txs}
          columns={columns}
          rowKey="id"
          loading={loading}
          scroll={{ x: 480 }}
          pagination={{ pageSize: 20, showSizeChanger: false }}
          locale={{ emptyText: 'No transactions yet.' }}
        />
      </div>
    </div>
  )
}
