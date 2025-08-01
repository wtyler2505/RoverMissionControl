/**
 * ThresholdOverlay Component
 * Renders threshold lines, bands, and zones on D3.js charts with real-time updates
 */

import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import { useTheme } from '@mui/material/styles';
import { Box } from '@mui/material';
import { 
  ThresholdOverlayProps, 
  ThresholdDefinition, 
  ThresholdVisualization,
  AlertInstance 
} from '../types/threshold-types';

const SEVERITY_COLORS = {
  info: '#2196f3',
  warning: '#ff9800',
  error: '#f44336',
  critical: '#9c27b0'
};

const ANIMATION_DURATION = 300;
const CONFIDENCE_INTERVAL_OPACITY = 0.2;

export const ThresholdOverlay: React.FC<ThresholdOverlayProps> = ({
  thresholds,
  alerts,
  data,
  dimensions,
  scales,
  animationEnabled = true,
  interactiveEnabled = true,
  showConfidenceIntervals = false,
  onThresholdClick,
  onThresholdHover,
  className
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const theme = useTheme();
  
  // Calculate dynamic thresholds based on data
  const calculatedThresholds = useMemo(() => {
    return thresholds.map(threshold => {
      let calculatedValue = threshold.value;
      let confidenceInterval: [number, number] | undefined;
      
      if (threshold.type === 'dynamic_percentile' || threshold.type === 'dynamic_stddev') {
        const values = data.slice(-Math.max(threshold.minDataPoints || 50, 50))
          .map(d => typeof d.y === 'number' ? d.y : d.value)
          .filter(v => typeof v === 'number');
          
        if (values.length >= (threshold.minDataPoints || 10)) {
          if (threshold.type === 'dynamic_percentile') {
            const percentile = threshold.percentile || 95;
            values.sort((a, b) => a - b);
            const index = Math.floor((percentile / 100) * values.length);
            calculatedValue = values[Math.min(index, values.length - 1)];
            
            // Calculate confidence interval
            if (showConfidenceIntervals) {
              const lowerIndex = Math.floor((Math.max(percentile - 5, 0) / 100) * values.length);
              const upperIndex = Math.floor((Math.min(percentile + 5, 100) / 100) * values.length);
              confidenceInterval = [
                values[Math.min(lowerIndex, values.length - 1)],
                values[Math.min(upperIndex, values.length - 1)]
              ];
            }
          } else if (threshold.type === 'dynamic_stddev') {
            const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
            const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
            const stdDev = Math.sqrt(variance);
            const multiplier = threshold.stddevMultiplier || 2;
            calculatedValue = mean + multiplier * stdDev;
            
            // Calculate confidence interval
            if (showConfidenceIntervals) {
              confidenceInterval = [
                mean + (multiplier - 0.5) * stdDev,
                mean + (multiplier + 0.5) * stdDev
              ];
            }
          }
        }
      } else if (threshold.type === 'rate_of_change') {
        // Calculate rate of change threshold
        const recentValues = data.slice(-10).map(d => typeof d.y === 'number' ? d.y : d.value);
        if (recentValues.length >= 2) {
          const rates = [];
          for (let i = 1; i < recentValues.length; i++) {
            rates.push(Math.abs(recentValues[i] - recentValues[i - 1]));
          }
          const avgRate = rates.reduce((sum, r) => sum + r, 0) / rates.length;
          calculatedValue = avgRate * (threshold.stddevMultiplier || 2);
        }
      }
      
      return {
        ...threshold,
        calculatedValue,
        confidenceInterval
      };
    });
  }, [thresholds, data, showConfidenceIntervals]);
  
  // Render threshold visualization
  const renderThresholds = useCallback(() => {
    if (!svgRef.current || !scales.x || !scales.y) return;
    
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    
    // Create groups for different threshold elements
    const defsGroup = svg.append('defs');
    const backgroundGroup = svg.append('g').attr('class', 'threshold-backgrounds');
    const lineGroup = svg.append('g').attr('class', 'threshold-lines');
    const labelGroup = svg.append('g').attr('class', 'threshold-labels');
    const alertGroup = svg.append('g').attr('class', 'alert-indicators');
    
    calculatedThresholds.forEach((threshold, index) => {
      if (!threshold.enabled) return;
      
      const color = threshold.color || SEVERITY_COLORS[threshold.severity];
      const value = threshold.calculatedValue ?? threshold.value;
      if (value === undefined) return;
      
      const yPos = scales.y(value);
      if (isNaN(yPos)) return;
      
      // Create gradient if needed
      if (threshold.fill && threshold.type === 'static') {
        const gradientId = `threshold-gradient-${threshold.id}`;
        const gradient = defsGroup.append('linearGradient')
          .attr('id', gradientId)
          .attr('gradientUnits', 'userSpaceOnUse')
          .attr('x1', 0)
          .attr('y1', yPos)
          .attr('x2', 0)
          .attr('y2', dimensions.height);
          
        gradient.append('stop')
          .attr('offset', '0%')
          .attr('stop-color', color)
          .attr('stop-opacity', threshold.fillOpacity || 0.3);
          
        gradient.append('stop')
          .attr('offset', '100%')
          .attr('stop-color', color)
          .attr('stop-opacity', 0);
      }
      
      // Render range thresholds (bands/zones)
      if (threshold.upperBound !== undefined && threshold.lowerBound !== undefined) {
        const upperY = scales.y(threshold.upperBound);
        const lowerY = scales.y(threshold.lowerBound);
        
        if (!isNaN(upperY) && !isNaN(lowerY)) {
          const bandHeight = Math.abs(lowerY - upperY);
          const bandY = Math.min(upperY, lowerY);
          
          const band = backgroundGroup.append('rect')
            .attr('class', `threshold-band threshold-${threshold.severity}`)
            .attr('x', 0)
            .attr('y', bandY)
            .attr('width', dimensions.width)
            .attr('height', bandHeight)
            .attr('fill', threshold.operator === 'in_range' ? 
              d3.color('#4caf50')?.copy({opacity: 0.1}).toString() : 
              d3.color(color)?.copy({opacity: 0.1}).toString())
            .attr('stroke', color)
            .attr('stroke-width', 1)
            .attr('stroke-dasharray', threshold.style === 'dashed' ? '5,5' : 
                                     threshold.style === 'dotted' ? '2,2' : 'none');
          
          if (interactiveEnabled) {
            band
              .style('cursor', 'pointer')
              .on('click', (event) => onThresholdClick?.(threshold, event))
              .on('mouseenter', (event) => onThresholdHover?.(threshold, event))
              .on('mouseleave', (event) => onThresholdHover?.(null, event));
          }
          
          if (animationEnabled) {
            band.attr('opacity', 0)
              .transition()
              .duration(ANIMATION_DURATION)
              .attr('opacity', 1);
          }
        }
      }
      
      // Render confidence interval if available
      if (threshold.confidenceInterval && showConfidenceIntervals) {
        const [lower, upper] = threshold.confidenceInterval;
        const lowerY = scales.y(lower);
        const upperY = scales.y(upper);
        
        if (!isNaN(lowerY) && !isNaN(upperY)) {
          const confidenceBand = backgroundGroup.append('rect')
            .attr('class', 'threshold-confidence-interval')
            .attr('x', 0)
            .attr('y', Math.min(upperY, lowerY))
            .attr('width', dimensions.width)
            .attr('height', Math.abs(upperY - lowerY))
            .attr('fill', color)
            .attr('opacity', CONFIDENCE_INTERVAL_OPACITY)
            .attr('stroke', color)
            .attr('stroke-width', 1)
            .attr('stroke-dasharray', '3,3');
            
          if (animationEnabled) {
            confidenceBand.attr('opacity', 0)
              .transition()
              .duration(ANIMATION_DURATION)
              .attr('opacity', CONFIDENCE_INTERVAL_OPACITY);
          }
        }
      }
      
      // Render threshold line
      const line = lineGroup.append('line')
        .attr('class', `threshold-line threshold-${threshold.severity}`)
        .attr('x1', 0)
        .attr('y1', yPos)
        .attr('x2', dimensions.width)
        .attr('y2', yPos)
        .attr('stroke', color)
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', threshold.style === 'dashed' ? '8,4' : 
                                 threshold.style === 'dotted' ? '2,2' : 'none');
      
      if (interactiveEnabled) {
        line
          .style('cursor', 'pointer')
          .on('click', (event) => onThresholdClick?.(threshold, event))
          .on('mouseenter', (event) => onThresholdHover?.(threshold, event))
          .on('mouseleave', (event) => onThresholdHover?.(null, event));
      }
      
      if (animationEnabled) {
        line.attr('opacity', 0)
          .transition()
          .duration(ANIMATION_DURATION)
          .delay(index * 50)
          .attr('opacity', 1);
      }
      
      // Add hysteresis band if configured
      if (threshold.hysteresis && threshold.hysteresis > 0) {
        const hysteresisUpper = scales.y(value + threshold.hysteresis);
        const hysteresisLower = scales.y(value - threshold.hysteresis);
        
        if (!isNaN(hysteresisUpper) && !isNaN(hysteresisLower)) {
          backgroundGroup.append('rect')
            .attr('class', 'threshold-hysteresis')
            .attr('x', 0)
            .attr('y', Math.min(hysteresisUpper, hysteresisLower))
            .attr('width', dimensions.width)
            .attr('height', Math.abs(hysteresisUpper - hysteresisLower))
            .attr('fill', color)
            .attr('opacity', 0.05)
            .attr('stroke', color)
            .attr('stroke-width', 1)
            .attr('stroke-dasharray', '1,2');
        }
      }
      
      // Render threshold label
      if (threshold.showLabel !== false) {
        const labelText = threshold.name + (threshold.showValue !== false && value !== undefined ? 
          ` (${value.toFixed(2)})` : '');
        
        const label = labelGroup.append('g')
          .attr('class', 'threshold-label');
          
        const labelBg = label.append('rect')
          .attr('class', 'threshold-label-background')
          .attr('fill', theme.palette.background.paper)
          .attr('stroke', color)
          .attr('stroke-width', 1)
          .attr('rx', 4)
          .attr('ry', 4)
          .attr('opacity', 0.9);
          
        const labelTextElement = label.append('text')
          .attr('class', 'threshold-label-text')
          .attr('x', dimensions.width - 10)
          .attr('y', yPos)
          .attr('text-anchor', 'end')
          .attr('dominant-baseline', 'middle')
          .attr('fill', color)
          .attr('font-size', '11px')
          .attr('font-weight', 'bold')
          .text(labelText);
        
        // Size background to fit text
        const bbox = (labelTextElement.node() as SVGTextElement)?.getBBox();
        if (bbox) {
          labelBg
            .attr('x', bbox.x - 4)
            .attr('y', bbox.y - 2)
            .attr('width', bbox.width + 8)
            .attr('height', bbox.height + 4);
        }
        
        if (animationEnabled) {
          label.attr('opacity', 0)
            .transition()
            .duration(ANIMATION_DURATION)
            .delay(index * 50 + 100)
            .attr('opacity', 1);
        }
      }
    });
    
    // Render alert indicators
    if (alerts.length > 0) {
      const visibleAlerts = alerts.filter(alert => {
        // Find corresponding data point
        const alertTime = alert.timestamp.getTime();
        const dataPoint = data.find(d => {
          const dataTime = (d.time || d.x || d.timestamp)?.getTime();
          return dataTime && Math.abs(dataTime - alertTime) < 60000; // Within 1 minute
        });
        return dataPoint !== undefined;
      });
      
      visibleAlerts.forEach((alert, index) => {
        const alertTime = alert.timestamp;
        const xPos = scales.x(alertTime);
        const yPos = scales.y(alert.value);
        
        if (isNaN(xPos) || isNaN(yPos)) return;
        
        const alertColor = SEVERITY_COLORS[alert.severity];
        
        // Alert marker
        const alertMarker = alertGroup.append('g')
          .attr('class', `alert-marker alert-${alert.severity}`)
          .attr('transform', `translate(${xPos}, ${yPos})`);
          
        // Alert circle
        const circle = alertMarker.append('circle')
          .attr('r', alert.severity === 'critical' ? 8 : 6)
          .attr('fill', alertColor)
          .attr('stroke', theme.palette.background.paper)
          .attr('stroke-width', 2);
          
        // Alert icon
        alertMarker.append('text')
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .attr('fill', 'white')
          .attr('font-size', alert.severity === 'critical' ? '10px' : '8px')
          .attr('font-weight', 'bold')
          .text('!');
        
        // Pulsing animation for unacknowledged critical alerts
        if (alert.severity === 'critical' && !alert.acknowledged) {
          const pulse = alertMarker.append('circle')
            .attr('r', 8)
            .attr('fill', 'none')
            .attr('stroke', alertColor)
            .attr('stroke-width', 2)
            .attr('opacity', 0.8);
            
          pulse.transition()
            .duration(1000)
            .ease(d3.easeLinear)
            .attr('r', 16)
            .attr('opacity', 0)
            .on('end', function() {
              d3.select(this).remove();
            });
        }
        
        if (interactiveEnabled) {
          alertMarker
            .style('cursor', 'pointer')
            .on('click', (event) => {
              event.stopPropagation();
              // Custom alert click handling could be added here
            });
        }
        
        if (animationEnabled) {
          alertMarker.attr('opacity', 0)
            .transition()
            .duration(ANIMATION_DURATION)
            .delay(index * 25)
            .attr('opacity', 1);
        }
      });
    }
  }, [calculatedThresholds, alerts, data, dimensions, scales, animationEnabled, interactiveEnabled, showConfidenceIntervals, onThresholdClick, onThresholdHover, theme]);
  
  // Update when dependencies change
  useEffect(() => {
    renderThresholds();
  }, [renderThresholds]);
  
  return (
    <Box
      className={className}
      sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: interactiveEnabled ? 'auto' : 'none',
        '& .threshold-line': {
          transition: animationEnabled ? 'opacity 0.3s ease-in-out' : 'none',
        },
        '& .threshold-label': {
          transition: animationEnabled ? 'opacity 0.3s ease-in-out' : 'none',
        },
        '& .alert-marker': {
          transition: animationEnabled ? 'opacity 0.3s ease-in-out' : 'none',
        }
      }}
    >
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        style={{ 
          position: 'absolute',
          top: 0,
          left: 0,
          overflow: 'visible'
        }}
        role="img"
        aria-label="Threshold overlay with alert indicators"
      />
    </Box>
  );
};

export default ThresholdOverlay;