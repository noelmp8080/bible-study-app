import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import BibleStudyApp from './TheBibleStudyApp.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BibleStudyApp />
  </StrictMode>,
)
