import { useState, useEffect } from 'react';

interface NetworkStatus {
  isOnline: boolean;
  wasOffline: boolean;
}

export function useNetworkStatus(onOffline?: () => void, onOnline?: () => void) {
  const [status, setStatus] = useState<NetworkStatus>({
    isOnline: navigator.onLine,
    wasOffline: false,
  });

  useEffect(() => {
    const handleOnline = () => {
      console.log('🌐 Network: Back online');
      setStatus({ isOnline: true, wasOffline: status.wasOffline });
      onOnline?.();
    };

    const handleOffline = () => {
      console.log('❌ Network: Went offline - security logout triggered');
      setStatus({ isOnline: false, wasOffline: true });
      onOffline?.();
    };

    // Add event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Cleanup
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [onOffline, onOnline]);

  return status;
}
