/**
 * Mission Control Layout Context
 * Provides centralized state management for mission control layout system
 */

import React, { createContext, useContext, useReducer, useCallback, useEffect, useMemo } from 'react';
import {
  MissionControlState,
  LayoutContextValue,
  LayoutPreset,
  PanelFocusContext,
  AccessibilityAnnouncement,
  KeyboardShortcut,
  LayoutEventData,
  DEFAULT_LAYOUTS,
  LayoutConfiguration
} from './types';
import { PanelInstance } from '../../../types/grid';
import { useGrid } from '../../Grid/GridContext';

// Action types for the reducer
type LayoutAction =
  | { type: 'SET_PRESET'; payload: LayoutPreset }
  | { type: 'TOGGLE_AREA'; payload: string }
  | { type: 'FOCUS_PANEL'; payload: { panelId: string; source: 'keyboard' | 'mouse' | 'programmatic' } }
  | { type: 'SET_TRANSITIONING'; payload: boolean }
  | { type: 'UPDATE_PREFERENCES'; payload: Partial<MissionControlState['preferences']> }
  | { type: 'SAVE_CUSTOM_LAYOUT'; payload: { id: string; config: LayoutConfiguration } }
  | { type: 'LOAD_CUSTOM_LAYOUT'; payload: string }
  | { type: 'RESET_STATE' }
  | { type: 'IMPORT_STATE'; payload: Partial<MissionControlState> };

// Initial state
const initialState: MissionControlState = {
  currentPreset: 'operations',
  activeAreas: Object.keys(DEFAULT_LAYOUTS.operations.areas.reduce((acc, area) => {
    acc[area.id] = true;
    return acc;
  }, {} as Record<string, boolean>)),
  focusHistory: [],
  isTransitioning: false,
  customLayouts: {},
  preferences: {
    autoSave: true,
    animationsEnabled: true,
    keyboardNavigation: true,
    highContrast: false
  }
};

// Layout reducer
function layoutReducer(state: MissionControlState, action: LayoutAction): MissionControlState {
  switch (action.type) {
    case 'SET_PRESET': {
      const newAreas = DEFAULT_LAYOUTS[action.payload].areas
        .filter(area => !area.isCollapsible || state.activeAreas.includes(area.id))
        .map(area => area.id);
      
      return {
        ...state,
        currentPreset: action.payload,
        activeAreas: newAreas,
        isTransitioning: false
      };
    }

    case 'TOGGLE_AREA': {
      const isActive = state.activeAreas.includes(action.payload);
      return {
        ...state,
        activeAreas: isActive
          ? state.activeAreas.filter(id => id !== action.payload)
          : [...state.activeAreas, action.payload]
      };
    }

    case 'FOCUS_PANEL': {
      const { panelId } = action.payload;
      const newHistory = [panelId, ...state.focusHistory.filter(id => id !== panelId)].slice(0, 10);
      
      return {
        ...state,
        focusedPanel: panelId,
        focusHistory: newHistory
      };
    }

    case 'SET_TRANSITIONING':
      return {
        ...state,
        isTransitioning: action.payload
      };

    case 'UPDATE_PREFERENCES':
      return {
        ...state,
        preferences: {
          ...state.preferences,
          ...action.payload
        }
      };

    case 'SAVE_CUSTOM_LAYOUT':
      return {
        ...state,
        customLayouts: {
          ...state.customLayouts,
          [action.payload.id]: action.payload.config
        }
      };

    case 'LOAD_CUSTOM_LAYOUT': {
      const customLayout = state.customLayouts[action.payload];
      if (customLayout) {
        return {
          ...state,
          currentPreset: customLayout.id as LayoutPreset,
          activeAreas: customLayout.areas.map(area => area.id)
        };
      }
      return state;
    }

    case 'RESET_STATE':
      return {
        ...initialState,
        customLayouts: state.customLayouts, // Preserve custom layouts
        preferences: state.preferences // Preserve user preferences
      };

    case 'IMPORT_STATE':
      return {
        ...state,
        ...action.payload
      };

    default:
      return state;
  }
}

// Context creation
const MissionControlContext = createContext<LayoutContextValue | null>(null);

// Provider component
interface MissionControlProviderProps {
  children: React.ReactNode;
  initialPreset?: LayoutPreset;
  customConfigurations?: Record<string, LayoutConfiguration>;
}

export function MissionControlProvider({ 
  children, 
  initialPreset = 'operations',
  customConfigurations = {}
}: MissionControlProviderProps) {
  const [state, dispatch] = useReducer(layoutReducer, {
    ...initialState,
    currentPreset: initialPreset
  });

  const gridContext = useGrid();

  // Load saved state on mount
  useEffect(() => {
    if (state.preferences.autoSave) {
      try {
        const saved = localStorage.getItem('rover-mission-control-layout');
        if (saved) {
          const savedState = JSON.parse(saved);
          dispatch({ type: 'IMPORT_STATE', payload: savedState });
        }
      } catch (error) {
        console.warn('Failed to load saved layout state:', error);
      }
    }
  }, [state.preferences.autoSave]);

  // Auto-save state changes
  useEffect(() => {
    if (state.preferences.autoSave) {
      const saveTimer = setTimeout(() => {
        try {
          const stateToSave = {
            currentPreset: state.currentPreset,
            activeAreas: state.activeAreas,
            customLayouts: state.customLayouts,
            preferences: state.preferences,
            timestamp: Date.now()
          };
          localStorage.setItem('rover-mission-control-layout', JSON.stringify(stateToSave));
        } catch (error) {
          console.warn('Failed to save layout state:', error);
        }
      }, 1000);

      return () => clearTimeout(saveTimer);
    }
  }, [state, state.preferences.autoSave]);

  // Merged configurations (default + custom)
  const configurations = useMemo(() => ({
    ...DEFAULT_LAYOUTS,
    ...customConfigurations
  }), [customConfigurations]);

  // Set preset with transition
  const setPreset = useCallback(async (preset: LayoutPreset) => {
    if (preset === state.currentPreset) return;

    dispatch({ type: 'SET_TRANSITIONING', payload: true });
    
    // Emit layout event
    const event: LayoutEventData = {
      type: 'preset-change',
      payload: { from: state.currentPreset, to: preset },
      timestamp: Date.now(),
      source: 'user'
    };

    try {
      // Apply smooth transition if animations are enabled
      if (state.preferences.animationsEnabled) {
        await new Promise(resolve => setTimeout(resolve, 150));
      }

      dispatch({ type: 'SET_PRESET', payload: preset });
      
      // Announce to screen readers
      announceToScreenReader({
        message: `Layout changed to ${configurations[preset].name}`,
        priority: 'medium',
        type: 'status'
      });

    } catch (error) {
      console.error('Failed to change layout preset:', error);
      dispatch({ type: 'SET_TRANSITIONING', payload: false });
    }
  }, [state.currentPreset, state.preferences.animationsEnabled, configurations]);

  // Toggle area visibility
  const toggleArea = useCallback((areaId: string) => {
    const area = configurations[state.currentPreset].areas.find(a => a.id === areaId);
    if (!area || !area.isCollapsible) return;

    dispatch({ type: 'TOGGLE_AREA', payload: areaId });

    const isBeingHidden = state.activeAreas.includes(areaId);
    announceToScreenReader({
      message: `${area.name} area ${isBeingHidden ? 'collapsed' : 'expanded'}`,
      priority: 'low',
      type: 'status'
    });

    // Emit layout event
    const event: LayoutEventData = {
      type: isBeingHidden ? 'area-collapse' : 'area-expand',
      payload: { areaId, areaName: area.name },
      timestamp: Date.now(),
      source: 'user'
    };
  }, [state.activeAreas, state.currentPreset, configurations]);

  // Focus panel management
  const focusPanel = useCallback((panelId: string, source: 'keyboard' | 'mouse' | 'programmatic' = 'programmatic') => {
    const currentConfig = configurations[state.currentPreset];
    const area = currentConfig.areas.find(a => a.defaultPanels.includes(panelId));
    
    if (!area) return;

    dispatch({ type: 'FOCUS_PANEL', payload: { panelId, source } });

    // Focus the actual DOM element if keyboard navigation is enabled
    if (state.preferences.keyboardNavigation && source === 'keyboard') {
      setTimeout(() => {
        const element = document.querySelector(`[data-panel-id="${panelId}"]`) as HTMLElement;
        if (element) {
          element.focus();
        }
      }, 0);
    }

    // Create focus context
    const focusContext: PanelFocusContext = {
      panelId,
      areaId: area.id,
      timestamp: Date.now(),
      interactionType: source
    };
  }, [state.currentPreset, state.preferences.keyboardNavigation, configurations]);

  // Cycle through focused panels
  const cycleFocus = useCallback((direction: 'next' | 'previous') => {
    const currentConfig = configurations[state.currentPreset];
    const allPanels = currentConfig.areas
      .filter(area => state.activeAreas.includes(area.id))
      .flatMap(area => area.defaultPanels);

    if (allPanels.length === 0) return;

    const currentIndex = state.focusedPanel 
      ? allPanels.indexOf(state.focusedPanel)
      : -1;

    let nextIndex: number;
    if (direction === 'next') {
      nextIndex = currentIndex < allPanels.length - 1 ? currentIndex + 1 : 0;
    } else {
      nextIndex = currentIndex > 0 ? currentIndex - 1 : allPanels.length - 1;
    }

    const nextPanel = allPanels[nextIndex];
    if (nextPanel) {
      focusPanel(nextPanel, 'keyboard');
    }
  }, [state.currentPreset, state.activeAreas, state.focusedPanel, configurations, focusPanel]);

  // Custom layout management
  const saveCustomLayout = useCallback((id: string, config: LayoutConfiguration) => {
    dispatch({ type: 'SAVE_CUSTOM_LAYOUT', payload: { id, config } });
    
    announceToScreenReader({
      message: `Custom layout "${config.name}" saved`,
      priority: 'low',
      type: 'status'
    });
  }, []);

  const loadCustomLayout = useCallback((id: string) => {
    dispatch({ type: 'LOAD_CUSTOM_LAYOUT', payload: id });
    
    const layout = state.customLayouts[id];
    if (layout) {
      announceToScreenReader({
        message: `Loaded custom layout "${layout.name}"`,
        priority: 'medium',
        type: 'status'
      });
    }
  }, [state.customLayouts]);

  // Reset to default state
  const resetToDefault = useCallback(() => {
    dispatch({ type: 'RESET_STATE' });
    
    announceToScreenReader({
      message: 'Layout reset to default configuration',
      priority: 'medium',
      type: 'status'
    });
  }, []);

  // Utility functions
  const getAreaPanels = useCallback((areaId: string): PanelInstance[] => {
    const area = configurations[state.currentPreset].areas.find(a => a.id === areaId);
    if (!area) return [];

    // This would integrate with the grid system to get actual panel instances
    return gridContext.state.panels.filter(panel => 
      area.defaultPanels.includes(panel.panelId)
    );
  }, [state.currentPreset, configurations, gridContext.state.panels]);

  const isPanelVisible = useCallback((panelId: string): boolean => {
    const currentConfig = configurations[state.currentPreset];
    const area = currentConfig.areas.find(a => a.defaultPanels.includes(panelId));
    return area ? state.activeAreas.includes(area.id) : false;
  }, [state.currentPreset, state.activeAreas, configurations]);

  const getShortcuts = useCallback((): KeyboardShortcut[] => {
    const currentConfig = configurations[state.currentPreset];
    const shortcuts: KeyboardShortcut[] = [];

    // Layout shortcuts
    if (currentConfig.shortcuts) {
      Object.entries(currentConfig.shortcuts).forEach(([keys, panelId]) => {
        shortcuts.push({
          keys: keys.split('+'),
          description: `Focus ${panelId} panel`,
          action: () => focusPanel(panelId, 'keyboard'),
          category: 'panel'
        });
      });
    }

    // Navigation shortcuts
    shortcuts.push(
      {
        keys: ['Tab'],
        description: 'Cycle to next panel',
        action: () => cycleFocus('next'),
        category: 'navigation'
      },
      {
        keys: ['Shift', 'Tab'],
        description: 'Cycle to previous panel',
        action: () => cycleFocus('previous'),
        category: 'navigation'
      },
      {
        keys: ['Escape'],
        description: 'Clear panel focus',
        action: () => dispatch({ type: 'FOCUS_PANEL', payload: { panelId: '', source: 'keyboard' } }),
        category: 'navigation'
      }
    );

    // Layout preset shortcuts
    const presetKeys = ['F1', 'F2', 'F3', 'F4'];
    const presets: LayoutPreset[] = ['operations', 'analysis', 'emergency', 'maintenance'];
    
    presets.forEach((preset, index) => {
      if (presetKeys[index]) {
        shortcuts.push({
          keys: [presetKeys[index]],
          description: `Switch to ${preset} layout`,
          action: () => setPreset(preset),
          category: 'layout',
          global: true
        });
      }
    });

    return shortcuts;
  }, [state.currentPreset, configurations, focusPanel, cycleFocus, setPreset]);

  // Screen reader announcement utility
  const announceToScreenReader = useCallback((announcement: AccessibilityAnnouncement) => {
    if (!state.preferences.keyboardNavigation) return;

    const element = document.createElement('div');
    element.setAttribute('role', 'status');
    element.setAttribute('aria-live', announcement.priority === 'high' ? 'assertive' : 'polite');
    element.setAttribute('aria-atomic', 'true');
    element.className = 'sr-only';
    element.style.cssText = `
      position: absolute !important;
      width: 1px !important;
      height: 1px !important;
      padding: 0 !important;
      margin: -1px !important;
      overflow: hidden !important;
      clip: rect(0, 0, 0, 0) !important;
      white-space: nowrap !important;
      border: 0 !important;
    `;
    element.textContent = announcement.message;

    document.body.appendChild(element);
    
    setTimeout(() => {
      if (document.body.contains(element)) {
        document.body.removeChild(element);
      }
    }, 1000);
  }, [state.preferences.keyboardNavigation]);

  // Context value
  const contextValue: LayoutContextValue = {
    state,
    configurations,
    setPreset,
    toggleArea,
    focusPanel,
    cycleFocus,
    saveCustomLayout,
    loadCustomLayout,
    resetToDefault,
    getAreaPanels,
    isPanelVisible,
    getShortcuts,
    announceToScreenReader
  };

  return (
    <MissionControlContext.Provider value={contextValue}>
      {children}
    </MissionControlContext.Provider>
  );
}

// Hook for using mission control context
export function useMissionControl(): LayoutContextValue {
  const context = useContext(MissionControlContext);
  if (!context) {
    throw new Error('useMissionControl must be used within a MissionControlProvider');
  }
  return context;
}

// Hook for using layout state only
export function useMissionControlState(): MissionControlState {
  const { state } = useMissionControl();
  return state;
}

// Hook for using layout actions only
export function useMissionControlActions() {
  const {
    setPreset,
    toggleArea,
    focusPanel,
    cycleFocus,
    saveCustomLayout,
    loadCustomLayout,
    resetToDefault
  } = useMissionControl();

  return {
    setPreset,
    toggleArea,
    focusPanel,
    cycleFocus,
    saveCustomLayout,
    loadCustomLayout,
    resetToDefault
  };
}

export { MissionControlContext };
export default MissionControlProvider;