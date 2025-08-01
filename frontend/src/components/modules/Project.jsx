import React from 'react';
import { Panel } from '../shared';

const Project = ({
  // Project management props
  projectTasks,
  panelStates,
  togglePanel
}) => {
  return (
    <article className="project-workspace" aria-labelledby="project-heading">
      <header className="module-header">
        <h2 id="project-heading" className="sr-only">Project Management</h2>
      </header>
      <div className="project-grid" role="region" aria-label="Project management panels">
        <Panel 
          title="📋 PROJECT KANBAN" 
          className="kanban-panel"
          isMinimized={panelStates.kanban}
          onToggleMinimize={() => togglePanel('kanban')}
        >
          <div className="kanban-board">
            {['todo', 'in-progress', 'done'].map(status => (
              <div key={status} className="kanban-column">
                <h4 className="column-header">{status.toUpperCase()}</h4>
                <div className="task-list">
                  {projectTasks.filter(task => task.status === status).map(task => (
                    <div key={task.id} className={`task-card priority-${task.priority}`}>
                      <div className="task-title">{task.title}</div>
                      <div className="task-meta">
                        <span className={`priority priority-${task.priority}`}>
                          {task.priority}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel 
          title="📦 COMPONENT INVENTORY" 
          className="inventory-panel"
          isMinimized={panelStates.inventory}
          onToggleMinimize={() => togglePanel('inventory')}
        >
          <div className="inventory-list">
            <div className="inventory-item">
              <span>Arduino Mega 2560</span>
              <span className="quantity">1x ✅</span>
            </div>
            <div className="inventory-item">
              <span>NodeMCU Amica</span>
              <span className="quantity">1x ✅</span>
            </div>
            <div className="inventory-item">
              <span>RioRand BLDC Controllers</span>
              <span className="quantity">4x ✅</span>
            </div>
            <div className="inventory-item">
              <span>Hoverboard Wheels</span>
              <span className="quantity">4x ✅</span>
            </div>
            <div className="inventory-item">
              <span>36V Battery</span>
              <span className="quantity">1x ⚠️</span>
            </div>
            <div className="inventory-item">
              <span>25.2V Battery</span>
              <span className="quantity">1x ❌</span>
            </div>
          </div>
        </Panel>
      </div>
    </article>
  );
};

export default Project;