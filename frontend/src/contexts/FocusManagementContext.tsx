/**
 * Focus Management Context
 * Provides centralized focus management for the entire application
 * Integrates all focus management hooks and provides a unified API
 */

import React, { createContext, useContext, useRef, useCallback, useEffect } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useFocusRestore } from '../hooks/useFocusRestore';
import { useFocusVisible } from '../hooks/useFocusVisible';
import { useRouterFocus } from '../hooks/useRouterFocus';
import { useDynamicFocus } from '../hooks/useDynamicFocus';

interface FocusManagementContextValue {
  /**
   * Focus trap management
   */
  focusTrap: {
    /**
     * Create a focus trap for a container
     */
    createTrap: (
      containerRef: React.RefObject<HTMLElement>,
      options?: Parameters<typeof useFocusTrap>[1]
    ) => ReturnType<typeof useFocusTrap>;
    /**
     * Global focus trap state
     */
    isGlobalTrapActive: boolean;
    /**
     * Activate global focus trap
     */
    activateGlobalTrap: (element: HTMLElement) => void;
    /**
     * Deactivate global focus trap
     */
    deactivateGlobalTrap: () => void;
  };

  /**
   * Focus restoration management
   */
  focusRestore: {
    /**
     * Capture current focus for later restoration
     */
    captureFocus: () => void;
    /**
     * Restore previously captured focus
     */
    restoreFocus: () => void;
    /**
     * Reset focus restoration state
     */
    resetState: () => void;
  };

  /**
   * Focus visibility management
   */
  focusVisible: {
    /**
     * Whether focus should be visible
     */
    isFocusVisible: boolean;
    /**
     * Last interaction mode
     */
    lastInteractionMode: 'keyboard' | 'mouse' | 'touch' | null;
    /**
     * Get focus visible props for an element
     */
    getFocusVisibleProps: (props?: Record<string, any>) => Record<string, any>;
  };

  /**
   * Router focus management
   */
  routerFocus: {
    /**
     * Current pathname
     */
    pathname: string;
    /**
     * Announce message to screen readers
     */
    announceToScreenReader: (message: string) => void;
    /**
     * Set custom focus target
     */
    setCustomFocusTarget: (selector: string | HTMLElement) => void;
  };

  /**
   * Dynamic content focus management
   */
  dynamicFocus: {
    /**
     * Start observing a container for changes
     */
    observeContainer: (container: HTMLElement) => void;
    /**
     * Stop observing current container
     */
    stopObserving: () => void;
    /**
     * Announce dynamic changes
     */
    announceChange: (message: string) => void;
  };

  /**
   * Utility functions
   */
  utils: {
    /**
     * Check if an element is focusable
     */
    isFocusable: (element: HTMLElement) => boolean;
    /**
     * Get all focusable elements in a container
     */
    getFocusableElements: (container: HTMLElement) => HTMLElement[];
    /**
     * Focus an element safely
     */
    focusElement: (element: HTMLElement, options?: { scroll?: boolean }) => void;
    /**
     * Get the next focusable element
     */
    getNextFocusableElement: (current: HTMLElement, direction: 'forward' | 'backward') => HTMLElement | null;
  };
}

const FocusManagementContext = createContext<FocusManagementContextValue | null>(null);

interface FocusManagementProviderProps {
  children: React.ReactNode;
  /**
   * Global focus management options
   */
  options?: {
    /**
     * Whether focus management is enabled globally
     */
    enabled?: boolean;
    /**
     * Default focus trap options
     */
    defaultTrapOptions?: Parameters<typeof useFocusTrap>[1];
    /**
     * Default focus restore options
     */
    defaultRestoreOptions?: Parameters<typeof useFocusRestore>[0];
    /**
     * Router focus options
     */
    routerFocusOptions?: Parameters<typeof useRouterFocus>[0];
    /**
     * Dynamic focus options
     */
    dynamicFocusOptions?: Parameters<typeof useDynamicFocus>[0];
  };
}

export const FocusManagementProvider: React.FC<FocusManagementProviderProps> = ({ 
  children, 
  options = {} 
}) => {
  const {
    enabled = true,
    defaultTrapOptions = {},
    defaultRestoreOptions = {},
    routerFocusOptions = {},
    dynamicFocusOptions = {},
  } = options;

  const globalTrapRef = useRef<HTMLElement | null>(null);
  const trapInstanceRef = useRef<ReturnType<typeof useFocusTrap> | null>(null);

  // Initialize individual focus management hooks
  const focusRestore = useFocusRestore({ ...defaultRestoreOptions, enabled });
  const focusVisible = useFocusVisible({ enabled });
  const routerFocus = useRouterFocus({ ...routerFocusOptions, enabled });
  const dynamicFocus = useDynamicFocus({ ...dynamicFocusOptions, enabled });

  /**
   * Create a focus trap instance
   */
  const createTrap = useCallback((
    containerRef: React.RefObject<HTMLElement>,
    options: Parameters<typeof useFocusTrap>[1] = {}
  ) => {
    const mergedOptions = { ...defaultTrapOptions, ...options };
    return useFocusTrap(containerRef, mergedOptions);
  }, [defaultTrapOptions]);

  /**
   * Activate global focus trap
   */
  const activateGlobalTrap = useCallback((element: HTMLElement) => {
    if (!enabled) return;

    globalTrapRef.current = element;
    const containerRef = { current: element };
    
    if (trapInstanceRef.current) {
      trapInstanceRef.current.deactivate();
    }

    trapInstanceRef.current = createTrap(containerRef, { active: true });
  }, [enabled, createTrap]);

  /**
   * Deactivate global focus trap
   */
  const deactivateGlobalTrap = useCallback(() => {
    if (trapInstanceRef.current) {
      trapInstanceRef.current.deactivate();
      trapInstanceRef.current = null;
    }
    globalTrapRef.current = null;
  }, []);

  /**
   * Check if an element is focusable
   */
  const isFocusable = useCallback((element: HTMLElement): boolean => {
    if (!element || !document.contains(element)) return false;

    const style = window.getComputedStyle(element);
    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      element.hasAttribute('inert') ||
      element.getAttribute('aria-hidden') === 'true'
    ) {
      return false;
    }

    if ('disabled' in element && (element as any).disabled) {
      return false;
    }

    const tabIndex = element.getAttribute('tabindex');
    if (tabIndex && parseInt(tabIndex, 10) < -1) {
      return false;
    }

    // Check if element is naturally focusable or has tabindex
    const focusableElements = [
      'a[href]', 'button', 'input', 'textarea', 'select', 
      'details', 'iframe', 'embed', 'object', 'audio[controls]', 
      'video[controls]', 'area[href]', 'summary'
    ];

    const tagName = element.tagName.toLowerCase();
    const isNaturallyFocusable = focusableElements.some(selector => 
      tagName === selector.split('[')[0]
    );

    const hasTabIndex = element.hasAttribute('tabindex') && parseInt(tabIndex || '0', 10) >= 0;
    const hasRole = element.hasAttribute('role');

    return isNaturallyFocusable || hasTabIndex || hasRole;
  }, []);

  /**
   * Get all focusable elements in a container
   */
  const getFocusableElements = useCallback((container: HTMLElement): HTMLElement[] => {
    const selector = [
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

    const elements = Array.from(container.querySelectorAll<HTMLElement>(selector));
    return elements.filter(element => isFocusable(element));
  }, [isFocusable]);

  /**
   * Focus an element safely
   */
  const focusElement = useCallback((
    element: HTMLElement, 
    options: { scroll?: boolean } = {}
  ) => {
    const { scroll = true } = options;

    if (!isFocusable(element)) {
      console.warn('Attempted to focus non-focusable element:', element);
      return;
    }

    try {
      element.focus({ preventScroll: !scroll });
      
      if (scroll) {
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'nearest',
        });
      }
    } catch (error) {
      console.error('Failed to focus element:', error, element);
    }
  }, [isFocusable]);

  /**
   * Get the next focusable element in the document
   */
  const getNextFocusableElement = useCallback((
    current: HTMLElement, 
    direction: 'forward' | 'backward'
  ): HTMLElement | null => {
    const focusableElements = getFocusableElements(document.body);
    const currentIndex = focusableElements.indexOf(current);
    
    if (currentIndex === -1) return null;

    let nextIndex: number;
    if (direction === 'forward') {
      nextIndex = (currentIndex + 1) % focusableElements.length;
    } else {
      nextIndex = currentIndex === 0 ? focusableElements.length - 1 : currentIndex - 1;
    }

    return focusableElements[nextIndex] || null;
  }, [getFocusableElements]);

  // Create context value
  const contextValue: FocusManagementContextValue = {
    focusTrap: {
      createTrap,
      isGlobalTrapActive: globalTrapRef.current !== null,
      activateGlobalTrap,
      deactivateGlobalTrap,
    },
    focusRestore: {
      captureFocus: focusRestore.captureFocus,
      restoreFocus: focusRestore.restoreFocus,
      resetState: focusRestore.resetFocusState,
    },
    focusVisible: {
      isFocusVisible: focusVisible.isFocusVisible,
      lastInteractionMode: focusVisible.lastInteractionMode,
      getFocusVisibleProps: focusVisible.getFocusVisibleProps,
    },
    routerFocus: {
      pathname: routerFocus.pathname,
      announceToScreenReader: routerFocus.announceToScreenReader,
      setCustomFocusTarget: routerFocus.setCustomFocusTarget,
    },
    dynamicFocus: {
      observeContainer: dynamicFocus.observeContainer,
      stopObserving: dynamicFocus.stopObserving,
      announceChange: dynamicFocus.announceToScreenReader,
    },
    utils: {
      isFocusable,
      getFocusableElements,
      focusElement,
      getNextFocusableElement,
    },
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      deactivateGlobalTrap();
    };
  }, [deactivateGlobalTrap]);

  return (
    <FocusManagementContext.Provider value={contextValue}>
      {children}
    </FocusManagementContext.Provider>
  );
};

/**
 * Hook to use focus management context
 */
export const useFocusManagement = (): FocusManagementContextValue => {
  const context = useContext(FocusManagementContext);
  if (!context) {
    throw new Error('useFocusManagement must be used within a FocusManagementProvider');
  }
  return context;
};

/**
 * HOC to add focus management to a component
 */
export const withFocusManagement = <P extends object>(
  Component: React.ComponentType<P>
) => {
  const WrappedComponent = (props: P) => {
    const focusManagement = useFocusManagement();
    return <Component {...props} focusManagement={focusManagement} />;
  };

  WrappedComponent.displayName = `withFocusManagement(${Component.displayName || Component.name})`;
  return WrappedComponent;
};

export default FocusManagementContext;