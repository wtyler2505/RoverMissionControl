import { useRef, useCallback, useEffect, useState } from 'react';
import { DataPoint, DataSeries } from './RealTimeChart';

export interface UseRealTimeDataOptions {
  maxDataPoints?: number;
  bufferSize?: number;
  decimationFactor?: number;
  smoothingWindow?: number;
}

export interface RealTimeDataManager {
  addDataPoint: (seriesId: string, value: number, timestamp?: number) => void;
  addBatchData: (seriesId: string, points: DataPoint[]) => void;
  clearData: (seriesId?: string) => void;
  getSeries: (seriesId: string) => DataPoint[];
  getAllSeries: () => Map<string, DataPoint[]>;
  setMaxDataPoints: (max: number) => void;
  getStatistics: (seriesId: string) => DataStatistics | null;
}

export interface DataStatistics {
  min: number;
  max: number;
  mean: number;
  stdDev: number;
  lastValue: number;
  dataRate: number; // Hz
}

const DEFAULT_OPTIONS: UseRealTimeDataOptions = {
  maxDataPoints: 10000,
  bufferSize: 20000,
  decimationFactor: 1,
  smoothingWindow: 0,
};

export function useRealTimeData(
  options: UseRealTimeDataOptions = {}
): RealTimeDataManager {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const dataRef = useRef<Map<string, DataPoint[]>>(new Map());
  const statsRef = useRef<Map<string, DataStatistics>>(new Map());
  const lastUpdateRef = useRef<Map<string, number>>(new Map());
  const dataRateRef = useRef<Map<string, number[]>>(new Map());

  // Add a single data point
  const addDataPoint = useCallback((
    seriesId: string,
    value: number,
    timestamp?: number
  ) => {
    const now = timestamp || Date.now();
    
    if (!dataRef.current.has(seriesId)) {
      dataRef.current.set(seriesId, []);
      dataRateRef.current.set(seriesId, []);
    }

    const series = dataRef.current.get(seriesId)!;
    const rateBuffer = dataRateRef.current.get(seriesId)!;

    // Apply smoothing if enabled
    let smoothedValue = value;
    if (opts.smoothingWindow && opts.smoothingWindow > 0 && series.length > 0) {
      const windowSize = Math.min(opts.smoothingWindow, series.length);
      const recentValues = series.slice(-windowSize).map(p => p.value);
      recentValues.push(value);
      smoothedValue = recentValues.reduce((a, b) => a + b) / recentValues.length;
    }

    // Add new point
    series.push({ timestamp: now, value: smoothedValue });

    // Update data rate tracking
    const lastUpdate = lastUpdateRef.current.get(seriesId) || now;
    if (now > lastUpdate) {
      rateBuffer.push(1000 / (now - lastUpdate));
      if (rateBuffer.length > 100) {
        rateBuffer.shift();
      }
    }
    lastUpdateRef.current.set(seriesId, now);

    // Apply decimation
    if (opts.decimationFactor > 1 && series.length % opts.decimationFactor !== 0) {
      series.pop(); // Remove the point if it doesn't meet decimation criteria
      return;
    }

    // Maintain buffer size
    if (series.length > opts.bufferSize!) {
      series.splice(0, series.length - opts.maxDataPoints!);
    }

    // Update statistics
    updateStatistics(seriesId, series, rateBuffer);
  }, [opts]);

  // Add batch data
  const addBatchData = useCallback((
    seriesId: string,
    points: DataPoint[]
  ) => {
    if (!dataRef.current.has(seriesId)) {
      dataRef.current.set(seriesId, []);
      dataRateRef.current.set(seriesId, []);
    }

    const series = dataRef.current.get(seriesId)!;
    const rateBuffer = dataRateRef.current.get(seriesId)!;

    // Apply smoothing to batch
    const smoothedPoints = opts.smoothingWindow && opts.smoothingWindow > 0
      ? points.map((point, index) => {
          const windowStart = Math.max(0, series.length + index - opts.smoothingWindow);
          const windowData = [
            ...series.slice(windowStart),
            ...points.slice(0, index + 1)
          ].slice(-opts.smoothingWindow);
          
          const smoothedValue = windowData.reduce((sum, p) => sum + p.value, 0) / windowData.length;
          return { ...point, value: smoothedValue };
        })
      : points;

    // Apply decimation to batch
    const decimatedPoints = opts.decimationFactor > 1
      ? smoothedPoints.filter((_, index) => index % opts.decimationFactor === 0)
      : smoothedPoints;

    // Add points
    series.push(...decimatedPoints);

    // Update data rate
    if (decimatedPoints.length > 1) {
      const timeSpan = decimatedPoints[decimatedPoints.length - 1].timestamp - decimatedPoints[0].timestamp;
      const rate = (decimatedPoints.length - 1) * 1000 / timeSpan;
      rateBuffer.push(rate);
      if (rateBuffer.length > 100) {
        rateBuffer.shift();
      }
    }
    lastUpdateRef.current.set(seriesId, decimatedPoints[decimatedPoints.length - 1].timestamp);

    // Maintain buffer size
    if (series.length > opts.bufferSize!) {
      series.splice(0, series.length - opts.maxDataPoints!);
    }

    // Update statistics
    updateStatistics(seriesId, series, rateBuffer);
  }, [opts]);

  // Clear data
  const clearData = useCallback((seriesId?: string) => {
    if (seriesId) {
      dataRef.current.delete(seriesId);
      statsRef.current.delete(seriesId);
      lastUpdateRef.current.delete(seriesId);
      dataRateRef.current.delete(seriesId);
    } else {
      dataRef.current.clear();
      statsRef.current.clear();
      lastUpdateRef.current.clear();
      dataRateRef.current.clear();
    }
  }, []);

  // Get series data
  const getSeries = useCallback((seriesId: string): DataPoint[] => {
    return dataRef.current.get(seriesId) || [];
  }, []);

  // Get all series
  const getAllSeries = useCallback((): Map<string, DataPoint[]> => {
    return new Map(dataRef.current);
  }, []);

  // Set max data points
  const setMaxDataPoints = useCallback((max: number) => {
    opts.maxDataPoints = max;
    
    // Trim existing data if necessary
    dataRef.current.forEach((series, id) => {
      if (series.length > max) {
        series.splice(0, series.length - max);
        updateStatistics(id, series, dataRateRef.current.get(id) || []);
      }
    });
  }, [opts]);

  // Get statistics for a series
  const getStatistics = useCallback((seriesId: string): DataStatistics | null => {
    return statsRef.current.get(seriesId) || null;
  }, []);

  // Update statistics for a series
  const updateStatistics = (
    seriesId: string,
    series: DataPoint[],
    rateBuffer: number[]
  ) => {
    if (series.length === 0) return;

    const values = series.map(p => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const mean = values.reduce((a, b) => a + b) / values.length;
    
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    const lastValue = values[values.length - 1];
    const dataRate = rateBuffer.length > 0
      ? rateBuffer.reduce((a, b) => a + b) / rateBuffer.length
      : 0;

    statsRef.current.set(seriesId, {
      min,
      max,
      mean,
      stdDev,
      lastValue,
      dataRate,
    });
  };

  return {
    addDataPoint,
    addBatchData,
    clearData,
    getSeries,
    getAllSeries,
    setMaxDataPoints,
    getStatistics,
  };
}

// Hook for WebWorker-based data processing
export function useWebWorkerProcessing(
  workerScript: string
): {
  processData: (data: any) => Promise<any>;
  terminate: () => void;
} {
  const workerRef = useRef<Worker | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (typeof Worker !== 'undefined') {
      workerRef.current = new Worker(workerScript);
      
      workerRef.current.onmessage = () => {
        setIsReady(true);
      };

      return () => {
        workerRef.current?.terminate();
      };
    }
  }, [workerScript]);

  const processData = useCallback((data: any): Promise<any> => {
    return new Promise((resolve, reject) => {
      if (!workerRef.current || !isReady) {
        reject(new Error('Worker not ready'));
        return;
      }

      const messageHandler = (e: MessageEvent) => {
        workerRef.current!.removeEventListener('message', messageHandler);
        if (e.data.error) {
          reject(new Error(e.data.error));
        } else {
          resolve(e.data.result);
        }
      };

      workerRef.current.addEventListener('message', messageHandler);
      workerRef.current.postMessage(data);
    });
  }, [isReady]);

  const terminate = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
    setIsReady(false);
  }, []);

  return { processData, terminate };
}