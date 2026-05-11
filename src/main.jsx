import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { ConfigProvider, App, theme } from 'antd'
import AppRoutes from './App'
import { CardsProvider } from './contexts/CardsContext'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary:          '#6c63ff',
          colorBgContainer:      '#1a1d27',
          colorBgBase:           '#0f1117',
          colorBgElevated:       '#242736',
          colorBgSpotlight:      '#242736',
          colorBorder:           '#2a2d3a',
          colorBorderSecondary:  '#2a2d3a',
          colorText:             '#e2e4ef',
          colorTextSecondary:    '#6b7080',
          colorSuccess:          '#3ecf8e',
          colorError:            '#f25f5c',
          colorWarning:          '#f5a623',
          borderRadius:          8,
          fontFamily:            "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        },
      }}
    >
      <App>
        <HashRouter>
          <CardsProvider>
            <AppRoutes />
          </CardsProvider>
        </HashRouter>
      </App>
    </ConfigProvider>
  </React.StrictMode>
)
