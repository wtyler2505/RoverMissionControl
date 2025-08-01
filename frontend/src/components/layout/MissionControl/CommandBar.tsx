/**
 * Mission Control Command Bar Component
 * Fixed position command interface at bottom of viewport
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import styled from '@emotion/styled';
import { css } from '@emotion/react';
import { Theme } from '../../../theme/themes';
import { Button } from '../../ui/core/Button/Button';
import { Modal } from '../../ui/core/Modal/Modal';
import { Badge } from '../../ui/core/Badge/Badge';
import { 
  Command, 
  CommandHistory, 
  CommandSuggestion, 
  ConnectionStatus, 
  CommandQueueStatus, 
  CommandBarState,
  KeyboardShortcut
} from './types';
import { 
  parseCommand, 
  findCommandSuggestions, 
  validateCommand, 
  getCommandHelp,
  formatCommandSyntax 
} from './commandParser';
import { ALL_COMMANDS, COMMAND_CATEGORIES, QUICK_ACTIONS } from './commandRegistry';

export interface CommandBarProps {
  /** Connection status */
  connectionStatus: ConnectionStatus;
  /** Command queue status */
  queueStatus: CommandQueueStatus;
  /** Command history */
  history?: CommandHistory[];
  /** Callback when command is executed */
  onExecuteCommand: (command: string, parameters: Record<string, any>) => Promise<void>;
  /** Callback when command needs confirmation */
  onConfirmCommand?: (command: Command, parameters: Record<string, any>) => Promise<boolean>;
  /** Custom CSS class */
  className?: string;
  /** Test ID for automation */
  testId?: string;
}

const CommandBarContainer = styled.div<{ theme: Theme }>`
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background-color: ${({ theme }) => theme.colors.background.elevated};
  border-top: 2px solid ${({ theme }) => theme.colors.divider};
  box-shadow: ${({ theme }) => theme.shadows.lg};
  z-index: ${({ theme }) => theme.zIndex?.modal || 1000};
  backdrop-filter: blur(8px);
  
  @media (prefers-color-scheme: dark) {
    background-color: ${({ theme }) => theme.colors.background.paper}dd;
  }
`;

const CommandBarContent = styled.div<{ theme: Theme }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[3]};
  padding: ${({ theme }) => theme.spacing[3]} ${({ theme }) => theme.spacing[4]};
  max-width: 1200px;
  margin: 0 auto;
`;

const StatusIndicators = styled.div<{ theme: Theme }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
  flex-shrink: 0;
`;

const StatusDot = styled.div<{ 
  theme: Theme; 
  status: 'connected' | 'disconnected' | 'executing' | 'error' 
}>`
  width: 12px;
  height: 12px;
  border-radius: 50%;
  position: relative;
  
  ${({ theme, status }) => {
    const colors = {
      connected: theme.colors.success.main,
      disconnected: theme.colors.error.main,
      executing: theme.colors.warning.main,
      error: theme.colors.error.main
    };
    
    return css`
      background-color: ${colors[status]};
      
      ${status === 'connected' && css`
        &::after {
          content: '';
          position: absolute;
          top: -2px;
          left: -2px;
          right: -2px;
          bottom: -2px;
          background-color: ${colors[status]};
          border-radius: 50%;
          opacity: 0.3;
          animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.3; }
          50% { transform: scale(1.2); opacity: 0.1; }
        }
      `}
    `;
  }}
`;

const StatusText = styled.span<{ theme: Theme }>`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.text.secondary};
  white-space: nowrap;
`;

const CommandInputContainer = styled.div<{ theme: Theme; isFocused: boolean }>`
  position: relative;
  flex: 1;
  min-width: 0;
  
  ${({ theme, isFocused }) => isFocused && css`
    &::before {
      content: '';
      position: absolute;
      top: -2px;
      left: -2px;
      right: -2px;
      bottom: -2px;
      background: linear-gradient(45deg, 
        ${theme.colors.primary.main}, 
        ${theme.colors.secondary.main}
      );
      border-radius: ${theme.borderRadius.md};
      z-index: -1;
      opacity: 0.3;
    }
  `}
`;

const CommandInput = styled.input<{ theme: Theme }>`
  width: 100%;
  padding: ${({ theme }) => theme.spacing[3]} ${({ theme }) => theme.spacing[4]};
  background-color: ${({ theme }) => theme.colors.background.paper};
  border: 2px solid ${({ theme }) => theme.colors.divider};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-family: ${({ theme }) => theme.typography.fontFamily.primary};
  font-size: ${({ theme }) => theme.typography.fontSize.base};
  color: ${({ theme }) => theme.colors.text.primary};
  transition: ${({ theme }) => theme.transitions.duration.fast} ${({ theme }) => theme.transitions.timing.ease};
  
  &::placeholder {
    color: ${({ theme }) => theme.colors.text.disabled};
  }
  
  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary.main};
    box-shadow: 0 0 0 3px ${({ theme }) => theme.colors.primary.main}33;
  }
  
  &:disabled {
    background-color: ${({ theme }) => theme.colors.background.default};
    color: ${({ theme }) => theme.colors.text.disabled};
    cursor: not-allowed;
  }
`;

const SuggestionsContainer = styled.div<{ theme: Theme; isVisible: boolean }>`
  position: absolute;
  bottom: 100%;
  left: 0;
  right: 0;
  background-color: ${({ theme }) => theme.colors.background.paper};
  border: 2px solid ${({ theme }) => theme.colors.divider};
  border-bottom: none;
  border-radius: ${({ theme }) => theme.borderRadius.md} ${({ theme }) => theme.borderRadius.md} 0 0;
  box-shadow: ${({ theme }) => theme.shadows.lg};
  max-height: 300px;
  overflow-y: auto;
  z-index: 10;
  
  ${({ isVisible }) => css`
    display: ${isVisible ? 'block' : 'none'};
  `}
`;

const SuggestionItem = styled.div<{ 
  theme: Theme; 
  isSelected: boolean; 
  dangerLevel: Command['dangerLevel'] 
}>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[3]};
  padding: ${({ theme }) => theme.spacing[3]} ${({ theme }) => theme.spacing[4]};
  cursor: pointer;
  transition: ${({ theme }) => theme.transitions.duration.fast} ${({ theme }) => theme.transitions.timing.ease};
  
  ${({ theme, isSelected }) => isSelected && css`
    background-color: ${theme.colors.primary.main}11;
    border-left: 4px solid ${theme.colors.primary.main};
  `}
  
  &:hover {
    background-color: ${({ theme }) => theme.colors.divider};
  }
  
  ${({ theme, dangerLevel }) => {
    if (dangerLevel === 'high' || dangerLevel === 'critical') {
      return css`
        border-left: 4px solid ${theme.colors.error.main};
        background-color: ${theme.colors.error.main}05;
      `;
    }
  }}
`;

const SuggestionIcon = styled.div<{ theme: Theme; category: keyof typeof COMMAND_CATEGORIES }>`
  width: 32px;
  height: 32px;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  background-color: ${({ category }) => COMMAND_CATEGORIES[category].color}22;
  color: ${({ category }) => COMMAND_CATEGORIES[category].color};
  flex-shrink: 0;
`;

const SuggestionContent = styled.div`
  flex: 1;
  min-width: 0;
`;

const SuggestionTitle = styled.div<{ theme: Theme }>`
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ theme }) => theme.colors.text.primary};
  margin-bottom: ${({ theme }) => theme.spacing[1]};
`;

const SuggestionDescription = styled.div<{ theme: Theme }>`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.text.secondary};
  line-height: ${({ theme }) => theme.typography.lineHeight.relaxed};
`;

const SuggestionMeta = styled.div<{ theme: Theme }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
  flex-shrink: 0;
`;

const QuickActions = styled.div<{ theme: Theme }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
  flex-shrink: 0;
`;

const KeyboardHint = styled.div<{ theme: Theme }>`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.text.disabled};
  padding: ${({ theme }) => theme.spacing[1]} ${({ theme }) => theme.spacing[2]};
  background-color: ${({ theme }) => theme.colors.background.default};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  border: 1px solid ${({ theme }) => theme.colors.divider};
`;

export const CommandBar: React.FC<CommandBarProps> = ({
  connectionStatus,
  queueStatus,
  history = [],
  onExecuteCommand,
  onConfirmCommand,
  className,
  testId
}) => {
  const [state, setState] = useState<CommandBarState>({
    input: '',
    isOpen: false,
    suggestions: [],
    selectedSuggestionIndex: -1,
    history: history,
    historyIndex: -1,
    isExecuting: false,
    recentCommands: [],
    favorites: []
  });

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingCommand, setPendingCommand] = useState<{
    command: Command;
    parameters: Record<string, any>;
  } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Keyboard shortcuts
  const shortcuts: KeyboardShortcut[] = useMemo(() => [
    { key: 'k', modifiers: ['ctrl'], action: 'focus', description: 'Focus command bar' },
    { key: 'Enter', modifiers: [], action: 'execute', description: 'Execute command' },
    { key: 'ArrowUp', modifiers: [], action: 'previous-suggestion', description: 'Previous suggestion' },
    { key: 'ArrowDown', modifiers: [], action: 'next-suggestion', description: 'Next suggestion' },
    { key: 'Escape', modifiers: [], action: 'close', description: 'Close suggestions' },
    { key: 'Tab', modifiers: [], action: 'complete', description: 'Complete suggestion' }
  ], []);

  // Global keyboard shortcut handler
  useEffect(() => {
    const handleGlobalKeydown = (event: KeyboardEvent) => {
      const isCtrlK = event.ctrlKey && event.key === 'k';
      
      if (isCtrlK) {
        event.preventDefault();
        inputRef.current?.focus();
        setState(prev => ({ ...prev, isOpen: true }));
      }
    };

    document.addEventListener('keydown', handleGlobalKeydown);
    return () => document.removeEventListener('keydown', handleGlobalKeydown);
  }, []);

  // Update suggestions when input changes
  useEffect(() => {
    if (state.input.trim()) {
      const suggestions = findCommandSuggestions(state.input, 8);
      setState(prev => ({
        ...prev,
        suggestions,
        selectedSuggestionIndex: suggestions.length > 0 ? 0 : -1
      }));
    } else {
      setState(prev => ({
        ...prev,
        suggestions: [],
        selectedSuggestionIndex: -1
      }));
    }
  }, [state.input]);

  // Handle input change
  const handleInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setState(prev => ({
      ...prev,
      input: value,
      historyIndex: -1
    }));
  }, []);

  // Handle input focus
  const handleInputFocus = useCallback(() => {
    setState(prev => ({ ...prev, isOpen: true }));
  }, []);

  // Handle input blur
  const handleInputBlur = useCallback(() => {
    // Delay to allow suggestion clicks
    setTimeout(() => {
      setState(prev => ({ ...prev, isOpen: false }));
    }, 150);
  }, []);

  // Handle keyboard events
  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case 'ArrowUp':
        event.preventDefault();
        setState(prev => {
          if (prev.suggestions.length === 0) {
            // Navigate command history
            const newHistoryIndex = Math.min(prev.historyIndex + 1, prev.history.length - 1);
            if (newHistoryIndex >= 0 && prev.history[newHistoryIndex]) {
              return {
                ...prev,
                historyIndex: newHistoryIndex,
                input: prev.history[newHistoryIndex].command
              };
            }
          } else {
            // Navigate suggestions
            const newIndex = prev.selectedSuggestionIndex > 0 
              ? prev.selectedSuggestionIndex - 1 
              : prev.suggestions.length - 1;
            return { ...prev, selectedSuggestionIndex: newIndex };
          }
          return prev;
        });
        break;

      case 'ArrowDown':
        event.preventDefault();
        setState(prev => {
          if (prev.suggestions.length === 0) {
            // Navigate command history
            const newHistoryIndex = prev.historyIndex > 0 ? prev.historyIndex - 1 : -1;
            return {
              ...prev,
              historyIndex: newHistoryIndex,
              input: newHistoryIndex >= 0 ? prev.history[newHistoryIndex].command : ''
            };
          } else {
            // Navigate suggestions
            const newIndex = prev.selectedSuggestionIndex < prev.suggestions.length - 1 
              ? prev.selectedSuggestionIndex + 1 
              : 0;
            return { ...prev, selectedSuggestionIndex: newIndex };
          }
        });
        break;

      case 'Tab':
        event.preventDefault();
        if (state.selectedSuggestionIndex >= 0 && state.suggestions[state.selectedSuggestionIndex]) {
          const suggestion = state.suggestions[state.selectedSuggestionIndex];
          setState(prev => ({
            ...prev,
            input: suggestion.command.name,
            suggestions: [],
            selectedSuggestionIndex: -1,
            isOpen: false
          }));
        }
        break;

      case 'Enter':
        event.preventDefault();
        if (state.selectedSuggestionIndex >= 0 && state.suggestions[state.selectedSuggestionIndex]) {
          handleSuggestionSelect(state.suggestions[state.selectedSuggestionIndex]);
        } else {
          handleExecuteCommand();
        }
        break;

      case 'Escape':
        setState(prev => ({
          ...prev,
          isOpen: false,
          suggestions: [],
          selectedSuggestionIndex: -1
        }));
        inputRef.current?.blur();
        break;
    }
  }, [state.selectedSuggestionIndex, state.suggestions, state.historyIndex, state.history]);

  // Handle suggestion selection
  const handleSuggestionSelect = useCallback((suggestion: CommandSuggestion) => {
    setState(prev => ({
      ...prev,
      input: suggestion.command.name,
      isOpen: false,
      suggestions: [],
      selectedSuggestionIndex: -1
    }));
    inputRef.current?.focus();
  }, []);

  // Handle command execution
  const handleExecuteCommand = useCallback(async () => {
    if (!state.input.trim() || state.isExecuting) return;

    const { commandName, parameters } = parseCommand(state.input);
    const command = ALL_COMMANDS.find(cmd => 
      cmd.name === commandName || cmd.aliases?.includes(commandName)
    );

    if (!command) {
      // Show error - command not found
      return;
    }

    // Validate command
    const validation = validateCommand(command, parameters);
    if (!validation.isValid) {
      // Show validation errors
      return;
    }

    // Check if confirmation is required
    if (command.confirmationRequired && onConfirmCommand) {
      setPendingCommand({ command, parameters });
      setShowConfirmModal(true);
      return;
    }

    // Execute command
    setState(prev => ({ ...prev, isExecuting: true }));
    
    try {
      await onExecuteCommand(state.input, parameters);
      
      // Add to history and recent commands
      setState(prev => ({
        ...prev,
        input: '',
        isExecuting: false,
        recentCommands: [state.input, ...prev.recentCommands.slice(0, 9)],
        historyIndex: -1
      }));
    } catch (error) {
      setState(prev => ({ ...prev, isExecuting: false }));
      // Handle execution error
    }
  }, [state.input, state.isExecuting, onExecuteCommand, onConfirmCommand]);

  // Handle command confirmation
  const handleConfirmCommand = useCallback(async () => {
    if (!pendingCommand) return;

    setState(prev => ({ ...prev, isExecuting: true }));
    
    try {
      await onExecuteCommand(state.input, pendingCommand.parameters);
      
      setState(prev => ({
        ...prev,
        input: '',
        isExecuting: false,
        recentCommands: [state.input, ...prev.recentCommands.slice(0, 9)],
        historyIndex: -1
      }));
    } catch (error) {
      setState(prev => ({ ...prev, isExecuting: false }));
    } finally {
      setShowConfirmModal(false);
      setPendingCommand(null);
    }
  }, [pendingCommand, state.input, onExecuteCommand]);

  // Handle quick action
  const handleQuickAction = useCallback((action: string) => {
    setState(prev => ({ ...prev, input: action }));
    inputRef.current?.focus();
  }, []);

  // Connection status
  const getConnectionStatus = (): 'connected' | 'disconnected' | 'executing' | 'error' => {
    if (state.isExecuting || queueStatus.executing > 0) return 'executing';
    if (!connectionStatus.isConnected) return 'disconnected';
    if (queueStatus.failed > 0) return 'error';
    return 'connected';
  };

  return (
    <>
      <CommandBarContainer className={className} data-testid={testId}>
        <CommandBarContent>
          {/* Status Indicators */}
          <StatusIndicators>
            <StatusDot status={getConnectionStatus()} />
            <StatusText>
              {getConnectionStatus() === 'connected' && `${connectionStatus.protocol} • ${connectionStatus.latency || 0}ms`}
              {getConnectionStatus() === 'disconnected' && 'Disconnected'}
              {getConnectionStatus() === 'executing' && 'Executing...'}
              {getConnectionStatus() === 'error' && 'Error'}
            </StatusText>
            
            {queueStatus.pending > 0 && (
              <Badge variant="info" testId="queue-pending">
                {queueStatus.pending} queued
              </Badge>
            )}
          </StatusIndicators>

          {/* Command Input */}
          <CommandInputContainer isFocused={state.isOpen}>
            <CommandInput
              ref={inputRef}
              type="text"
              value={state.input}
              onChange={handleInputChange}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              onKeyDown={handleKeyDown}
              placeholder="Enter command... (Ctrl+K to focus)"
              disabled={state.isExecuting || !connectionStatus.isConnected}
              data-testid="command-input"
              aria-label="Command input"
              aria-expanded={state.isOpen}
              aria-autocomplete="list"
              role="combobox"
            />
            
            {/* Suggestions */}
            <SuggestionsContainer 
              ref={suggestionsRef}
              isVisible={state.isOpen && state.suggestions.length > 0}
              role="listbox"
            >
              {state.suggestions.map((suggestion, index) => (
                <SuggestionItem
                  key={suggestion.command.id}
                  isSelected={index === state.selectedSuggestionIndex}
                  dangerLevel={suggestion.command.dangerLevel}
                  onClick={() => handleSuggestionSelect(suggestion)}
                  role="option"
                  aria-selected={index === state.selectedSuggestionIndex}
                  data-testid={`suggestion-${index}`}
                >
                  <SuggestionIcon category={suggestion.command.category}>
                    {COMMAND_CATEGORIES[suggestion.command.category].icon}
                  </SuggestionIcon>
                  
                  <SuggestionContent>
                    <SuggestionTitle>{suggestion.command.name}</SuggestionTitle>
                    <SuggestionDescription>
                      {suggestion.command.description}
                    </SuggestionDescription>
                  </SuggestionContent>
                  
                  <SuggestionMeta>
                    <Badge 
                      variant={suggestion.command.dangerLevel === 'high' || suggestion.command.dangerLevel === 'critical' ? 'error' : 'neutral'}
                    >
                      {COMMAND_CATEGORIES[suggestion.command.category].name}
                    </Badge>
                    {suggestion.command.confirmationRequired && (
                      <KeyboardHint>Confirm</KeyboardHint>
                    )}
                  </SuggestionMeta>
                </SuggestionItem>
              ))}
            </SuggestionsContainer>
          </CommandInputContainer>

          {/* Quick Actions */}
          <QuickActions>
            {QUICK_ACTIONS.map((action) => (
              <Button
                key={action}
                variant="ghost"
                size="small"
                onClick={() => handleQuickAction(action)}
                disabled={state.isExecuting || !connectionStatus.isConnected}
                data-testid={`quick-action-${action.replace(/\s+/g, '-')}`}
              >
                {action}
              </Button>
            ))}
          </QuickActions>
        </CommandBarContent>
      </CommandBarContainer>

      {/* Confirmation Modal */}
      <Modal
        open={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title="Confirm Command"
        variant="confirmation"
        danger={pendingCommand?.command.dangerLevel === 'high' || pendingCommand?.command.dangerLevel === 'critical'}
        onConfirm={handleConfirmCommand}
        onCancel={() => {
          setShowConfirmModal(false);
          setPendingCommand(null);
        }}
        loading={state.isExecuting}
        testId="command-confirmation"
      >
        {pendingCommand && (
          <div>
            <p>Are you sure you want to execute this command?</p>
            <div 
              style={{ 
                marginTop: '16px', 
                padding: '12px', 
                backgroundColor: 'var(--color-background-default)', 
                borderRadius: '8px',
                fontFamily: 'monospace'
              }}
            >
              {state.input}
            </div>
            <p style={{ marginTop: '16px', fontSize: '14px', color: 'var(--color-text-secondary)' }}>
              {pendingCommand.command.description}
            </p>
            {(pendingCommand.command.dangerLevel === 'high' || pendingCommand.command.dangerLevel === 'critical') && (
              <p style={{ marginTop: '8px', color: 'var(--color-error-main)', fontWeight: 'bold' }}>
                ⚠️ This is a {pendingCommand.command.dangerLevel} danger level command.
              </p>
            )}
          </div>
        )}
      </Modal>
    </>
  );
};