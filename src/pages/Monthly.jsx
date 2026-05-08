import { useEffect, useState } from 'react'
import { Button, Table, App } from 'antd'
import { LeftOutlined, RightOutlined } from '@ant-design/icons'
import { fetchMonthTransactions } from '../lib/supabase'
import { fmt, fmtDate, monthLabel } from '../lib/utils'
import Badge from '../components/Badge'
import BarRow from '../components/BarRow'

export default function Monthly() {
  const { message } = App.useApp()
  const now = new Date()
  const [year, setYear]   = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [txs, setTxs]     = useState([])
  const [loading, setLoading] = useState(true)

  function changeMonth(dir) {
    if (dir === -1) {
      if (month === 0) { setYear(y => y - 1); setMonth(11) }
      else setMonth(m => m - 1)
    } else {
      if (month === 11) { setYear(y => y + 1); setMonth(0) }
      else setMonth(m => m + 1)
    }
  }

  useEffect(() => {
    setLoading(true)
    fetchMonthTransactions(year, month)
      .then(setTxs)
      .catch(e => message.error(e.message))
      .finally(() => setLoading(false))
  }, [year, month])

  const expenses = txs.filter(t => t.type === 'expense')
  const incomes  = txs.filter(t => t.type === 'income')
  const totalExp = expenses.reduce((s, t) => s + t.amount, 0)
  const totalInc = incomes.reduce((s, t) => s + t.amount, 0)

  const byMethod = {}
  expenses.forEach(t => { byMethod[t.method] = (byMethod[t.method] || 0) + t.amount })

  const byCat = {}
  expenses.forEach(t => { byCat[t.category] = (byCat[t.category] || 0) + t.amount })

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth()
  const d = now.getDate()

  const columns = [
    { title: 'Date',     dataIndex: 'date',     key: 'date',     render: d => fmtDate(d), width: 120 },
    { title: 'Note',     dataIndex: 'note',     key: 'note',     render: n => n || '—', ellipsis: true, responsive: ['sm'] },
    { title: 'Category', dataIndex: 'category', key: 'category', ellipsis: true },
    { title: 'Method',   dataIndex: 'method',   key: 'method',   render: m => <Badge method={m} />, width: 150 },
    {
      title: 'Amount', dataIndex: 'amount', key: 'amount', align: 'right', width: 130,
      render: (amount, r) => (
        <span style={{ fontWeight: 600, color: r.type === 'expense' ? '#f25f5c' : '#3ecf8e' }}>
          {r.type === 'expense' ? '-' : '+'}{fmt(amount)}
        </span>
      ),
    },
  ]

  return (
    <div>
      {/* Month picker */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Button icon={<LeftOutlined />} onClick={() => changeMonth(-1)} />
        <span style={{ fontSize: 16, fontWeight: 600, minWidth: 160, textAlign: 'center' }}>
          {monthLabel(year, month)}
        </span>
        <Button icon={<RightOutlined />} onClick={() => changeMonth(1)} />
      </div>

      {/* Reminders */}
      {isCurrentMonth && d >= 13 && d <= 17 && (
        <div style={{ marginBottom: 16, padding: '10px 16px', borderRadius: 8, fontSize: 13, background: '#f5a62318', border: '1px solid #f5a62344', color: '#f5a623' }}>
          Reminder: Pay <strong>BCA</strong> card before the 19th!
        </div>
      )}
      {isCurrentMonth && d >= 27 && (
        <div style={{ marginBottom: 16, padding: '10px 16px', borderRadius: 8, fontSize: 13, background: '#6c63ff18', border: '1px solid #6c63ff44', color: '#9b94ff' }}>
          Payday soon — remember to pay <strong>Tokopedia BRI</strong> and <strong>Atome Mayapada</strong>.
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-2 gap-4" style={{ marginBottom: 16 }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#f25f5c' }}>{fmt(totalExp)}</div>
          <div style={{ fontSize: 12, color: '#6b7080', marginTop: 4 }}>Total Spending</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#3ecf8e' }}>{fmt(totalInc)}</div>
          <div style={{ fontSize: 12, color: '#6b7080', marginTop: 4 }}>Total Income</div>
        </div>
      </div>

      {/* By Method */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 11, color: '#6b7080', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 16 }}>
          By Payment Method
        </h3>
        {Object.keys(byMethod).length === 0 ? (
          <div style={{ textAlign: 'center', color: '#6b7080', fontSize: 13, padding: '16px 0' }}>No expenses this month.</div>
        ) : (
          Object.entries(byMethod).sort((a, b) => b[1] - a[1]).map(([method, amt]) => (
            <BarRow key={method} amount={amt} total={totalExp} color="#6c63ff"
              renderLabel={() => <Badge method={method} />} />
          ))
        )}
      </div>

      {/* By Category */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 11, color: '#6b7080', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 16 }}>
          By Category
        </h3>
        {Object.keys(byCat).length === 0 ? (
          <div style={{ textAlign: 'center', color: '#6b7080', fontSize: 13, padding: '16px 0' }}>No expenses this month.</div>
        ) : (
          Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
            <BarRow key={cat} label={cat} amount={amt} total={totalExp} color="#f5a623" />
          ))
        )}
      </div>

      {/* Transactions table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #2a2d3a' }}>
          <h3 style={{ fontSize: 11, color: '#6b7080', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>
            Transactions
          </h3>
        </div>
        <Table
          dataSource={txs}
          columns={columns}
          rowKey="id"
          loading={loading}
          scroll={{ x: 480 }}
          pagination={false}
          locale={{ emptyText: 'No transactions this month.' }}
        />
      </div>
    </div>
  )
}
