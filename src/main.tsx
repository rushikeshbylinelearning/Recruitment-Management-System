import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Suppress browser extension errors that don't affect the application
// These occur when extensions try to communicate with the page but the message channel closes
const originalError = console.error;
console.error = (...args: any[]) => {
  const errorMessage = args[0]?.toString() || '';
  
  // Suppress known harmless browser extension errors
  if (
    errorMessage.includes('message channel closed') ||
    errorMessage.includes('Extension context invalidated') ||
    errorMessage.includes('Could not establish connection')
  ) {
    return; // Silently ignore these errors
  }
  
  // Log all other errors normally
  originalError.apply(console, args);
};

// Handle unhandled promise rejections from browser extensions
window.addEventListener('unhandledrejection', (event) => {
  const errorMessage = event.reason?.message || event.reason?.toString() || '';
  
  // Suppress browser extension promise rejections
  if (
    errorMessage.includes('message channel closed') ||
    errorMessage.includes('Extension context invalidated') ||
    errorMessage.includes('Could not establish connection')
  ) {
    event.preventDefault(); // Prevent the error from being logged
    return;
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
