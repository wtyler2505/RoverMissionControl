/**
 * useFocusTrap Hook
 * Manages focus trapping within a container element for modals, dialogs, and overlays
 * Ensures focus cycles through only focusable elements within the trap
 */

import { useEffect, useRef, useCallback } from 'react';

interface FocusTrapOptions {
  /**
   * Whether the focus trap is active
   */
  active: boolean;
  /**
   * Element to focus initially when trap activates
   */
  initialFocus?: HTMLElement | string;
  /**
   * Whether to restore focus to the previously focused element when trap deactivates
   */
  restoreFocus?: boolean;
  /**
   * Custom focusable selector (defaults to standard focusable elements)
   */
  focusableSelector?: string;
  /**
   * Callback when escape key is pressed
   */
  onEscape?: () => void;
  /**
   * Whether escape key should be handled
   */
  escapeDeactivates?: boolean;
}

/**
 * Default selector for focusable elements
 */
const DEFAULT_FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
  'audio[controls]',
  'video[controls]',
  'iframe',
  'object',
  'embed',
  'area[href]',
  'summary',
  '[role="button"]:not([aria-disabled="true"])',
  '[role="link"]:not([aria-disabled="true"])',
  '[role="menuitem"]:not([aria-disabled="true"])',
  '[role="option"]:not([aria-disabled="true"])',
  '[role="tab"]:not([aria-disabled="true"])',
  '[role="checkbox"]:not([aria-disabled="true"])',
  '[role="radio"]:not([aria-disabled="true"])',
  '[role="switch"]:not([aria-disabled="true"])',
  '[role="textbox"]:not([aria-disabled="true"])',
  '[role="searchbox"]:not([aria-disabled="true"])',
  '[role="combobox"]:not([aria-disabled="true"])',
  '[role="slider"]:not([aria-disabled="true"])',
  '[role="spinbutton"]:not([aria-disabled="true"])',
].join(', ');

/**
 * Hook to manage focus trapping within a container
 */
export const useFocusTrap = (
  containerRef: React.RefObject<HTMLElement>,
  options: FocusTrapOptions = { active: false }
) => {
  const {
    active,
    initialFocus,
    restoreFocus = true,
    focusableSelector = DEFAULT_FOCUSABLE_SELECTOR,
    onEscape,
    escapeDeactivates = true,
  } = options;

  const previouslyFocusedElement = useRef<HTMLElement | null>(null);
  const sentinelStart = useRef<HTMLDivElement>(null);
  const sentinelEnd = useRef<HTMLDivElement>(null);

  /**
   * Get all focusable elements within the container
   */
  const getFocusableElements = useCallback((): HTMLElement[] => {
    if (!containerRef.current) return [];
    
    const elements = Array.from(
      containerRef.current.querySelectorAll<HTMLElement>(focusableSelector)
    );

    // Filter out elements that are not actually focusable
    return elements.filter((element) => {
      const style = window.getComputedStyle(element);
      return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        !element.hasAttribute('inert') &&
        element.tabIndex >= 0
      );
    });
  }, [containerRef, focusableSelector]);

  /**
   * Focus the initial element or first focusable element
   */
  const focusInitialElement = useCallback(() => {
    if (!containerRef.current) return;

    let elementToFocus: HTMLElement | null = null;

    if (typeof initialFocus === 'string') {
      elementToFocus = containerRef.current.querySelector(initialFocus);
    } else if (initialFocus instanceof HTMLElement) {
      elementToFocus = initialFocus;
    } else {
      const focusableElements = getFocusableElements();
      elementToFocus = focusableElements[0] || null;
    }

    if (elementToFocus) {
      elementToFocus.focus();
    } else {
      // If no focusable element found, focus the container itself
      containerRef.current.focus();
    }
  }, [containerRef, initialFocus, getFocusableElements]);

  /**
   * Handle tab key navigation within the trap
   */
  const handleTabKey = useCallback(
    (event: KeyboardEvent) => {
      if (!containerRef.current || event.key !== 'Tab') return;

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) {
        event.preventDefault();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const currentElement = document.activeElement as HTMLElement;

      if (event.shiftKey) {
        // Shift + Tab: moving backwards
        if (currentElement === firstElement || !focusableElements.includes(currentElement)) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab: moving forwards
        if (currentElement === lastElement || !focusableElements.includes(currentElement)) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    },
    [containerRef, getFocusableElements]
  );

  /**
   * Handle escape key
   */
  const handleEscapeKey = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape' && escapeDeactivates && onEscape) {
        event.preventDefault();
        onEscape();
      }
    },
    [escapeDeactivates, onEscape]
  );

  /**
   * Handle focus on sentinel elements (start and end of trap)
   */
  const handleSentinelFocus = useCallback(
    (isStart: boolean) => {
      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) return;

      const targetElement = isStart 
        ? focusableElements[focusableElements.length - 1]
        : focusableElements[0];
      
      targetElement.focus();
    },
    [getFocusableElements]
  );

  /**
   * Create invisible sentinel elements to catch focus outside the trap
   */
  const createSentinels = useCallback(() => {
    if (!containerRef.current || !active) return;

    // Remove existing sentinels
    const existingSentinels = containerRef.current.querySelectorAll('[data-focus-sentinel]');
    existingSentinels.forEach(sentinel => sentinel.remove());

    // Create start sentinel
    const startSentinel = document.createElement('div');
    startSentinel.setAttribute('data-focus-sentinel', 'start');
    startSentinel.setAttribute('tabindex', '0');
    startSentinel.style.cssText = `
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    `;
    startSentinel.addEventListener('focus', () => handleSentinelFocus(true));

    // Create end sentinel
    const endSentinel = document.createElement('div');
    endSentinel.setAttribute('data-focus-sentinel', 'end');
    endSentinel.setAttribute('tabindex', '0');
    endSentinel.style.cssText = startSentinel.style.cssText;
    endSentinel.addEventListener('focus', () => handleSentinelFocus(false));

    // Insert sentinels
    containerRef.current.insertBefore(startSentinel, containerRef.current.firstChild);
    containerRef.current.appendChild(endSentinel);

    sentinelStart.current = startSentinel;
    sentinelEnd.current = endSentinel;
  }, [containerRef, active, handleSentinelFocus]);

  /**
   * Clean up sentinels
   */
  const cleanupSentinels = useCallback(() => {
    if (sentinelStart.current) {
      sentinelStart.current.remove();
      sentinelStart.current = null;
    }
    if (sentinelEnd.current) {
      sentinelEnd.current.remove();
      sentinelEnd.current = null;
    }
  }, []);

  /**
   * Activate focus trap
   */
  const activate = useCallback(() => {
    if (!containerRef.current) return;

    // Store previously focused element
    previouslyFocusedElement.current = document.activeElement as HTMLElement;

    // Create sentinels
    createSentinels();

    // Add event listeners
    document.addEventListener('keydown', handleTabKey);
    document.addEventListener('keydown', handleEscapeKey);

    // Focus initial element
    focusInitialElement();

    // Add ARIA attributes
    containerRef.current.setAttribute('aria-modal', 'true');
    containerRef.current.setAttribute('role', 'dialog');
    if (!containerRef.current.hasAttribute('tabindex')) {
      containerRef.current.setAttribute('tabindex', '-1');
    }
  }, [containerRef, createSentinels, handleTabKey, handleEscapeKey, focusInitialElement]);

  /**
   * Deactivate focus trap
   */
  const deactivate = useCallback(() => {
    if (!containerRef.current) return;

    // Remove event listeners
    document.removeEventListener('keydown', handleTabKey);
    document.removeEventListener('keydown', handleEscapeKey);

    // Clean up sentinels
    cleanupSentinels();

    // Remove ARIA attributes
    containerRef.current.removeAttribute('aria-modal');
    if (containerRef.current.getAttribute('role') === 'dialog') {
      containerRef.current.removeAttribute('role');
    }

    // Restore focus to previously focused element
    if (restoreFocus && previouslyFocusedElement.current) {
      // Use setTimeout to ensure the element is focusable
      setTimeout(() => {
        if (previouslyFocusedElement.current) {
          previouslyFocusedElement.current.focus();
        }
      }, 0);
    }

    previouslyFocusedElement.current = null;
  }, [containerRef, handleTabKey, handleEscapeKey, cleanupSentinels, restoreFocus]);

  /**
   * Effect to manage focus trap activation/deactivation
   */
  useEffect(() => {
    if (active) {
      activate();
    } else {
      deactivate();
    }

    return () => {
      deactivate();
    };
  }, [active, activate, deactivate]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      deactivate();
    };
  }, [deactivate]);

  return {
    /**
     * Get all focusable elements within the trap
     */
    getFocusableElements,
    /**
     * Manually activate the focus trap
     */
    activate,
    /**
     * Manually deactivate the focus trap
     */
    deactivate,
    /**
     * Focus the first focusable element
     */
    focusFirst: () => {
      const elements = getFocusableElements();
      if (elements.length > 0) {
        elements[0].focus();
      }
    },
    /**
     * Focus the last focusable element
     */
    focusLast: () => {
      const elements = getFocusableElements();
      if (elements.length > 0) {
        elements[elements.length - 1].focus();
      }
    },
  };
};

export default useFocusTrap;