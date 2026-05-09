import { useEffect, useState } from 'react'
import { Form, Input, InputNumber, Select, DatePicker, Button, Modal, Switch, Popconfirm, App } from 'antd'
import { PlusOutlined, DeleteOutlined, SplitCellsOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { v4 as uuidv4 } from 'uuid'
import { addTransaction, addTransactions, fetchCategories, addCategory, deleteCategory } from '../lib/supabase'
import { CARDS } from '../lib/utils'

export default function AddTransaction() {
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const [loading, setLoading]       = useState(false)
  const [categories, setCategories] = useState([])
  const [catLoading, setCatLoading] = useState(true)
  const [manageOpen, setManageOpen] = useState(false)
  const [newCat, setNewCat]         = useState('')
  const [addingCat, setAddingCat]   = useState(false)

  // Split state
  const [isSplit, setIsSplit] = useState(false)
  const [splits, setSplits]   = useState([{ category: null, amount: null }])
  const [totalAmount, setTotalAmount] = useState(0)

  useEffect(() => { loadCategories() }, [])

  async function loadCategories() {
    setCatLoading(true)
    try { setCategories(await fetchCategories()) }
    catch (e) { message.error(e.message) }
    finally { setCatLoading(false) }
  }

  function addSplitRow() {
    setSplits(prev => [...prev, { category: null, amount: null }])
  }

  function removeSplitRow(idx) {
    setSplits(prev => prev.filter((_, i) => i !== idx))
  }

  function updateSplit(idx, key, val) {
    setSplits(prev => prev.map((s, i) => i === idx ? { ...s, [key]: val } : s))
  }

  const splitTotal = splits.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
  const splitRemaining = totalAmount - splitTotal

  async function handleSubmit(values) {
    if (isSplit) {
      if (splits.length < 2) { message.warning('Add at least 2 splits.'); return }
      if (splits.some(s => !s.category || !s.amount)) { message.warning('Fill in all split rows.'); return }
      if (Math.abs(splitRemaining) > 0.01) { message.warning(`Split amounts must equal total (${splitRemaining > 0 ? `${fmt(splitRemaining)} remaining` : `${fmt(Math.abs(splitRemaining))} over`}).`); return }
    }

    setLoading(true)
    try {
      if (isSplit) {
        const splitId = uuidv4()
        const txs = splits.map(s => ({
          date:     values.date.format('YYYY-MM-DD'),
          amount:   parseFloat(s.amount),
          type:     values.type,
          method:   values.method,
          category: s.category,
          note:     values.note || '',
          split_id: splitId,
        }))
        await addTransactions(txs)
        message.success(`Split transaction added (${splits.length} parts)`)
      } else {
        await addTransaction({
          date:     values.date.format('YYYY-MM-DD'),
          amount:   values.amount,
          type:     values.type,
          method:   values.method,
          category: values.category,
          note:     values.note || '',
        })
        message.success('Transaction added!')
      }
      form.resetFields()
      form.setFieldsValue({ date: dayjs(), type: 'expense', method: 'card1' })
      setIsSplit(false)
      setSplits([{ category: null, amount: null }])
      setTotalAmount(0)
    } catch (e) {
      message.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleAddCategory() {
    const name = newCat.trim()
    if (!name) return
    setAddingCat(true)
    try {
      const cat = await addCategory(name)
      setCategories(prev => [...prev, cat].sort((a, b) => a.name.localeCompare(b.name)))
      setNewCat('')
      message.success(`"${name}" added`)
    } catch (e) {
      message.error(e.message)
    } finally {
      setAddingCat(false)
    }
  }

  async function handleDeleteCategory(id, name) {
    try {
      await deleteCategory(id)
      setCategories(prev => prev.filter(c => c.id !== id))
      message.success(`"${name}" removed`)
    } catch (e) {
      message.error(e.message)
    }
  }

  // fmt inline for split display
  function fmt(n) {
    return new Intl.NumberFormat('id-ID').format(Math.abs(n))
  }

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16, color: '#e2e4ef' }}>Add Transaction</h2>

      <div className="card">
        <Form form={form} layout="vertical" onFinish={handleSubmit}
          initialValues={{ date: dayjs(), type: 'expense', method: 'card1' }}>

          <Form.Item label="Date" name="date" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" allowClear={false} />
          </Form.Item>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Form.Item label="Total Amount" name="amount"
              rules={isSplit ? [] : [{ required: true, type: 'number', min: 0.01, message: 'Enter amount' }]}>
              <InputNumber style={{ width: '100%' }} min={0} placeholder="0" step={1000}
                onChange={v => setTotalAmount(v || 0)} />
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
              {Object.entries(CARDS).map(([k, v]) => <Select.Option key={k} value={k}>{v}</Select.Option>)}
            </Select>
          </Form.Item>

          {/* Split toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, padding: '10px 14px', background: '#0f1117', borderRadius: 8, border: '1px solid #2a2d3a' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <SplitCellsOutlined style={{ color: '#6c63ff' }} />
              <span style={{ fontSize: 13 }}>Split across categories</span>
            </div>
            <Switch checked={isSplit} onChange={v => { setIsSplit(v); setSplits([{ category: null, amount: null }, { category: null, amount: null }]) }} />
          </div>

          {/* Single category OR split rows */}
          {!isSplit ? (
            <Form.Item
              label={
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                  <span>Category</span>
                  <button type="button" onClick={() => setManageOpen(true)}
                    style={{ background: 'none', border: 'none', color: '#6c63ff', fontSize: 12, cursor: 'pointer', padding: 0 }}>
                    Manage
                  </button>
                </div>
              }
              name="category" rules={[{ required: true, message: 'Select a category' }]}
            >
              <Select loading={catLoading} placeholder="Select category" showSearch>
                {categories.map(c => <Select.Option key={c.id} value={c.name}>{c.name}</Select.Option>)}
              </Select>
            </Form.Item>
          ) : (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: '#6b7080', marginBottom: 10 }}>
                Split rows — total must equal {totalAmount > 0 ? fmt(totalAmount) : '0'}
                {splitRemaining !== 0 && totalAmount > 0 && (
                  <span style={{ marginLeft: 8, color: Math.abs(splitRemaining) < 0.01 ? '#3ecf8e' : '#f5a623', fontWeight: 600 }}>
                    ({splitRemaining > 0 ? `${fmt(splitRemaining)} remaining` : `${fmt(Math.abs(splitRemaining))} over`})
                  </span>
                )}
              </div>
              {splits.map((split, idx) => (
                <div key={idx} className="grid grid-cols-1 sm:grid-cols-2 gap-2" style={{ marginBottom: 8, alignItems: 'end' }}>
                  <Select
                    loading={catLoading}
                    placeholder="Category"
                    value={split.category}
                    onChange={v => updateSplit(idx, 'category', v)}
                    showSearch
                    style={{ width: '100%' }}
                  >
                    {categories.map(c => <Select.Option key={c.id} value={c.name}>{c.name}</Select.Option>)}
                  </Select>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <InputNumber
                      style={{ flex: 1 }}
                      min={0}
                      placeholder="Amount"
                      value={split.amount}
                      onChange={v => updateSplit(idx, 'amount', v)}
                      step={1000}
                    />
                    {splits.length > 2 && (
                      <Button danger icon={<DeleteOutlined />} onClick={() => removeSplitRow(idx)} />
                    )}
                  </div>
                </div>
              ))}
              <Button size="small" icon={<PlusOutlined />} onClick={addSplitRow} style={{ marginTop: 4 }}>
                Add row
              </Button>
            </div>
          )}

          <Form.Item label="Note" name="note">
            <Input placeholder="e.g. lunch at warung" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" loading={loading} block size="large">
              {isSplit ? `Add Split Transaction (${splits.length} parts)` : 'Add Transaction'}
            </Button>
          </Form.Item>
        </Form>
      </div>

      {/* Manage Categories Modal */}
      <Modal title="Manage Categories" open={manageOpen} onCancel={() => setManageOpen(false)} footer={null} width={400}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <Input placeholder="New category name" value={newCat} onChange={e => setNewCat(e.target.value)} onPressEnter={handleAddCategory} maxLength={50} />
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAddCategory} loading={addingCat}>Add</Button>
        </div>
        {categories.map(c => (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #2a2d3a' }}>
            <span style={{ fontSize: 14 }}>{c.name}</span>
            <Popconfirm title={`Delete "${c.name}"?`} description="Existing transactions keep this category." onConfirm={() => handleDeleteCategory(c.id, c.name)} okText="Delete" okButtonProps={{ danger: true }} cancelText="Cancel">
              <Button type="text" danger icon={<DeleteOutlined />} size="small" />
            </Popconfirm>
          </div>
        ))}
      </Modal>
    </div>
  )
}
