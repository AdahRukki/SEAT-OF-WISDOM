import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function usePwaInstall() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    console.log('🔧 PWA Install Hook: Initializing...');
    
    // Check if running in iframe (common in development environments)
    const isInIframe = window.self !== window.top;
    console.log('🔍 PWA Install Hook: Running in iframe?', isInIframe);
    if (isInIframe) {
      console.warn('⚠️  PWA Install Hook: Running in iframe - install prompt will NOT appear!');
      console.warn('💡 To test PWA installation: Open this URL in a new browser tab/window');
    }
    
    const handleBeforeInstallPrompt = (e: Event) => {
      console.log('✅ PWA Install Hook: beforeinstallprompt event captured!');
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      console.log('✅ PWA Install Hook: Install prompt saved, button should now be visible');
    };

    const checkIfInstalled = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      console.log('🔍 PWA Install Hook: Checking if already installed... standalone:', isStandalone);
      if (isStandalone) {
        setIsInstalled(true);
        console.log('✅ PWA Install Hook: App is already installed (running in standalone mode)');
      }
    };

    console.log('👂 PWA Install Hook: Adding event listeners...');
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', () => {
      console.log('🎉 PWA Install Hook: App installed successfully!');
      setIsInstalled(true);
      setInstallPrompt(null);
    });

    checkIfInstalled();

    // Log current state after a moment
    setTimeout(() => {
      console.log('📊 PWA Install Hook: Current state check:', {
        hasInstallPrompt: !!installPrompt,
        isInstalled,
        canInstall: !!installPrompt && !isInstalled,
        isInIframe
      });
    }, 2000);

    return () => {
      console.log('🧹 PWA Install Hook: Cleaning up event listeners...');
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const installApp = async () => {
    if (!installPrompt) return false;

    try {
      await installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      
      if (outcome === 'accepted') {
        setInstallPrompt(null);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error installing PWA:', error);
      return false;
    }
  };

  return {
    canInstall: !!installPrompt && !isInstalled,
    isInstalled,
    installApp
  };
}
