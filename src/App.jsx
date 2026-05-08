import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import AddTransaction from './pages/AddTransaction'
import Transactions from './pages/Transactions'
import Monthly from './pages/Monthly'
import Cards from './pages/Cards'
import Accounts from './pages/Accounts'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/add" replace />} />
        <Route path="add"          element={<AddTransaction />} />
        <Route path="transactions" element={<Transactions />} />
        <Route path="monthly"      element={<Monthly />} />
        <Route path="cards"        element={<Cards />} />
        <Route path="accounts"     element={<Accounts />} />
      </Route>
    </Routes>
  )
}
