import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { ensureFirebaseReady } from "@/lib/firebase";

// Show loading indicator while Firebase initializes
const rootElement = document.getElementById("root")!;
rootElement.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui;color:#666;"><div style="text-align:center;"><div style="width:40px;height:40px;border:3px solid #e5e7eb;border-top-color:#3b82f6;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 16px;"></div><div>Loading...</div></div></div><style>@keyframes spin{to{transform:rotate(360deg)}}</style>';

// Render app function
function renderApp() {
  createRoot(rootElement).render(<App />);
}

// Initialize Firebase with timeout to ensure app loads
const FIREBASE_TIMEOUT = 5000; // 5 seconds max wait

const timeoutPromise = new Promise<void>((_, reject) => {
  setTimeout(() => reject(new Error('Firebase initialization timeout')), FIREBASE_TIMEOUT);
});

Promise.race([ensureFirebaseReady(), timeoutPromise])
  .then(() => {
    renderApp();
  })
  .catch((error) => {
    console.warn('Firebase initialization issue:', error.message);
    // Render app anyway - Firebase features may be degraded but app should still work
    renderApp();
  });

// Register service worker and wire up update detection
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js')
    .then((registration) => {
      console.log('✓ Service worker registered');

      const notifyUpdate = () => {
        window.dispatchEvent(new Event('sw-update-ready'));
      };

      // If there is already a waiting SW on page load, notify immediately
      if (registration.waiting && navigator.serviceWorker.controller) {
        notifyUpdate();
      }

      // Watch for a new SW that finishes installing while this page is open
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          // 'installed' + an existing controller means a new version is waiting
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            notifyUpdate();
          }
        });
      });
    })
    .catch((err) => console.warn('Service worker registration failed:', err));
}
