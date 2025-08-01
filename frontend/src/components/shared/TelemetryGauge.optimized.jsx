import React, { useEffect, useMemo, useCallback } from 'react';
import { accessibility } from '../../utils/accessibility';

/**
 * Optimized Telemetry Gauge Component with comprehensive memoization
 * Performance optimizations:
 * - Memoized expensive calculations (percentage, angle, colors)
 * - Cached SVG path calculations
 * - Optimized accessibility updates
 * - Selective re-rendering based on significant value changes
 */
const TelemetryGaugeOptimized = React.memo(({ 
  value, 
  min, 
  max, 
  unit, 
  label, 
  type = "normal",
  precision = 1,
  threshold = 0.1 // Minimum change required for re-render
}) => {
  
  // Memoize expensive calculations
  const calculations = useMemo(() => {
    const safeValue = Math.max(min, Math.min(max, value || 0));
    const percentage = Math.max(0, Math.min(100, ((safeValue - min) / (max - min)) * 100));
    const angle = (percentage / 100) * 180 - 90;
    
    return {
      safeValue,
      percentage,
      angle,
      displayValue: typeof safeValue === 'number' ? safeValue.toFixed(precision) : safeValue
    };
  }, [value, min, max, precision]);
  
  // Memoize status determination logic
  const statusInfo = useMemo(() => {
    const { percentage } = calculations;
    let colorClass = "gauge-normal";
    let statusText = "normal";
    
    if (type === "battery") {
      if (percentage > 60) {
        colorClass = "gauge-good";
        statusText = "good";
      } else if (percentage > 30) {
        colorClass = "gauge-warning";
        statusText = "low";
      } else {
        colorClass = "gauge-critical";
        statusText = "critical";
      }
    } else if (type === "temperature") {
      if (percentage < 70) {
        colorClass = "gauge-good";
        statusText = "normal";
      } else if (percentage < 85) {
        colorClass = "gauge-warning";
        statusText = "elevated";
      } else {
        colorClass = "gauge-critical";
        statusText = "overheating";
      }
    } else if (type === "latency") {
      if (percentage < 50) {
        colorClass = "gauge-good";
        statusText = "excellent";
      } else if (percentage < 75) {
        colorClass = "gauge-warning";
        statusText = "moderate";
      } else {
        colorClass = "gauge-critical";
        statusText = "high";
      }
    }
    
    return { colorClass, statusText };
  }, [calculations.percentage, type]);
  
  // Memoize IDs and accessibility attributes
  const accessibilityInfo = useMemo(() => {
    const gaugeId = `gauge-${label.replace(/\s+/g, '-').toLowerCase()}`;
    const descriptionId = `${gaugeId}-description`;
    const labelId = `gauge-label-${gaugeId}`;
    
    return { gaugeId, descriptionId, labelId };
  }, [label]);
  
  // Memoize ARIA attributes
  const ariaAttributes = useMemo(() => ({
    'aria-valuemin': min,
    'aria-valuemax': max,
    'aria-valuenow': calculations.safeValue,
    'aria-valuetext': `${accessibility.formatValue(calculations.safeValue, unit)} out of ${accessibility.formatValue(max, unit)} - ${statusInfo.statusText} level`,
    'aria-label': `${label} gauge`,
    'aria-describedby': accessibilityInfo.descriptionId
  }), [min, max, calculations.safeValue, unit, statusInfo.statusText, label, accessibilityInfo.descriptionId]);
  
  // Memoize SVG paths and properties
  const svgElements = useMemo(() => {
    const { percentage, angle } = calculations;
    
    return {
      viewBox: "0 0 100 60",
      backgroundPath: "M 10 50 A 40 40 0 0 1 90 50",
      valuePath: "M 10 50 A 40 40 0 0 1 90 50",
      strokeDasharray: `${percentage * 1.26} 126`,
      needleTransform: `translate(50, 50) rotate(${angle})`,
      title: `${label} gauge showing ${accessibility.formatValue(calculations.safeValue, unit)} - ${statusInfo.statusText}`
    };
  }, [calculations, label, statusInfo.statusText, unit]);
  
  // Optimized description update callback
  const updateDescription = useCallback(() => {
    const description = accessibility.generateControlLabel(
      `${label} gauge`, 
      { value: calculations.safeValue, min, max, status: statusInfo.statusText },
      { unit, precision }
    ) + `. Reading indicates ${statusInfo.statusText} levels.`;
    
    accessibility.setDescription(accessibilityInfo.gaugeId, description);
  }, [label, calculations.safeValue, min, max, statusInfo.statusText, unit, precision, accessibilityInfo.gaugeId]);
  
  // Effect for accessibility updates with dependency optimization
  useEffect(() => {
    updateDescription();
    
    return () => {
      accessibility.removeDescription(accessibilityInfo.gaugeId);
    };
  }, [updateDescription, accessibilityInfo.gaugeId]);
  
  // Memoize screen reader content
  const screenReaderContent = useMemo(() => ({
    labelContent: `${label} - ${statusInfo.statusText} level`,
    statusContent: `${label} status: ${statusInfo.statusText}`,
    titleContent: svgElements.title
  }), [label, statusInfo.statusText, svgElements.title]);
  
  return (
    <div 
      className={`telemetry-gauge ${statusInfo.colorClass}`}
      role="meter"
      {...ariaAttributes}
      tabIndex={0}
    >
      <div className="gauge-label" id={accessibilityInfo.labelId}>
        {label}
        <span className="sr-only"> - {statusInfo.statusText} level</span>
      </div>
      
      <div className="gauge-container">
        <svg 
          viewBox={svgElements.viewBox}
          className="gauge-svg"
          aria-hidden="true"
          role="img"
          aria-labelledby={accessibilityInfo.labelId}
        >
          <title>{screenReaderContent.titleContent}</title>
          
          {/* Background arc */}
          <path
            d={svgElements.backgroundPath}
            stroke="#333"
            strokeWidth="8"
            fill="none"
          />
          
          {/* Value arc */}
          <path
            d={svgElements.valuePath}
            stroke="currentColor"
            strokeWidth="6"
            fill="none"
            strokeDasharray={svgElements.strokeDasharray}
            className="gauge-arc"
          />
          
          {/* Needle */}
          <g transform={svgElements.needleTransform}>
            <line x1="0" y1="0" x2="0" y2="-35" stroke="#fff" strokeWidth="2" />
            <circle cx="0" cy="0" r="3" fill="#fff" />
          </g>
        </svg>
        
        <div className="gauge-value" aria-hidden="true">
          {calculations.displayValue}
          <span className="gauge-unit">{unit}</span>
        </div>
      </div>
      
      {/* Status indicator for screen readers */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {screenReaderContent.statusContent}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for optimal re-rendering
  // Only re-render if significant changes occurred
  
  // Check if core measurement properties changed
  if (prevProps.min !== nextProps.min || 
      prevProps.max !== nextProps.max ||
      prevProps.unit !== nextProps.unit ||
      prevProps.label !== nextProps.label ||
      prevProps.type !== nextProps.type ||
      prevProps.precision !== nextProps.precision) {
    return false; // Re-render needed
  }
  
  // Check if value changed significantly
  const prevValue = prevProps.value || 0;
  const nextValue = nextProps.value || 0;
  const threshold = nextProps.threshold || prevProps.threshold || 0.1;
  
  const valueChangeSignificant = Math.abs(prevValue - nextValue) > threshold;
  
  // Return true if no significant change (prevents re-render)
  return !valueChangeSignificant;
});

// Display name for debugging
TelemetryGaugeOptimized.displayName = 'TelemetryGaugeOptimized';

export default TelemetryGaugeOptimized;