/**
 * GridExample Component - Demonstration of the flexible grid system
 * Shows how to integrate and use the drag-and-drop grid system
 */

import React, { useState, useCallback } from 'react';
import { 
  GridContainer, 
  GridContainerRef, 
  PANEL_CONFIGS, 
  DEFAULT_LAYOUTS,
  GridUtils 
} from './index';
import { ResponsiveLayouts, PanelInstance } from '../../types/grid';

interface GridExampleProps {
  className?: string;
}

const GridExample: React.FC<GridExampleProps> = ({ className = '' }) => {
  const gridRef = React.useRef<GridContainerRef>(null);
  
  // Initialize with default panels
  const [panels] = useState<PanelInstance[]>([
    {
      id: 'status-panel',
      panelId: 'status',
      layout: { i: 'status-panel', x: 0, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
      config: { autoRefresh: true, showAlerts: true },
      isMinimized: false,
      isMaximized: false,
      isVisible: true,
      lastModified: Date.now()
    },
    {
      id: 'telemetry-panel',
      panelId: 'telemetry',
      layout: { i: 'telemetry-panel', x: 3, y: 0, w: 4, h: 3, minW: 2, minH: 2 },
      config: { updateInterval: 1000, showGraphs: true },
      isMinimized: false,
      isMaximized: false,
      isVisible: true,
      lastModified: Date.now()
    },
    {
      id: 'control-panel',
      panelId: 'control',
      layout: { i: 'control-panel', x: 7, y: 0, w: 3, h: 4, minW: 2, minH: 3 },
      config: { enableJoystick: true, showAdvancedControls: true },
      isMinimized: false,
      isMaximized: false,
      isVisible: true,
      lastModified: Date.now()
    },
    {
      id: 'visualization-panel',
      panelId: 'visualization',
      layout: { i: 'visualization-panel', x: 0, y: 2, w: 7, h: 4, minW: 4, minH: 3 },
      config: { viewMode: '3d', showGrid: true, showPath: true },
      isMinimized: false,
      isMaximized: false,
      isVisible: true,
      lastModified: Date.now()
    },
    {
      id: 'communication-panel',
      panelId: 'communication',
      layout: { i: 'communication-panel', x: 7, y: 4, w: 5, h: 5, minW: 3, minH: 3 },
      config: { autoScroll: true, maxLogEntries: 100, showStats: true },
      isMinimized: false,
      isMaximized: false,
      isVisible: true,
      lastModified: Date.now()
    }
  ]);

  // Handle layout changes
  const handleLayoutChange = useCallback((layouts: ResponsiveLayouts) => {
    console.log('Layout changed:', layouts);
    // Here you would typically save to localStorage or send to backend
  }, []);

  // Handle panel changes
  const handlePanelChange = useCallback((updatedPanels: PanelInstance[]) => {
    console.log('Panels changed:', updatedPanels);
    // Here you would typically update your state management system
  }, []);

  // Handle control commands
  const handleControlCommand = useCallback((control: any) => {
    console.log('Control command:', control);
    // Here you would send commands to the rover
  }, []);

  // Handle communication commands
  const handleSendCommand = useCallback((command: string) => {
    console.log('Communication command:', command);
    // Here you would send commands via WebSocket or HTTP
  }, []);

  // Export layout
  const handleExportLayout = useCallback(() => {
    if (gridRef.current) {
      const layouts = gridRef.current.exportLayout();
      const layoutJson = GridUtils.exportLayout(layouts, panels);
      
      // Create download link
      const blob = new Blob([layoutJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `rover-grid-layout-${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  }, [panels]);

  // Import layout
  const handleImportLayout = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const layoutData = event.target?.result as string;
          const imported = GridUtils.importLayout(layoutData);
          
          if (imported && gridRef.current) {
            gridRef.current.importLayout(imported.layouts);
            console.log('Layout imported:', imported);
          } else {
            alert('Failed to import layout. Please check the file format.');
          }
        };
        reader.readAsText(file);
      }
    };
    
    input.click();
  }, []);

  return (
    <div className={`grid-example ${className}`}>
      {/* Example controls */}
      <div className="example-controls" style={{ 
        padding: '10px', 
        background: '#f5f5f5', 
        borderBottom: '1px solid #ccc',
        display: 'flex',
        gap: '10px',
        alignItems: 'center'
      }}>
        <h3 style={{ margin: 0, fontSize: '14px' }}>Rover Mission Control - Grid System Demo</h3>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px' }}>
          <button 
            onClick={handleExportLayout}
            style={{ 
              padding: '4px 8px', 
              fontSize: '12px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              background: 'white',
              cursor: 'pointer'
            }}
          >
            Export Layout
          </button>
          <button 
            onClick={handleImportLayout}
            style={{ 
              padding: '4px 8px', 
              fontSize: '12px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              background: 'white',
              cursor: 'pointer'
            }}
          >
            Import Layout
          </button>
          <button 
            onClick={() => gridRef.current?.resetLayout()}
            style={{ 
              padding: '4px 8px', 
              fontSize: '12px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              background: 'white',
              cursor: 'pointer'
            }}
          >
            Reset Layout
          </button>
        </div>
      </div>

      {/* Grid container */}
      <GridContainer
        ref={gridRef}
        layouts={DEFAULT_LAYOUTS}
        panels={panels}
        onLayoutChange={handleLayoutChange}
        onPanelChange={handlePanelChange}
        showToolbar={true}
        enableKeyboardNavigation={true}
        enableAnimations={true}
        autoSave={true}
        saveInterval={5000}
        className="rover-grid"
        data-testid="rover-grid-example"
      >
        {/* Panel content will be rendered automatically based on panel configurations */}
      </GridContainer>

      {/* Usage instructions */}
      <div style={{ 
        position: 'absolute', 
        bottom: '10px', 
        right: '10px', 
        background: 'rgba(0,0,0,0.8)', 
        color: 'white', 
        padding: '10px', 
        borderRadius: '4px',
        fontSize: '11px',
        maxWidth: '250px'
      }}>
        <strong>Usage:</strong>
        <ul style={{ margin: '5px 0', paddingLeft: '15px' }}>
          <li>Drag panels to rearrange</li>
          <li>Resize using corner handles</li>
          <li>Use toolbar to add panels</li>
          <li>Press ESC for emergency stop</li>
          <li>WASD keys for rover control</li>
        </ul>
      </div>
    </div>
  );
};

export default GridExample;