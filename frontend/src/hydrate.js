import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.router';
import './index.css';

// SSR Hydration with error handling and performance monitoring
const hydrate = () => {
  const container = document.getElementById('root');
  
  if (!container) {
    console.error('Root container not found');
    return;
  }

  // Performance monitoring
  const startTime = performance.now();
  
  // Get initial data from SSR
  const initialData = window.__INITIAL_DATA__ || {};
  const ssrRoute = window.__SSR_ROUTE__ || '/';
  
  console.log('🔄 Hydrating React app...', {
    route: ssrRoute,
    hasInitialData: Object.keys(initialData).length > 0,
    timestamp: new Date().toISOString()
  });

  // Create root and hydrate
  const root = ReactDOM.createRoot(container);
  
  try {
    // Use hydrateRoot for SSR or createRoot for client-only
    const isSSR = container.innerHTML.includes('data-reactroot') || 
                  container.innerHTML.includes('ssr-loading-placeholder');
    
    if (isSSR) {
      // SSR hydration path
      console.log('🌊 Hydrating from SSR...');
      
      // Pass initial data to App component
      const AppWithData = React.createElement(App, {
        initialData,
        ssrRoute
      });
      
      root.render(AppWithData);
      
    } else {
      // Client-only rendering path
      console.log('🔧 Client-side rendering...');
      root.render(React.createElement(App));
    }
    
    // Performance metrics
    const hydrationTime = performance.now() - startTime;
    console.log(`✅ Hydration complete in ${hydrationTime.toFixed(2)}ms`);
    
    // Report performance metrics
    if (window.gtag) {
      window.gtag('event', 'hydration_complete', {
        custom_parameter_1: hydrationTime,
        custom_parameter_2: ssrRoute
      });
    }
    
    // Clean up SSR artifacts
    setTimeout(() => {
      // Remove critical CSS once main CSS has loaded
      const criticalCSS = document.getElementById('critical-css');
      if (criticalCSS && document.readyState === 'complete') {
        criticalCSS.remove();
      }
      
      // Clean up initial data from window
      delete window.__INITIAL_DATA__;
      delete window.__SSR_ROUTE__;
    }, 1000);
    
  } catch (error) {
    console.error('❌ Hydration failed:', error);
    
    // Fallback to fresh client render
    console.log('🔄 Falling back to client-side rendering...');
    container.innerHTML = '';
    root.render(React.createElement(App));
  }
};

// Enhanced hydration with WebSocket connection handling
const hydrateWithWebSocket = () => {
  hydrate();
  
  // Establish WebSocket connection after hydration
  setTimeout(() => {
    console.log('🔌 Establishing WebSocket connection...');
    
    // This will be handled by the App component's useEffect
    const connectEvent = new CustomEvent('app:connect-websocket', {
      detail: { delay: 100 } // Small delay to ensure React is ready
    });
    
    window.dispatchEvent(connectEvent);
  }, 500);
};

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', hydrateWithWebSocket);
} else {
  hydrateWithWebSocket();
}

// Export for potential manual use
export default hydrate;