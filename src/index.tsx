import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Register Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Wrapped in try/catch to silence potential origin mismatch errors in preview environments
    try {
        navigator.serviceWorker.register('./sw.js')
        .then(registration => {
            console.log('SW registered');
        })
        .catch(err => {
            // Silently ignore or log warning for origin mismatch
            if (!err.message.includes('origin') && !err.message.includes('failed')) {
                console.log('SW registration skipped');
            }
        });
    } catch (e) {
        // Ignore registration errors
    }
  });
}