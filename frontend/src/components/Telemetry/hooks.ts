/**
 * Telemetry hooks for easy access to telemetry functionality
 */

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { 
  useTelemetry, 
  useTelemetryStream as useTelemetryStreamBase,
  TelemetryStreamConfig,
  HistoricalDataRequest
} from './TelemetryProvider';
import { TelemetryDataPoint, TelemetryDataType } from '../../services/websocket/TelemetryManager';

/**
 * Hook for real-time telemetry data with automatic subscription
 */
export const useRealTimeTelemetry = (
  streamId: string,
  config?: Partial<TelemetryStreamConfig>
) => {
  const { subscribe, unsubscribe, isConnected } = useTelemetry();
  const streamData = useTelemetryStreamBase(streamId);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!isConnected || !streamId || isSubscribed) return;

    const doSubscribe = async () => {
      try {
        const defaultConfig: TelemetryStreamConfig = {
          streamId,
          name: streamId,
          dataType: TelemetryDataType.NUMERIC,
          bufferSize: 1000,
          ...config
        };
        
        await subscribe(defaultConfig);
        setIsSubscribed(true);
        setError(null);
      } catch (err) {
        setError(err as Error);
        console.error(`Failed to subscribe to ${streamId}:`, err);
      }
    };

    doSubscribe();

    return () => {
      if (isSubscribed) {
        unsubscribe(streamId).catch(console.error);
        setIsSubscribed(false);
      }
    };
  }, [streamId, isConnected, subscribe, unsubscribe, config, isSubscribed]);

  return {
    ...streamData,
    isSubscribed,
    error
  };
};

/**
 * Hook for telemetry data with windowing
 */
export const useWindowedTelemetry = (
  streamId: string,
  windowSize: number, // in seconds
  updateInterval = 100 // ms
) => {
  const { getStreamData } = useTelemetry();
  const [windowedData, setWindowedData] = useState<TelemetryDataPoint[]>([]);
  const intervalRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const updateWindow = () => {
      const data = getStreamData(streamId);
      const now = Date.now();
      const windowStart = now - (windowSize * 1000);
      
      const filtered = data.filter(point => point.timestamp >= windowStart);
      setWindowedData(filtered);
    };

    updateWindow();
    intervalRef.current = setInterval(updateWindow, updateInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [streamId, windowSize, updateInterval, getStreamData]);

  return windowedData;
};

/**
 * Hook for telemetry statistics calculation
 */
export const useTelemetryStatistics = (
  streamId: string,
  windowSize?: number // in seconds
) => {
  const data = useWindowedTelemetry(streamId, windowSize || 60);

  const statistics = useMemo(() => {
    if (data.length === 0) {
      return {
        min: 0,
        max: 0,
        average: 0,
        current: 0,
        count: 0,
        standardDeviation: 0,
        rate: 0 // points per second
      };
    }

    // Filter numeric values only
    const numericData = data
      .filter(point => typeof point.value === 'number')
      .map(point => point.value as number);

    if (numericData.length === 0) {
      return {
        min: 0,
        max: 0,
        average: 0,
        current: data[data.length - 1]?.value || 0,
        count: data.length,
        standardDeviation: 0,
        rate: 0
      };
    }

    const min = Math.min(...numericData);
    const max = Math.max(...numericData);
    const sum = numericData.reduce((a, b) => a + b, 0);
    const average = sum / numericData.length;
    const current = numericData[numericData.length - 1] || 0;

    // Calculate standard deviation
    const squaredDiffs = numericData.map(value => Math.pow(value - average, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / numericData.length;
    const standardDeviation = Math.sqrt(avgSquaredDiff);

    // Calculate rate
    let rate = 0;
    if (data.length > 1) {
      const duration = (data[data.length - 1].timestamp - data[0].timestamp) / 1000;
      rate = duration > 0 ? data.length / duration : 0;
    }

    return {
      min,
      max,
      average,
      current,
      count: data.length,
      standardDeviation,
      rate
    };
  }, [data]);

  return statistics;
};

/**
 * Hook for telemetry alerts
 */
export interface TelemetryAlert {
  id: string;
  streamId: string;
  condition: 'above' | 'below' | 'equals' | 'change';
  threshold: number;
  triggered: boolean;
  lastTriggered?: number;
  message?: string;
}

export const useTelemetryAlerts = (
  alerts: Omit<TelemetryAlert, 'id' | 'triggered' | 'lastTriggered'>[]
) => {
  const { getStreamData } = useTelemetry();
  const [triggeredAlerts, setTriggeredAlerts] = useState<TelemetryAlert[]>([]);
  const alertStatesRef = useRef<Map<string, TelemetryAlert>>(new Map());

  useEffect(() => {
    const checkAlerts = () => {
      const newTriggeredAlerts: TelemetryAlert[] = [];

      alerts.forEach((alertConfig, index) => {
        const alertId = `${alertConfig.streamId}_${index}`;
        const data = getStreamData(alertConfig.streamId, 1);
        
        if (data.length === 0) return;

        const currentValue = data[0].value;
        if (typeof currentValue !== 'number') return;

        let triggered = false;

        switch (alertConfig.condition) {
          case 'above':
            triggered = currentValue > alertConfig.threshold;
            break;
          case 'below':
            triggered = currentValue < alertConfig.threshold;
            break;
          case 'equals':
            triggered = Math.abs(currentValue - alertConfig.threshold) < 0.001;
            break;
          case 'change':
            const previousAlert = alertStatesRef.current.get(alertId);
            if (previousAlert && typeof previousAlert.threshold === 'number') {
              triggered = Math.abs(currentValue - previousAlert.threshold) > alertConfig.threshold;
            }
            break;
        }

        const alert: TelemetryAlert = {
          ...alertConfig,
          id: alertId,
          triggered,
          lastTriggered: triggered ? Date.now() : alertStatesRef.current.get(alertId)?.lastTriggered
        };

        alertStatesRef.current.set(alertId, { ...alert, threshold: currentValue });

        if (triggered) {
          newTriggeredAlerts.push(alert);
        }
      });

      setTriggeredAlerts(newTriggeredAlerts);
    };

    const interval = setInterval(checkAlerts, 1000);
    checkAlerts(); // Check immediately

    return () => clearInterval(interval);
  }, [alerts, getStreamData]);

  return triggeredAlerts;
};

/**
 * Hook for telemetry data export
 */
export const useTelemetryExport = () => {
  const { exportStreamData, activeStreams } = useTelemetry();
  const [isExporting, setIsExporting] = useState(false);

  const exportToFile = useCallback(async (
    streamId: string,
    format: 'json' | 'csv' = 'json',
    filename?: string
  ) => {
    setIsExporting(true);
    try {
      const data = exportStreamData(streamId);
      if (!data) {
        throw new Error('No data available for export');
      }

      let content: string;
      let mimeType: string;

      if (format === 'json') {
        content = JSON.stringify(data, null, 2);
        mimeType = 'application/json';
      } else {
        // CSV format
        const { config, data: points } = data;
        let csv = `Stream: ${config.name}\n`;
        csv += `Type: ${config.dataType}\n`;
        csv += `Units: ${config.units || 'N/A'}\n\n`;
        csv += 'Timestamp,Value,Quality\n';
        
        points.forEach(point => {
          const value = typeof point.value === 'object' 
            ? JSON.stringify(point.value) 
            : point.value;
          csv += `${point.timestamp},${value},${point.quality || 1}\n`;
        });
        
        content = csv;
        mimeType = 'text/csv';
      }

      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || `telemetry_${streamId}_${Date.now()}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      throw error;
    } finally {
      setIsExporting(false);
    }
  }, [exportStreamData]);

  const exportAllStreams = useCallback(async (
    format: 'json' | 'csv' = 'json'
  ) => {
    setIsExporting(true);
    try {
      const allData: any = {};
      
      activeStreams.forEach(stream => {
        const data = exportStreamData(stream.streamId);
        if (data) {
          allData[stream.streamId] = data;
        }
      });

      const content = JSON.stringify(allData, null, 2);
      const blob = new Blob([content], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `telemetry_all_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      throw error;
    } finally {
      setIsExporting(false);
    }
  }, [activeStreams, exportStreamData]);

  return {
    exportToFile,
    exportAllStreams,
    isExporting
  };
};

/**
 * Hook for historical telemetry data
 */
export const useHistoricalTelemetry = (
  streamId: string,
  timeRange: { start: Date; end: Date },
  options?: {
    maxPoints?: number;
    aggregation?: HistoricalDataRequest['aggregation'];
    autoFetch?: boolean;
  }
) => {
  const { getHistoricalData } = useTelemetry();
  const [data, setData] = useState<TelemetryDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!streamId) return;

    setIsLoading(true);
    setError(null);

    try {
      const request: HistoricalDataRequest = {
        streamId,
        startTime: timeRange.start.getTime(),
        endTime: timeRange.end.getTime(),
        maxPoints: options?.maxPoints,
        aggregation: options?.aggregation
      };

      const historicalData = await getHistoricalData(request);
      setData(historicalData);
    } catch (err) {
      setError(err as Error);
      console.error('Failed to fetch historical data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [streamId, timeRange, options, getHistoricalData]);

  useEffect(() => {
    if (options?.autoFetch !== false) {
      fetchData();
    }
  }, [fetchData, options?.autoFetch]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchData
  };
};

/**
 * Hook for telemetry data comparison
 */
export const useTelemetryComparison = (
  streamIds: string[],
  windowSize = 60 // seconds
) => {
  const { getStreamData } = useTelemetry();
  const [comparisonData, setComparisonData] = useState<{
    [streamId: string]: TelemetryDataPoint[];
  }>({});

  useEffect(() => {
    const updateComparison = () => {
      const now = Date.now();
      const windowStart = now - (windowSize * 1000);
      const newData: typeof comparisonData = {};

      streamIds.forEach(streamId => {
        const data = getStreamData(streamId);
        newData[streamId] = data.filter(point => point.timestamp >= windowStart);
      });

      setComparisonData(newData);
    };

    const interval = setInterval(updateComparison, 100);
    updateComparison();

    return () => clearInterval(interval);
  }, [streamIds, windowSize, getStreamData]);

  // Calculate correlation between streams
  const correlation = useMemo(() => {
    const correlations: { [key: string]: number } = {};
    
    for (let i = 0; i < streamIds.length; i++) {
      for (let j = i + 1; j < streamIds.length; j++) {
        const stream1 = comparisonData[streamIds[i]] || [];
        const stream2 = comparisonData[streamIds[j]] || [];
        
        if (stream1.length < 2 || stream2.length < 2) continue;
        
        // Simple correlation calculation for numeric data
        const values1 = stream1
          .filter(p => typeof p.value === 'number')
          .map(p => p.value as number);
        const values2 = stream2
          .filter(p => typeof p.value === 'number')
          .map(p => p.value as number);
        
        if (values1.length < 2 || values2.length < 2) continue;
        
        // Calculate Pearson correlation coefficient
        const n = Math.min(values1.length, values2.length);
        const sum1 = values1.slice(0, n).reduce((a, b) => a + b, 0);
        const sum2 = values2.slice(0, n).reduce((a, b) => a + b, 0);
        const sum1Sq = values1.slice(0, n).reduce((a, b) => a + b * b, 0);
        const sum2Sq = values2.slice(0, n).reduce((a, b) => a + b * b, 0);
        const pSum = values1.slice(0, n).reduce((a, b, idx) => a + b * values2[idx], 0);
        
        const num = pSum - (sum1 * sum2 / n);
        const den = Math.sqrt((sum1Sq - sum1 * sum1 / n) * (sum2Sq - sum2 * sum2 / n));
        
        const corr = den === 0 ? 0 : num / den;
        correlations[`${streamIds[i]}_${streamIds[j]}`] = corr;
      }
    }
    
    return correlations;
  }, [streamIds, comparisonData]);

  return {
    data: comparisonData,
    correlation
  };
};