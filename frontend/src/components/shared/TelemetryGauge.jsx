import React, { useEffect } from 'react';
import { accessibility } from '../../utils/accessibility';

/**
 * Enhanced Telemetry Gauge Component with comprehensive ARIA support
 * Used in Dashboard module for displaying telemetry data
 */
const TelemetryGauge = ({ value, min, max, unit, label, type = "normal" }) => {
  const percentage = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  const angle = (percentage / 100) * 180 - 90;
  
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

  // Generate comprehensive description for screen readers
  const gaugeId = `gauge-${label.replace(/\s+/g, '-').toLowerCase()}`;
  const descriptionId = `${gaugeId}-description`;
  
  useEffect(() => {
    // Update dynamic description for screen readers
    const description = accessibility.generateControlLabel(
      `${label} gauge`, 
      { value, min, max, status: statusText },
      { unit, precision: 1 }
    ) + `. Reading indicates ${statusText} levels.`;
    
    accessibility.setDescription(gaugeId, description);
    
    return () => {
      accessibility.removeDescription(gaugeId);
    };
  }, [value, min, max, unit, label, statusText, gaugeId]);
  
  return (
    <div 
      className={`telemetry-gauge ${colorClass}`}
      role="meter"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={`${accessibility.formatValue(value, unit)} out of ${accessibility.formatValue(max, unit)} - ${statusText} level`}
      aria-label={`${label} gauge`}
      aria-describedby={descriptionId}
      tabIndex={0}
    >
      <div className="gauge-label" id={`gauge-label-${gaugeId}`}>
        {label}
        <span className="sr-only"> - {statusText} level</span>
      </div>
      <div className="gauge-container">
        <svg 
          viewBox="0 0 100 60" 
          className="gauge-svg"
          aria-hidden="true"
          role="img"
          aria-labelledby={`gauge-label-${gaugeId}`}
        >
          <title>{`${label} gauge showing ${accessibility.formatValue(value, unit)} - ${statusText}`}</title>
          {/* Background arc */}
          <path
            d="M 10 50 A 40 40 0 0 1 90 50"
            stroke="#333"
            strokeWidth="8"
            fill="none"
          />
          {/* Value arc */}
          <path
            d="M 10 50 A 40 40 0 0 1 90 50"
            stroke="currentColor"
            strokeWidth="6"
            fill="none"
            strokeDasharray={`${percentage * 1.26} 126`}
            className="gauge-arc"
          />
          {/* Needle */}
          <g transform={`translate(50, 50) rotate(${angle})`}>
            <line x1="0" y1="0" x2="0" y2="-35" stroke="#fff" strokeWidth="2" />
            <circle cx="0" cy="0" r="3" fill="#fff" />
          </g>
        </svg>
        <div className="gauge-value" aria-hidden="true">
          {typeof value === 'number' ? value.toFixed(1) : value}
          <span className="gauge-unit">{unit}</span>
        </div>
      </div>
      
      {/* Status indicator for screen readers */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {label} status: {statusText}
      </div>
    </div>
  );
};

export default TelemetryGauge;