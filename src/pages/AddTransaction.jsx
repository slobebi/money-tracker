import { useEffect, useState } from 'react'
import { Form, Input, InputNumber, Select, DatePicker, Button, Modal, Popconfirm, App } from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { addTransaction, fetchCategories, addCategory, deleteCategory } from '../lib/supabase'
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

  useEffect(() => { loadCategories() }, [])

  async function loadCategories() {
    setCatLoading(true)
    try { setCategories(await fetchCategories()) }
    catch (e) { message.error(e.message) }
    finally { setCatLoading(false) }
  }

  async function handleSubmit(values) {
    setLoading(true)
    try {
      await addTransaction({
        date:     values.date.format('YYYY-MM-DD'),
        amount:   values.amount,
        type:     values.type,
        method:   values.method,
        category: values.category,
        note:     values.note || '',
      })
      message.success('Transaction added!')
      form.resetFields()
      form.setFieldsValue({ date: dayjs(), type: 'expense', method: 'card1' })
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

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 20, color: '#e2e4ef' }}>Add Transaction</h2>

      <div className="card">
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{ date: dayjs(), type: 'expense', method: 'card1' }}
        >
          <Form.Item label="Date" name="date" rules={[{ required: true, message: 'Pick a date' }]}>
            <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" allowClear={false} />
          </Form.Item>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Form.Item label="Amount" name="amount" rules={[{ required: true, type: 'number', min: 0.01, message: 'Enter amount' }]}>
              <InputNumber style={{ width: '100%' }} min={0} placeholder="0" step={1000} />
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
              {Object.entries(CARDS).map(([k, v]) => (
                <Select.Option key={k} value={k}>{v}</Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            label={
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                <span>Category</span>
                <button
                  type="button"
                  onClick={() => setManageOpen(true)}
                  style={{ background: 'none', border: 'none', color: '#6c63ff', fontSize: 12, cursor: 'pointer', padding: 0 }}
                >
                  Manage categories
                </button>
              </div>
            }
            name="category"
            rules={[{ required: true, message: 'Select a category' }]}
          >
            <Select loading={catLoading} placeholder="Select category" showSearch>
              {categories.map(c => (
                <Select.Option key={c.id} value={c.name}>{c.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item label="Note" name="note">
            <Input placeholder="e.g. lunch at warung" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" loading={loading} block size="large">
              Add Transaction
            </Button>
          </Form.Item>
        </Form>
      </div>

      {/* Manage Categories Modal */}
      <Modal
        title="Manage Categories"
        open={manageOpen}
        onCancel={() => setManageOpen(false)}
        footer={null}
        width={400}
      >
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <Input
            placeholder="New category name"
            value={newCat}
            onChange={e => setNewCat(e.target.value)}
            onPressEnter={handleAddCategory}
            maxLength={50}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAddCategory} loading={addingCat}>
            Add
          </Button>
        </div>

        {categories.length === 0 ? (
          <p style={{ color: '#6b7080', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>
            No categories yet.
          </p>
        ) : (
          categories.map(c => (
            <div key={c.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 0', borderBottom: '1px solid #2a2d3a',
            }}>
              <span style={{ fontSize: 14 }}>{c.name}</span>
              <Popconfirm
                title={`Delete "${c.name}"?`}
                description="Existing transactions keep this category name."
                onConfirm={() => handleDeleteCategory(c.id, c.name)}
                okText="Delete" okButtonProps={{ danger: true }}
                cancelText="Cancel"
              >
                <Button type="text" danger icon={<DeleteOutlined />} size="small" />
              </Popconfirm>
            </div>
          ))
        )}
      </Modal>
    </div>
  )
}
