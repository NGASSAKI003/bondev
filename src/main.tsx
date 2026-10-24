import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { startTranslator } from './i18n'

startTranslator()
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'))
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
