/**
 * ResponsiveContainer Component
 * Provides automatic resizing for charts with debouncing and aspect ratio support
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Box } from '@mui/material';
import { ResponsiveContainerProps, ChartDimensions } from '../types';
import { useComponentPerformanceTracking } from '../../../hooks/usePerformanceMonitoring';

const DEFAULT_DEBOUNCE_TIME = 150;
const DEFAULT_MARGIN = {
  top: 20,
  right: 80,
  bottom: 50,
  left: 70
};

export const ResponsiveContainer: React.FC<ResponsiveContainerProps> = ({
  children,
  aspectRatio,
  minHeight = 200,
  maxHeight,
  debounceTime = DEFAULT_DEBOUNCE_TIME,
  className
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState<ChartDimensions>({
    width: 0,
    height: 0,
    margin: DEFAULT_MARGIN
  });
  const resizeTimeoutRef = useRef<NodeJS.Timeout>();
  const { startTracking, endTracking } = useComponentPerformanceTracking('ResponsiveContainer');

  /**
   * Calculate dimensions based on container size and constraints
   */
  const calculateDimensions = useCallback(() => {
    if (!containerRef.current) return;

    const { width: containerWidth } = containerRef.current.getBoundingClientRect();
    
    if (containerWidth === 0) return;

    let height: number;

    if (aspectRatio) {
      // Calculate height based on aspect ratio
      height = containerWidth / aspectRatio;
    } else {
      // Use container height or default
      const containerHeight = containerRef.current.offsetHeight;
      height = containerHeight > 0 ? containerHeight : 400;
    }

    // Apply min/max constraints
    height = Math.max(minHeight, height);
    if (maxHeight) {
      height = Math.min(maxHeight, height);
    }

    // Calculate inner dimensions (excluding margins)
    const innerWidth = containerWidth - DEFAULT_MARGIN.left - DEFAULT_MARGIN.right;
    const innerHeight = height - DEFAULT_MARGIN.top - DEFAULT_MARGIN.bottom;

    const newDimensions: ChartDimensions = {
      width: Math.floor(containerWidth),
      height: Math.floor(height),
      margin: DEFAULT_MARGIN
    };

    // Only update if dimensions actually changed
    if (
      newDimensions.width !== dimensions.width ||
      newDimensions.height !== dimensions.height
    ) {
      startTracking();
      setDimensions(newDimensions);
      endTracking();
    }
  }, [aspectRatio, minHeight, maxHeight, dimensions.width, dimensions.height, startTracking, endTracking]);

  /**
   * Handle resize with debouncing
   */
  const handleResize = useCallback(() => {
    if (resizeTimeoutRef.current) {
      clearTimeout(resizeTimeoutRef.current);
    }

    resizeTimeoutRef.current = setTimeout(() => {
      calculateDimensions();
    }, debounceTime);
  }, [calculateDimensions, debounceTime]);

  /**
   * Setup ResizeObserver
   */
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === containerRef.current) {
          handleResize();
        }
      }
    });

    resizeObserver.observe(containerRef.current);

    // Initial dimension calculation
    calculateDimensions();

    // Cleanup
    return () => {
      resizeObserver.disconnect();
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, [handleResize, calculateDimensions]);

  /**
   * Fallback to window resize event for older browsers
   */
  useEffect(() => {
    if (!window.ResizeObserver) {
      window.addEventListener('resize', handleResize);
      return () => {
        window.removeEventListener('resize', handleResize);
      };
    }
  }, [handleResize]);

  // Don't render children until we have valid dimensions
  if (dimensions.width === 0 || dimensions.height === 0) {
    return (
      <Box
        ref={containerRef}
        className={className}
        sx={{
          width: '100%',
          height: aspectRatio ? 'auto' : '100%',
          minHeight: `${minHeight}px`,
          maxHeight: maxHeight ? `${maxHeight}px` : undefined,
          position: 'relative'
        }}
      />
    );
  }

  return (
    <Box
      ref={containerRef}
      className={className}
      sx={{
        width: '100%',
        height: aspectRatio ? `${dimensions.height}px` : '100%',
        minHeight: `${minHeight}px`,
        maxHeight: maxHeight ? `${maxHeight}px` : undefined,
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {children(dimensions)}
    </Box>
  );
};

/**
 * Hook for responsive dimensions
 */
export const useResponsiveDimensions = (
  aspectRatio?: number,
  minHeight = 200,
  maxHeight?: number,
  debounceTime = DEFAULT_DEBOUNCE_TIME
): [ChartDimensions, React.RefObject<HTMLDivElement>] => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState<ChartDimensions>({
    width: 0,
    height: 0,
    margin: DEFAULT_MARGIN
  });
  const resizeTimeoutRef = useRef<NodeJS.Timeout>();

  const calculateDimensions = useCallback(() => {
    if (!containerRef.current) return;

    const { width: containerWidth } = containerRef.current.getBoundingClientRect();
    
    if (containerWidth === 0) return;

    let height: number;

    if (aspectRatio) {
      height = containerWidth / aspectRatio;
    } else {
      const containerHeight = containerRef.current.offsetHeight;
      height = containerHeight > 0 ? containerHeight : 400;
    }

    height = Math.max(minHeight, height);
    if (maxHeight) {
      height = Math.min(maxHeight, height);
    }

    setDimensions({
      width: Math.floor(containerWidth),
      height: Math.floor(height),
      margin: DEFAULT_MARGIN
    });
  }, [aspectRatio, minHeight, maxHeight]);

  const handleResize = useCallback(() => {
    if (resizeTimeoutRef.current) {
      clearTimeout(resizeTimeoutRef.current);
    }

    resizeTimeoutRef.current = setTimeout(() => {
      calculateDimensions();
    }, debounceTime);
  }, [calculateDimensions, debounceTime]);

  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });

    resizeObserver.observe(containerRef.current);
    calculateDimensions();

    return () => {
      resizeObserver.disconnect();
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, [handleResize, calculateDimensions]);

  return [dimensions, containerRef];
};

export default ResponsiveContainer;