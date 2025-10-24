module.exports = {
  apps: [{
    name: 'seatofwisdom',
    script: 'dist/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    // Load environment variables from .env file
    env_file: '.env',
    // Alternative: you can also specify env vars directly
    // Uncomment below if env_file doesn't work with your PM2 version
    /*
    env: {
      NODE_ENV: 'production',
      PORT: 5000,
      DATABASE_URL: 'postgresql://sowa_user:Sowa2025Academy@localhost:5432/sowa_academy',
      VITE_FIREBASE_API_KEY: 'AIzaSyDe-WAyR3GTqgp1lNcScrUznORBPJ2Wdt8',
      VITE_FIREBASE_APP_ID: '1:678218632080:web:d1a6e61b87398a5de88115',
      VITE_FIREBASE_PROJECT_ID: 'sowa-test-fd7c0',
      SESSION_SECRET: 'T5Qq6fPmhD97FK0M+WGIsadBEikLfdNsVLZJa1B52tlR7BV1ZmvNh82D/8w20lZC8D13ledeTjYQ08',
      JWT_SECRET: 'sowa-test-fd7c0'
    }
    */
  }]
};
