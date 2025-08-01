import React from 'react';
import './LoadingSkeleton.css';

/**
 * Generic skeleton loader with configurable layout
 */
const SkeletonLine = ({ width = '100%', height = '1rem', className = '' }) => (
  <div 
    className={`skeleton-line ${className}`} 
    style={{ width, height }}
    role="presentation"
    aria-hidden="true"
  />
);

const SkeletonBox = ({ width = '100%', height = '200px', className = '' }) => (
  <div 
    className={`skeleton-box ${className}`} 
    style={{ width, height }}
    role="presentation"
    aria-hidden="true"
  />
);

/**
 * Dashboard loading skeleton
 */
export const DashboardSkeleton = () => (
  <div className="loading-skeleton dashboard-skeleton" aria-label="Loading dashboard">
    <div className="skeleton-header">
      <SkeletonLine width="300px" height="2rem" />
    </div>
    <div className="skeleton-grid dashboard-grid">
      {/* 3D Visualization skeleton */}
      <div className="skeleton-panel">
        <SkeletonLine width="200px" height="1.5rem" className="panel-title" />
        <SkeletonBox height="300px" className="rover-3d" />
      </div>
      
      {/* Telemetry chart skeleton */}
      <div className="skeleton-panel">
        <SkeletonLine width="180px" height="1.5rem" className="panel-title" />
        <SkeletonBox height="250px" className="chart" />
      </div>
      
      {/* Control panel skeleton */}
      <div className="skeleton-panel">
        <SkeletonLine width="150px" height="1.5rem" className="panel-title" />
        <div className="control-skeleton">
          <SkeletonBox width="60px" height="40px" className="button" />
          <SkeletonBox width="150px" height="150px" className="joystick" />
          <SkeletonLine width="120px" height="30px" className="slider" />
        </div>
      </div>
      
      {/* Gauges skeleton */}
      <div className="skeleton-panel">
        <SkeletonLine width="160px" height="1.5rem" className="panel-title" />
        <div className="gauges-skeleton">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="gauge-skeleton">
              <SkeletonBox width="80px" height="80px" className="gauge-circle" />
              <SkeletonLine width="60px" height="1rem" className="gauge-label" />
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

/**
 * IDE loading skeleton
 */
export const IDESkeleton = () => (
  <div className="loading-skeleton ide-skeleton" aria-label="Loading IDE">
    <div className="skeleton-header">
      <SkeletonLine width="200px" height="2rem" />
    </div>
    <div className="skeleton-grid ide-grid">
      {/* Code editor skeleton */}
      <div className="skeleton-panel editor-panel">
        <SkeletonLine width="120px" height="1.5rem" className="panel-title" />
        <div className="editor-toolbar-skeleton">
          {[1, 2, 3, 4].map(i => (
            <SkeletonBox key={i} width="80px" height="32px" className="toolbar-btn" />
          ))}
        </div>
        <SkeletonBox height="400px" className="code-editor" />
      </div>
      
      {/* Library manager skeleton */}
      <div className="skeleton-panel">
        <SkeletonLine width="140px" height="1.5rem" className="panel-title" />
        <div className="library-skeleton">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="library-item-skeleton">
              <SkeletonLine width="150px" height="1rem" />
              <SkeletonLine width="60px" height="0.8rem" />
            </div>
          ))}
        </div>
      </div>
      
      {/* Serial monitor skeleton */}
      <div className="skeleton-panel">
        <SkeletonLine width="130px" height="1.5rem" className="panel-title" />
        <SkeletonBox height="200px" className="serial-output" />
      </div>
      
      {/* Compilation output skeleton */}
      <div className="skeleton-panel">
        <SkeletonLine width="170px" height="1.5rem" className="panel-title" />
        <SkeletonBox height="150px" className="compilation-output" />
      </div>
    </div>
  </div>
);

/**
 * AI Assistant loading skeleton
 */
export const AIAssistantSkeleton = () => (
  <div className="loading-skeleton ai-skeleton" aria-label="Loading AI Assistant">
    <div className="skeleton-header">
      <SkeletonLine width="180px" height="2rem" />
    </div>
    <div className="skeleton-panel ai-panel">
      <SkeletonLine width="200px" height="1.5rem" className="panel-title" />
      <div className="ai-chat-skeleton">
        <div className="context-skeleton">
          <SkeletonLine width="120px" height="1.2rem" />
          {[1, 2, 3, 4].map(i => (
            <SkeletonLine key={i} width="200px" height="1rem" className="context-item" />
          ))}
        </div>
        <div className="chat-messages-skeleton">
          <div className="welcome-message-skeleton">
            <SkeletonBox height="200px" className="welcome-content" />
          </div>
        </div>
        <div className="chat-input-skeleton">
          <SkeletonBox width="100%" height="40px" className="input-field" />
          <SkeletonBox width="80px" height="40px" className="send-button" />
        </div>
      </div>
    </div>
  </div>
);

/**
 * Project management loading skeleton
 */
export const ProjectSkeleton = () => (
  <div className="loading-skeleton project-skeleton" aria-label="Loading project management">
    <div className="skeleton-header">
      <SkeletonLine width="220px" height="2rem" />
    </div>
    <div className="skeleton-grid project-grid">
      {/* Kanban board skeleton */}
      <div className="skeleton-panel kanban-panel">
        <SkeletonLine width="160px" height="1.5rem" className="panel-title" />
        <div className="kanban-skeleton">
          {['TODO', 'IN PROGRESS', 'DONE'].map(column => (
            <div key={column} className="kanban-column-skeleton">
              <SkeletonLine width="100px" height="1.2rem" className="column-header" />
              {[1, 2, 3].map(i => (
                <SkeletonBox key={i} height="80px" className="task-card" />
              ))}
            </div>
          ))}
        </div>
      </div>
      
      {/* Inventory skeleton */}
      <div className="skeleton-panel">
        <SkeletonLine width="180px" height="1.5rem" className="panel-title" />
        <div className="inventory-skeleton">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="inventory-item-skeleton">
              <SkeletonLine width="180px" height="1rem" />
              <SkeletonLine width="60px" height="1rem" />
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

/**
 * Knowledge base loading skeleton
 */
export const KnowledgeSkeleton = () => (
  <div className="loading-skeleton knowledge-skeleton" aria-label="Loading knowledge base">
    <div className="skeleton-header">
      <SkeletonLine width="200px" height="2rem" />
    </div>
    <div className="skeleton-panel knowledge-panel">
      <SkeletonLine width="160px" height="1.5rem" className="panel-title" />
      <div className="knowledge-nav-skeleton">
        {[1, 2, 3, 4].map(i => (
          <SkeletonBox key={i} width="120px" height="36px" className="nav-tab" />
        ))}
      </div>
      <div className="knowledge-content-skeleton">
        <SkeletonBox height="400px" className="content-area" />
      </div>
    </div>
  </div>
);

/**
 * Generic loading skeleton for fallback
 */
export const GenericSkeleton = ({ title = "Loading..." }) => (
  <div className="loading-skeleton generic-skeleton" aria-label={title}>
    <div className="skeleton-header">
      <SkeletonLine width="200px" height="2rem" />
    </div>
    <div className="skeleton-content">
      <SkeletonBox height="300px" />
      <div className="skeleton-rows">
        <SkeletonLine width="80%" height="1rem" />
        <SkeletonLine width="90%" height="1rem" />
        <SkeletonLine width="75%" height="1rem" />
      </div>
    </div>
  </div>
);