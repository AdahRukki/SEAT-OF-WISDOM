import { useState, useEffect } from 'react';

export function usePwaUpdate() {
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    let mounted = true;
    const syncUpdateReady = () => {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (mounted) setUpdateReady(Boolean(reg?.waiting && navigator.serviceWorker.controller));
      }).catch(() => {
        if (mounted) setUpdateReady(false);
      });
    };

    window.addEventListener('sw-update-ready', syncUpdateReady);
    navigator.serviceWorker.addEventListener('controllerchange', syncUpdateReady);
    syncUpdateReady();

    return () => {
      mounted = false;
      window.removeEventListener('sw-update-ready', syncUpdateReady);
      navigator.serviceWorker.removeEventListener('controllerchange', syncUpdateReady);
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
      } else {
        setUpdateReady(false);
      }
    }).catch(() => setUpdateReady(false));
  };

  return { updateReady, applyUpdate };
}
