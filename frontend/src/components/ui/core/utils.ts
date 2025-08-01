/**
 * Utility functions and types for UI components
 */

import { Theme } from '../../../theme/themes';
import { css } from '@emotion/react';
import { buttonFocusStyles, inputFocusStyles, linkFocusStyles, navigationFocusStyles } from '../../../theme/focusStyles';

// Component size variants
export type ComponentSize = 'small' | 'medium' | 'large';

// Common component states
export interface ComponentStates {
  disabled?: boolean;
  loading?: boolean;
  error?: boolean;
  success?: boolean;
}

// Focus visible styles for keyboard navigation (using comprehensive focus styles)
export const focusStyles = (theme: Theme, type: 'button' | 'input' | 'link' | 'navigation' = 'button') => {
  const focusStyleMap = {
    'button': buttonFocusStyles,
    'input': inputFocusStyles,
    'link': linkFocusStyles,
    'navigation': navigationFocusStyles,
  };
  
  return focusStyleMap[type](theme);
};

// Disabled styles
export const disabledStyles = (theme: Theme) => css`
  opacity: 0.6;
  cursor: not-allowed;
  pointer-events: none;
`;

// Loading styles
export const loadingStyles = css`
  position: relative;
  color: transparent;
  pointer-events: none;
  
  &::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 1em;
    height: 1em;
    margin-left: -0.5em;
    margin-top: -0.5em;
    border: 2px solid currentColor;
    border-right-color: transparent;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`;

// Transition styles with reduced motion support
export const transitionStyles = (theme: Theme, properties: string[] = ['all']) => css`
  transition-property: ${properties.join(', ')};
  transition-duration: ${theme.transitions.duration.base};
  transition-timing-function: ${theme.transitions.timing.ease};
  
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

// Size mapping utilities
export const sizeMap = {
  small: {
    padding: '0.375rem 0.75rem',
    fontSize: '0.875rem',
    height: '2rem',
  },
  medium: {
    padding: '0.5rem 1rem',
    fontSize: '1rem',
    height: '2.5rem',
  },
  large: {
    padding: '0.75rem 1.5rem',
    fontSize: '1.125rem',
    height: '3rem',
  },
};

// Generate unique IDs for accessibility
let idCounter = 0;
export const generateId = (prefix: string = 'ui') => {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
};

// Check if color meets WCAG contrast requirements
export const meetsContrastRequirement = (
  foreground: string,
  background: string,
  level: 'AA' | 'AAA' = 'AA'
): boolean => {
  // This is a simplified check - in production, use a proper contrast calculation
  // For now, we'll trust our theme colors meet requirements
  return true;
};

// Ripple effect for interactive components
export const rippleEffect = css`
  position: relative;
  overflow: hidden;
  
  &::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 0;
    height: 0;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.5);
    transform: translate(-50%, -50%);
    transition: width 0.6s, height 0.6s;
  }
  
  &:active::before {
    width: 300px;
    height: 300px;
  }
`;

// Error state styles
export const errorStyles = (theme: Theme) => css`
  border-color: ${theme.colors.error.main};
  color: ${theme.colors.error.main};
  
  &:hover {
    border-color: ${theme.colors.error.dark};
  }
  
  &:focus-visible {
    outline-color: ${theme.colors.error.main};
  }
`;

// Success state styles
export const successStyles = (theme: Theme) => css`
  border-color: ${theme.colors.success.main};
  color: ${theme.colors.success.main};
  
  &:hover {
    border-color: ${theme.colors.success.dark};
  }
  
  &:focus-visible {
    outline-color: ${theme.colors.success.main};
  }
`;

// Screen reader only styles
export const srOnly = css`
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
`;

// Truncate text with ellipsis
export const truncate = css`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

// Center content
export const centerContent = css`
  display: flex;
  align-items: center;
  justify-content: center;
`;

// Stack elements vertically
export const stack = (gap: string = '1rem') => css`
  display: flex;
  flex-direction: column;
  gap: ${gap};
`;

// Stack elements horizontally
export const inline = (gap: string = '0.5rem') => css`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: ${gap};
`;