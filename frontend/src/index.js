import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";

// Import the SSR-compatible App component
import App from "./App.router";

// Check if we're in SSR mode or regular client mode
const isSSRMode = window.__INITIAL_DATA__ !== undefined || 
                  document.getElementById('root').innerHTML.includes('ssr-loading-placeholder');

if (isSSRMode) {
  // Use hydration for SSR
  import('./hydrate');
} else {
  // Regular client-side rendering
  const root = ReactDOM.createRoot(document.getElementById("root"));
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
