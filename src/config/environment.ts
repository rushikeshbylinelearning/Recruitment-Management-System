// Environment configuration for the frontend
export const config = {
  // API Configuration
  API_BASE_URL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
  // API_BASE_URL: import.meta.env.VITE_API_URL || 'https://hr.bylinelms.com/api/',
  
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

