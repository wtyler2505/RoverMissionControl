/**
 * Accessibility Utilities for Rover Mission Control
 * Provides comprehensive screen reader support and ARIA management
 */

/**
 * ARIA Live Region Manager
 * Manages polite and assertive announcements for screen readers
 */
class ARIALiveRegionManager {
  constructor() {
    this.politeRegion = null;
    this.assertiveRegion = null;
    this.statusRegion = null;
    this.alertRegion = null;
    this.initialized = false;
    
    this.init();
  }

  init() {
    if (this.initialized || typeof document === 'undefined') return;

    // Create polite live region for general announcements
    this.politeRegion = this.createLiveRegion('polite-announcer', 'polite');
    
    // Create assertive live region for urgent announcements
    this.assertiveRegion = this.createLiveRegion('assertive-announcer', 'assertive');
    
    // Create status region for ongoing state changes
    this.statusRegion = this.createLiveRegion('status-announcer', 'polite', 'status');
    
    // Create alert region for critical alerts
    this.alertRegion = this.createLiveRegion('alert-announcer', 'assertive', 'alert');

    this.initialized = true;
  }

  createLiveRegion(id, liveType, role = 'status') {
    let region = document.getElementById(id);
    
    if (!region) {
      region = document.createElement('div');
      region.id = id;
      region.className = 'sr-only';
      region.setAttribute('aria-live', liveType);
      region.setAttribute('aria-atomic', 'true');
      region.setAttribute('role', role);
      region.setAttribute('aria-relevant', 'additions text');
      document.body.appendChild(region);
    }
    
    return region;
  }

  /**
   * Announce message to screen readers (polite)
   * @param {string} message - Message to announce
   * @param {number} delay - Delay before announcement (ms)
   */
  announcePolite(message, delay = 100) {
    if (!message || !this.politeRegion) return;
    
    // Clear previous message
    this.politeRegion.textContent = '';
    
    setTimeout(() => {
      this.politeRegion.textContent = message;
    }, delay);
  }

  /**
   * Announce urgent message to screen readers (assertive)
   * @param {string} message - Urgent message to announce
   * @param {number} delay - Delay before announcement (ms)
   */
  announceAssertive(message, delay = 50) {
    if (!message || !this.assertiveRegion) return;
    
    // Clear previous message
    this.assertiveRegion.textContent = '';
    
    setTimeout(() => {
      this.assertiveRegion.textContent = message;
    }, delay);
  }

  /**
   * Announce status change
   * @param {string} message - Status message
   */
  announceStatus(message) {
    if (!message || !this.statusRegion) return;
    
    this.statusRegion.textContent = '';
    setTimeout(() => {
      this.statusRegion.textContent = message;
    }, 100);
  }

  /**
   * Announce critical alert
   * @param {string} message - Alert message
   */
  announceAlert(message) {
    if (!message || !this.alertRegion) return;
    
    this.alertRegion.textContent = message;
  }

  /**
   * Clear all announcements
   */
  clearAll() {
    if (this.politeRegion) this.politeRegion.textContent = '';
    if (this.assertiveRegion) this.assertiveRegion.textContent = '';
    if (this.statusRegion) this.statusRegion.textContent = '';
    if (this.alertRegion) this.alertRegion.textContent = '';
  }
}

/**
 * ARIA Description Manager
 * Manages dynamic descriptions for complex UI elements
 */
class ARIADescriptionManager {
  constructor() {
    this.descriptions = new Map();
    this.descriptionContainer = null;
    this.init();
  }

  init() {
    if (typeof document === 'undefined') return;

    // Create container for dynamic descriptions
    this.descriptionContainer = document.createElement('div');
    this.descriptionContainer.id = 'aria-descriptions';
    this.descriptionContainer.className = 'sr-only';
    document.body.appendChild(this.descriptionContainer);
  }

  /**
   * Create or update an ARIA description
   * @param {string} id - Unique identifier for the description
   * @param {string} description - Description content
   * @returns {string} - The ID to use for aria-describedby
   */
  setDescription(id, description) {
    const descId = `desc-${id}`;
    let descElement = this.descriptions.get(id);

    if (!descElement) {
      descElement = document.createElement('div');
      descElement.id = descId;
      descElement.className = 'sr-description';
      this.descriptionContainer.appendChild(descElement);
      this.descriptions.set(id, descElement);
    }

    descElement.textContent = description;
    return descId;
  }

  /**
   * Remove an ARIA description
   * @param {string} id - Identifier for the description to remove
   */
  removeDescription(id) {
    const descElement = this.descriptions.get(id);
    if (descElement) {
      descElement.remove();
      this.descriptions.delete(id);
    }
  }

  /**
   * Get description ID for aria-describedby
   * @param {string} id - Description identifier
   * @returns {string|null} - Description element ID or null
   */
  getDescriptionId(id) {
    return this.descriptions.has(id) ? `desc-${id}` : null;
  }
}

/**
 * Telemetry Announcer
 * Specialized for announcing rover telemetry changes
 */
class TelemetryAnnouncer {
  constructor(liveRegionManager) {
    this.liveRegionManager = liveRegionManager;
    this.lastValues = {};
    this.thresholds = {
      battery: { critical: 20, warning: 30 },
      temperature: { warning: 70, critical: 85 },
      rpm: { significantChange: 50 }
    };
  }

  /**
   * Announce telemetry updates with intelligent filtering
   * @param {Object} telemetry - Current telemetry data
   */
  announceTelemetry(telemetry) {
    if (!telemetry) return;

    // Battery level announcements
    this.announceBatteryStatus(telemetry.battery);
    
    // Temperature warnings
    this.announceTemperature(telemetry.temp);
    
    // Motor status changes
    this.announceMotorStatus(telemetry.wheels);
    
    // Connection status
    if (telemetry.connectionStatus !== this.lastValues.connectionStatus) {
      this.announceConnectionStatus(telemetry.connectionStatus);
    }

    // Emergency stop status
    if (telemetry.emergency_stop !== this.lastValues.emergency_stop) {
      this.announceEmergencyStop(telemetry.emergency_stop);
    }

    // Store last values for comparison
    this.lastValues = { ...telemetry };
  }

  announceBatteryStatus(battery) {
    if (!battery) return;

    ['motor', 'logic'].forEach(type => {
      const current = battery[type]?.percentage;
      const last = this.lastValues.battery?.[type]?.percentage;
      
      if (current !== undefined && current !== last) {
        if (current <= this.thresholds.battery.critical) {
          this.liveRegionManager.announceAlert(
            `Critical: ${type} battery at ${Math.round(current)}% - immediate attention required`
          );
        } else if (current <= this.thresholds.battery.warning && last > this.thresholds.battery.warning) {
          this.liveRegionManager.announceAssertive(
            `Warning: ${type} battery low at ${Math.round(current)}%`
          );
        } else if (Math.abs(current - (last || 0)) >= 10) {
          this.liveRegionManager.announceStatus(
            `${type} battery: ${Math.round(current)}%`
          );
        }
      }
    });
  }

  announceTemperature(temp) {
    if (temp === undefined) return;

    const lastTemp = this.lastValues.temp;
    
    if (temp >= this.thresholds.temperature.critical) {
      this.liveRegionManager.announceAlert(
        `Critical temperature: ${temp.toFixed(1)} degrees Celsius`
      );
    } else if (temp >= this.thresholds.temperature.warning && (lastTemp < this.thresholds.temperature.warning)) {
      this.liveRegionManager.announceAssertive(
        `High temperature warning: ${temp.toFixed(1)} degrees Celsius`
      );
    }
  }

  announceMotorStatus(wheels) {
    if (!wheels) return;

    const motors = ['fl', 'fr', 'rl', 'rr'];
    const motorNames = {
      fl: 'front left',
      fr: 'front right', 
      rl: 'rear left',
      rr: 'rear right'
    };

    motors.forEach(motor => {
      const current = wheels[motor];
      const last = this.lastValues.wheels?.[motor];
      
      if (current && last) {
        const rpmDiff = Math.abs((current.rpm || 0) - (last.rpm || 0));
        
        // Announce significant RPM changes
        if (rpmDiff >= this.thresholds.rpm.significantChange) {
          this.liveRegionManager.announceStatus(
            `${motorNames[motor]} motor: ${Math.round(current.rpm || 0)} RPM`
          );
        }
        
        // Announce motor faults
        if (current.fault && !last.fault) {
          this.liveRegionManager.announceAlert(
            `Motor fault detected on ${motorNames[motor]} wheel`
          );
        } else if (!current.fault && last.fault) {
          this.liveRegionManager.announceStatus(
            `${motorNames[motor]} motor fault cleared`
          );
        }
      }
    });
  }

  announceConnectionStatus(status) {
    if (status === 'connected') {
      this.liveRegionManager.announceStatus('Mission control connection established');
    } else if (status === 'disconnected') {
      this.liveRegionManager.announceAssertive('Mission control connection lost');
    } else if (status === 'reconnecting') {
      this.liveRegionManager.announceStatus('Attempting to reconnect to mission control');
    }
  }

  announceEmergencyStop(isActive) {
    if (isActive) {
      this.liveRegionManager.announceAlert('Emergency stop activated - all rover movement halted');
    } else {
      this.liveRegionManager.announceStatus('Emergency stop cleared - rover ready for operation');
    }
  }
}

/**
 * Chart Accessibility Helper
 * Provides alternative text representations of charts and graphs
 */
class ChartAccessibilityHelper {
  /**
   * Generate textual description of chart data
   * @param {Object} chartData - Chart.js data object
   * @param {string} chartType - Type of chart (line, bar, etc.)
   * @returns {string} - Accessible description
   */
  static describeChart(chartData, chartType = 'line') {
    if (!chartData || !chartData.datasets) return 'Chart data unavailable';

    const { labels, datasets } = chartData;
    const datasetCount = datasets.length;
    const pointCount = labels ? labels.length : 0;

    let description = `${chartType} chart with ${datasetCount} data series and ${pointCount} data points. `;

    datasets.forEach((dataset, index) => {
      const data = dataset.data || [];
      const label = dataset.label || `Series ${index + 1}`;
      
      if (data.length === 0) {
        description += `${label}: No data. `;
        return;
      }

      const min = Math.min(...data);
      const max = Math.max(...data);
      const avg = data.reduce((sum, val) => sum + val, 0) / data.length;
      const latest = data[data.length - 1];

      description += `${label}: Range from ${min.toFixed(1)} to ${max.toFixed(1)}, ` +
                   `average ${avg.toFixed(1)}, current value ${latest.toFixed(1)}. `;
    });

    return description;
  }

  /**
   * Generate data table representation for screen readers
   * @param {Object} chartData - Chart.js data object
   * @returns {string} - HTML table string
   */
  static generateDataTable(chartData) {
    if (!chartData || !chartData.datasets || !chartData.labels) {
      return '<p>No chart data available</p>';
    }

    const { labels, datasets } = chartData;
    
    let table = '<table role="table" aria-label="Chart data table">';
    table += '<caption>Data from chart visualization</caption>';
    
    // Header row
    table += '<thead><tr><th scope="col">Time/Label</th>';
    datasets.forEach(dataset => {
      table += `<th scope="col">${dataset.label || 'Data Series'}</th>`;
    });
    table += '</tr></thead>';
    
    // Data rows
    table += '<tbody>';
    labels.forEach((label, index) => {
      table += `<tr><th scope="row">${label}</th>`;
      datasets.forEach(dataset => {
        const value = dataset.data[index] || 0;
        table += `<td>${typeof value === 'number' ? value.toFixed(1) : value}</td>`;
      });
      table += '</tr>';
    });
    table += '</tbody></table>';
    
    return table;
  }
}

/**
 * Form Accessibility Helper
 * Manages form validation announcements and field descriptions
 */
class FormAccessibilityHelper {
  constructor(liveRegionManager) {
    this.liveRegionManager = liveRegionManager;
  }

  /**
   * Announce form validation errors
   * @param {Object} errors - Validation errors object
   * @param {string} formName - Name of the form
   */
  announceValidationErrors(errors, formName = 'form') {
    const errorCount = Object.keys(errors).length;
    
    if (errorCount === 0) {
      this.liveRegionManager.announceStatus(`${formName} validation passed`);
      return;
    }

    const errorMessages = Object.entries(errors)
      .map(([field, error]) => `${field}: ${error}`)
      .join('. ');

    this.liveRegionManager.announceAssertive(
      `${formName} has ${errorCount} validation error${errorCount > 1 ? 's' : ''}. ${errorMessages}`
    );
  }

  /**
   * Announce successful form submission
   * @param {string} formName - Name of the form
   * @param {string} action - Action performed
   */
  announceFormSuccess(formName, action = 'submitted') {
    this.liveRegionManager.announceStatus(`${formName} ${action} successfully`);
  }
}

// Create singleton instances
const liveRegionManager = new ARIALiveRegionManager();
const descriptionManager = new ARIADescriptionManager();
const telemetryAnnouncer = new TelemetryAnnouncer(liveRegionManager);
const formAccessibilityHelper = new FormAccessibilityHelper(liveRegionManager);

// Utility functions
export const accessibility = {
  // Live region management
  announce: (message, urgent = false) => {
    if (urgent) {
      liveRegionManager.announceAssertive(message);
    } else {
      liveRegionManager.announcePolite(message);
    }
  },
  
  announceStatus: (message) => liveRegionManager.announceStatus(message),
  announceAlert: (message) => liveRegionManager.announceAlert(message),
  clearAnnouncements: () => liveRegionManager.clearAll(),
  
  // Description management
  setDescription: (id, description) => descriptionManager.setDescription(id, description),
  removeDescription: (id) => descriptionManager.removeDescription(id),
  getDescriptionId: (id) => descriptionManager.getDescriptionId(id),
  
  // Telemetry announcements
  announceTelemetry: (telemetry) => telemetryAnnouncer.announceTelemetry(telemetry),
  
  // Chart accessibility
  describeChart: ChartAccessibilityHelper.describeChart,
  generateDataTable: ChartAccessibilityHelper.generateDataTable,
  
  // Form accessibility
  announceValidationErrors: (errors, formName) => 
    formAccessibilityHelper.announceValidationErrors(errors, formName),
  announceFormSuccess: (formName, action) => 
    formAccessibilityHelper.announceFormSuccess(formName, action),
  
  // Utility functions
  formatValue: (value, unit = '', precision = 1) => {
    if (typeof value !== 'number') return String(value);
    return `${value.toFixed(precision)}${unit ? ' ' + unit : ''}`;
  },
  
  formatPercentage: (value, precision = 0) => {
    return `${Math.round(value * Math.pow(10, precision)) / Math.pow(10, precision)}%`;
  },
  
  /**
   * Generate accessible label for complex controls
   * @param {string} baseLabel - Base label text
   * @param {Object} state - Current state of the control
   * @param {Object} options - Formatting options
   * @returns {string} - Complete accessible label
   */
  generateControlLabel: (baseLabel, state = {}, options = {}) => {
    let label = baseLabel;
    
    if (state.value !== undefined) {
      const formattedValue = options.unit ? 
        accessibility.formatValue(state.value, options.unit, options.precision) :
        state.value;
      label += ` - current value: ${formattedValue}`;
    }
    
    if (state.min !== undefined && state.max !== undefined) {
      label += ` - range: ${state.min} to ${state.max}`;
    }
    
    if (state.disabled) {
      label += ' - disabled';
    }
    
    if (state.status) {
      label += ` - status: ${state.status}`;
    }
    
    return label;
  }
};

export default accessibility;