/**
 * Format Utilities
 * Common formatting functions for the application
 */

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Format duration in milliseconds to human readable string
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Format number with thousands separator
 */
export function formatNumber(num: number, decimals = 0): string {
  return num.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

/**
 * Format percentage
 */
export function formatPercentage(value: number, decimals = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Format timestamp to local time string
 */
export function formatTimestamp(timestamp: number, includeDate = false): string {
  const date = new Date(timestamp);
  
  if (includeDate) {
    return date.toLocaleString();
  } else {
    return date.toLocaleTimeString();
  }
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  if (diff < 60000) {
    return 'just now';
  } else if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  } else if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else {
    const days = Math.floor(diff / 86400000);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }
}

/**
 * Format data rate (points per second)
 */
export function formatDataRate(rate: number): string {
  if (rate >= 1000000) {
    return `${(rate / 1000000).toFixed(1)}M Hz`;
  } else if (rate >= 1000) {
    return `${(rate / 1000).toFixed(1)}k Hz`;
  } else {
    return `${rate.toFixed(0)} Hz`;
  }
}

/**
 * Format scientific notation
 */
export function formatScientific(value: number, decimals = 2): string {
  return value.toExponential(decimals);
}

/**
 * Format with SI prefix
 */
export function formatSI(value: number, unit = '', decimals = 2): string {
  const prefixes = ['', 'k', 'M', 'G', 'T', 'P', 'E'];
  const base = 1000;
  
  if (value === 0) return `0 ${unit}`;
  
  const sign = value < 0 ? '-' : '';
  const absValue = Math.abs(value);
  const exponent = Math.floor(Math.log(absValue) / Math.log(base));
  const index = Math.max(0, Math.min(exponent, prefixes.length - 1));
  const scaledValue = absValue / Math.pow(base, index);
  
  return `${sign}${scaledValue.toFixed(decimals)} ${prefixes[index]}${unit}`;
}