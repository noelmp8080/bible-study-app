import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Fonts are bundled (no CDN) so the installed app has them offline.
import '@fontsource/instrument-serif/400.css'
import '@fontsource/instrument-serif/400-italic.css'
import '@fontsource-variable/archivo/wght.css'
import '@fontsource-variable/source-serif-4/opsz.css'
import '@fontsource-variable/source-serif-4/opsz-italic.css'
import './styles/tokens.css'
import './styles/base.css'
import Root from './app/Root.jsx'

// Apply the last-used theme before the first paint.
try {
  const theme = localStorage.getItem('bsa_theme')
  if (theme) document.documentElement.dataset.theme = theme
  // The pasted Anthropic key is gone: AI calls go through the "scholar" Edge Function.
  localStorage.removeItem('bsa_api_key')
} catch { /* storage blocked */ }

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
    <Root />
  </StrictMode>,
)
