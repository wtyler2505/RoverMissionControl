/**
 * useFocusVisible Hook
 * Determines when focus indicators should be visible based on user interaction mode
 * Implements the focus-visible specification for better UX
 */

import { useState, useEffect, useCallback, useRef } from 'react';

interface FocusVisibleOptions {
  /**
   * Whether the hook should be active
   */
  enabled?: boolean;
  /**
   * Custom logic to determine if focus should be visible
   */
  customLogic?: (element: HTMLElement, event?: Event) => boolean;
  /**
   * Callback when focus visibility changes
   */
  onVisibilityChange?: (isVisible: boolean, element: HTMLElement) => void;
}

interface FocusVisibleState {
  /**
   * Whether focus is currently visible
   */
  isFocusVisible: boolean;
  /**
   * The element that currently has focus
   */
  focusedElement: HTMLElement | null;
  /**
   * The last interaction mode (keyboard, mouse, touch)
   */
  lastInteractionMode: 'keyboard' | 'mouse' | 'touch' | null;
}

/**
 * Elements that should always show focus when focused via keyboard
 */
const ALWAYS_FOCUS_VISIBLE_ELEMENTS = [
  'input',
  'textarea',
  'select',
  'button',
  'a',
  '[contenteditable]',
  '[role="button"]',
  '[role="link"]',
  '[role="textbox"]',
  '[role="searchbox"]',
  '[role="combobox"]',
  '[role="menuitem"]',
  '[role="option"]',
  '[role="tab"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="switch"]',
  '[role="slider"]',
  '[role="spinbutton"]',
];

/**
 * Keys that indicate keyboard navigation
 */
const KEYBOARD_NAVIGATION_KEYS = [
  'Tab',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
  'PageUp',
  'PageDown',
  ' ', // Space
  'Enter',
];

/**
 * Hook to manage focus visibility
 */
export const useFocusVisible = (options: FocusVisibleOptions = {}) => {
  const {
    enabled = true,
    customLogic,
    onVisibilityChange,
  } = options;

  const [state, setState] = useState<FocusVisibleState>({
    isFocusVisible: false,
    focusedElement: null,
    lastInteractionMode: null,
  });

  const hadKeyboardEvent = useRef(true); // Start with keyboard mode
  const timeoutId = useRef<NodeJS.Timeout>();

  /**
   * Check if an element should always show focus when focused
   */
  const shouldAlwaysShowFocus = useCallback((element: HTMLElement): boolean => {
    const tagName = element.tagName.toLowerCase();
    const role = element.getAttribute('role');
    const contentEditable = element.getAttribute('contenteditable');

    // Check tag names
    if (['input', 'textarea', 'select', 'button', 'a'].includes(tagName)) {
      return true;
    }

    // Check for contenteditable
    if (contentEditable === 'true' || contentEditable === '') {
      return true;
    }

    // Check roles
    if (role && ALWAYS_FOCUS_VISIBLE_ELEMENTS.some(selector => 
      selector.includes(`[role="${role}"]`)
    )) {
      return true;
    }

    // Check for interactive elements with tabindex
    const tabIndex = element.getAttribute('tabindex');
    if (tabIndex && parseInt(tabIndex, 10) >= 0) {
      const ariaRole = element.getAttribute('role');
      if (ariaRole && ['button', 'link', 'menuitem', 'option', 'tab'].includes(ariaRole)) {
        return true;
      }
    }

    return false;
  }, []);

  /**
   * Determine if focus should be visible based on the element and interaction mode
   */
  const shouldShowFocus = useCallback((element: HTMLElement, event?: Event): boolean => {
    // Use custom logic if provided
    if (customLogic) {
      return customLogic(element, event);
    }

    // Always show focus if the element requires it
    if (shouldAlwaysShowFocus(element)) {
      return hadKeyboardEvent.current;
    }

    // Show focus if the last interaction was keyboard-based
    return hadKeyboardEvent.current;
  }, [customLogic, shouldAlwaysShowFocus]);

  /**
   * Handle keyboard events
   */
  const handleKeydown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;

    // Only set keyboard mode for navigation keys
    if (KEYBOARD_NAVIGATION_KEYS.includes(event.key)) {
      hadKeyboardEvent.current = true;
      
      setState(prevState => {
        const newState = {
          ...prevState,
          lastInteractionMode: 'keyboard' as const,
        };
        
        // If there's a focused element, update focus visibility
        if (prevState.focusedElement) {
          const shouldShow = shouldShowFocus(prevState.focusedElement, event);
          newState.isFocusVisible = shouldShow;
          
          if (shouldShow !== prevState.isFocusVisible) {
            onVisibilityChange?.(shouldShow, prevState.focusedElement);
          }
        }
        
        return newState;
      });
    }
  }, [enabled, shouldShowFocus, onVisibilityChange]);

  /**
   * Handle mouse events
   */
  const handleMousedown = useCallback((event: MouseEvent) => {
    if (!enabled) return;

    hadKeyboardEvent.current = false;
    
    setState(prevState => ({
      ...prevState,
      lastInteractionMode: 'mouse',
      isFocusVisible: false,
    }));

    if (prevState.isFocusVisible && prevState.focusedElement) {
      onVisibilityChange?.(false, prevState.focusedElement);
    }
  }, [enabled, onVisibilityChange]);

  /**
   * Handle touch events
   */
  const handleTouchstart = useCallback((event: TouchEvent) => {
    if (!enabled) return;

    hadKeyboardEvent.current = false;
    
    setState(prevState => ({
      ...prevState,
      lastInteractionMode: 'touch',
      isFocusVisible: false,
    }));

    if (prevState.isFocusVisible && prevState.focusedElement) {
      onVisibilityChange?.(false, prevState.focusedElement);
    }
  }, [enabled, onVisibilityChange]);

  /**
   * Handle focus events
   */
  const handleFocus = useCallback((event: FocusEvent) => {
    if (!enabled) return;

    const element = event.target as HTMLElement;
    const shouldShow = shouldShowFocus(element, event);

    setState(prevState => {
      const newState = {
        ...prevState,
        focusedElement: element,
        isFocusVisible: shouldShow,
      };

      if (shouldShow !== prevState.isFocusVisible || element !== prevState.focusedElement) {
        // Clear any existing timeout
        if (timeoutId.current) {
          clearTimeout(timeoutId.current);
        }

        // Use a small delay to ensure the element is ready
        timeoutId.current = setTimeout(() => {
          onVisibilityChange?.(shouldShow, element);
        }, 0);
      }

      return newState;
    });
  }, [enabled, shouldShowFocus, onVisibilityChange]);

  /**
   * Handle blur events
   */
  const handleBlur = useCallback((event: FocusEvent) => {
    if (!enabled) return;

    setState(prevState => {
      const newState = {
        ...prevState,
        focusedElement: null,
        isFocusVisible: false,
      };

      if (prevState.isFocusVisible && prevState.focusedElement) {
        onVisibilityChange?.(false, prevState.focusedElement);
      }

      return newState;
    });
  }, [enabled, onVisibilityChange]);

  /**
   * Set up event listeners
   */
  useEffect(() => {
    if (!enabled) return;

    // Add event listeners
    document.addEventListener('keydown', handleKeydown, true);
    document.addEventListener('mousedown', handleMousedown, true);
    document.addEventListener('touchstart', handleTouchstart, true);
    document.addEventListener('focus', handleFocus, true);
    document.addEventListener('blur', handleBlur, true);

    return () => {
      // Remove event listeners
      document.removeEventListener('keydown', handleKeydown, true);
      document.removeEventListener('mousedown', handleMousedown, true);
      document.removeEventListener('touchstart', handleTouchstart, true);
      document.removeEventListener('focus', handleFocus, true);
      document.removeEventListener('blur', handleBlur, true);

      // Clear timeout
      if (timeoutId.current) {
        clearTimeout(timeoutId.current);
      }
    };
  }, [enabled, handleKeydown, handleMousedown, handleTouchstart, handleFocus, handleBlur]);

  /**
   * Create CSS class names for focus visibility
   */
  const getFocusVisibleClassName = useCallback((baseClassName = '') => {
    const classes = [baseClassName];
    if (state.isFocusVisible) {
      classes.push('focus-visible');
    }
    if (state.lastInteractionMode) {
      classes.push(`interaction-${state.lastInteractionMode}`);
    }
    return classes.filter(Boolean).join(' ');
  }, [state.isFocusVisible, state.lastInteractionMode]);

  /**
   * Props to apply to elements for focus visibility
   */
  const getFocusVisibleProps = useCallback((props: Record<string, any> = {}) => {
    return {
      ...props,
      className: getFocusVisibleClassName(props.className),
      'data-focus-visible': state.isFocusVisible,
      'data-interaction-mode': state.lastInteractionMode,
    };
  }, [getFocusVisibleClassName, state.isFocusVisible, state.lastInteractionMode]);

  return {
    /**
     * Whether focus is currently visible
     */
    isFocusVisible: state.isFocusVisible,
    /**
     * The element that currently has focus
     */
    focusedElement: state.focusedElement,
    /**
     * The last interaction mode
     */
    lastInteractionMode: state.lastInteractionMode,
    /**
     * Get CSS class names for focus visibility
     */
    getFocusVisibleClassName,
    /**
     * Get props to apply to elements
     */
    getFocusVisibleProps,
    /**
     * Manually set focus visibility
     */
    setFocusVisible: (visible: boolean) => {
      setState(prevState => ({
        ...prevState,
        isFocusVisible: visible,
      }));
    },
  };
};

export default useFocusVisible;