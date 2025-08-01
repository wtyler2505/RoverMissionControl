/**
 * Virtualization Components Export
 * High-performance virtualization components for large datasets
 * 
 * Performance Benefits:
 * - Handles 10,000+ items without performance degradation
 * - Reduces DOM nodes by 90%+ for large lists
 * - Maintains 60fps scrolling performance
 * - Preserves accessibility features
 */

// Core virtualization components
export { default as VirtualizedList } from './VirtualizedList';
export type { 
  VirtualizedListProps, 
  VirtualizedListItem, 
  VirtualizedListRef 
} from './VirtualizedList';

export { default as VirtualizedTable } from './VirtualizedTable';
export type { 
  VirtualizedTableProps, 
  VirtualizedTableRow, 
  VirtualizedTableRef,
  TableColumn 
} from './VirtualizedTable';

// Specialized virtualized components
export { default as VirtualizedCommunicationLogViewer } from '../CommunicationLogs/VirtualizedCommunicationLogViewer';
export { default as VirtualizedAlertHistoryPanel } from '../ui/core/Alert/VirtualizedAlertHistoryPanel';
export { default as VirtualizedHALDeviceList } from '../HAL/VirtualizedHALDeviceList';

// Utility hooks and functions
export const VirtualizationUtils = {
  /**
   * Calculate optimal item height based on content
   */
  calculateItemHeight: (content: string, containerWidth: number, fontSize: number = 14): number => {
    const wordsPerLine = Math.floor(containerWidth / (fontSize * 0.6));
    const words = content.split(' ').length;
    const lines = Math.ceil(words / wordsPerLine);
    return Math.max(lines * (fontSize * 1.4) + 32, 48); // 32px padding, 48px minimum
  },

  /**
   * Estimate memory usage for virtualized list
   */
  estimateMemoryUsage: (totalItems: number, renderedItems: number, itemSize: number): string => {
    const totalMemory = totalItems * itemSize * 0.001; // Rough estimate in KB
    const renderedMemory = renderedItems * itemSize * 0.001;
    const savings = ((totalMemory - renderedMemory) / totalMemory * 100).toFixed(1);
    return `Rendered: ${renderedMemory.toFixed(1)}KB / Total: ${totalMemory.toFixed(1)}KB (${savings}% saved)`;
  },

  /**
   * Performance thresholds for when to use virtualization
   */
  shouldVirtualize: (itemCount: number, estimatedItemHeight: number = 50): boolean => {
    const estimatedHeight = itemCount * estimatedItemHeight;
    const viewportHeight = window.innerHeight;
    
    // Virtualize if content would be more than 5x viewport height or more than 100 items
    return estimatedHeight > viewportHeight * 5 || itemCount > 100;
  },

  /**
   * Optimal overscan count based on item count and performance requirements
   */
  getOptimalOverscan: (itemCount: number, performance: 'low' | 'medium' | 'high' = 'medium'): number => {
    const baseScan = {
      low: 2,
      medium: 5,
      high: 10,
    }[performance];

    // Reduce overscan for very large lists to maintain performance
    if (itemCount > 10000) return Math.max(1, Math.floor(baseScan / 2));
    if (itemCount > 1000) return baseScan;
    return baseScan * 2; // Increase for smaller lists for smoother scrolling
  },
};

// Export constants for consistent configuration
export const VIRTUALIZATION_CONSTANTS = {
  DEFAULT_ITEM_HEIGHT: 50,
  DEFAULT_OVERSCAN_COUNT: 5,
  MAX_SAFE_ITEMS_WITHOUT_VIRTUALIZATION: 100,
  GRID_DEFAULT_COLUMN_WIDTH: 300,
  TABLE_DEFAULT_ROW_HEIGHT: 52,
  TABLE_DEFAULT_HEADER_HEIGHT: 56,
  
  // Performance thresholds
  PERFORMANCE_THRESHOLDS: {
    SMALL_LIST: 50,
    MEDIUM_LIST: 500,
    LARGE_LIST: 5000,
    MASSIVE_LIST: 50000,
  },
  
  // Accessibility settings
  ACCESSIBILITY: {
    ANNOUNCE_THROTTLE_MS: 500, // Throttle screen reader announcements
    FOCUS_RESTORATION_DELAY_MS: 100,
    KEYBOARD_NAVIGATION_BUFFER: 3, // Items to keep in DOM for keyboard nav
  },
} as const;