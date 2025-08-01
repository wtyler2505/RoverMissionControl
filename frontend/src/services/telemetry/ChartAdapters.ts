import { ChartDataAdapter, TelemetryDataPoint } from './DataBindingLayer';
import { 
  TelemetryLineChartData,
  TelemetryGaugeChartData,
  TelemetryHeatmapData,
  TelemetryHistogramData,
  TelemetryScatterData,
  TelemetryAreaData
} from '../../components/Charts/charts';

export class LineChartAdapter implements ChartDataAdapter {
  constructor(
    public channel: string,
    private options: {
      yAxisField?: string;
      includeMetadata?: boolean;
      transformValue?: (value: number) => number;
    } = {}
  ) {}

  transform(data: TelemetryDataPoint): TelemetryLineChartData {
    const value = typeof data.value === 'number' 
      ? data.value 
      : (data.value[this.options.yAxisField || 'value'] || 0);

    return {
      timestamp: data.timestamp,
      value: this.options.transformValue ? this.options.transformValue(value) : value,
      ...(this.options.includeMetadata && data.metadata ? { metadata: data.metadata } : {})
    };
  }
}

export class GaugeChartAdapter implements ChartDataAdapter {
  constructor(
    public channel: string,
    private options: {
      min?: number;
      max?: number;
      thresholds?: Array<{ value: number; color: string; label?: string }>;
      units?: string;
    } = {}
  ) {}

  transform(data: TelemetryDataPoint): TelemetryGaugeChartData {
    const value = typeof data.value === 'number' 
      ? data.value 
      : 0;

    return {
      value,
      min: this.options.min || 0,
      max: this.options.max || 100,
      thresholds: this.options.thresholds || [],
      units: this.options.units || '',
      metadata: data.metadata
    };
  }
}

export class HeatmapChartAdapter implements ChartDataAdapter {
  constructor(
    public channel: string,
    private options: {
      xField?: string;
      yField?: string;
      valueField?: string;
      gridSize?: { x: number; y: number };
    } = {}
  ) {}

  transform(data: TelemetryDataPoint): TelemetryHeatmapData | TelemetryHeatmapData[] {
    if (typeof data.value === 'object' && !Array.isArray(data.value)) {
      const { xField = 'x', yField = 'y', valueField = 'value' } = this.options;
      
      // If value contains grid data
      if (Array.isArray(data.value.grid)) {
        return data.value.grid.map((point: any) => ({
          x: point[xField] || point.x || 0,
          y: point[yField] || point.y || 0,
          value: point[valueField] || point.value || 0,
          timestamp: data.timestamp
        }));
      }

      // Single point
      return {
        x: data.value[xField] || 0,
        y: data.value[yField] || 0,
        value: data.value[valueField] || 0,
        timestamp: data.timestamp
      };
    }

    // Default single value at center
    return {
      x: 0,
      y: 0,
      value: typeof data.value === 'number' ? data.value : 0,
      timestamp: data.timestamp
    };
  }
}

export class HistogramChartAdapter implements ChartDataAdapter {
  constructor(
    public channel: string,
    private options: {
      categoryField?: string;
      includeTimestamp?: boolean;
    } = {}
  ) {}

  transform(data: TelemetryDataPoint): TelemetryHistogramData {
    const value = typeof data.value === 'number' 
      ? data.value 
      : 0;

    return {
      value,
      ...(this.options.includeTimestamp ? { timestamp: data.timestamp } : {}),
      ...(this.options.categoryField && data.metadata ? 
        { category: data.metadata[this.options.categoryField] } : {}
      )
    };
  }
}

export class ScatterChartAdapter implements ChartDataAdapter {
  constructor(
    public channel: string,
    private options: {
      xChannel?: string;
      yChannel?: string;
      xField?: string;
      yField?: string;
      sizeField?: string;
      categoryField?: string;
      buffer?: { x: number[]; y: number[]; timestamps: number[] };
    } = {}
  ) {
    if (!this.options.buffer) {
      this.options.buffer = { x: [], y: [], timestamps: [] };
    }
  }

  transform(data: TelemetryDataPoint): TelemetryScatterData | null {
    // For scatter plots, we often need to correlate two channels
    if (this.options.xChannel && this.options.yChannel) {
      // Store data based on channel
      if (data.channel === this.options.xChannel) {
        const value = typeof data.value === 'number' 
          ? data.value 
          : (data.value[this.options.xField || 'value'] || 0);
        
        this.options.buffer!.x.push(value);
        this.options.buffer!.timestamps.push(data.timestamp);
      } else if (data.channel === this.options.yChannel) {
        const value = typeof data.value === 'number' 
          ? data.value 
          : (data.value[this.options.yField || 'value'] || 0);
        
        this.options.buffer!.y.push(value);
      }

      // Return point when we have both x and y values
      if (this.options.buffer!.x.length > 0 && this.options.buffer!.y.length > 0) {
        const x = this.options.buffer!.x.shift()!;
        const y = this.options.buffer!.y.shift()!;
        const timestamp = this.options.buffer!.timestamps.shift()!;

        return {
          x,
          y,
          timestamp,
          ...(this.options.sizeField && data.metadata ? 
            { size: data.metadata[this.options.sizeField] } : {}
          ),
          ...(this.options.categoryField && data.metadata ? 
            { category: data.metadata[this.options.categoryField] } : {}
          ),
          metadata: data.metadata
        };
      }

      return null;
    }

    // Single channel mode - expects x,y in value
    if (typeof data.value === 'object' && !Array.isArray(data.value)) {
      return {
        x: data.value[this.options.xField || 'x'] || 0,
        y: data.value[this.options.yField || 'y'] || 0,
        ...(this.options.sizeField && data.value[this.options.sizeField] ? 
          { size: data.value[this.options.sizeField] } : {}
        ),
        ...(this.options.categoryField && data.metadata ? 
          { category: data.metadata[this.options.categoryField] } : {}
        ),
        timestamp: data.timestamp,
        metadata: data.metadata
      };
    }

    return null;
  }
}

export class AreaChartAdapter implements ChartDataAdapter {
  private dataBuffer: Map<number, Record<string, number>> = new Map();
  
  constructor(
    public channel: string,
    private options: {
      series: string[];
      seriesField?: string;
      valueField?: string;
      bufferSize?: number;
      aggregateWindow?: number;
    } = { series: [] }
  ) {}

  transform(data: TelemetryDataPoint): TelemetryAreaData | null {
    // For area charts with multiple series
    if (this.options.series.length > 0) {
      const timestamp = this.normalizeTimestamp(data.timestamp);
      
      if (!this.dataBuffer.has(timestamp)) {
        this.dataBuffer.set(timestamp, {});
      }

      const buffer = this.dataBuffer.get(timestamp)!;

      // Extract series name and value
      if (this.options.seriesField && data.metadata) {
        const seriesName = data.metadata[this.options.seriesField];
        if (seriesName && this.options.series.includes(seriesName)) {
          const value = typeof data.value === 'number' 
            ? data.value 
            : (data.value[this.options.valueField || 'value'] || 0);
          
          buffer[seriesName] = value;
        }
      } else if (data.channel.includes(':')) {
        // Channel format: "telemetry:temperature"
        const seriesName = data.channel.split(':')[1];
        if (this.options.series.includes(seriesName)) {
          const value = typeof data.value === 'number' ? data.value : 0;
          buffer[seriesName] = value;
        }
      }

      // Check if we have all series for this timestamp
      const complete = this.options.series.every(series => series in buffer);
      
      if (complete) {
        const result: TelemetryAreaData = {
          timestamp,
          values: { ...buffer },
          metadata: data.metadata
        };

        // Clean up old data
        this.cleanupBuffer();

        return result;
      }
    } else {
      // Single series mode
      const value = typeof data.value === 'number' 
        ? data.value 
        : 0;

      return {
        timestamp: data.timestamp,
        values: { [data.channel]: value },
        metadata: data.metadata
      };
    }

    return null;
  }

  private normalizeTimestamp(timestamp: number): number {
    if (this.options.aggregateWindow) {
      return Math.floor(timestamp / this.options.aggregateWindow) * this.options.aggregateWindow;
    }
    return timestamp;
  }

  private cleanupBuffer(): void {
    const maxSize = this.options.bufferSize || 100;
    if (this.dataBuffer.size > maxSize) {
      const timestamps = Array.from(this.dataBuffer.keys()).sort((a, b) => a - b);
      const toRemove = timestamps.slice(0, timestamps.length - maxSize);
      toRemove.forEach(ts => this.dataBuffer.delete(ts));
    }
  }
}

// Factory class for creating adapters
export class ChartAdapterFactory {
  static createLineChartAdapter(
    channel: string,
    options?: Parameters<typeof LineChartAdapter['prototype']['constructor']>[1]
  ): LineChartAdapter {
    return new LineChartAdapter(channel, options);
  }

  static createGaugeChartAdapter(
    channel: string,
    options?: Parameters<typeof GaugeChartAdapter['prototype']['constructor']>[1]
  ): GaugeChartAdapter {
    return new GaugeChartAdapter(channel, options);
  }

  static createHeatmapChartAdapter(
    channel: string,
    options?: Parameters<typeof HeatmapChartAdapter['prototype']['constructor']>[1]
  ): HeatmapChartAdapter {
    return new HeatmapChartAdapter(channel, options);
  }

  static createHistogramChartAdapter(
    channel: string,
    options?: Parameters<typeof HistogramChartAdapter['prototype']['constructor']>[1]
  ): HistogramChartAdapter {
    return new HistogramChartAdapter(channel, options);
  }

  static createScatterChartAdapter(
    channel: string,
    options?: Parameters<typeof ScatterChartAdapter['prototype']['constructor']>[1]
  ): ScatterChartAdapter {
    return new ScatterChartAdapter(channel, options);
  }

  static createAreaChartAdapter(
    channel: string,
    options?: Parameters<typeof AreaChartAdapter['prototype']['constructor']>[1]
  ): AreaChartAdapter {
    return new AreaChartAdapter(channel, options);
  }
}

// Preset configurations for common telemetry scenarios
export const TelemetryPresets = {
  temperature: {
    line: () => new LineChartAdapter('telemetry:temperature', {
      transformValue: (v) => v,
      includeMetadata: true
    }),
    gauge: () => new GaugeChartAdapter('telemetry:temperature', {
      min: -20,
      max: 60,
      units: '°C',
      thresholds: [
        { value: 40, color: '#f59e0b', label: 'Warning' },
        { value: 50, color: '#ef4444', label: 'Critical' }
      ]
    }),
    histogram: () => new HistogramChartAdapter('telemetry:temperature', {
      includeTimestamp: true
    })
  },

  battery: {
    line: () => new LineChartAdapter('telemetry:battery', {
      transformValue: (v) => Math.max(0, Math.min(100, v)),
      includeMetadata: true
    }),
    gauge: () => new GaugeChartAdapter('telemetry:battery', {
      min: 0,
      max: 100,
      units: '%',
      thresholds: [
        { value: 20, color: '#ef4444', label: 'Low' },
        { value: 50, color: '#f59e0b', label: 'Medium' }
      ]
    }),
    area: () => new AreaChartAdapter('telemetry', {
      series: ['battery_voltage', 'battery_current'],
      seriesField: 'type',
      bufferSize: 100
    })
  },

  motion: {
    scatter: () => new ScatterChartAdapter('telemetry:position', {
      xField: 'x',
      yField: 'y',
      sizeField: 'velocity',
      categoryField: 'mode'
    }),
    heatmap: () => new HeatmapChartAdapter('telemetry:sensors', {
      xField: 'sensor_x',
      yField: 'sensor_y',
      valueField: 'reading'
    })
  },

  system: {
    area: () => new AreaChartAdapter('telemetry:system', {
      series: ['cpu', 'memory', 'disk'],
      seriesField: 'metric',
      aggregateWindow: 1000,
      bufferSize: 200
    }),
    histogram: () => new HistogramChartAdapter('telemetry:latency', {
      categoryField: 'endpoint'
    })
  }
};