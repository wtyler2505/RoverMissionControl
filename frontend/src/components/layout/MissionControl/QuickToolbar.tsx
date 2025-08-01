/**
 * Mission Control Quick Action Toolbar Component
 * 
 * A floating toolbar with customizable actions, drag-and-drop reordering,
 * context-aware tool grouping, and accessibility features.
 * 
 * Key Features:
 * - Customizable tool arrangement with drag-and-drop
 * - Context-aware tool visibility based on rover state
 * - Plugin architecture for tool extensions
 * - Keyboard accessibility with tab navigation
 * - User preference persistence via localStorage
 * - WCAG 2.1 AA accessibility compliance
 * - Integration with CommandBar for complex operations
 */

import React, { 
  useState, 
  useEffect, 
  useRef, 
  useCallback, 
  useMemo,
  DragEvent,
  KeyboardEvent,
  createContext,
  useContext
} from 'react';
import styled from '@emotion/styled';
import { css } from '@emotion/react';
import { Theme } from '../../../theme/themes';
import { Button } from '../../ui/core/Button/Button';
import { Tooltip } from '../../ui/core/Tooltip/Tooltip';
import { Badge } from '../../ui/core/Badge/Badge';
import { Modal } from '../../ui/core/Modal/Modal';
import { ToolbarCustomization } from './ToolbarCustomization';

// ============================================================================
// Types and Interfaces
// ============================================================================

export type ToolCategory = 
  | 'safety' 
  | 'navigation' 
  | 'sampling' 
  | 'system' 
  | 'custom'
  | 'communication'
  | 'diagnostic';

export type ToolState = 'enabled' | 'disabled' | 'loading' | 'error' | 'active';

export interface ToolAction {
  id: string;
  name: string;
  category: ToolCategory;
  description: string;
  icon: React.ReactNode;
  shortcut?: string;
  state: ToolState;
  confirmationRequired?: boolean;
  dangerLevel?: 'low' | 'medium' | 'high' | 'critical';
  contextRequirements?: string[]; // Required rover states/contexts
  onExecute: (params?: any) => Promise<void> | void;
  onCancel?: () => void;
  isVisible?: (context: RoverContext) => boolean;
  metadata?: Record<string, any>;
}

export interface ToolGroup {
  id: string;
  name: string;
  category: ToolCategory;
  tools: ToolAction[];
  isCollapsed?: boolean;
  priority: number;
}

export interface RoverContext {
  isConnected: boolean;
  currentState: string;
  capabilities: string[];
  batteryLevel: number;
  location?: { x: number; y: number; z: number };
  isEmergency: boolean;
  activeCommands: string[];
  permissions: string[];
}

export interface ToolbarLayout {
  position: 'top' | 'bottom' | 'left' | 'right' | 'floating';
  orientation: 'horizontal' | 'vertical';
  size: 'small' | 'medium' | 'large';
  showLabels: boolean;
  autoHide: boolean;
  maxTools: number;
}

export interface ToolbarPreferences {
  layout: ToolbarLayout;
  toolOrder: string[];
  hiddenTools: string[];
  customTools: ToolAction[];
  groupCollapsedState: Record<string, boolean>;
  keyboardShortcuts: Record<string, string>;
}

export interface QuickToolbarProps {
  /** Current rover context */
  roverContext: RoverContext;
  /** Available tools */
  tools?: ToolAction[];
  /** Tool groups */
  groups?: ToolGroup[];
  /** Initial toolbar layout */
  initialLayout?: Partial<ToolbarLayout>;
  /** User preferences */
  preferences?: Partial<ToolbarPreferences>;
  /** Callback when tool is executed */
  onToolExecute?: (tool: ToolAction, params?: any) => Promise<void>;
  /** Callback when preferences change */
  onPreferencesChange?: (preferences: ToolbarPreferences) => void;
  /** Callback to integrate with CommandBar */
  onCommandBarIntegration?: (command: string) => void;
  /** Custom CSS class */
  className?: string;
  /** Test ID for automation */
  testId?: string;
}

export interface ToolbarContextValue {
  roverContext: RoverContext;
  preferences: ToolbarPreferences;
  updatePreferences: (updates: Partial<ToolbarPreferences>) => void;
  executeCommand: (command: string) => void;
}

// ============================================================================
// Context
// ============================================================================

const ToolbarContext = createContext<ToolbarContextValue | null>(null);

const useToolbarContext = () => {
  const context = useContext(ToolbarContext);
  if (!context) {
    throw new Error('useToolbarContext must be used within a QuickToolbar');
  }
  return context;
};

// ============================================================================
// Default Tools and Configuration
// ============================================================================

const DEFAULT_TOOLS: ToolAction[] = [
  {
    id: 'emergency-stop',
    name: 'Emergency Stop',
    category: 'safety',
    description: 'Immediately halt all rover operations',
    icon: '🛑',
    shortcut: 'Ctrl+Shift+X',
    state: 'enabled',
    confirmationRequired: true,
    dangerLevel: 'critical',
    onExecute: async () => {
      console.log('Emergency stop activated');
    }
  },
  {
    id: 'home',
    name: 'Return Home',
    category: 'navigation',
    description: 'Navigate rover back to home position',
    icon: '🏠',
    shortcut: 'Ctrl+H',
    state: 'enabled',
    confirmationRequired: true,
    dangerLevel: 'medium',
    contextRequirements: ['navigation_enabled'],
    onExecute: async () => {
      console.log('Returning to home position');
    },
    isVisible: (context) => context.isConnected && !context.isEmergency
  },
  {
    id: 'sample-collect',
    name: 'Collect Sample',
    category: 'sampling',
    description: 'Activate sample collection mechanism',
    icon: '🧪',
    shortcut: 'Ctrl+S',
    state: 'enabled',
    contextRequirements: ['sampling_arm', 'storage_available'],
    onExecute: async () => {
      console.log('Collecting sample');
    },
    isVisible: (context) => context.capabilities.includes('sampling')
  },
  {
    id: 'navigate-waypoint',
    name: 'Navigate to Waypoint',
    category: 'navigation',
    description: 'Navigate to selected waypoint',
    icon: '🎯',
    shortcut: 'Ctrl+N',
    state: 'enabled',
    contextRequirements: ['navigation_enabled'],
    onExecute: async () => {
      console.log('Navigating to waypoint');
    },
    isVisible: (context) => context.isConnected
  },
  {
    id: 'camera-capture',
    name: 'Capture Image',
    category: 'system',
    description: 'Take photo with rover camera',
    icon: '📷',
    shortcut: 'Ctrl+C',
    state: 'enabled',
    onExecute: async () => {
      console.log('Capturing image');
    }
  },
  {
    id: 'status-report',
    name: 'Status Report',
    category: 'diagnostic',
    description: 'Generate comprehensive system status report',
    icon: '📊',
    shortcut: 'Ctrl+R',
    state: 'enabled',
    onExecute: async () => {
      console.log('Generating status report');
    }
  }
];

const DEFAULT_LAYOUT: ToolbarLayout = {
  position: 'floating',
  orientation: 'horizontal',
  size: 'medium',
  showLabels: false,
  autoHide: false,
  maxTools: 8
};

const DEFAULT_PREFERENCES: ToolbarPreferences = {
  layout: DEFAULT_LAYOUT,
  toolOrder: DEFAULT_TOOLS.map(tool => tool.id),
  hiddenTools: [],
  customTools: [],
  groupCollapsedState: {},
  keyboardShortcuts: DEFAULT_TOOLS.reduce((acc, tool) => {
    if (tool.shortcut) {
      acc[tool.shortcut] = tool.id;
    }
    return acc;
  }, {} as Record<string, string>)
};

// ============================================================================
// Styled Components
// ============================================================================

const ToolbarContainer = styled.div<{ 
  theme: Theme; 
  layout: ToolbarLayout;
  isDragging: boolean;
}>`
  position: ${({ layout }) => layout.position === 'floating' ? 'fixed' : 'relative'};
  ${({ layout }) => {
    switch (layout.position) {
      case 'top':
        return css`top: 0; left: 0; right: 0;`;
      case 'bottom':
        return css`bottom: 0; left: 0; right: 0;`;
      case 'left':
        return css`top: 0; left: 0; bottom: 0;`;
      case 'right':
        return css`top: 0; right: 0; bottom: 0;`;
      case 'floating':
        return css`
          top: 50%;
          left: 20px;
          transform: translateY(-50%);
        `;
      default:
        return css``;
    }
  }}
  
  display: flex;
  flex-direction: ${({ layout }) => 
    layout.orientation === 'vertical' ? 'column' : 'row'
  };
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
  padding: ${({ theme }) => theme.spacing[3]};
  background-color: ${({ theme }) => theme.colors.background.elevated};
  border: 2px solid ${({ theme }) => theme.colors.divider};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  box-shadow: ${({ theme }) => theme.shadows.lg};
  backdrop-filter: blur(8px);
  z-index: ${({ theme }) => theme.zIndex?.tooltip || 1001};
  
  ${({ layout }) => layout.position === 'floating' && css`
    max-height: 80vh;
    overflow-y: auto;
  `}
  
  ${({ isDragging, theme }) => isDragging && css`
    box-shadow: ${theme.shadows.xl};
    transform: ${({ layout }) => 
      layout.position === 'floating' 
        ? 'translateY(-50%) scale(1.02)' 
        : 'scale(1.02)'
    };
  `}
  
  /* Responsive behavior */
  @media (max-width: 768px) {
    ${({ layout }) => layout.position === 'floating' && css`
      position: fixed;
      bottom: 20px;
      left: 50%;
      top: auto;
      transform: translateX(-50%);
      flex-direction: row;
      max-width: calc(100vw - 40px);
      overflow-x: auto;
    `}
  }
  
  /* High contrast mode */
  @media (prefers-contrast: high) {
    border-width: 3px;
    box-shadow: none;
  }
  
  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    transition: none;
    transform: ${({ layout }) => 
      layout.position === 'floating' ? 'translateY(-50%)' : 'none'
    } !important;
  }
`;

const ToolButton = styled.div<{ 
  theme: Theme; 
  tool: ToolAction; 
  size: ToolbarLayout['size'];
  showLabel: boolean;
  isDragging: boolean;
  isKeyboardFocused: boolean;
}>`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[1]};
  min-width: ${({ size }) => {
    switch (size) {
      case 'small': return '40px';
      case 'large': return '64px';
      default: return '52px';
    }
  }};
  
  /* Drag and drop styling */
  ${({ isDragging, theme }) => isDragging && css`
    opacity: 0.5;
    transform: rotate(2deg);
    z-index: 1000;
    pointer-events: none;
  `}
  
  /* Keyboard focus */
  ${({ isKeyboardFocused, theme }) => isKeyboardFocused && css`
    outline: 3px solid ${theme.colors.primary.main};
    outline-offset: 2px;
    border-radius: ${theme.borderRadius.md};
  `}
  
  /* Animation */
  transition: ${({ theme }) => theme.transitions.duration.fast} ${({ theme }) => theme.transitions.timing.ease};
  
  &:hover {
    transform: translateY(-2px);
  }
  
  &:active {
    transform: translateY(0);
  }
  
  @media (prefers-reduced-motion: reduce) {
    transition: none;
    &:hover, &:active {
      transform: none;
    }
  }
`;

const ToolLabel = styled.span<{ theme: Theme; size: ToolbarLayout['size'] }>`
  font-size: ${({ theme, size }) => {
    switch (size) {
      case 'small': return theme.typography.fontSize.xs;
      case 'large': return theme.typography.fontSize.sm;
      default: return theme.typography.fontSize.xs;
    }
  }};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ theme }) => theme.colors.text.secondary};
  text-align: center;
  white-space: nowrap;
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: ${({ theme }) => theme.typography.lineHeight.tight};
`;

const StatusIndicator = styled.div<{ 
  theme: Theme; 
  state: ToolState;
}>`
  position: absolute;
  top: -4px;
  right: -4px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid ${({ theme }) => theme.colors.background.elevated};
  
  ${({ theme, state }) => {
    switch (state) {
      case 'active':
        return css`background-color: ${theme.colors.success.main};`;
      case 'loading':
        return css`
          background-color: ${theme.colors.warning.main};
          animation: pulse 1.5s infinite;
        `;
      case 'error':
        return css`background-color: ${theme.colors.error.main};`;
      case 'disabled':
        return css`background-color: ${theme.colors.text.disabled};`;
      default:
        return css`display: none;`;
    }
  }}
  
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
`;

const DragOverlay = styled.div<{ theme: Theme }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: ${({ theme }) => theme.colors.primary.main}11;
  z-index: 999;
  pointer-events: none;
`;

const DropZone = styled.div<{ 
  theme: Theme; 
  isActive: boolean; 
  orientation: 'horizontal' | 'vertical';
}>`
  width: ${({ orientation }) => orientation === 'vertical' ? '100%' : '4px'};
  height: ${({ orientation }) => orientation === 'vertical' ? '4px' : '100%'};
  background-color: ${({ theme, isActive }) => 
    isActive ? theme.colors.primary.main : 'transparent'
  };
  border-radius: 2px;
  transition: ${({ theme }) => theme.transitions.duration.fast} ${({ theme }) => theme.transitions.timing.ease};
  
  ${({ isActive, theme }) => isActive && css`
    box-shadow: 0 0 8px ${theme.colors.primary.main};
  `}
`;

const CustomizationButton = styled(Button)<{ theme: Theme }>`
  position: absolute;
  top: -12px;
  right: -12px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background-color: ${({ theme }) => theme.colors.background.paper};
  border: 2px solid ${({ theme }) => theme.colors.divider};
  padding: 0;
  
  &:hover {
    background-color: ${({ theme }) => theme.colors.primary.main};
    color: ${({ theme }) => theme.colors.primary.contrast};
  }
`;

// ============================================================================
// Utility Functions
// ============================================================================

const savePreferences = (preferences: ToolbarPreferences) => {
  try {
    localStorage.setItem('quickToolbar.preferences', JSON.stringify(preferences));
  } catch (error) {
    console.warn('Failed to save toolbar preferences:', error);
  }
};

const loadPreferences = (): ToolbarPreferences => {
  try {
    const saved = localStorage.getItem('quickToolbar.preferences');
    if (saved) {
      return { ...DEFAULT_PREFERENCES, ...JSON.parse(saved) };
    }
  } catch (error) {
    console.warn('Failed to load toolbar preferences:', error);
  }
  return DEFAULT_PREFERENCES;
};

const getVisibleTools = (tools: ToolAction[], context: RoverContext): ToolAction[] => {
  return tools.filter(tool => {
    // Check if tool should be visible based on context
    if (tool.isVisible && !tool.isVisible(context)) {
      return false;
    }
    
    // Check context requirements
    if (tool.contextRequirements) {
      const hasRequirements = tool.contextRequirements.every(req => 
        context.capabilities.includes(req) || 
        context.activeCommands.includes(req)
      );
      if (!hasRequirements) {
        return false;
      }
    }
    
    return true;
  });
};

const getToolState = (tool: ToolAction, context: RoverContext): ToolState => {
  if (!context.isConnected) return 'disabled';
  if (context.isEmergency && tool.category !== 'safety') return 'disabled';
  
  // Check if tool is currently executing
  if (context.activeCommands.includes(tool.id)) return 'active';
  
  return tool.state;
};

// ============================================================================
// Main Component
// ============================================================================

export const QuickToolbar: React.FC<QuickToolbarProps> = ({
  roverContext,
  tools = DEFAULT_TOOLS,
  groups = [],
  initialLayout = {},
  preferences: initialPreferences = {},
  onToolExecute,
  onPreferencesChange,
  onCommandBarIntegration,
  className,
  testId
}) => {
  // State management
  const [preferences, setPreferences] = useState<ToolbarPreferences>(() => ({
    ...loadPreferences(),
    ...initialPreferences
  }));
  
  const [isDragging, setIsDragging] = useState(false);
  const [draggedToolId, setDraggedToolId] = useState<string | null>(null);
  const [dropZoneIndex, setDropZoneIndex] = useState<number | null>(null);
  const [keyboardFocusIndex, setKeyboardFocusIndex] = useState(-1);
  const [showCustomization, setShowCustomization] = useState(false);
  const [executingTools, setExecutingTools] = useState<Set<string>>(new Set());
  
  // Refs
  const toolbarRef = useRef<HTMLDivElement>(null);
  const toolRefs = useRef<(HTMLDivElement | null)[]>([]);
  
  // Computed values
  const layout = useMemo(() => ({
    ...DEFAULT_LAYOUT,
    ...initialLayout,
    ...preferences.layout
  }), [initialLayout, preferences.layout]);
  
  const visibleTools = useMemo(() => {
    const allTools = getVisibleTools(tools, roverContext);
    const orderedTools = preferences.toolOrder
      .map(id => allTools.find(tool => tool.id === id))
      .filter((tool): tool is ToolAction => 
        tool !== undefined && !preferences.hiddenTools.includes(tool.id)
      );
    
    // Add any new tools not in the order
    const newTools = allTools.filter(tool => 
      !preferences.toolOrder.includes(tool.id) && 
      !preferences.hiddenTools.includes(tool.id)
    );
    
    const result = [...orderedTools, ...newTools];
    return result.slice(0, layout.maxTools);
  }, [tools, preferences.toolOrder, preferences.hiddenTools, roverContext, layout.maxTools]);
  
  // Context value
  const contextValue: ToolbarContextValue = useMemo(() => ({
    roverContext,
    preferences,
    updatePreferences: (updates) => {
      const newPreferences = { ...preferences, ...updates };
      setPreferences(newPreferences);
      savePreferences(newPreferences);
      onPreferencesChange?.(newPreferences);
    },
    executeCommand: (command) => {
      onCommandBarIntegration?.(command);
    }
  }), [roverContext, preferences, onPreferencesChange, onCommandBarIntegration]);
  
  // Tool execution handler
  const handleToolExecute = useCallback(async (tool: ToolAction) => {
    if (getToolState(tool, roverContext) === 'disabled') return;
    
    setExecutingTools(prev => new Set(prev).add(tool.id));
    
    try {
      if (onToolExecute) {
        await onToolExecute(tool);
      } else {
        await tool.onExecute();
      }
    } catch (error) {
      console.error(`Failed to execute tool ${tool.id}:`, error);
    } finally {
      setExecutingTools(prev => {
        const next = new Set(prev);
        next.delete(tool.id);
        return next;
      });
    }
  }, [roverContext, onToolExecute]);
  
  // Drag and drop handlers
  const handleDragStart = useCallback((e: DragEvent<HTMLDivElement>, toolId: string) => {
    setIsDragging(true);
    setDraggedToolId(toolId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', toolId);
  }, []);
  
  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);
  
  const handleDragEnter = useCallback((e: DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    setDropZoneIndex(index);
  }, []);
  
  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>, dropIndex: number) => {
    e.preventDefault();
    
    if (!draggedToolId) return;
    
    const dragIndex = visibleTools.findIndex(tool => tool.id === draggedToolId);
    if (dragIndex === -1) return;
    
    const newOrder = [...preferences.toolOrder];
    const [removed] = newOrder.splice(dragIndex, 1);
    newOrder.splice(dropIndex, 0, removed);
    
    contextValue.updatePreferences({ toolOrder: newOrder });
    
    setIsDragging(false);
    setDraggedToolId(null);
    setDropZoneIndex(null);
  }, [draggedToolId, visibleTools, preferences.toolOrder, contextValue]);
  
  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    setDraggedToolId(null);
    setDropZoneIndex(null);
  }, []);
  
  // Keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault();
        setKeyboardFocusIndex(prev => 
          prev <= 0 ? visibleTools.length - 1 : prev - 1
        );
        break;
        
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault();
        setKeyboardFocusIndex(prev => 
          prev >= visibleTools.length - 1 ? 0 : prev + 1
        );
        break;
        
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (keyboardFocusIndex >= 0 && keyboardFocusIndex < visibleTools.length) {
          handleToolExecute(visibleTools[keyboardFocusIndex]);
        }
        break;
        
      case 'Escape':
        setKeyboardFocusIndex(-1);
        toolbarRef.current?.blur();
        break;
    }
  }, [visibleTools, keyboardFocusIndex, handleToolExecute]);
  
  // Global keyboard shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const shortcut = `${e.ctrlKey ? 'Ctrl+' : ''}${e.shiftKey ? 'Shift+' : ''}${e.altKey ? 'Alt+' : ''}${e.key}`;
      const toolId = preferences.keyboardShortcuts[shortcut];
      
      if (toolId) {
        e.preventDefault();
        const tool = visibleTools.find(t => t.id === toolId);
        if (tool) {
          handleToolExecute(tool);
        }
      }
    };
    
    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, [preferences.keyboardShortcuts, visibleTools, handleToolExecute]);
  
  // Focus management
  useEffect(() => {
    if (keyboardFocusIndex >= 0 && toolRefs.current[keyboardFocusIndex]) {
      toolRefs.current[keyboardFocusIndex]?.focus();
    }
  }, [keyboardFocusIndex]);
  
  return (
    <ToolbarContext.Provider value={contextValue}>
      <ToolbarContainer
        ref={toolbarRef}
        layout={layout}
        isDragging={isDragging}
        className={className}
        data-testid={testId}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="toolbar"
        aria-label="Quick action toolbar"
        aria-orientation={layout.orientation}
      >
        {/* Drag overlay */}
        {isDragging && <DragOverlay />}
        
        {/* Customization button */}
        <CustomizationButton
          variant="ghost"
          size="small"
          icon="⚙️"
          onClick={() => setShowCustomization(true)}
          data-testid="toolbar-customize"
          aria-label="Customize toolbar"
        />
        
        {/* Tools */}
        {visibleTools.map((tool, index) => {
          const toolState = getToolState(tool, roverContext);
          const isExecuting = executingTools.has(tool.id);
          const currentState = isExecuting ? 'loading' : toolState;
          
          return (
            <React.Fragment key={tool.id}>
              {/* Drop zone before tool */}
              {isDragging && (
                <DropZone
                  orientation={layout.orientation}
                  isActive={dropZoneIndex === index}
                  onDragEnter={(e) => handleDragEnter(e, index)}
                />
              )}
              
              {/* Tool button */}
              <ToolButton
                ref={(el) => (toolRefs.current[index] = el)}
                tool={tool}
                size={layout.size}
                showLabel={layout.showLabels}
                isDragging={draggedToolId === tool.id}
                isKeyboardFocused={keyboardFocusIndex === index}
                draggable
                onDragStart={(e) => handleDragStart(e, tool.id)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                tabIndex={keyboardFocusIndex === index ? 0 : -1}
                role="button"
                aria-label={`${tool.name}: ${tool.description}`}
                aria-disabled={currentState === 'disabled'}
                aria-pressed={currentState === 'active'}
                data-testid={`tool-${tool.id}`}
              >
                <Tooltip
                  content={
                    <div>
                      <div style={{ fontWeight: 'bold' }}>{tool.name}</div>
                      <div>{tool.description}</div>
                      {tool.shortcut && (
                        <div style={{ 
                          fontSize: '0.8em', 
                          marginTop: '4px',
                          opacity: 0.8 
                        }}>
                          {tool.shortcut}
                        </div>
                      )}
                    </div>
                  }
                  position="top"
                  delay={500}
                >
                  <Button
                    variant={currentState === 'active' ? 'primary' : 'ghost'}
                    size={layout.size}
                    icon={tool.icon}
                    disabled={currentState === 'disabled'}
                    loading={currentState === 'loading'}
                    onClick={() => handleToolExecute(tool)}
                    data-testid={`tool-button-${tool.id}`}
                  />
                </Tooltip>
                
                {/* Status indicator */}
                <StatusIndicator state={currentState} />
                
                {/* Tool label */}
                {layout.showLabels && (
                  <ToolLabel size={layout.size}>
                    {tool.name}
                  </ToolLabel>
                )}
                
                {/* Danger level badge */}
                {tool.dangerLevel && (tool.dangerLevel === 'high' || tool.dangerLevel === 'critical') && (
                  <Badge
                    variant="error"
                    dot
                    style={{
                      position: 'absolute',
                      top: -8,
                      left: -8
                    }}
                  />
                )}
              </ToolButton>
            </React.Fragment>
          );
        })}
        
        {/* Final drop zone */}
        {isDragging && (
          <DropZone
            orientation={layout.orientation}
            isActive={dropZoneIndex === visibleTools.length}
            onDragEnter={(e) => handleDragEnter(e, visibleTools.length)}
          />
        )}
      </ToolbarContainer>
      
      {/* Customization Modal */}
      <Modal
        open={showCustomization}
        onClose={() => setShowCustomization(false)}
        title="Customize Toolbar"
        size="large"
        testId="toolbar-customization-modal"
      >
        <ToolbarCustomization
          tools={tools}
          preferences={preferences}
          roverContext={roverContext}
          onPreferencesChange={(newPreferences) => {
            contextValue.updatePreferences(newPreferences);
            setShowCustomization(false);
          }}
          onClose={() => setShowCustomization(false)}
          testId="toolbar-customization"
        />
      </Modal>
    </ToolbarContext.Provider>
  );
};

export default QuickToolbar;