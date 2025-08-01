/**
 * Tooltip Handler for interactive charts
 * Provides rich, accessible tooltips with smart positioning
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { createPortal } from 'react-dom';
import { TooltipConfig, TooltipData, TimeSeriesDataPoint } from './types';
import styled from 'styled-components';

// Styled tooltip container
const TooltipContainer = styled.div<{ x: number; y: number; visible: boolean }>`
  position: fixed;
  left: ${props => props.x}px;
  top: ${props => props.y}px;
  pointer-events: ${props => props.visible ? 'auto' : 'none'};
  opacity: ${props => props.visible ? 1 : 0};
  transform: translateY(${props => props.visible ? 0 : -10}px);
  transition: opacity 200ms ease-out, transform 200ms ease-out;
  z-index: 9999;
  max-width: 320px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
`;

const TooltipContent = styled.div`
  background: rgba(0, 0, 0, 0.9);
  color: white;
  padding: 12px 16px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
`;

const TooltipHeader = styled.div`
  font-size: 12px;
  font-weight: 600;
  color: #a0a0a0;
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const TooltipValue = styled.div`
  font-size: 18px;
  font-weight: 700;
  color: #ffffff;
  margin-bottom: 8px;
`;

const TooltipMetadata = styled.div`
  font-size: 12px;
  color: #d0d0d0;
  line-height: 1.4;
`;

const TooltipDivider = styled.hr`
  border: none;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  margin: 8px 0;
`;

const SeriesContainer = styled.div`
  margin: 4px 0;
`;

const SeriesIndicator = styled.span<{ color: string }>`
  display: inline-block;
  width: 12px;
  height: 12px;
  background-color: ${props => props.color};
  border-radius: 50%;
  margin-right: 8px;
  vertical-align: middle;
`;

interface TooltipHandlerProps extends TooltipConfig {
  containerRef: React.RefObject<SVGElement>;
  chartDimensions: { width: number; height: number; margin: any };
  xScale?: d3.ScaleTime<number, number> | d3.ScaleLinear<number, number>;
  yScale?: d3.ScaleLinear<number, number>;
  data?: TimeSeriesDataPoint[];
  multiSeries?: Record<string, TimeSeriesDataPoint[]>;
  seriesColors?: Record<string, string>;
}

export const TooltipHandler: React.FC<TooltipHandlerProps> = ({
  enabled = true,
  followCursor = true,
  offset = { x: 10, y: -10 },
  formatter,
  showDelay = 0,
  hideDelay = 200,
  interactive = false,
  maxWidth = 320,
  containerRef,
  chartDimensions,
  xScale,
  yScale,
  data = [],
  multiSeries,
  seriesColors = {}
}) => {
  const [tooltipData, setTooltipData] = useState<TooltipData | null>(null);
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const showTimeoutRef = useRef<NodeJS.Timeout>();
  const hideTimeoutRef = useRef<NodeJS.Timeout>();
  const tooltipRef = useRef<HTMLDivElement>(null);
  const bisectDate = d3.bisector<TimeSeriesDataPoint, Date>(d => d.time).left;

  /**
   * Find nearest data point to mouse position
   */
  const findNearestPoint = useCallback((mouseX: number, mouseY: number): TooltipData | null => {
    if (!xScale || !yScale || (!data.length && !multiSeries)) return null;

    // For time-based charts, use bisection
    if (xScale && 'invert' in xScale) {
      const xDate = xScale.invert(mouseX);
      
      if (multiSeries) {
        // Multi-series: find nearest point in each series
        const seriesData: TimeSeriesDataPoint[] = [];
        const seriesNames: string[] = [];
        
        Object.entries(multiSeries).forEach(([name, series]) => {
          if (series.length > 0) {
            const index = bisectDate(series, xDate as Date, 1);
            const d0 = series[index - 1];
            const d1 = series[index];
            
            if (d0 && d1) {
              const point = xDate.getTime() - d0.time.getTime() > d1.time.getTime() - xDate.getTime() ? d1 : d0;
              seriesData.push(point);
              seriesNames.push(name);
            } else if (d0) {
              seriesData.push(d0);
              seriesNames.push(name);
            }
          }
        });
        
        if (seriesData.length > 0) {
          return {
            x: mouseX,
            y: mouseY,
            data: seriesData,
            series: seriesNames,
            timestamp: seriesData[0].time
          };
        }
      } else if (data.length > 0) {
        // Single series
        const index = bisectDate(data, xDate as Date, 1);
        const d0 = data[index - 1];
        const d1 = data[index];
        
        let nearestPoint: TimeSeriesDataPoint;
        if (!d0) {
          nearestPoint = d1;
        } else if (!d1) {
          nearestPoint = d0;
        } else {
          nearestPoint = xDate.getTime() - d0.time.getTime() > d1.time.getTime() - xDate.getTime() ? d1 : d0;
        }
        
        if (nearestPoint) {
          return {
            x: xScale(nearestPoint.time) as number,
            y: yScale(nearestPoint.value),
            data: nearestPoint,
            timestamp: nearestPoint.time
          };
        }
      }
    }
    
    return null;
  }, [xScale, yScale, data, multiSeries, bisectDate]);

  /**
   * Calculate tooltip position to avoid edge clipping
   */
  const calculatePosition = useCallback((mouseX: number, mouseY: number): { x: number; y: number } => {
    const tooltipWidth = tooltipRef.current?.offsetWidth || 200;
    const tooltipHeight = tooltipRef.current?.offsetHeight || 100;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    let x = mouseX + offset.x;
    let y = mouseY + offset.y;
    
    // Horizontal adjustment
    if (x + tooltipWidth > windowWidth - 20) {
      x = mouseX - tooltipWidth - offset.x;
    }
    
    // Vertical adjustment
    if (y + tooltipHeight > windowHeight - 20) {
      y = mouseY - tooltipHeight - offset.y;
    }
    
    // Ensure tooltip stays within viewport
    x = Math.max(10, Math.min(x, windowWidth - tooltipWidth - 10));
    y = Math.max(10, Math.min(y, windowHeight - tooltipHeight - 10));
    
    return { x, y };
  }, [offset]);

  /**
   * Handle mouse move
   */
  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!enabled || !containerRef.current) return;
    
    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    const mouseX = event.clientX - rect.left - chartDimensions.margin.left;
    const mouseY = event.clientY - rect.top - chartDimensions.margin.top;
    
    // Check if mouse is within chart area
    if (mouseX < 0 || mouseX > chartDimensions.width - chartDimensions.margin.left - chartDimensions.margin.right ||
        mouseY < 0 || mouseY > chartDimensions.height - chartDimensions.margin.top - chartDimensions.margin.bottom) {
      handleMouseLeave();
      return;
    }
    
    const nearestData = findNearestPoint(mouseX, mouseY);
    
    if (nearestData) {
      // Clear hide timeout
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
      
      // Set or update tooltip data
      setTooltipData(nearestData);
      
      // Update position
      if (followCursor) {
        setPosition(calculatePosition(event.clientX, event.clientY));
      } else {
        const chartX = rect.left + chartDimensions.margin.left + nearestData.x;
        const chartY = rect.top + chartDimensions.margin.top + nearestData.y;
        setPosition(calculatePosition(chartX, chartY));
      }
      
      // Show tooltip with delay
      if (!visible) {
        if (showDelay > 0) {
          showTimeoutRef.current = setTimeout(() => {
            setVisible(true);
          }, showDelay);
        } else {
          setVisible(true);
        }
      }
    }
  }, [enabled, containerRef, chartDimensions, findNearestPoint, followCursor, calculatePosition, visible, showDelay]);

  /**
   * Handle mouse leave
   */
  const handleMouseLeave = useCallback(() => {
    // Clear show timeout
    if (showTimeoutRef.current) {
      clearTimeout(showTimeoutRef.current);
    }
    
    // Hide tooltip with delay
    hideTimeoutRef.current = setTimeout(() => {
      setVisible(false);
      setTooltipData(null);
    }, hideDelay);
  }, [hideDelay]);

  /**
   * Setup event listeners
   */
  useEffect(() => {
    if (!enabled || !containerRef.current) return;
    
    const container = containerRef.current;
    
    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseleave', handleMouseLeave);
    
    // Keyboard support
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && visible) {
        setVisible(false);
        setTooltipData(null);
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('keydown', handleKeyDown);
      
      if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, [enabled, containerRef, handleMouseMove, handleMouseLeave, visible]);

  /**
   * Default formatter
   */
  const defaultFormatter = (data: TooltipData): React.ReactNode => {
    if (!data.data) return null;
    
    const formatValue = (value: number): string => {
      if (Math.abs(value) >= 1000000) {
        return `${(value / 1000000).toFixed(2)}M`;
      } else if (Math.abs(value) >= 1000) {
        return `${(value / 1000).toFixed(2)}K`;
      }
      return value.toFixed(2);
    };
    
    const formatTime = (date: Date): string => {
      return new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        fractionalSecondDigits: 3
      }).format(date);
    };
    
    if (Array.isArray(data.data)) {
      // Multi-series tooltip
      return (
        <>
          <TooltipHeader>{formatTime(data.timestamp!)}</TooltipHeader>
          <TooltipDivider />
          {data.data.map((point, index) => {
            const seriesName = data.series?.[index] || `Series ${index + 1}`;
            const color = seriesColors[seriesName] || '#2196f3';
            
            return (
              <SeriesContainer key={seriesName}>
                <SeriesIndicator color={color} />
                <span style={{ fontSize: '14px' }}>
                  {seriesName}: <strong>{formatValue(point.value)}</strong>
                </span>
              </SeriesContainer>
            );
          })}
        </>
      );
    } else {
      // Single series tooltip
      const point = data.data as TimeSeriesDataPoint;
      return (
        <>
          <TooltipHeader>{formatTime(point.time)}</TooltipHeader>
          <TooltipValue>{formatValue(point.value)}</TooltipValue>
          {point.metadata && Object.keys(point.metadata).length > 0 && (
            <>
              <TooltipDivider />
              <TooltipMetadata>
                {Object.entries(point.metadata).map(([key, value]) => (
                  <div key={key}>
                    {key}: {String(value)}
                  </div>
                ))}
              </TooltipMetadata>
            </>
          )}
        </>
      );
    }
  };

  if (!enabled || !tooltipData) return null;

  return createPortal(
    <TooltipContainer
      ref={tooltipRef}
      x={position.x}
      y={position.y}
      visible={visible}
      style={{ maxWidth }}
      role="tooltip"
      aria-live="polite"
      onMouseEnter={() => {
        if (interactive && hideTimeoutRef.current) {
          clearTimeout(hideTimeoutRef.current);
        }
      }}
      onMouseLeave={() => {
        if (interactive) {
          handleMouseLeave();
        }
      }}
    >
      <TooltipContent>
        {formatter ? formatter(tooltipData) : defaultFormatter(tooltipData)}
      </TooltipContent>
    </TooltipContainer>,
    document.body
  );
};

/**
 * Hook for managing tooltip state
 */
export const useTooltip = (config: TooltipConfig = {}) => {
  const [tooltipProps, setTooltipProps] = useState<Partial<TooltipHandlerProps>>({});
  
  const showTooltip = useCallback((data: TooltipData) => {
    setTooltipProps(prev => ({ ...prev, tooltipData: data, visible: true }));
  }, []);
  
  const hideTooltip = useCallback(() => {
    setTooltipProps(prev => ({ ...prev, visible: false }));
  }, []);
  
  const updateTooltipData = useCallback((data: Partial<TooltipHandlerProps>) => {
    setTooltipProps(prev => ({ ...prev, ...data }));
  }, []);
  
  return {
    tooltipProps: { ...config, ...tooltipProps },
    showTooltip,
    hideTooltip,
    updateTooltipData
  };
};