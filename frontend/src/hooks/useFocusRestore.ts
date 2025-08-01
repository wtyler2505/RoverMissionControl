/**
 * useFocusRestore Hook
 * Manages focus restoration when components unmount or overlays close
 * Ensures focus returns to the appropriate element maintaining user context
 */

import { useRef, useEffect, useCallback } from 'react';

interface FocusRestoreOptions {
  /**
   * Whether focus restoration is enabled
   */
  enabled?: boolean;
  /**
   * Delay before restoring focus (in milliseconds)
   */
  delay?: number;
  /**
   * Custom element to restore focus to (overrides automatic detection)
   */
  restoreElement?: HTMLElement | (() => HTMLElement | null);
  /**
   * Callback when focus is restored
   */
  onRestore?: (element: HTMLElement) => void;
  /**
   * Callback when focus restoration fails
   */
  onRestoreFailure?: (reason: string) => void;
}

interface FocusRestoreState {
  /**
   * The element that had focus before the component mounted
   */
  previouslyFocusedElement: HTMLElement | null;
  /**
   * Timestamp when focus was captured
   */
  captureTime: number;
  /**
   * Whether focus was captured
   */
  wasCaptured: boolean;
}

/**
 * Hook to manage focus restoration
 */
export const useFocusRestore = (options: FocusRestoreOptions = {}) => {
  const {
    enabled = true,
    delay = 0,
    restoreElement,
    onRestore,
    onRestoreFailure,
  } = options;

  const focusState = useRef<FocusRestoreState>({
    previouslyFocusedElement: null,
    captureTime: 0,
    wasCaptured: false,
  });

  /**
   * Check if an element is focusable and visible
   */
  const isElementFocusable = useCallback((element: HTMLElement): boolean => {
    if (!element || !document.contains(element)) {
      return false;
    }

    const style = window.getComputedStyle(element);
    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      element.hasAttribute('inert') ||
      element.getAttribute('aria-hidden') === 'true'
    ) {
      return false;
    }

    // Check if element is disabled
    if ('disabled' in element && (element as any).disabled) {
      return false;
    }

    // Check if element has negative tabindex (unless it's specifically -1 and meant to be programmatically focusable)
    const tabIndex = element.getAttribute('tabindex');
    if (tabIndex && parseInt(tabIndex, 10) < -1) {
      return false;
    }

    return true;
  }, []);

  /**
   * Find the best element to restore focus to
   */
  const findRestoreTarget = useCallback((): HTMLElement | null => {
    // If a custom restore element is provided, use it
    if (restoreElement) {
      const element = typeof restoreElement === 'function' ? restoreElement() : restoreElement;
      if (element && isElementFocusable(element)) {
        return element;
      }
    }

    // Use the previously focused element if it's still focusable
    if (
      focusState.current.previouslyFocusedElement &&
      isElementFocusable(focusState.current.previouslyFocusedElement)
    ) {
      return focusState.current.previouslyFocusedElement;
    }

    // Fall back to body if no suitable element is found
    return document.body;
  }, [restoreElement, isElementFocusable]);

  /**
   * Capture the currently focused element
   */
  const captureFocus = useCallback(() => {
    if (!enabled) return;

    const activeElement = document.activeElement as HTMLElement;
    
    focusState.current = {
      previouslyFocusedElement: activeElement && activeElement !== document.body ? activeElement : null,
      captureTime: Date.now(),
      wasCaptured: true,
    };
  }, [enabled]);

  /**
   * Restore focus to the appropriate element
   */
  const restoreFocus = useCallback(
    (force = false) => {
      if (!enabled && !force) return;

      const restoreTarget = findRestoreTarget();
      
      if (!restoreTarget) {
        onRestoreFailure?.('No suitable restore target found');
        return;
      }

      const performRestore = () => {
        try {
          restoreTarget.focus();
          
          // Verify focus was actually set
          if (document.activeElement === restoreTarget) {
            onRestore?.(restoreTarget);
          } else {
            // Focus may have been intercepted, try again with a slight delay
            setTimeout(() => {
              if (document.activeElement !== restoreTarget) {
                restoreTarget.focus();
                if (document.activeElement === restoreTarget) {
                  onRestore?.(restoreTarget);
                } else {
                  onRestoreFailure?.('Focus restoration was intercepted');
                }
              }
            }, 10);
          }
        } catch (error) {
          onRestoreFailure?.(`Focus restoration failed: ${error}`);
        }
      };

      if (delay > 0) {
        setTimeout(performRestore, delay);
      } else {
        performRestore();
      }
    },
    [enabled, delay, findRestoreTarget, onRestore, onRestoreFailure]
  );

  /**
   * Reset the focus state
   */
  const resetFocusState = useCallback(() => {
    focusState.current = {
      previouslyFocusedElement: null,
      captureTime: 0,
      wasCaptured: false,
    };
  }, []);

  /**
   * Check if focus should be restored based on current state
   */
  const shouldRestoreFocus = useCallback((): boolean => {
    if (!enabled || !focusState.current.wasCaptured) {
      return false;
    }

    // Don't restore if too much time has passed (user may have navigated elsewhere)
    const timeSinceCapture = Date.now() - focusState.current.captureTime;
    const maxRestoreTime = 30000; // 30 seconds
    
    if (timeSinceCapture > maxRestoreTime) {
      return false;
    }

    return true;
  }, [enabled]);

  /**
   * Capture focus on mount
   */
  useEffect(() => {
    captureFocus();
  }, [captureFocus]);

  /**
   * Restore focus on unmount
   */
  useEffect(() => {
    return () => {
      if (shouldRestoreFocus()) {
        // Use requestAnimationFrame to ensure DOM is ready
        requestAnimationFrame(() => {
          restoreFocus();
        });
      }
    };
  }, [restoreFocus, shouldRestoreFocus]);

  return {
    /**
     * Manually capture the currently focused element
     */
    captureFocus,
    /**
     * Manually restore focus
     */
    restoreFocus,
    /**
     * Reset the focus state
     */
    resetFocusState,
    /**
     * Get the previously focused element
     */
    getPreviouslyFocusedElement: () => focusState.current.previouslyFocusedElement,
    /**
     * Check if focus was captured
     */
    wasFocusCaptured: () => focusState.current.wasCaptured,
    /**
     * Check if focus should be restored
     */
    shouldRestoreFocus,
  };
};

export default useFocusRestore;