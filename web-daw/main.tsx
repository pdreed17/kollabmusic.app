import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './App.css'

// Ensure we have a root element
const rootElement = document.getElementById('root')

if (!rootElement) {
  // Create root element if it doesn't exist (for manual setup)
  const root = document.createElement('div')
  root.id = 'root'
  document.body.appendChild(root)

  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
} else {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}