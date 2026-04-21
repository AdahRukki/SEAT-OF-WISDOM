import { useState, useEffect } from 'react';

export function usePwaUpdate() {
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const handleUpdateReady = () => setUpdateReady(true);

    // Listen for the custom event fired by main.tsx when a new SW is waiting
    window.addEventListener('sw-update-ready', handleUpdateReady);

    // Also check immediately in case a waiting SW was detected before this component mounted
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (reg?.waiting && navigator.serviceWorker.controller) {
        setUpdateReady(true);
      }
    });

    return () => {
      window.removeEventListener('sw-update-ready', handleUpdateReady);
    };
  }, []);

  const applyUpdate = () => {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.getRegistration().then((reg) => {
      if (reg?.waiting) {
        // When the new SW takes over, reload so users get the fresh app shell
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          window.location.reload();
        }, { once: true });

        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
    });
  };

  return { updateReady, applyUpdate };
}
