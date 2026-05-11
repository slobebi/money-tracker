import { NavLink, Outlet } from 'react-router-dom'
import {
  HomeOutlined,
  PlusCircleOutlined,
  UnorderedListOutlined,
  BarChartOutlined,
  CreditCardOutlined,
  WalletOutlined,
} from '@ant-design/icons'

const links = [
  { to: '/dashboard',    label: 'Home',     icon: <HomeOutlined /> },
  { to: '/add',          label: 'Add',      icon: <PlusCircleOutlined /> },
  { to: '/transactions', label: 'History',  icon: <UnorderedListOutlined /> },
  { to: '/monthly',      label: 'Monthly',  icon: <BarChartOutlined /> },
  { to: '/cards',        label: 'Cards',    icon: <CreditCardOutlined /> },
  { to: '/accounts',     label: 'Accounts', icon: <WalletOutlined /> },
]

const activeStyle = { color: '#6c63ff', borderColor: '#6c63ff' }
const inactiveStyle = { color: '#6b7080', borderColor: 'transparent' }

export default function Layout() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0f1117', overflow: 'hidden' }}>

      {/* Desktop top nav */}
      <nav className="hidden sm:flex" style={{
        background: '#1a1d27', borderBottom: '1px solid #2a2d3a',
        padding: '0 24px', alignItems: 'center', gap: 28,
        height: 56, position: 'sticky', top: 0, zIndex: 10,
      }}>
        <span style={{ fontWeight: 700, fontSize: 17, color: '#6c63ff', letterSpacing: '-0.5px', marginRight: 4 }}>
          💳 Tracker
        </span>
        {links.map(({ to, label }) => (
          <NavLink key={to} to={to} style={({ isActive }) => ({
            fontSize: 14, textDecoration: 'none', whiteSpace: 'nowrap',
            paddingBottom: 2, borderBottom: '2px solid',
            transition: 'color .15s, border-color .15s',
            ...(isActive ? activeStyle : inactiveStyle),
          })}>
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Mobile top header */}
      <header className="flex sm:hidden" style={{
        background: '#1a1d27', borderBottom: '1px solid #2a2d3a',
        padding: '0 16px', alignItems: 'center', height: 50,
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <span style={{ fontWeight: 700, fontSize: 16, color: '#6c63ff' }}>💳 Money Tracker</span>
      </header>

      {/* Content — fills remaining height and scrolls */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch' }}>
        <main className="pb-24 sm:pb-6" style={{ maxWidth: 860, margin: '0 auto', padding: '16px 12px' }}>
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <nav className="flex sm:hidden" style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: '#1a1d27', borderTop: '1px solid #2a2d3a',
        zIndex: 20, paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        {links.map(({ to, label, icon }) => (
          <NavLink key={to} to={to} style={{ flex: 1, textDecoration: 'none' }}>
            {({ isActive }) => (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', padding: '9px 2px 7px', gap: 3,
                color: isActive ? '#6c63ff' : '#6b7080',
                transition: 'color .15s',
              }}>
                <span style={{ fontSize: 18, lineHeight: 1 }}>{icon}</span>
                <span style={{ fontSize: 9, fontWeight: isActive ? 600 : 400, letterSpacing: '0.2px' }}>
                  {label}
                </span>
              </div>
            )}
          </NavLink>
        ))}
      </nav>

    </div>
  )
}
