import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import BibleStudyApp from './TheBibleStudyApp.jsx'

// When a new service worker takes control (autoUpdate mode calls skipWaiting),
// reload the page once so users always get the fresh build without manual refresh.
if ('serviceWorker' in navigator) {
  let swRefreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (swRefreshing) return;
    swRefreshing = true;
    window.location.reload();
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BibleStudyApp />
  </StrictMode>,
)
