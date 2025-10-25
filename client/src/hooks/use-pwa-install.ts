import { useState, useEffect, useRef } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function usePwaInstall() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const hasInteractedRef = useRef(false);
  const elapsedTimeRef = useRef(0);

  useEffect(() => {
    console.log('🔧 PWA Install Hook: Initializing...');
    console.log('📋 Current URL:', window.location.href);
    console.log('🌐 Protocol:', window.location.protocol, '(HTTPS required for production)');
    
    // Check if running in iframe
    const isInIframe = window.self !== window.top;
    console.log('🔍 PWA Install Hook: Running in iframe?', isInIframe);
    if (isInIframe) {
      console.warn('⚠️  PWA Install Hook: Running in iframe - install prompt will NOT appear!');
      console.warn('💡 To test PWA installation: Open this URL in a new browser tab/window');
    }
    
    // Log Chrome PWA requirements
    console.log('📝 Chrome PWA Requirements:');
    console.log('  1. HTTPS (or localhost) ✓');
    console.log('  2. Valid manifest.json ✓');
    console.log('  3. Service worker registered ✓');
    console.log('  4. User engagement: Click page + wait 30 seconds ⏱️');
    console.log('  5. Not in iframe ✓ (if in new tab)');
    console.log('⏰ IMPORTANT: Install button appears after 30 seconds of engagement!');
    
    // Track user interaction using ref
    const handleInteraction = () => {
      if (!hasInteractedRef.current) {
        hasInteractedRef.current = true;
        console.log('👆 PWA Install Hook: User interaction detected!');
      }
    };
    
    // Track elapsed time using ref
    const startTime = Date.now();
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      elapsedTimeRef.current = elapsed;
      
      if (elapsed === 10) console.log('⏱️  10 seconds elapsed...');
      if (elapsed === 20) console.log('⏱️  20 seconds elapsed...');
      if (elapsed === 30) console.log('⏱️  30 seconds elapsed! Install prompt should appear soon...');
    }, 1000);

    const handleBeforeInstallPrompt = (e: Event) => {
      console.log('✅ PWA Install Hook: beforeinstallprompt event captured!');
      console.log('📊 Engagement stats:', { 
        hasInteracted: hasInteractedRef.current, 
        elapsedTime: `${elapsedTimeRef.current}s` 
      });
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

    // Listen for user interactions
    window.addEventListener('click', handleInteraction);
    window.addEventListener('keydown', handleInteraction);
    window.addEventListener('touchstart', handleInteraction);
    
    console.log('👂 PWA Install Hook: Adding event listeners...');
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', () => {
      console.log('🎉 PWA Install Hook: App installed successfully!');
      setIsInstalled(true);
      setInstallPrompt(null);
    });

    checkIfInstalled();

    return () => {
      console.log('🧹 PWA Install Hook: Cleaning up...');
      clearInterval(timer);
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
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
