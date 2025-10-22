/**
 * Firebase Configuration
 * 
 * This file handles Firebase configuration for both development and production environments.
 * Firebase API keys are safe to expose in client-side code - security is enforced through
 * Firestore security rules, not by hiding the API key.
 * 
 * The configuration will:
 * 1. Try to use environment variables (VITE_* prefix)
 * 2. Fall back to server-side config endpoint if env vars are missing
 * 3. Provide clear error messages if configuration is incomplete
 */

interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  appId: string;
}

// Get configuration from environment variables
function getEnvConfig(): Partial<FirebaseConfig> {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  const appId = import.meta.env.VITE_FIREBASE_APP_ID;

  // Check if we have all required config from environment
  if (apiKey && projectId && appId) {
    return {
      apiKey,
      authDomain: `${projectId}.firebaseapp.com`,
      projectId,
      storageBucket: `${projectId}.firebasestorage.app`,
      appId,
    };
  }

  return {};
}

// Fetch configuration from server (fallback for production)
async function fetchServerConfig(): Promise<Partial<FirebaseConfig>> {
  try {
    const response = await fetch('/api/firebase-config', {
      method: 'GET',
      credentials: 'same-origin'
    });

    if (response.ok) {
      const config = await response.json();
      console.log('📡 Loaded Firebase config from server');
      return config;
    }
  } catch (error) {
    console.warn('⚠️ Could not fetch Firebase config from server:', error);
  }

  return {};
}

// Get Firebase configuration with fallbacks
export async function getFirebaseConfig(): Promise<FirebaseConfig> {
  // Try environment variables first
  let config = getEnvConfig();

  // If environment config is incomplete, try server
  if (!config.apiKey || !config.projectId || !config.appId) {
    console.log('🔍 Environment config incomplete, fetching from server...');
    const serverConfig = await fetchServerConfig();
    config = { ...config, ...serverConfig };
  }

  // Validate we have all required fields
  if (!config.apiKey || !config.projectId || !config.appId) {
    const missing: string[] = [];
    if (!config.apiKey) missing.push('API Key');
    if (!config.projectId) missing.push('Project ID');
    if (!config.appId) missing.push('App ID');

    throw new Error(
      `Firebase configuration incomplete. Missing: ${missing.join(', ')}. ` +
      `Please ensure Firebase environment variables are set or the server config endpoint is available.`
    );
  }

  return config as FirebaseConfig;
}
