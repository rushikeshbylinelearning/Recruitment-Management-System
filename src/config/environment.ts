import { getHrAppUrl, getPublicAppUrl } from './domains';

// Environment configuration for the frontend
export const config = {
  // API Configuration
  // Reads from VITE_API_URL env variable:
  //   - .env.development sets VITE_API_URL=/api  (proxied to localhost:3001 by Vite)
  //   - .env.production  sets VITE_API_URL=https://hr.bylinelms.com/api
  // Safety fallback: http://localhost:3001 if variable is not set
  API_BASE_URL: import.meta.env.VITE_API_URL || 'http://localhost:3001',

  /** @deprecated Use getPublicAppUrl() for share links */
  APP_URL: getPublicAppUrl(),

  HR_APP_URL: getHrAppUrl(),
  PUBLIC_APP_URL: getPublicAppUrl(),

  // App Configuration
  APP_NAME: import.meta.env.VITE_APP_NAME || 'HR Workflow Management',
  APP_VERSION: import.meta.env.VITE_APP_VERSION || '1.0.0',

  // Development flags
  IS_DEVELOPMENT: import.meta.env.DEV,
  IS_PRODUCTION: import.meta.env.PROD,

  // Feature flags
  ENABLE_ANALYTICS: import.meta.env.VITE_ENABLE_ANALYTICS !== 'false',
  ENABLE_NOTIFICATIONS: import.meta.env.VITE_ENABLE_NOTIFICATIONS !== 'false',
};

export default config;
