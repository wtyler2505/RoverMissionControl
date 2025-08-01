/**
 * FocusableJoystick Component
 * A joystick control with comprehensive keyboard and focus management
 * Supports WCAG 2.1 AA accessibility requirements
 */

import React, { useRef, useCallback, useEffect, useState } from 'react';
import styled from '@emotion/styled';
import { css } from '@emotion/react';
import { useFocusManagement } from '../../contexts/FocusManagementContext';
import { interactiveFocusStyles } from '../../theme/focusStyles';
import { Theme } from '../../theme/themes';

interface FocusableJoystickProps {
  /**
   * Current forward value (-1 to 1)
   */
  forward: number;
  /**
   * Current turn value (-1 to 1)  
   */
  turn: number;
  /**
   * Whether the joystick is disabled (e.g., emergency stop)
   */
  disabled?: boolean;
  /**
   * Callback when joystick values change
   */
  onMove: (forward: number, turn: number) => void;
  /**
   * Size of the joystick
   */
  size?: number;
  /**
   * Test ID for testing
   */
  testId?: string;
  /**
   * Additional CSS class
   */
  className?: string;
}

const JoystickContainer = styled.div<{
  theme: Theme;
  size: number;
  disabled: boolean;
}>`
  position: relative;
  width: ${({ size }) => size}px;
  height: ${({ size }) => size}px;
  border: 3px solid ${({ theme }) => theme.colors.divider};
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.background.paper};
  cursor: ${({ disabled }) => disabled ? 'not-allowed' : 'grab'};
  user-select: none;
  overflow: hidden;
  
  /* Focus styles for joystick container */
  ${({ theme }) => interactiveFocusStyles(theme, 'joystick')}
  
  /* Disabled state */
  ${({ disabled, theme }) => disabled && css`
    opacity: 0.6;
    background: ${theme.colors.background.default};
    pointer-events: none;
  `}
  
  /* Visual indicators */
  &::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 2px;
    height: 100%;
    background: ${({ theme }) => theme.colors.divider};
    transform: translate(-50%, -50%);
    z-index: 1;
  }
  
  &::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 100%;
    height: 2px;
    background: ${({ theme }) => theme.colors.divider};
    transform: translate(-50%, -50%);
    z-index: 1;
  }
`;

const JoystickKnob = styled.div<{
  theme: Theme;
  x: number;
  y: number;
  disabled: boolean;
  isDragging: boolean;
}>`
  position: absolute;
  width: 30px;
  height: 30px;
  background: ${({ theme, disabled }) => disabled ? theme.colors.text.disabled : theme.colors.primary.main};
  border: 2px solid ${({ theme, disabled }) => disabled ? theme.colors.text.disabled : theme.colors.primary.dark};
  border-radius: 50%;
  transform: translate(-50%, -50%);
  transition: ${({ isDragging }) => isDragging ? 'none' : 'all 0.2s ease'};
  cursor: ${({ disabled }) => disabled ? 'not-allowed' : 'grab'};
  z-index: 2;
  box-shadow: ${({ theme }) => theme.shadows.md};
  
  left: ${({ x }) => 50 + (x * 40)}%;
  top: ${({ y }) => 50 - (y * 40)}%;
  
  ${({ isDragging }) => isDragging && css`
    cursor: grabbing;
    transform: translate(-50%, -50%) scale(1.1);
  `}
  
  /* High contrast mode */
  @media (prefers-contrast: high) {
    border-width: 3px;
  }
`;

const Instructions = styled.div<{
  theme: Theme;
  visible: boolean;
}>`
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-top: ${({ theme }) => theme.spacing[2]};
  padding: ${({ theme }) => theme.spacing[2]} ${({ theme }) => theme.spacing[3]};
  background: ${({ theme }) => theme.colors.background.tooltip};
  color: ${({ theme }) => theme.colors.text.primary};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  white-space: nowrap;
  opacity: ${({ visible }) => visible ? 1 : 0};
  visibility: ${({ visible }) => visible ? 'visible' : 'hidden'};
  transition: opacity 0.2s ease, visibility 0.2s ease;
  z-index: 10;
  
  &::before {
    content: '';
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 0;
    border-left: 6px solid transparent;
    border-right: 6px solid transparent;
    border-bottom: 6px solid ${({ theme }) => theme.colors.background.tooltip};
  }
`;

export const FocusableJoystick: React.FC<FocusableJoystickProps> = ({
  forward,
  turn,
  disabled = false,
  onMove,
  size = 150,
  testId,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const { focusVisible, routerFocus } = useFocusManagement();

  // Handle mouse/touch movement
  const handleMove = useCallback((clientX: number, clientY: number) => {
    if (!containerRef.current || disabled) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const maxRadius = (size - 30) / 2; // Account for knob size
    const deltaX = clientX - centerX;
    const deltaY = centerY - clientY; // Invert Y axis
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    let normalizedX = deltaX / maxRadius;
    let normalizedY = deltaY / maxRadius;
    
    // Constrain to unit circle
    if (distance > maxRadius) {
      normalizedX = (deltaX / distance) * (maxRadius / maxRadius);
      normalizedY = (deltaY / distance) * (maxRadius / maxRadius);
    }
    
    // Clamp values
    normalizedX = Math.max(-1, Math.min(1, normalizedX));
    normalizedY = Math.max(-1, Math.min(1, normalizedY));
    
    onMove(normalizedY, normalizedX); // forward, turn
  }, [disabled, onMove, size]);

  // Mouse event handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (disabled) return;
    e.preventDefault();
    setIsDragging(true);
    handleMove(e.clientX, e.clientY);
  }, [disabled, handleMove]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging && !disabled) {
      handleMove(e.clientX, e.clientY);
    }
  }, [isDragging, disabled, handleMove]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    if (!disabled) {
      onMove(0, 0); // Return to center
    }
  }, [disabled, onMove]);

  // Touch event handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled) return;
    e.preventDefault();
    setIsDragging(true);
    const touch = e.touches[0];
    handleMove(touch.clientX, touch.clientY);
  }, [disabled, handleMove]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (isDragging && !disabled) {
      e.preventDefault();
      const touch = e.touches[0];
      handleMove(touch.clientX, touch.clientY);
    }
  }, [isDragging, disabled, handleMove]);

  // Keyboard controls for accessibility
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (disabled) return;
    
    const increment = e.shiftKey ? 0.2 : 0.1; // Fine control with Shift
    let newForward = forward;
    let newTurn = turn;
    let handled = false;
    
    switch (e.key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        newForward = Math.min(1, forward + increment);
        handled = true;
        break;
        
      case 'ArrowDown':
      case 's':
      case 'S':
        newForward = Math.max(-1, forward - increment);
        handled = true;
        break;
        
      case 'ArrowLeft':
      case 'a':
      case 'A':
        newTurn = Math.max(-1, turn - increment);
        handled = true;
        break;
        
      case 'ArrowRight':
      case 'd':
      case 'D':
        newTurn = Math.min(1, turn + increment);
        handled = true;
        break;
        
      case 'Enter':
      case ' ':
        // Center the joystick
        newForward = 0;
        newTurn = 0;
        handled = true;
        break;
        
      case 'Home':
        // Maximum forward
        newForward = 1;
        newTurn = 0;
        handled = true;
        break;
        
      case 'End':
        // Maximum reverse
        newForward = -1;
        newTurn = 0;
        handled = true;
        break;
    }
    
    if (handled) {
      e.preventDefault();
      e.stopPropagation();
      onMove(newForward, newTurn);
      
      // Announce changes to screen readers
      const forwardPercent = Math.round(newForward * 100);
      const turnPercent = Math.round(newTurn * 100);
      const announcement = `Joystick: Forward ${forwardPercent}%, Turn ${turnPercent}%`;
      routerFocus.announceToScreenReader(announcement);
    }
  }, [disabled, forward, turn, onMove, routerFocus]);

  // Mouse event listeners
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleTouchMove);
      document.addEventListener('touchend', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove]);

  // Focus/blur handlers for instructions
  const handleFocus = useCallback(() => {
    setShowInstructions(true);
  }, []);

  const handleBlur = useCallback(() => {
    setShowInstructions(false);
  }, []);

  // Calculate knob position
  const knobX = turn;
  const knobY = forward;

  return (
    <div className={className} style={{ position: 'relative', display: 'inline-block' }}>
      <JoystickContainer
        ref={containerRef}
        size={size}
        disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        role="slider"
        aria-label="Rover joystick control"
        aria-valuemin={-100}
        aria-valuemax={100}
        aria-valuenow={Math.round(forward * 100)}
        aria-valuetext={`Forward: ${Math.round(forward * 100)}%, Turn: ${Math.round(turn * 100)}%`}
        aria-disabled={disabled}
        data-testid={testId}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        {...focusVisible.getFocusVisibleProps()}
      >
        <JoystickKnob
          x={knobX}
          y={knobY}
          disabled={disabled}
          isDragging={isDragging}
        />
      </JoystickContainer>
      
      <Instructions visible={showInstructions && !disabled}>
        Arrow keys or WASD to move • Shift for fine control • Enter/Space to center • Home/End for max forward/reverse
      </Instructions>
      
      {/* Screen reader announcements */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {disabled ? 'Joystick disabled - Emergency stop active' : ''}
      </div>
    </div>
  );
};

export default FocusableJoystick;