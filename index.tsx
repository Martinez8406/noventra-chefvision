import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// Stripe przekierowuje na http://localhost:3000/success – normalizuj do #/success
if (typeof window !== 'undefined' && window.location.pathname === '/success') {
  const search = window.location.search || '';
  window.history.replaceState(null, '', `${window.location.origin}/#/success${search}`);
}

const container = document.getElementById('root');

if (!container) {
  throw new Error("Nie znaleziono elementu root w dokumencie.");
}

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
