/**
 * Toolbar Customization Interface Component
 * 
 * Provides a comprehensive interface for customizing the QuickToolbar:
 * - Tool selection and ordering
 * - Layout configuration
 * - Keyboard shortcuts customization
 * - Category management
 * - Import/export settings
 */

import React, { useState, useCallback, useMemo } from 'react';
import styled from '@emotion/styled';
import { css } from '@emotion/react';
import { Theme } from '../../../theme/themes';
import { Button } from '../../ui/core/Button/Button';
import { Input } from '../../ui/core/Input/Input';
import { Select } from '../../ui/core/Select/Select';
import { Checkbox } from '../../ui/core/Checkbox/Checkbox';
import { Toggle } from '../../ui/core/Toggle/Toggle';
import { Badge } from '../../ui/core/Badge/Badge';
import { Card } from '../../ui/core/Card/Card';
import { Modal } from '../../ui/core/Modal/Modal';
import { 
  ToolAction, 
  ToolCategory, 
  ToolbarLayout, 
  ToolbarPreferences,
  RoverContext 
} from './QuickToolbar';

export interface ToolbarCustomizationProps {
  /** Available tools */
  tools: ToolAction[];
  /** Current preferences */
  preferences: ToolbarPreferences;
  /** Rover context for validation */
  roverContext: RoverContext;
  /** Callback when preferences change */
  onPreferencesChange: (preferences: ToolbarPreferences) => void;
  /** Callback to close customization */
  onClose: () => void;
  /** Test ID */
  testId?: string;
}

// ============================================================================
// Styled Components
// ============================================================================

const CustomizationContainer = styled.div<{ theme: Theme }>`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[6]};
  max-height: 70vh;
  overflow-y: auto;
  padding: ${({ theme }) => theme.spacing[4]};
`;

const Section = styled.div<{ theme: Theme }>`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[4]};
`;

const SectionTitle = styled.h3<{ theme: Theme }>`
  font-size: ${({ theme }) => theme.typography.fontSize.lg};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.text.primary};
  margin: 0;
  border-bottom: 2px solid ${({ theme }) => theme.colors.divider};
  padding-bottom: ${({ theme }) => theme.spacing[2]};
`;

const GridContainer = styled.div<{ theme: Theme; columns?: number }>`
  display: grid;
  grid-template-columns: repeat(${({ columns = 2 }) => columns}, 1fr);
  gap: ${({ theme }) => theme.spacing[4]};
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const ToolGrid = styled.div<{ theme: Theme }>`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: ${({ theme }) => theme.spacing[3]};
  max-height: 300px;
  overflow-y: auto;
  padding: ${({ theme }) => theme.spacing[2]};
  border: 2px solid ${({ theme }) => theme.colors.divider};
  border-radius: ${({ theme }) => theme.borderRadius.md};
`;

const ToolCard = styled.div<{ 
  theme: Theme; 
  isSelected: boolean; 
  isHidden: boolean;
  isDragging?: boolean;
}>`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
  padding: ${({ theme }) => theme.spacing[3]};
  border: 2px solid ${({ theme, isSelected }) => 
    isSelected ? theme.colors.primary.main : theme.colors.divider
  };
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background-color: ${({ theme, isSelected, isHidden }) => {
    if (isHidden) return theme.colors.background.default;
    if (isSelected) return `${theme.colors.primary.main}11`;
    return theme.colors.background.paper;
  }};
  cursor: pointer;
  transition: ${({ theme }) => theme.transitions.duration.fast} ${({ theme }) => theme.transitions.timing.ease};
  
  ${({ isHidden }) => isHidden && css`
    opacity: 0.5;
  `}
  
  ${({ isDragging, theme }) => isDragging && css`
    transform: rotate(2deg);
    box-shadow: ${theme.shadows.lg};
    z-index: 1000;
  `}
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: ${({ theme }) => theme.shadows.md};
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

const ToolIcon = styled.div<{ theme: Theme }>`
  font-size: 24px;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background-color: ${({ theme }) => theme.colors.background.elevated};
`;

const ToolName = styled.div<{ theme: Theme }>`
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ theme }) => theme.colors.text.primary};
  text-align: center;
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
`;

const ToolDescription = styled.div<{ theme: Theme }>`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.text.secondary};
  text-align: center;
  line-height: ${({ theme }) => theme.typography.lineHeight.relaxed};
`;

const CategoryFilter = styled.div<{ theme: Theme }>`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing[2]};
  margin-bottom: ${({ theme }) => theme.spacing[4]};
`;

const CategoryBadge = styled(Badge)<{ isActive: boolean }>`
  cursor: pointer;
  ${({ isActive }) => !isActive && css`
    opacity: 0.5;
  `}
`;

const LayoutPreview = styled.div<{ theme: Theme; layout: ToolbarLayout }>`
  display: flex;
  ${({ layout }) => css`
    flex-direction: ${layout.orientation === 'vertical' ? 'column' : 'row'};
  `}
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
  padding: ${({ theme }) => theme.spacing[4]};
  border: 2px solid ${({ theme }) => theme.colors.divider};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background-color: ${({ theme }) => theme.colors.background.elevated};
  min-height: 80px;
  position: relative;
  
  ${({ layout }) => {
    switch (layout.position) {
      case 'top':
        return css`justify-content: center;`;
      case 'bottom':
        return css`justify-content: center;`;
      case 'left':
        return css`justify-content: flex-start;`;
      case 'right':
        return css`justify-content: flex-end;`;
      case 'floating':
        return css`
          justify-content: center;
          &::before {
            content: 'Floating';
            position: absolute;
            top: 4px;
            right: 4px;
            font-size: 10px;
            color: var(--color-text-secondary);
          }
        `;
    }
  }}
`;

const PreviewTool = styled.div<{ theme: Theme; size: ToolbarLayout['size'] }>`
  width: ${({ size }) => {
    switch (size) {
      case 'small': return '32px';
      case 'large': return '48px';
      default: return '40px';
    }
  }};
  height: ${({ size }) => {
    switch (size) {
      case 'small': return '32px';
      case 'large': return '48px';
      default: return '40px';
    }
  }};
  background-color: ${({ theme }) => theme.colors.primary.main};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.colors.primary.contrast};
  font-size: ${({ size }) => {
    switch (size) {
      case 'small': return '12px';
      case 'large': return '20px';
      default: return '16px';
    }
  }};
`;

const ShortcutInput = styled.div<{ theme: Theme }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
  padding: ${({ theme }) => theme.spacing[2]};
  border: 1px solid ${({ theme }) => theme.colors.divider};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  background-color: ${({ theme }) => theme.colors.background.paper};
`;

const ActionsContainer = styled.div<{ theme: Theme }>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[3]};
  padding-top: ${({ theme }) => theme.spacing[4]};
  border-top: 2px solid ${({ theme }) => theme.colors.divider};
`;

// ============================================================================
// Helper Functions
// ============================================================================

const CATEGORY_COLORS: Record<ToolCategory, string> = {
  safety: '#ef4444',
  navigation: '#3b82f6',
  sampling: '#10b981',
  system: '#8b5cf6',
  custom: '#f59e0b',
  communication: '#06b6d4',
  diagnostic: '#ec4899'
};

const CATEGORY_LABELS: Record<ToolCategory, string> = {
  safety: 'Safety',
  navigation: 'Navigation',
  sampling: 'Sampling',
  system: 'System',
  custom: 'Custom',
  communication: 'Communication',
  diagnostic: 'Diagnostic'
};

// ============================================================================
// Main Component
// ============================================================================

export const ToolbarCustomization: React.FC<ToolbarCustomizationProps> = ({
  tools,
  preferences,
  roverContext,
  onPreferencesChange,
  onClose,
  testId
}) => {
  // State
  const [selectedTools, setSelectedTools] = useState<Set<string>>(
    new Set(preferences.toolOrder.filter(id => !preferences.hiddenTools.includes(id)))
  );
  const [activeCategory, setActiveCategory] = useState<ToolCategory | 'all'>('all');
  const [localLayout, setLocalLayout] = useState<ToolbarLayout>(preferences.layout);
  const [showShortcutEditor, setShowShortcutEditor] = useState(false);
  const [editingShortcut, setEditingShortcut] = useState<{ toolId: string; current: string } | null>(null);

  // Computed values
  const categories = useMemo(() => {
    const cats = new Set(tools.map(tool => tool.category));
    return Array.from(cats).sort();
  }, [tools]);

  const filteredTools = useMemo(() => {
    return tools.filter(tool => 
      activeCategory === 'all' || tool.category === activeCategory
    );
  }, [tools, activeCategory]);

  const orderedSelectedTools = useMemo(() => {
    return preferences.toolOrder
      .map(id => tools.find(tool => tool.id === id))
      .filter((tool): tool is ToolAction => tool !== undefined && selectedTools.has(tool.id));
  }, [preferences.toolOrder, tools, selectedTools]);

  // Handlers
  const handleToolToggle = useCallback((toolId: string) => {
    setSelectedTools(prev => {
      const next = new Set(prev);
      if (next.has(toolId)) {
        next.delete(toolId);
      } else {
        next.add(toolId);
      }
      return next;
    });
  }, []);

  const handleLayoutChange = useCallback((key: keyof ToolbarLayout, value: any) => {
    setLocalLayout(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleSavePreferences = useCallback(() => {
    const newPreferences: ToolbarPreferences = {
      ...preferences,
      layout: localLayout,
      toolOrder: [
        ...preferences.toolOrder.filter(id => selectedTools.has(id)),
        ...tools
          .filter(tool => selectedTools.has(tool.id) && !preferences.toolOrder.includes(tool.id))
          .map(tool => tool.id)
      ],
      hiddenTools: tools
        .filter(tool => !selectedTools.has(tool.id))
        .map(tool => tool.id)
    };

    onPreferencesChange(newPreferences);
    onClose();
  }, [preferences, localLayout, selectedTools, tools, onPreferencesChange, onClose]);

  const handleResetToDefaults = useCallback(() => {
    const defaultSelected = new Set(tools.slice(0, 6).map(tool => tool.id));
    setSelectedTools(defaultSelected);
    setLocalLayout({
      position: 'floating',
      orientation: 'vertical',
      size: 'medium',
      showLabels: false,
      autoHide: false,
      maxTools: 8
    });
  }, [tools]);

  const handleExportSettings = useCallback(() => {
    const settings = {
      preferences,
      selectedTools: Array.from(selectedTools),
      layout: localLayout,
      timestamp: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(settings, null, 2)], { 
      type: 'application/json' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `toolbar-settings-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [preferences, selectedTools, localLayout]);

  const handleImportSettings = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const settings = JSON.parse(e.target?.result as string);
        if (settings.preferences) {
          onPreferencesChange(settings.preferences);
        }
        if (settings.selectedTools) {
          setSelectedTools(new Set(settings.selectedTools));
        }
        if (settings.layout) {
          setLocalLayout(settings.layout);
        }
      } catch (error) {
        console.error('Failed to import settings:', error);
        // Could show error message to user
      }
    };
    reader.readAsText(file);
  }, [onPreferencesChange]);

  return (
    <CustomizationContainer data-testid={testId}>
      {/* Tool Selection */}
      <Section>
        <SectionTitle>Select Tools</SectionTitle>
        
        {/* Category Filter */}
        <CategoryFilter>
          <CategoryBadge
            variant="neutral"
            isActive={activeCategory === 'all'}
            onClick={() => setActiveCategory('all')}
          >
            All ({tools.length})
          </CategoryBadge>
          {categories.map(category => (
            <CategoryBadge
              key={category}
              variant="primary"
              isActive={activeCategory === category}
              onClick={() => setActiveCategory(category)}
              style={{ backgroundColor: CATEGORY_COLORS[category] }}
            >
              {CATEGORY_LABELS[category]} ({tools.filter(t => t.category === category).length})
            </CategoryBadge>
          ))}
        </CategoryFilter>

        {/* Tool Grid */}
        <ToolGrid>
          {filteredTools.map(tool => (
            <ToolCard
              key={tool.id}
              isSelected={selectedTools.has(tool.id)}
              isHidden={preferences.hiddenTools.includes(tool.id)}
              onClick={() => handleToolToggle(tool.id)}
              data-testid={`customization-tool-${tool.id}`}
            >
              <ToolIcon>{tool.icon}</ToolIcon>
              <ToolName>{tool.name}</ToolName>
              <ToolDescription>{tool.description}</ToolDescription>
              {tool.dangerLevel && (tool.dangerLevel === 'high' || tool.dangerLevel === 'critical') && (
                <Badge variant="error" size="small">
                  {tool.dangerLevel}
                </Badge>
              )}
              {tool.shortcut && (
                <Badge variant="neutral" size="small">
                  {tool.shortcut}
                </Badge>
              )}
            </ToolCard>
          ))}
        </ToolGrid>

        <div>
          <strong>Selected: {selectedTools.size}/{localLayout.maxTools} tools</strong>
        </div>
      </Section>

      {/* Layout Configuration */}
      <Section>
        <SectionTitle>Layout Configuration</SectionTitle>
        
        <GridContainer columns={3}>
          <div>
            <label>Position</label>
            <Select
              value={localLayout.position}
              onChange={(value) => handleLayoutChange('position', value)}
              options={[
                { value: 'floating', label: 'Floating' },
                { value: 'top', label: 'Top' },
                { value: 'bottom', label: 'Bottom' },
                { value: 'left', label: 'Left' },
                { value: 'right', label: 'Right' }
              ]}
            />
          </div>
          
          <div>
            <label>Orientation</label>
            <Select
              value={localLayout.orientation}
              onChange={(value) => handleLayoutChange('orientation', value)}
              options={[
                { value: 'horizontal', label: 'Horizontal' },
                { value: 'vertical', label: 'Vertical' }
              ]}
            />
          </div>
          
          <div>
            <label>Size</label>
            <Select
              value={localLayout.size}
              onChange={(value) => handleLayoutChange('size', value)}
              options={[
                { value: 'small', label: 'Small' },
                { value: 'medium', label: 'Medium' },
                { value: 'large', label: 'Large' }
              ]}
            />
          </div>
        </GridContainer>

        <GridContainer columns={2}>
          <Toggle
            label="Show Labels"
            checked={localLayout.showLabels}
            onChange={(checked) => handleLayoutChange('showLabels', checked)}
          />
          
          <Toggle
            label="Auto Hide"
            checked={localLayout.autoHide}
            onChange={(checked) => handleLayoutChange('autoHide', checked)}
          />
        </GridContainer>

        <div>
          <label>Maximum Tools</label>
          <Input
            type="number"
            value={localLayout.maxTools.toString()}
            onChange={(e) => handleLayoutChange('maxTools', parseInt(e.target.value) || 8)}
            min="1"
            max="20"
          />
        </div>

        {/* Layout Preview */}
        <div>
          <strong>Preview:</strong>
          <LayoutPreview layout={localLayout}>
            {orderedSelectedTools.slice(0, Math.min(5, localLayout.maxTools)).map((tool, index) => (
              <PreviewTool key={tool.id} size={localLayout.size}>
                {tool.icon}
              </PreviewTool>
            ))}
            {orderedSelectedTools.length > 5 && (
              <PreviewTool size={localLayout.size}>
                +{orderedSelectedTools.length - 5}
              </PreviewTool>
            )}
          </LayoutPreview>
        </div>
      </Section>

      {/* Keyboard Shortcuts */}
      <Section>
        <SectionTitle>Keyboard Shortcuts</SectionTitle>
        
        <Button
          variant="secondary"
          onClick={() => setShowShortcutEditor(true)}
          disabled={selectedTools.size === 0}
        >
          Edit Shortcuts ({Object.keys(preferences.keyboardShortcuts).length})
        </Button>
      </Section>

      {/* Actions */}
      <ActionsContainer>
        <div>
          <Button
            variant="ghost"
            onClick={handleResetToDefaults}
            testId="reset-defaults"
          >
            Reset to Defaults
          </Button>
        </div>
        
        <div style={{ display: 'flex', gap: '12px' }}>
          <Button
            variant="secondary"
            onClick={handleExportSettings}
            testId="export-settings"
          >
            Export Settings
          </Button>
          
          <input
            type="file"
            accept=".json"
            onChange={handleImportSettings}
            style={{ display: 'none' }}
            id="import-settings"
          />
          <Button
            variant="secondary"
            onClick={() => document.getElementById('import-settings')?.click()}
            testId="import-settings"
          >
            Import Settings
          </Button>
          
          <Button
            variant="tertiary"
            onClick={onClose}
            testId="cancel-customization"
          >
            Cancel
          </Button>
          
          <Button
            variant="primary"
            onClick={handleSavePreferences}
            testId="save-customization"
          >
            Save Changes
          </Button>
        </div>
      </ActionsContainer>

      {/* Shortcut Editor Modal */}
      <Modal
        open={showShortcutEditor}
        onClose={() => setShowShortcutEditor(false)}
        title="Edit Keyboard Shortcuts"
        size="large"
      >
        <div>
          <p>Configure keyboard shortcuts for selected tools:</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
            {orderedSelectedTools.map(tool => (
              <ShortcutInput key={tool.id}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>{tool.icon}</span>
                  <span>{tool.name}</span>
                </div>
                <Input
                  value={tool.shortcut || ''}
                  placeholder="e.g., Ctrl+H"
                  style={{ width: '150px' }}
                  readOnly
                />
                <Button
                  variant="ghost"
                  size="small"
                  onClick={() => setEditingShortcut({ toolId: tool.id, current: tool.shortcut || '' })}
                >
                  Edit
                </Button>
              </ShortcutInput>
            ))}
          </div>
        </div>
      </Modal>
    </CustomizationContainer>
  );
};