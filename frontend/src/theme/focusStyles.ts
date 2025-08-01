/**
 * Focus Styles for Rover Mission Control
 * WCAG 2.1 AA compliant focus indicators that work across all themes
 */

import { css } from '@emotion/react';
import { Theme } from './themes';

/**
 * Base focus styles that meet WCAG 2.1 AA requirements
 */
export interface FocusStyleOptions {
  /**
   * Focus ring color (defaults to theme primary)
   */
  color?: string;
  /**
   * Focus ring width in pixels
   */
  width?: number;
  /**
   * Focus ring style (solid, dashed, dotted)
   */
  style?: 'solid' | 'dashed' | 'dotted';
  /**
   * Offset from element border
   */
  offset?: number;
  /**
   * Border radius for the focus ring
   */
  borderRadius?: number;
  /**
   * Whether to include a shadow effect
   */
  shadow?: boolean;
  /**
   * Animation duration for focus transitions
   */
  animationDuration?: string;
  /**
   * Whether to use high contrast mode adaptations
   */
  highContrast?: boolean;
}

/**
 * Generate WCAG 2.1 AA compliant focus styles
 */
export const generateFocusStyles = (theme: Theme, options: FocusStyleOptions = {}) => {
  const {
    color = theme.colors.primary.main,
    width = 2,
    style = 'solid',
    offset = 2,
    borderRadius = 4,
    shadow = true,
    animationDuration = '150ms',
    highContrast = theme.name === 'High Contrast' || theme.name === 'Mission Critical',
  } = options;

  // Ensure minimum contrast ratio for WCAG AA
  const focusColor = highContrast ? theme.colors.primary.main : color;
  const shadowColor = `${focusColor}40`; // 25% opacity
  const glowColor = `${focusColor}20`; // 12.5% opacity

  return css`
    outline: none;
    position: relative;
    transition: box-shadow ${animationDuration} ease, outline ${animationDuration} ease;
    
    &:focus-visible,
    &.focus-visible {
      outline: ${width}px ${style} ${focusColor};
      outline-offset: ${offset}px;
      
      ${shadow && css`
        box-shadow: 
          0 0 0 ${offset}px ${theme.colors.background.paper},
          0 0 0 ${offset + width}px ${focusColor},
          ${highContrast ? 'none' : `0 0 8px ${shadowColor}, 0 0 16px ${glowColor}`};
      `}
      
      ${highContrast && css`
        outline-width: 3px;
        outline-offset: 1px;
        background-color: ${theme.colors.background.paper};
        border: 2px solid ${focusColor};
      `}
      
      border-radius: ${borderRadius}px;
    }
    
    /* Enhanced visibility for Mission Critical theme */
    ${theme.name === 'Mission Critical' && css`
      &:focus-visible,
      &.focus-visible {
        outline: 3px solid ${theme.colors.primary.main};
        outline-offset: 3px;
        box-shadow: 
          0 0 0 1px ${theme.colors.background.paper},
          0 0 0 6px ${theme.colors.primary.main},
          0 0 12px ${theme.colors.primary.main}80,
          0 0 24px ${theme.colors.primary.main}40;
        animation: missionCriticalFocusPulse 2s infinite;
      }
      
      @keyframes missionCriticalFocusPulse {
        0%, 100% { 
          box-shadow: 
            0 0 0 1px ${theme.colors.background.paper},
            0 0 0 6px ${theme.colors.primary.main},
            0 0 12px ${theme.colors.primary.main}80,
            0 0 24px ${theme.colors.primary.main}40;
        }
        50% { 
          box-shadow: 
            0 0 0 1px ${theme.colors.background.paper},
            0 0 0 6px ${theme.colors.primary.main},
            0 0 16px ${theme.colors.primary.main}CC,
            0 0 32px ${theme.colors.primary.main}60;
        }
      }
    `}
    
    /* Reduced motion support */
    @media (prefers-reduced-motion: reduce) {
      transition: none;
      animation: none !important;
      
      &:focus-visible,
      &.focus-visible {
        ${theme.name === 'Mission Critical' && css`
          box-shadow: 
            0 0 0 1px ${theme.colors.background.paper},
            0 0 0 6px ${theme.colors.primary.main};
        `}
      }
    }
    
    /* High contrast media query support */
    @media (prefers-contrast: high) {
      &:focus-visible,
      &.focus-visible {
        outline: 3px solid ButtonText;
        outline-offset: 2px;
        background-color: Canvas;
        color: ButtonText;
        box-shadow: none;
      }
    }
  `;
};

/**
 * Specific focus styles for different component types
 */

/**
 * Button focus styles
 */
export const buttonFocusStyles = (theme: Theme) => generateFocusStyles(theme, {
  width: 2,
  offset: 2,
  borderRadius: 6,
  shadow: true,
});

/**
 * Input focus styles
 */
export const inputFocusStyles = (theme: Theme) => generateFocusStyles(theme, {
  width: 2,
  offset: 0,
  borderRadius: 4,
  shadow: true,
});

/**
 * Link focus styles
 */
export const linkFocusStyles = (theme: Theme) => generateFocusStyles(theme, {
  width: 2,
  offset: 2,
  borderRadius: 2,
  shadow: false,
});

/**
 * Navigation focus styles
 */
export const navigationFocusStyles = (theme: Theme) => generateFocusStyles(theme, {
  width: 2,
  offset: 1,
  borderRadius: 4,
  shadow: true,
});

/**
 * Card/Panel focus styles
 */
export const cardFocusStyles = (theme: Theme) => generateFocusStyles(theme, {
  width: 2,
  offset: 4,
  borderRadius: 8,
  shadow: true,
});

/**
 * Emergency control focus styles
 */
export const emergencyFocusStyles = (theme: Theme) => generateFocusStyles(theme, {
  color: theme.colors.error.main,
  width: 3,
  offset: 3,
  borderRadius: 8,
  shadow: true,
  animationDuration: '100ms',
});

/**
 * Modal/Dialog focus styles
 */
export const modalFocusStyles = (theme: Theme) => css`
  &:focus {
    outline: none;
  }
  
  &:focus-within {
    ${generateFocusStyles(theme, {
      width: 3,
      offset: 2,
      borderRadius: 12,
      shadow: true,
    })}
  }
`;

/**
 * Skip link focus styles
 */
export const skipLinkFocusStyles = (theme: Theme) => css`
  ${generateFocusStyles(theme, {
    width: 3,
    offset: 2,
    borderRadius: 6,
    shadow: true,
    animationDuration: '200ms',
  })}
  
  &:focus-visible,
  &.focus-visible {
    background-color: ${theme.colors.primary.main};
    color: ${theme.colors.primary.contrast};
    padding: 8px 16px;
    font-weight: 600;
    z-index: 9999;
    
    /* Ensure skip links are always visible when focused */
    position: absolute !important;
    width: auto !important;
    height: auto !important;
    overflow: visible !important;
    clip: auto !important;
    white-space: nowrap !important;
  }
`;

/**
 * Focus styles for custom interactive components
 */
export const interactiveFocusStyles = (theme: Theme, elementType: 'gauge' | 'joystick' | 'chart' | 'control') => {
  const baseStyles = {
    gauge: {
      width: 3,
      offset: 4,
      borderRadius: 8,
      shadow: true,
    },
    joystick: {
      width: 3,
      offset: 6,
      borderRadius: 50, // Circular
      shadow: true,
      animationDuration: '200ms',
    },
    chart: {
      width: 2,
      offset: 2,
      borderRadius: 8,
      shadow: true,
    },
    control: {
      width: 2,
      offset: 3,
      borderRadius: 6,
      shadow: true,
    },
  };

  return generateFocusStyles(theme, baseStyles[elementType]);
};

/**
 * Focus management utilities
 */

/**
 * CSS to hide focus indicators when not using keyboard
 */
export const focusVisibleOnly = css`
  &:focus:not(:focus-visible) {
    outline: none;
    box-shadow: none;
  }
`;

/**
 * CSS for elements that should never show focus
 */
export const noFocusStyles = css`
  &:focus,
  &:focus-visible {
    outline: none !important;
    box-shadow: none !important;
  }
`;

/**
 * CSS for focus trap containers
 */
export const focusTrapStyles = css`
  &[data-focus-trap="active"] {
    isolation: isolate;
  }
  
  &[data-focus-trap="active"] * {
    &:focus-visible {
      z-index: 1;
    }
  }
`;

/**
 * Helper function to create focus styles with custom properties
 */
export const createCustomFocusStyles = (
  theme: Theme,
  customProperties: Partial<FocusStyleOptions>
) => {
  return generateFocusStyles(theme, customProperties);
};

/**
 * Focus styles for different interaction modes
 */
export const interactionModeFocusStyles = (theme: Theme) => css`
  &[data-interaction-mode="keyboard"] {
    ${generateFocusStyles(theme, { shadow: true })}
  }
  
  &[data-interaction-mode="mouse"] {
    ${generateFocusStyles(theme, { shadow: false, width: 1 })}
  }
  
  &[data-interaction-mode="touch"] {
    ${generateFocusStyles(theme, { 
      shadow: true, 
      width: 3, 
      offset: 4,
      color: theme.colors.primary.light 
    })}
  }
`;

/**
 * Print-friendly focus styles
 */
export const printFocusStyles = css`
  @media print {
    &:focus,
    &:focus-visible,
    &.focus-visible {
      outline: 2px solid black !important;
      outline-offset: 1px !important;
      box-shadow: none !important;
      background-color: white !important;
      color: black !important;
    }
  }
`;