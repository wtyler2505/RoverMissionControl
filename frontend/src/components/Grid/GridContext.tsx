/**
 * GridContext - React Context for Grid State Management
 * Provides centralized state management for the grid system
 */

import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { 
  GridState, 
  GridContextValue, 
  PanelInstance, 
  PanelLayout, 
  ResponsiveLayouts,
  GridConfig,
  GridBreakpoints,
  GridCols,
  Breakpoint 
} from '../../types/grid';

// Action types for reducer
type GridAction =
  | { type: 'SET_LAYOUTS'; payload: ResponsiveLayouts }
  | { type: 'SET_PANELS'; payload: PanelInstance[] }
  | { type: 'ADD_PANEL'; payload: PanelInstance }
  | { type: 'REMOVE_PANEL'; payload: string }
  | { type: 'UPDATE_PANEL'; payload: { id: string; updates: Partial<PanelInstance> } }
  | { type: 'SET_BREAKPOINT'; payload: Breakpoint }
  | { type: 'SET_DRAGGING'; payload: boolean }
  | { type: 'SET_RESIZING'; payload: boolean }
  | { type: 'SET_DRAGGED_PANEL'; payload: string | undefined }
  | { type: 'RESET_STATE' }
  | { type: 'IMPORT_STATE'; payload: Partial<GridState> };

// Initial state
const initialState: GridState = {
  layouts: {
    lg: [],
    md: [],
    sm: [],
    xs: [],
    xxs: []
  },
  panels: [],
  currentBreakpoint: 'lg',
  isDragging: false,
  isResizing: false,
  draggedPanel: undefined,
  lastSaved: Date.now(),
  version: 1
};

// Grid reducer
function gridReducer(state: GridState, action: GridAction): GridState {
  switch (action.type) {
    case 'SET_LAYOUTS':
      return {
        ...state,
        layouts: action.payload,
        lastSaved: Date.now(),
        version: state.version + 1
      };

    case 'SET_PANELS':
      return {
        ...state,
        panels: action.payload,
        lastSaved: Date.now(),
        version: state.version + 1
      };

    case 'ADD_PANEL':
      return {
        ...state,
        panels: [...state.panels, action.payload],
        lastSaved: Date.now(),
        version: state.version + 1
      };

    case 'REMOVE_PANEL':
      return {
        ...state,
        panels: state.panels.filter(panel => panel.id !== action.payload),
        layouts: {
          lg: state.layouts.lg.filter(item => item.i !== action.payload),
          md: state.layouts.md.filter(item => item.i !== action.payload),
          sm: state.layouts.sm.filter(item => item.i !== action.payload),
          xs: state.layouts.xs.filter(item => item.i !== action.payload),
          xxs: state.layouts.xxs.filter(item => item.i !== action.payload)
        },
        lastSaved: Date.now(),
        version: state.version + 1
      };

    case 'UPDATE_PANEL':
      return {
        ...state,
        panels: state.panels.map(panel =>
          panel.id === action.payload.id
            ? { ...panel, ...action.payload.updates, lastModified: Date.now() }
            : panel
        ),
        lastSaved: Date.now(),
        version: state.version + 1
      };

    case 'SET_BREAKPOINT':
      return {
        ...state,
        currentBreakpoint: action.payload
      };

    case 'SET_DRAGGING':
      return {
        ...state,
        isDragging: action.payload
      };

    case 'SET_RESIZING':
      return {
        ...state,
        isResizing: action.payload
      };

    case 'SET_DRAGGED_PANEL':
      return {
        ...state,
        draggedPanel: action.payload
      };

    case 'RESET_STATE':
      return {
        ...initialState,
        version: state.version + 1
      };

    case 'IMPORT_STATE':
      return {
        ...state,
        ...action.payload,
        version: state.version + 1
      };

    default:
      return state;
  }
}

// Context creation
const GridContext = createContext<GridContextValue | null>(null);

// Provider component props
interface GridProviderProps {
  children: ReactNode;
  value?: Partial<{
    layouts: ResponsiveLayouts;
    panels: PanelInstance[];
    currentBreakpoint: Breakpoint;
    isDragging: boolean;
    isResizing: boolean;
    draggedPanel: string | undefined;
    addPanel: (panelConfig: any, position?: Partial<PanelLayout>) => void;
    removePanel: (panelId: string) => void;
    config: GridConfig;
    breakpoints: GridBreakpoints;
    cols: GridCols;
  }>;
}

// Provider component
export function GridProvider({ children, value = {} }: GridProviderProps) {
  const [state, dispatch] = useReducer(gridReducer, {
    ...initialState,
    layouts: value.layouts || initialState.layouts,
    panels: value.panels || initialState.panels,
    currentBreakpoint: value.currentBreakpoint || initialState.currentBreakpoint,
    isDragging: value.isDragging || initialState.isDragging,
    isResizing: value.isResizing || initialState.isResizing,
    draggedPanel: value.draggedPanel || initialState.draggedPanel
  });

  // Context value with actions
  const contextValue: GridContextValue = {
    state,
    config: value.config || {} as GridConfig,
    breakpoints: value.breakpoints || {} as GridBreakpoints,
    cols: value.cols || {} as GridCols,

    // Panel management
    addPanel: (panelConfig: any, position?: Partial<PanelLayout>) => {
      const newPanel: PanelInstance = {
        id: `panel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        panelId: panelConfig.id,
        layout: {
          i: `panel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          x: position?.x ?? 0,
          y: position?.y ?? 0,
          w: position?.w ?? panelConfig.defaultSize?.w ?? 4,
          h: position?.h ?? panelConfig.defaultSize?.h ?? 3,
          minW: panelConfig.minSize?.w ?? 2,
          minH: panelConfig.minSize?.h ?? 2,
          maxW: panelConfig.maxSize?.w,
          maxH: panelConfig.maxSize?.h,
          ...position
        },
        config: panelConfig.config || {},
        isMinimized: false,
        isMaximized: false,
        isVisible: true,
        lastModified: Date.now(),
        customTitle: panelConfig.customTitle,
        customIcon: panelConfig.customIcon
      };

      dispatch({ type: 'ADD_PANEL', payload: newPanel });

      // Add to current breakpoint layout
      const updatedLayouts = { ...state.layouts };
      updatedLayouts[state.currentBreakpoint] = [
        ...updatedLayouts[state.currentBreakpoint],
        newPanel.layout
      ];
      dispatch({ type: 'SET_LAYOUTS', payload: updatedLayouts });

      // Call external handler if provided
      value.addPanel?.(panelConfig, position);
    },

    removePanel: (panelId: string) => {
      dispatch({ type: 'REMOVE_PANEL', payload: panelId });
      value.removePanel?.(panelId);
    },

    updatePanel: (panelId: string, updates: Partial<PanelInstance>) => {
      dispatch({ type: 'UPDATE_PANEL', payload: { id: panelId, updates } });
    },

    minimizePanel: (panelId: string) => {
      dispatch({ 
        type: 'UPDATE_PANEL', 
        payload: { 
          id: panelId, 
          updates: { 
            isMinimized: !state.panels.find(p => p.id === panelId)?.isMinimized 
          } 
        } 
      });
    },

    maximizePanel: (panelId: string) => {
      dispatch({ 
        type: 'UPDATE_PANEL', 
        payload: { 
          id: panelId, 
          updates: { 
            isMaximized: !state.panels.find(p => p.id === panelId)?.isMaximized 
          } 
        } 
      });
    },

    togglePanel: (panelId: string) => {
      const panel = state.panels.find(p => p.id === panelId);
      if (panel) {
        dispatch({ 
          type: 'UPDATE_PANEL', 
          payload: { 
            id: panelId, 
            updates: { isVisible: !panel.isVisible } 
          } 
        });
      }
    },

    // Layout management
    updateLayout: (layout: PanelLayout[], breakpoint: string) => {
      const updatedLayouts = { ...state.layouts };
      updatedLayouts[breakpoint as Breakpoint] = layout;
      dispatch({ type: 'SET_LAYOUTS', payload: updatedLayouts });

      // Update panel instances with new layout data
      const updatedPanels = state.panels.map(panel => {
        const layoutItem = layout.find(item => item.i === panel.id);
        if (layoutItem) {
          return {
            ...panel,
            layout: layoutItem,
            lastModified: Date.now()
          };
        }
        return panel;
      });
      dispatch({ type: 'SET_PANELS', payload: updatedPanels });
    },

    resetLayout: () => {
      dispatch({ type: 'RESET_STATE' });
    },

    saveLayout: () => {
      try {
        const dataToSave = {
          layouts: state.layouts,
          panels: state.panels,
          timestamp: Date.now(),
          version: state.version
        };
        localStorage.setItem('rover-grid-state', JSON.stringify(dataToSave));
      } catch (error) {
        console.error('Failed to save grid layout:', error);
      }
    },

    loadLayout: (layoutData: string) => {
      try {
        const parsedData = JSON.parse(layoutData);
        dispatch({ 
          type: 'IMPORT_STATE', 
          payload: {
            layouts: parsedData.layouts,
            panels: parsedData.panels,
            lastSaved: parsedData.timestamp || Date.now()
          }
        });
      } catch (error) {
        console.error('Failed to load grid layout:', error);
      }
    },

    // Grid operations
    compactLayout: () => {
      // This would be handled by the grid component itself
      console.log('Compacting layout...');
    },

    autoArrangeLayout: () => {
      // Implement auto-arrangement logic
      const currentLayout = state.layouts[state.currentBreakpoint];
      const arrangedLayout = currentLayout.map((item, index) => ({
        ...item,
        x: (index * 4) % (value.cols?.[state.currentBreakpoint] || 12),
        y: Math.floor((index * 4) / (value.cols?.[state.currentBreakpoint] || 12)) * 3
      }));

      const updatedLayouts = { ...state.layouts };
      updatedLayouts[state.currentBreakpoint] = arrangedLayout;
      dispatch({ type: 'SET_LAYOUTS', payload: updatedLayouts });
    },

    onLayoutChange: (layout: PanelLayout[], layouts: ResponsiveLayouts) => {
      dispatch({ type: 'SET_LAYOUTS', payload: layouts });
    },

    onBreakpointChange: (breakpoint: string, cols: number) => {
      dispatch({ type: 'SET_BREAKPOINT', payload: breakpoint as Breakpoint });
    },

    // State management
    exportState: () => {
      return JSON.stringify({
        layouts: state.layouts,
        panels: state.panels,
        currentBreakpoint: state.currentBreakpoint,
        timestamp: Date.now(),
        version: state.version
      });
    },

    importState: (stateData: string) => {
      try {
        const parsedState = JSON.parse(stateData);
        dispatch({ type: 'IMPORT_STATE', payload: parsedState });
      } catch (error) {
        console.error('Failed to import grid state:', error);
      }
    },

    clearState: () => {
      dispatch({ type: 'RESET_STATE' });
      localStorage.removeItem('rover-grid-state');
    }
  };

  return (
    <GridContext.Provider value={contextValue}>
      {children}
    </GridContext.Provider>
  );
}

// Hook for using grid context
export function useGrid(): GridContextValue {
  const context = useContext(GridContext);
  if (!context) {
    throw new Error('useGrid must be used within a GridProvider');
  }
  return context;
}

// Hook for using grid state only
export function useGridState(): GridState {
  const { state } = useGrid();
  return state;
}

// Hook for using grid actions only
export function useGridActions() {
  const { 
    addPanel, 
    removePanel, 
    updatePanel, 
    minimizePanel, 
    maximizePanel, 
    togglePanel,
    updateLayout,
    resetLayout,
    saveLayout,
    loadLayout,
    compactLayout,
    autoArrangeLayout,
    exportState,
    importState,
    clearState
  } = useGrid();
  
  return {
    addPanel,
    removePanel,
    updatePanel,
    minimizePanel,
    maximizePanel,
    togglePanel,
    updateLayout,
    resetLayout,
    saveLayout,
    loadLayout,
    compactLayout,
    autoArrangeLayout,
    exportState,
    importState,
    clearState
  };
}

export { GridContext };
export default GridProvider;