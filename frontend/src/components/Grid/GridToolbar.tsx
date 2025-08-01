/**
 * GridToolbar Component - Control toolbar for grid operations
 * Provides panel management, layout operations, and grid controls
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Breakpoint } from '../../types/grid';
import { useTheme } from '../../theme/ThemeProvider';
import './GridToolbar.css';

// Toolbar icons
const AddIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="12" y1="5" x2="12" y2="19"/>
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

const ResetIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
    <path d="M21 3v5h-5"/>
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
    <path d="M3 21v-5h5"/>
  </svg>
);

const CompactIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="7" height="7"/>
    <rect x="14" y="3" width="7" height="7"/>
    <rect x="3" y="14" width="7" height="7"/>
    <rect x="14" y="14" width="7" height="7"/>
  </svg>
);

const SaveIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
    <polyline points="17,21 17,13 7,13 7,21"/>
    <polyline points="7,3 7,8 15,8"/>
  </svg>
);

const LoadIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14,2 14,8 20,8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
    <polyline points="10,9 9,9 8,9"/>
  </svg>
);

const GridIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="7" height="7"/>
    <rect x="14" y="3" width="7" height="7"/>
    <rect x="3" y="14" width="7" height="7"/>
    <rect x="14" y="14" width="7" height="7"/>
  </svg>
);

// Panel type configurations for the add panel dropdown
const PANEL_TYPES = [
  {
    id: 'telemetry',
    name: 'Telemetry Panel',
    icon: '📡',
    description: 'Real-time sensor data and metrics',
    defaultSize: { w: 4, h: 3 },
    minSize: { w: 2, h: 2 },
    category: 'Data'
  },
  {
    id: 'control',
    name: 'Control Panel',
    icon: '🎮',
    description: 'Rover control interface',
    defaultSize: { w: 3, h: 4 },
    minSize: { w: 2, h: 3 },
    category: 'Control'
  },
  {
    id: 'visualization',
    name: 'Visualization Panel',
    icon: '📊',
    description: '3D visualization and charts',
    defaultSize: { w: 6, h: 4 },
    minSize: { w: 4, h: 3 },
    category: 'Display'
  },
  {
    id: 'status',
    name: 'Status Panel',
    icon: '🔍',
    description: 'System health and status',
    defaultSize: { w: 3, h: 2 },
    minSize: { w: 2, h: 2 },
    category: 'Monitoring'
  },
  {
    id: 'communication',
    name: 'Communication Panel',
    icon: '💬',
    description: 'Mission logs and communication',
    defaultSize: { w: 4, h: 5 },
    minSize: { w: 3, h: 3 },
    category: 'Communication'
  }
];

export interface GridToolbarProps {
  onAddPanel?: (panelType: any, position?: any) => void;
  onResetLayout?: () => void;
  onCompactLayout?: () => void;
  onSaveLayout?: () => void;
  onLoadLayout?: (layoutData: string) => void;
  currentBreakpoint?: Breakpoint;
  panelCount?: number;
  className?: string;
  showBreakpointInfo?: boolean;
  showPanelCount?: boolean;
}

const GridToolbar: React.FC<GridToolbarProps> = ({
  onAddPanel,
  onResetLayout,
  onCompactLayout,
  onSaveLayout,
  onLoadLayout,
  currentBreakpoint = 'lg',
  panelCount = 0,
  className = '',
  showBreakpointInfo = true,
  showPanelCount = true
}) => {
  const theme = useTheme();
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Group panel types by category
  const panelCategories = useMemo(() => {
    const categories = ['All', ...Array.from(new Set(PANEL_TYPES.map(p => p.category)))];
    return categories;
  }, []);

  const filteredPanelTypes = useMemo(() => {
    if (selectedCategory === 'All') return PANEL_TYPES;
    return PANEL_TYPES.filter(panel => panel.category === selectedCategory);
  }, [selectedCategory]);

  // Handle adding a panel
  const handleAddPanel = useCallback((panelType: typeof PANEL_TYPES[0]) => {
    onAddPanel?.(panelType);
    setShowAddPanel(false);
  }, [onAddPanel]);

  // Handle save layout
  const handleSaveLayout = useCallback(async () => {
    try {
      onSaveLayout?.();
      
      // Show confirmation (could be replaced with a toast notification)
      console.log('Layout saved successfully');
    } catch (error) {
      console.error('Failed to save layout:', error);
    }
  }, [onSaveLayout]);

  // Handle load layout
  const handleLoadLayout = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const layoutData = event.target?.result as string;
          onLoadLayout?.(layoutData);
        };
        reader.readAsText(file);
      }
    };
    
    input.click();
  }, [onLoadLayout]);

  // Breakpoint display mapping
  const breakpointLabels = {
    lg: 'Large (1920px+)',
    md: 'Medium (1366px+)',
    sm: 'Small (1024px+)',
    xs: 'Extra Small (768px+)',
    xxs: 'Mobile (480px+)'
  };

  return (
    <div 
      className={`grid-toolbar ${className}`}
      role="toolbar"
      aria-label="Grid layout controls"
      data-testid="grid-toolbar"
    >
      {/* Left section - Primary actions */}
      <div className="toolbar-section toolbar-primary">
        {/* Add Panel Dropdown */}
        <div className="toolbar-dropdown">
          <button
            className="toolbar-btn primary"
            onClick={() => setShowAddPanel(!showAddPanel)}
            title="Add new panel"
            aria-label="Add new panel"
            aria-expanded={showAddPanel}
            aria-haspopup="true"
          >
            <AddIcon size={16} />
            <span>Add Panel</span>
          </button>
          
          {showAddPanel && (
            <div 
              className="dropdown-menu"
              role="menu"
              aria-label="Panel types"
            >
              {/* Category Filter */}
              <div className="dropdown-header">
                <div className="category-filters">
                  {panelCategories.map(category => (
                    <button
                      key={category}
                      className={`category-btn ${selectedCategory === category ? 'active' : ''}`}
                      onClick={() => setSelectedCategory(category)}
                      type="button"
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Panel Types */}
              <div className="panel-types-list">
                {filteredPanelTypes.map(panelType => (
                  <button
                    key={panelType.id}
                    className="panel-type-item"
                    onClick={() => handleAddPanel(panelType)}
                    role="menuitem"
                    type="button"
                  >
                    <div className="panel-type-icon">{panelType.icon}</div>
                    <div className="panel-type-info">
                      <div className="panel-type-name">{panelType.name}</div>
                      <div className="panel-type-description">{panelType.description}</div>
                      <div className="panel-type-size">
                        Default: {panelType.defaultSize.w}×{panelType.defaultSize.h}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Layout Actions */}
        <div className="toolbar-actions">
          <button
            className="toolbar-btn"
            onClick={onCompactLayout}
            title="Compact layout"
            aria-label="Compact layout to remove gaps"
          >
            <CompactIcon size={16} />
            <span>Compact</span>
          </button>

          <button
            className="toolbar-btn"
            onClick={onResetLayout}
            title="Reset layout"
            aria-label="Reset layout to default"
          >
            <ResetIcon size={16} />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Center section - Info */}
      <div className="toolbar-section toolbar-info">
        {showPanelCount && (
          <div className="info-item">
            <GridIcon size={14} />
            <span>{panelCount} panels</span>
          </div>
        )}
        
        {showBreakpointInfo && (
          <div className="info-item breakpoint-info">
            <span className={`breakpoint-indicator ${currentBreakpoint}`}>
              {currentBreakpoint.toUpperCase()}
            </span>
            <span className="breakpoint-label">
              {breakpointLabels[currentBreakpoint]}
            </span>
          </div>
        )}
      </div>

      {/* Right section - Save/Load */}
      <div className="toolbar-section toolbar-secondary">
        <button
          className="toolbar-btn"
          onClick={handleSaveLayout}
          title="Save current layout"
          aria-label="Save current layout"
        >
          <SaveIcon size={16} />
          <span>Save</span>
        </button>

        <button
          className="toolbar-btn"
          onClick={handleLoadLayout}
          title="Load saved layout"
          aria-label="Load saved layout from file"
        >
          <LoadIcon size={16} />
          <span>Load</span>
        </button>
      </div>

      {/* Click outside handler for dropdown */}
      {showAddPanel && (
        <div
          className="dropdown-backdrop"
          onClick={() => setShowAddPanel(false)}
          aria-hidden="true"
        />
      )}
    </div>
  );
};

export default GridToolbar;