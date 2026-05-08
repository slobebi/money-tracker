import { NavLink, Outlet } from 'react-router-dom'
import {
  PlusCircleOutlined,
  UnorderedListOutlined,
  BarChartOutlined,
  CreditCardOutlined,
  WalletOutlined,
} from '@ant-design/icons'

const links = [
  { to: '/add',          label: 'Add',      icon: <PlusCircleOutlined /> },
  { to: '/transactions', label: 'History',  icon: <UnorderedListOutlined /> },
  { to: '/monthly',      label: 'Monthly',  icon: <BarChartOutlined /> },
  { to: '/cards',        label: 'Cards',    icon: <CreditCardOutlined /> },
  { to: '/accounts',     label: 'Accounts', icon: <WalletOutlined /> },
]

export default function Layout() {
  return (
    <div style={{ minHeight: '100vh', background: '#0f1117' }}>

      {/* ── Desktop top nav (hidden on mobile) ── */}
      <nav className="hidden sm:flex" style={{
        background: '#1a1d27',
        borderBottom: '1px solid #2a2d3a',
        padding: '0 24px',
        alignItems: 'center',
        gap: 32,
        height: 56,
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <span style={{ fontWeight: 700, fontSize: 18, color: '#6c63ff', letterSpacing: '-0.5px' }}>
          💳 Tracker
        </span>
        {links.map(({ to, label }) => (
          <NavLink key={to} to={to} style={({ isActive }) => ({
            fontSize: 14,
            color: isActive ? '#e2e4ef' : '#6b7080',
            borderBottom: `2px solid ${isActive ? '#6c63ff' : 'transparent'}`,
            paddingBottom: 2,
            textDecoration: 'none',
            whiteSpace: 'nowrap',
            transition: 'color .15s, border-color .15s',
          })}>
            {label}
          </NavLink>
        ))}
      </nav>

      {/* ── Mobile top header (logo only) ── */}
      <header className="flex sm:hidden" style={{
        background: '#1a1d27',
        borderBottom: '1px solid #2a2d3a',
        padding: '0 16px',
        alignItems: 'center',
        height: 52,
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <span style={{ fontWeight: 700, fontSize: 17, color: '#6c63ff' }}>💳 Tracker</span>
      </header>

      {/* ── Page content ── */}
      {/* pb-24 on mobile to clear the bottom tab bar */}
      <main className="pb-24 sm:pb-6" style={{ maxWidth: 860, margin: '0 auto', padding: '16px 12px' }}>
        <Outlet />
      </main>

      {/* ── Mobile bottom tab bar (hidden on desktop) ── */}
      <nav className="flex sm:hidden" style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: '#1a1d27',
        borderTop: '1px solid #2a2d3a',
        zIndex: 20,
        paddingBottom: 'env(safe-area-inset-bottom)', // iPhone notch support
      }}>
        {links.map(({ to, label, icon }) => (
          <NavLink key={to} to={to} style={{ flex: 1, textDecoration: 'none' }}>
            {({ isActive }) => (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '10px 4px 8px',
                gap: 3,
                color: isActive ? '#6c63ff' : '#6b7080',
                transition: 'color .15s',
              }}>
                <span style={{ fontSize: 20, lineHeight: 1 }}>{icon}</span>
                <span style={{ fontSize: 10, fontWeight: isActive ? 600 : 400, letterSpacing: '0.2px' }}>
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
