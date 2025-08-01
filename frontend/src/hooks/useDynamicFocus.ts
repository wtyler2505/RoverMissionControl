/**
 * useDynamicFocus Hook
 * Manages focus for dynamically added/removed content
 * Handles focus announcements and preservation during content updates
 */

import { useRef, useCallback, useEffect } from 'react';

interface DynamicFocusOptions {
  /**
   * Whether dynamic focus management is enabled
   */
  enabled?: boolean;
  /**
   * Selector for the container that holds dynamic content
   */
  containerSelector?: string;
  /**
   * Whether to announce content changes to screen readers
   */
  announceChanges?: boolean;
  /**
   * Delay before focusing new content (in milliseconds)
   */
  focusDelay?: number;
  /**
   * Whether to preserve focus position during updates
   */
  preserveFocus?: boolean;
  /**
   * Custom function to determine what to focus when content is added
   */
  getFocusTargetOnAdd?: (addedElement: HTMLElement) => HTMLElement | null;
  /**
   * Custom function to determine what to focus when content is removed
   */
  getFocusTargetOnRemove?: (removedElement: HTMLElement, container: HTMLElement) => HTMLElement | null;
}

interface FocusPreservationState {
  /**
   * Element that had focus before content change
   */
  previouslyFocusedElement: HTMLElement | null;
  /**
   * Position of focused element relative to siblings
   */
  focusPosition: number;
  /**
   * Selector to identify the focused element type
   */
  focusSelector: string;
  /**
   * Whether focus should be preserved
   */
  shouldPreserve: boolean;
}

/**
 * Hook to manage focus for dynamic content
 */
export const useDynamicFocus = (options: DynamicFocusOptions = {}) => {
  const {
    enabled = true,
    containerSelector,
    announceChanges = true,
    focusDelay = 100,
    preserveFocus = true,
    getFocusTargetOnAdd,
    getFocusTargetOnRemove,
  } = options;

  const observerRef = useRef<MutationObserver | null>(null);
  const containerRef = useRef<HTMLElement | null>(null);
  const focusStateRef = useRef<FocusPreservationState>({
    previouslyFocusedElement: null,
    focusPosition: -1,
    focusSelector: '',
    shouldPreserve: false,
  });
  const announceElementRef = useRef<HTMLElement | null>(null);

  /**
   * Get or create the announcement element for screen readers
   */
  const getAnnounceElement = useCallback((): HTMLElement => {
    if (announceElementRef.current) {
      return announceElementRef.current;
    }

    let element = document.getElementById('dynamic-content-announcements');
    
    if (!element) {
      element = document.createElement('div');
      element.id = 'dynamic-content-announcements';
      element.setAttribute('aria-live', 'polite');
      element.setAttribute('aria-atomic', 'false');
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
      document.body.appendChild(element);
    }

    announceElementRef.current = element;
    return element;
  }, []);

  /**
   * Announce content changes to screen readers
   */
  const announceContentChange = useCallback((message: string) => {
    if (!announceChanges || !enabled) return;

    const announceElement = getAnnounceElement();
    announceElement.textContent = '';
    setTimeout(() => {
      announceElement.textContent = message;
    }, 50);
  }, [announceChanges, enabled, getAnnounceElement]);

  /**
   * Capture focus state before content changes
   */
  const captureFocusState = useCallback(() => {
    if (!preserveFocus || !enabled) return;

    const activeElement = document.activeElement as HTMLElement;
    const container = containerRef.current;

    if (!container || !activeElement || !container.contains(activeElement)) {
      focusStateRef.current.shouldPreserve = false;
      return;
    }

    // Find the position of the focused element among its siblings
    const parent = activeElement.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children) as HTMLElement[];
      const position = siblings.indexOf(activeElement);
      
      focusStateRef.current = {
        previouslyFocusedElement: activeElement,
        focusPosition: position,
        focusSelector: generateElementSelector(activeElement),
        shouldPreserve: true,
      };
    }
  }, [preserveFocus, enabled]);

  /**
   * Generate a selector for an element
   */
  const generateElementSelector = useCallback((element: HTMLElement): string => {
    const parts: string[] = [];
    
    // Add tag name
    parts.push(element.tagName.toLowerCase());
    
    // Add class names
    if (element.className) {
      const classes = element.className.split(' ').filter(Boolean);
      parts.push(classes.map(c => `.${c}`).join(''));
    }
    
    // Add role if present
    const role = element.getAttribute('role');
    if (role) {
      parts.push(`[role="${role}"]`);
    }
    
    // Add data-testid if present
    const testId = element.getAttribute('data-testid');
    if (testId) {
      parts.push(`[data-testid="${testId}"]`);
    }

    return parts.join('');
  }, []);

  /**
   * Restore focus to an appropriate element
   */
  const restoreFocus = useCallback(() => {
    if (!preserveFocus || !enabled || !focusStateRef.current.shouldPreserve) return;

    const container = containerRef.current;
    if (!container) return;

    const { focusPosition, focusSelector, previouslyFocusedElement } = focusStateRef.current;

    // Try to find the exact element first
    if (previouslyFocusedElement && document.contains(previouslyFocusedElement)) {
      previouslyFocusedElement.focus();
      return;
    }

    // Try to find by selector
    if (focusSelector) {
      const elementBySelector = container.querySelector<HTMLElement>(focusSelector);
      if (elementBySelector) {
        elementBySelector.focus();
        return;
      }
    }

    // Try to find by position
    if (focusPosition >= 0) {
      const parent = previouslyFocusedElement?.parentElement;
      if (parent && document.contains(parent)) {
        const siblings = Array.from(parent.children) as HTMLElement[];
        const targetElement = siblings[Math.min(focusPosition, siblings.length - 1)];
        if (targetElement && targetElement.offsetParent !== null) {
          if (targetElement.tabIndex >= 0 || targetElement.hasAttribute('tabindex')) {
            targetElement.focus();
            return;
          }
        }
      }
    }

    // Fallback to first focusable element in container
    const focusableElements = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    }
  }, [preserveFocus, enabled]);

  /**
   * Handle nodes being added
   */
  const handleNodesAdded = useCallback((addedNodes: Node[]) => {
    const elements = addedNodes.filter(node => node.nodeType === Node.ELEMENT_NODE) as HTMLElement[];
    if (elements.length === 0) return;

    // Announce content addition
    if (elements.length === 1) {
      const element = elements[0];
      const tagName = element.tagName.toLowerCase();
      const textContent = element.textContent?.trim().substring(0, 50) || '';
      announceContentChange(`New ${tagName} added${textContent ? `: ${textContent}` : ''}`);
    } else {
      announceContentChange(`${elements.length} new items added`);
    }

    // Handle focus for added elements
    setTimeout(() => {
      for (const element of elements) {
        let focusTarget: HTMLElement | null = null;

        if (getFocusTargetOnAdd) {
          focusTarget = getFocusTargetOnAdd(element);
        } else {
          // Default: focus first focusable element in the added content
          focusTarget = element.querySelector<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          
          if (!focusTarget && element.tabIndex >= 0) {
            focusTarget = element;
          }
        }

        if (focusTarget) {
          focusTarget.focus();
          break; // Only focus the first suitable element
        }
      }
    }, focusDelay);
  }, [getFocusTargetOnAdd, focusDelay, announceContentChange]);

  /**
   * Handle nodes being removed
   */
  const handleNodesRemoved = useCallback((removedNodes: Node[]) => {
    const elements = removedNodes.filter(node => node.nodeType === Node.ELEMENT_NODE) as HTMLElement[];
    if (elements.length === 0) return;

    // Check if the focused element was removed
    const activeElement = document.activeElement as HTMLElement;
    const wasFocusedElementRemoved = elements.some(element => 
      element.contains(activeElement) || element === activeElement
    );

    // Announce content removal
    if (elements.length === 1) {
      const element = elements[0];
      const tagName = element.tagName.toLowerCase();
      announceContentChange(`${tagName} removed`);
    } else {
      announceContentChange(`${elements.length} items removed`);
    }

    // Handle focus restoration if needed
    if (wasFocusedElementRemoved && containerRef.current) {
      setTimeout(() => {
        let focusTarget: HTMLElement | null = null;

        if (getFocusTargetOnRemove) {
          focusTarget = getFocusTargetOnRemove(elements[0], containerRef.current!);
        } else {
          // Default: focus container or first focusable element
          const container = containerRef.current!;
          focusTarget = container.querySelector<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          
          if (!focusTarget) {
            if (container.tabIndex >= 0) {
              focusTarget = container;
            } else {
              container.setAttribute('tabindex', '-1');
              focusTarget = container;
            }
          }
        }

        if (focusTarget) {
          focusTarget.focus();
        }
      }, focusDelay);
    }
  }, [getFocusTargetOnRemove, focusDelay, announceContentChange]);

  /**
   * Start observing a container for changes
   */
  const observeContainer = useCallback((container: HTMLElement) => {
    if (!enabled) return;

    containerRef.current = container;

    // Create mutation observer
    observerRef.current = new MutationObserver((mutations) => {
      // Capture focus state before processing mutations
      captureFocusState();

      let hasAdditions = false;
      let hasRemovals = false;
      const addedNodes: Node[] = [];
      const removedNodes: Node[] = [];

      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          if (mutation.addedNodes.length > 0) {
            hasAdditions = true;
            addedNodes.push(...Array.from(mutation.addedNodes));
          }
          if (mutation.removedNodes.length > 0) {
            hasRemovals = true;
            removedNodes.push(...Array.from(mutation.removedNodes));
          }
        }
      });

      // Handle changes
      if (hasRemovals) {
        handleNodesRemoved(removedNodes);
      }
      if (hasAdditions) {
        handleNodesAdded(addedNodes);
      }

      // Restore focus if needed
      if (!hasAdditions && !hasRemovals && focusStateRef.current.shouldPreserve) {
        setTimeout(restoreFocus, focusDelay);
      }
    });

    // Start observing
    observerRef.current.observe(container, {
      childList: true,
      subtree: true,
    });
  }, [enabled, captureFocusState, handleNodesAdded, handleNodesRemoved, restoreFocus, focusDelay]);

  /**
   * Stop observing
   */
  const stopObserving = useCallback(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
    containerRef.current = null;
  }, []);

  /**
   * Initialize with container selector
   */
  useEffect(() => {
    if (containerSelector) {
      const container = document.querySelector<HTMLElement>(containerSelector);
      if (container) {
        observeContainer(container);
      }
    }

    return stopObserving;
  }, [containerSelector, observeContainer, stopObserving]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      stopObserving();
      if (announceElementRef.current) {
        announceElementRef.current.remove();
        announceElementRef.current = null;
      }
    };
  }, [stopObserving]);

  return {
    /**
     * Start observing a container for dynamic content changes
     */
    observeContainer,
    /**
     * Stop observing the current container
     */
    stopObserving,
    /**
     * Manually announce a message to screen readers
     */
    announceToScreenReader: (message: string) => announceContentChange(message),
    /**
     * Manually capture current focus state
     */
    captureFocusState,
    /**
     * Manually restore focus
     */
    restoreFocus,
  };
};

export default useDynamicFocus;