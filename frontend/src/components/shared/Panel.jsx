import React from 'react';

/**
 * Shared Panel component used across all modules
 * Provides consistent panel structure with minimize/expand functionality
 */
const Panel = ({ title, children, className = "", isMinimized = false, onToggleMinimize }) => {
  return (
    <section className={`panel ${className} ${isMinimized ? 'minimized' : ''}`}>
      <header className="panel-header">
        <h3 className="panel-title" id={`panel-title-${title.replace(/\s+/g, '-').toLowerCase()}`}>
          {title}
        </h3>
        <div className="panel-controls">
          <button 
            className="panel-btn minimize" 
            onClick={onToggleMinimize}
            aria-label={isMinimized ? `Expand ${title}` : `Minimize ${title}`}
            aria-expanded={!isMinimized}
          >
            {isMinimized ? '⬆' : '⬇'}
          </button>
        </div>
      </header>
      {!isMinimized && (
        <div className="panel-body" role="region" aria-labelledby={`panel-title-${title.replace(/\s+/g, '-').toLowerCase()}`}>
          {children}
        </div>
      )}
    </section>
  );
};

export default Panel;