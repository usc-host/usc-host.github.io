import '@fontsource-variable/montserrat';
import '@fontsource-variable/manrope';
import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/pages.css';
import './styles/chat.css';
import './styles/features.css';
import './styles/loyalty.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { matchRoute } from './app/routes';

/* The first page chunk loads while the boot screen is still up, so React
   renders real content on its first paint instead of a second loader. */
matchRoute(window.location.pathname)
  .load()
  .then(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>
    );
  })
  .catch(() => window.__bellaBoot?.fail());
