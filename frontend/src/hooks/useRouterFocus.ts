/**
 * useRouterFocus Hook
 * Manages focus during route changes in React Router
 * Ensures focus is handled appropriately for screen reader users and keyboard navigation
 */

import { useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';

interface RouteChangeAnnouncement {
  /**
   * The route path
   */
  path: string;
  /**
   * Human-readable page title or description
   */
  title: string;
  /**
   * Additional context for screen readers
   */
  context?: string;
}

interface RouterFocusOptions {
  /**
   * Whether router focus management is enabled
   */
  enabled?: boolean;
  /**
   * Selector for the main content area to focus
   */
  mainContentSelector?: string;
  /**
   * Selector for the page heading to focus
   */
  headingSelector?: string;
  /**
   * Whether to announce route changes to screen readers
   */
  announceRouteChanges?: boolean;
  /**
   * Custom function to determine focus target
   */
  getFocusTarget?: (pathname: string) => HTMLElement | string | null;
  /**
   * Custom function to generate route announcements
   */
  getRouteAnnouncement?: (pathname: string) => RouteChangeAnnouncement | null;
  /**
   * Delay before focusing (to allow DOM updates)
   */
  focusDelay?: number;
  /**
   * Whether to scroll to the focused element
   */
  scrollToFocus?: boolean;
}

/**
 * Default route announcements
 */
const DEFAULT_ROUTE_ANNOUNCEMENTS: Record<string, RouteChangeAnnouncement> = {
  '/': {
    path: '/',
    title: 'Dashboard',
    context: 'Main rover control dashboard loaded',
  },
  '/telemetry': {
    path: '/telemetry',
    title: 'Telemetry',
    context: 'Rover telemetry data page loaded',
  },
  '/commands': {
    path: '/commands',
    title: 'Command Center',
    context: 'Rover command center loaded',
  },
  '/hardware': {
    path: '/hardware',
    title: 'Hardware Diagnostics',
    context: 'Hardware diagnostics page loaded',
  },
  '/settings': {
    path: '/settings',
    title: 'Settings',
    context: 'Application settings page loaded',
  },
  '/emergency': {
    path: '/emergency',
    title: 'Emergency Control',
    context: 'Emergency control systems page loaded',
  },
};

/**
 * Hook to manage focus during route changes
 */
export const useRouterFocus = (options: RouterFocusOptions = {}) => {
  const {
    enabled = true,
    mainContentSelector = '[role="main"], main, #main-content',
    headingSelector = 'h1, [role="heading"][aria-level="1"]',
    announceRouteChanges = true,
    getFocusTarget,
    getRouteAnnouncement,
    focusDelay = 100,
    scrollToFocus = true,
  } = options;

  const location = useLocation();
  const previousPathname = useRef<string>('');
  const announceElementRef = useRef<HTMLElement | null>(null);

  /**
   * Create or get the announcement element for screen readers
   */
  const getAnnounceElement = useCallback((): HTMLElement => {
    if (announceElementRef.current) {
      return announceElementRef.current;
    }

    // Look for existing announcement element
    let element = document.getElementById('route-announcements');
    
    if (!element) {
      element = document.createElement('div');
      element.id = 'route-announcements';
      element.setAttribute('aria-live', 'assertive');
      element.setAttribute('aria-atomic', 'true');
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
   * Announce route change to screen readers
   */
  const announceRouteChange = useCallback((pathname: string) => {
    if (!announceRouteChanges || !enabled) return;

    const announcement = getRouteAnnouncement 
      ? getRouteAnnouncement(pathname)
      : DEFAULT_ROUTE_ANNOUNCEMENTS[pathname];

    if (announcement) {
      const announceElement = getAnnounceElement();
      const message = announcement.context 
        ? `${announcement.title}. ${announcement.context}`
        : `Navigated to ${announcement.title}`;
      
      // Clear and set the announcement
      announceElement.textContent = '';
      setTimeout(() => {
        announceElement.textContent = message;
      }, 50);
    }
  }, [announceRouteChanges, enabled, getRouteAnnouncement, getAnnounceElement]);

  /**
   * Find the best element to focus
   */
  const findFocusTarget = useCallback((pathname: string): HTMLElement | null => {
    // Use custom logic if provided
    if (getFocusTarget) {
      const target = getFocusTarget(pathname);
      if (typeof target === 'string') {
        return document.querySelector(target);
      }
      return target;
    }

    // Try to find the main heading first
    let target = document.querySelector<HTMLElement>(headingSelector);
    if (target && target.offsetParent !== null) {
      return target;
    }

    // Fall back to main content area
    target = document.querySelector<HTMLElement>(mainContentSelector);
    if (target && target.offsetParent !== null) {
      return target;
    }

    // Final fallback to body
    return document.body;
  }, [getFocusTarget, headingSelector, mainContentSelector]);

  /**
   * Focus an element with proper handling
   */
  const focusElement = useCallback((element: HTMLElement) => {
    if (!element) return;

    // Ensure the element is focusable
    if (!element.hasAttribute('tabindex') && element.tabIndex < 0) {
      element.setAttribute('tabindex', '-1');
    }

    // Focus the element
    element.focus();

    // Scroll to the element if requested
    if (scrollToFocus) {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
        inline: 'nearest',
      });
    }

    // Remove tabindex if we added it temporarily
    setTimeout(() => {
      if (element.getAttribute('tabindex') === '-1' && 
          element !== document.activeElement) {
        element.removeAttribute('tabindex');
      }
    }, 1000);
  }, [scrollToFocus]);

  /**
   * Handle route change
   */
  const handleRouteChange = useCallback((pathname: string) => {
    if (!enabled) return;

    // Don't handle if it's the same route
    if (pathname === previousPathname.current) return;

    previousPathname.current = pathname;

    // Announce route change
    announceRouteChange(pathname);

    // Focus appropriate element after a delay
    setTimeout(() => {
      const focusTarget = findFocusTarget(pathname);
      if (focusTarget) {
        focusElement(focusTarget);
      }
    }, focusDelay);
  }, [enabled, announceRouteChange, findFocusTarget, focusElement, focusDelay]);

  /**
   * Effect to handle location changes
   */
  useEffect(() => {
    handleRouteChange(location.pathname);
  }, [location.pathname, handleRouteChange]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (announceElementRef.current) {
        announceElementRef.current.remove();
        announceElementRef.current = null;
      }
    };
  }, []);

  /**
   * Manually trigger route focus handling
   */
  const triggerRouteFocus = useCallback((pathname?: string) => {
    const targetPath = pathname || location.pathname;
    handleRouteChange(targetPath);
  }, [location.pathname, handleRouteChange]);

  /**
   * Set a custom focus target for the current route
   */
  const setCustomFocusTarget = useCallback((selector: string | HTMLElement) => {
    setTimeout(() => {
      const element = typeof selector === 'string' 
        ? document.querySelector<HTMLElement>(selector)
        : selector;
      
      if (element) {
        focusElement(element);
      }
    }, focusDelay);
  }, [focusElement, focusDelay]);

  return {
    /**
     * Current pathname
     */
    pathname: location.pathname,
    /**
     * Previous pathname
     */
    previousPathname: previousPathname.current,
    /**
     * Manually trigger route focus handling
     */
    triggerRouteFocus,
    /**
     * Set a custom focus target
     */
    setCustomFocusTarget,
    /**
     * Announce a custom message to screen readers
     */
    announceToScreenReader: (message: string) => {
      if (announceRouteChanges && enabled) {
        const announceElement = getAnnounceElement();
        announceElement.textContent = '';
        setTimeout(() => {
          announceElement.textContent = message;
        }, 50);
      }
    },
  };
};

export default useRouterFocus;