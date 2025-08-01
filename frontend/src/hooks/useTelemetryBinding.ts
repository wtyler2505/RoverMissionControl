import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  DataBindingLayer, 
  DataSourceConfig, 
  DataBindingConfig, 
  ChartDataAdapter,
  DataSubscription 
} from '../services/telemetry/DataBindingLayer';

export interface UseTelemetryBindingOptions {
  dataSourceId?: string;
  dataSourceConfig?: DataSourceConfig;
  bindingConfig?: DataBindingConfig;
  adapter: ChartDataAdapter;
  onError?: (error: Error) => void;
  bufferSize?: number;
  throttleMs?: number;
}

export interface UseTelemetryBindingResult<T = any> {
  data: T[];
  isConnected: boolean;
  isLoading: boolean;
  error: Error | null;
  clearData: () => void;
  reconnect: () => Promise<void>;
  updateBinding: (config: Partial<DataBindingConfig>) => void;
}

// Singleton instance of DataBindingLayer
let dataBindingLayer: DataBindingLayer | null = null;

function getDataBindingLayer(): DataBindingLayer {
  if (!dataBindingLayer) {
    dataBindingLayer = new DataBindingLayer();
  }
  return dataBindingLayer;
}

export function useTelemetryBinding<T = any>({
  dataSourceId,
  dataSourceConfig,
  bindingConfig,
  adapter,
  onError,
  bufferSize = 100,
  throttleMs = 0
}: UseTelemetryBindingOptions): UseTelemetryBindingResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const dataBufferRef = useRef<T[]>([]);
  const subscriptionRef = useRef<DataSubscription | null>(null);
  const bindingIdRef = useRef<string>(`binding-${Date.now()}`);
  const lastUpdateRef = useRef<number>(0);
  const dataSourceIdRef = useRef<string>(dataSourceId || `ds-${Date.now()}`);

  const clearData = useCallback(() => {
    dataBufferRef.current = [];
    setData([]);
  }, []);

  const handleData = useCallback((newData: T) => {
    const now = Date.now();
    
    // Apply throttling if configured
    if (throttleMs > 0 && now - lastUpdateRef.current < throttleMs) {
      return;
    }
    
    lastUpdateRef.current = now;

    // Add to buffer
    dataBufferRef.current.push(newData);
    
    // Limit buffer size
    if (dataBufferRef.current.length > bufferSize) {
      dataBufferRef.current = dataBufferRef.current.slice(-bufferSize);
    }

    // Update state
    setData([...dataBufferRef.current]);
  }, [bufferSize, throttleMs]);

  const handleError = useCallback((err: Error) => {
    setError(err);
    if (onError) {
      onError(err);
    }
  }, [onError]);

  const setupBinding = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const bindingLayer = getDataBindingLayer();

      // Create or get data source
      let dataSource = bindingLayer.getDataSource(dataSourceIdRef.current);
      
      if (!dataSource && dataSourceConfig) {
        dataSource = await bindingLayer.createDataSource(
          dataSourceIdRef.current, 
          dataSourceConfig
        );
      }

      if (!dataSource) {
        throw new Error('No data source available');
      }

      // Subscribe to connection state
      const connectionSub = dataSource.connectionState$.subscribe(state => {
        setIsConnected(state === 'connected');
      });

      // Subscribe to errors
      const errorSub = dataSource.errors$.subscribe(handleError);

      // Create binding
      const binding = bindingLayer.createBinding(
        bindingIdRef.current,
        bindingConfig || {},
        dataSourceIdRef.current
      );

      // Subscribe to channel
      dataSource.subscribeToChannel(adapter.channel);

      // Bind to chart adapter
      const dataSub = bindingLayer.bind(
        bindingIdRef.current,
        adapter,
        handleData
      );

      subscriptionRef.current = dataSub;

      // Store subscriptions for cleanup
      return () => {
        connectionSub.unsubscribe();
        errorSub.unsubscribe();
        dataSub.unsubscribe();
      };

    } catch (err) {
      handleError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [dataSourceConfig, bindingConfig, adapter, handleData, handleError]);

  const reconnect = useCallback(async () => {
    const bindingLayer = getDataBindingLayer();
    const dataSource = bindingLayer.getDataSource(dataSourceIdRef.current);
    
    if (dataSource) {
      await dataSource.disconnect();
      await dataSource.connect();
    }
  }, []);

  const updateBinding = useCallback((config: Partial<DataBindingConfig>) => {
    const bindingLayer = getDataBindingLayer();
    
    // Remove old binding
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
    }
    bindingLayer.unbind(bindingIdRef.current);

    // Create new binding with updated config
    const newConfig = { ...bindingConfig, ...config };
    const binding = bindingLayer.createBinding(
      bindingIdRef.current,
      newConfig,
      dataSourceIdRef.current
    );

    // Re-bind with adapter
    const dataSub = bindingLayer.bind(
      bindingIdRef.current,
      adapter,
      handleData
    );

    subscriptionRef.current = dataSub;
  }, [bindingConfig, adapter, handleData]);

  useEffect(() => {
    const cleanup = setupBinding();

    return () => {
      cleanup?.then(cleanupFn => cleanupFn?.());
      
      const bindingLayer = getDataBindingLayer();
      
      // Cleanup binding
      bindingLayer.unbind(bindingIdRef.current);
      
      // Unsubscribe from channel
      const dataSource = bindingLayer.getDataSource(dataSourceIdRef.current);
      if (dataSource) {
        dataSource.unsubscribeFromChannel(adapter.channel);
      }
    };
  }, []); // Run only once on mount

  return {
    data,
    isConnected,
    isLoading,
    error,
    clearData,
    reconnect,
    updateBinding
  };
}

// Hook for managing multiple telemetry bindings
export function useMultipleTelemetryBindings<T = any>(
  bindings: Array<UseTelemetryBindingOptions & { id: string }>
): Record<string, UseTelemetryBindingResult<T>> {
  const [results, setResults] = useState<Record<string, UseTelemetryBindingResult<T>>>({});

  useEffect(() => {
    const newResults: Record<string, UseTelemetryBindingResult<T>> = {};

    bindings.forEach(binding => {
      // This is a simplified version - in practice, you'd need to handle this more carefully
      // to avoid violating hooks rules
      newResults[binding.id] = {
        data: [],
        isConnected: false,
        isLoading: true,
        error: null,
        clearData: () => {},
        reconnect: async () => {},
        updateBinding: () => {}
      };
    });

    setResults(newResults);
  }, [bindings]);

  return results;
}

// Preset hook configurations for common use cases
export const useTelemetryPresets = {
  useTemperatureTelemetry: (options?: Partial<UseTelemetryBindingOptions>) => {
    const adapter = new (await import('../services/telemetry/ChartAdapters')).LineChartAdapter(
      'telemetry:temperature',
      { includeMetadata: true }
    );

    return useTelemetryBinding({
      dataSourceConfig: {
        type: 'websocket',
        endpoint: 'ws://localhost:8080/telemetry'
      },
      adapter,
      bufferSize: 200,
      throttleMs: 100,
      ...options
    });
  },

  useBatteryTelemetry: (options?: Partial<UseTelemetryBindingOptions>) => {
    const adapter = new (await import('../services/telemetry/ChartAdapters')).GaugeChartAdapter(
      'telemetry:battery',
      {
        min: 0,
        max: 100,
        units: '%',
        thresholds: [
          { value: 20, color: '#ef4444', label: 'Low' },
          { value: 50, color: '#f59e0b', label: 'Medium' }
        ]
      }
    );

    return useTelemetryBinding({
      dataSourceConfig: {
        type: 'websocket',
        endpoint: 'ws://localhost:8080/telemetry'
      },
      adapter,
      bufferSize: 50,
      throttleMs: 500,
      ...options
    });
  },

  useSystemMetrics: (options?: Partial<UseTelemetryBindingOptions>) => {
    const adapter = new (await import('../services/telemetry/ChartAdapters')).AreaChartAdapter(
      'telemetry:system',
      {
        series: ['cpu', 'memory', 'disk'],
        seriesField: 'metric',
        aggregateWindow: 1000
      }
    );

    return useTelemetryBinding({
      dataSourceConfig: {
        type: 'websocket',
        endpoint: 'ws://localhost:8080/telemetry'
      },
      bindingConfig: {
        aggregation: {
          type: 'average',
          windowSize: 5000,
          windowType: 'time'
        }
      },
      adapter,
      bufferSize: 300,
      throttleMs: 200,
      ...options
    });
  }
};