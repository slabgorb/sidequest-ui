import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'

// Spike: ?dice-spike query param loads the dice test page directly
// eslint-disable-next-line react-refresh/only-export-components
const DiceSpikePage = lazy(() => import('./dice/DiceSpikePage'));
const isDiceSpike = new URLSearchParams(window.location.search).has('dice-spike');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isDiceSpike ? (
      <Suspense fallback={<div style={{ background: '#111', height: '100vh' }} />}>
        <DiceSpikePage />
      </Suspense>
    ) : (
      <BrowserRouter>
        <App />
      </BrowserRouter>
    )}
  </StrictMode>,
)
