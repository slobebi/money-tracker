import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import AddTransaction from './pages/AddTransaction'
import Transactions from './pages/Transactions'
import Monthly from './pages/Monthly'
import Cards from './pages/Cards'
import Confirm from './pages/Confirm'
import Accounts from './pages/Accounts'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard"    element={<Dashboard />} />
        <Route path="add"          element={<AddTransaction />} />
        <Route path="transactions" element={<Transactions />} />
        <Route path="monthly"      element={<Monthly />} />
        <Route path="cards"        element={<Cards />} />
        <Route path="confirm"      element={<Confirm />} />
        <Route path="accounts"     element={<Accounts />} />
      </Route>
    </Routes>
  )
}
