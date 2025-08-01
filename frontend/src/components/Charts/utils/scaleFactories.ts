/**
 * Scale Factory Utilities
 * Creates appropriate D3 scales based on data types and requirements
 */

import * as d3 from 'd3';
import { ScaleFactoryOptions, ScaleType } from '../types';

/**
 * Create D3 scale based on configuration
 */
export const createScale = (options: ScaleFactoryOptions): d3.ScaleLinear<number, number> | 
  d3.ScaleTime<number, number> | 
  d3.ScaleLogarithmic<number, number> | 
  d3.ScaleBand<string> | 
  d3.ScaleOrdinal<string, string> | 
  d3.ScaleSequential<string> => {
    
  const { domain, range, type, padding = 0, nice = false, clamp = false } = options;

  switch (type) {
    case 'linear': {
      const scale = d3.scaleLinear()
        .domain(domain as [number, number])
        .range(range as [number, number]);
      
      if (nice) scale.nice();
      if (clamp) scale.clamp(true);
      
      return scale;
    }

    case 'time': {
      const scale = d3.scaleTime()
        .domain(domain as [Date, Date])
        .range(range as [number, number]);
      
      if (nice) scale.nice();
      if (clamp) scale.clamp(true);
      
      return scale;
    }

    case 'log': {
      const scale = d3.scaleLog()
        .domain(domain as [number, number])
        .range(range as [number, number])
        .base(10);
      
      if (nice) scale.nice();
      if (clamp) scale.clamp(true);
      
      return scale;
    }

    case 'band': {
      const scale = d3.scaleBand()
        .domain(domain as string[])
        .range(range as [number, number])
        .padding(padding);
      
      return scale;
    }

    case 'ordinal': {
      const scale = d3.scaleOrdinal<string>()
        .domain(domain as string[])
        .range(range as string[]);
      
      return scale;
    }

    case 'sequential': {
      const scale = d3.scaleSequential()
        .domain(domain as [number, number])
        .interpolator(d3.interpolateViridis); // Default interpolator
      
      if (clamp) scale.clamp(true);
      
      return scale;
    }

    default:
      throw new Error(`Unsupported scale type: ${type}`);
  }
};

/**
 * Automatically determine the appropriate scale type based on data
 */
export const inferScaleType = (data: any[]): ScaleType => {
  if (data.length === 0) return 'linear';
  
  const sample = data[0];
  
  if (sample instanceof Date) return 'time';
  if (typeof sample === 'string') return 'band';
  if (typeof sample === 'number') {
    // Check if data spans multiple orders of magnitude (good for log scale)
    const extent = d3.extent(data) as [number, number];
    if (extent[0] > 0 && extent[1] / extent[0] > 1000) {
      return 'log';
    }
    return 'linear';
  }
  
  return 'ordinal';
};

/**
 * Create time scale with intelligent tick formatting
 */
export const createTimeScale = (
  domain: [Date, Date], 
  range: [number, number],
  options: { nice?: boolean; clamp?: boolean } = {}
): { 
  scale: d3.ScaleTime<number, number>; 
  tickFormat: (date: Date) => string;
  tickValues?: Date[];
} => {
  const { nice = true, clamp = false } = options;
  
  const scale = d3.scaleTime()
    .domain(domain)
    .range(range);
  
  if (nice) scale.nice();
  if (clamp) scale.clamp(true);
  
  // Determine appropriate tick format based on time span
  const timeSpan = domain[1].getTime() - domain[0].getTime();
  
  let tickFormat: (date: Date) => string;
  let tickValues: Date[] | undefined;
  
  if (timeSpan < 60000) { // Less than 1 minute
    tickFormat = d3.timeFormat('%H:%M:%S');
  } else if (timeSpan < 3600000) { // Less than 1 hour
    tickFormat = d3.timeFormat('%H:%M');
  } else if (timeSpan < 86400000) { // Less than 1 day
    tickFormat = d3.timeFormat('%H:%M');
  } else if (timeSpan < 604800000) { // Less than 1 week
    tickFormat = d3.timeFormat('%m/%d %H:%M');
  } else if (timeSpan < 2592000000) { // Less than 1 month
    tickFormat = d3.timeFormat('%m/%d');
  } else if (timeSpan < 31536000000) { // Less than 1 year
    tickFormat = d3.timeFormat('%m/%d/%y');
  } else {
    tickFormat = d3.timeFormat('%Y');
  }
  
  return { scale, tickFormat, tickValues };
};

/**
 * Create color scales for different visualization needs
 */
export const createColorScale = (
  type: 'categorical' | 'sequential' | 'diverging' | 'custom',
  domain: any[],
  options: {
    colors?: string[];
    interpolator?: (t: number) => string;
    scheme?: string;
  } = {}
): d3.ScaleOrdinal<string, string> | d3.ScaleSequential<string> => {
  
  const { colors, interpolator, scheme } = options;
  
  switch (type) {
    case 'categorical': {
      let colorRange: string[];
      
      if (colors) {
        colorRange = colors;
      } else if (scheme) {
        // Use D3 color schemes
        const schemes: Record<string, string[]> = {
          category10: d3.schemeCategory10,
          set1: d3.schemeSet1,
          set2: d3.schemeSet2,
          set3: d3.schemeSet3,
          pastel1: d3.schemePastel1,
          pastel2: d3.schemePastel2,
          dark2: d3.schemeDark2,
          accent: d3.schemeAccent
        };
        colorRange = schemes[scheme] || d3.schemeCategory10;
      } else {
        colorRange = d3.schemeCategory10;
      }
      
      return d3.scaleOrdinal<string>()
        .domain(domain as string[])
        .range(colorRange);
    }
    
    case 'sequential': {
      const scale = d3.scaleSequential()
        .domain(d3.extent(domain) as [number, number]);
      
      if (interpolator) {
        scale.interpolator(interpolator);
      } else if (scheme) {
        const interpolators: Record<string, (t: number) => string> = {
          viridis: d3.interpolateViridis,
          plasma: d3.interpolatePlasma,
          inferno: d3.interpolateInferno,
          magma: d3.interpolateMagma,
          cividis: d3.interpolateCividis,
          blues: d3.interpolateBlues,
          greens: d3.interpolateGreens,
          greys: d3.interpolateGreys,
          oranges: d3.interpolateOranges,
          purples: d3.interpolatePurples,
          reds: d3.interpolateReds
        };
        scale.interpolator(interpolators[scheme] || d3.interpolateViridis);
      } else {
        scale.interpolator(d3.interpolateViridis);
      }
      
      return scale;
    }
    
    case 'diverging': {
      const scale = d3.scaleSequential()
        .domain(d3.extent(domain) as [number, number]);
      
      if (interpolator) {
        scale.interpolator(interpolator);
      } else if (scheme) {
        const interpolators: Record<string, (t: number) => string> = {
          rdbu: d3.interpolateRdBu,
          rdylbu: d3.interpolateRdYlBu,
          rdylgn: d3.interpolateRdYlGn,
          spectral: d3.interpolateSpectral,
          brbg: d3.interpolateBrBG,
          prgn: d3.interpolatePRGn,
          piyg: d3.interpolatePiYG,
          puor: d3.interpolatePuOr
        };
        scale.interpolator(interpolators[scheme] || d3.interpolateRdBu);
      } else {
        scale.interpolator(d3.interpolateRdBu);
      }
      
      return scale;
    }
    
    case 'custom': {
      if (!colors || colors.length < 2) {
        throw new Error('Custom color scale requires at least 2 colors');
      }
      
      if (domain.length === colors.length) {
        // Ordinal mapping
        return d3.scaleOrdinal<string>()
          .domain(domain as string[])
          .range(colors);
      } else {
        // Sequential interpolation
        const interpolator = d3.interpolateRgbBasis(colors);
        return d3.scaleSequential()
          .domain(d3.extent(domain) as [number, number])
          .interpolator(interpolator);
      }
    }
    
    default:
      throw new Error(`Unsupported color scale type: ${type}`);
  }
};

/**
 * Create adaptive scales that adjust based on data characteristics
 */
export const createAdaptiveScale = (
  data: number[],
  range: [number, number],
  options: {
    forceZero?: boolean;
    symmetric?: boolean;
    logThreshold?: number;
    niceThreshold?: number;
  } = {}
): d3.ScaleLinear<number, number> | d3.ScaleLogarithmic<number, number> => {
  
  const { forceZero = false, symmetric = false, logThreshold = 1000, niceThreshold = 10 } = options;
  
  if (data.length === 0) {
    return d3.scaleLinear().domain([0, 1]).range(range);
  }
  
  const extent = d3.extent(data) as [number, number];
  let domain = [...extent];
  
  // Check if log scale would be appropriate
  const useLog = extent[0] > 0 && extent[1] / extent[0] > logThreshold;
  
  if (useLog) {
    const logScale = d3.scaleLog()
      .domain(domain)
      .range(range)
      .base(10)
      .nice();
    
    return logScale;
  }
  
  // Linear scale adjustments
  if (forceZero) {
    if (extent[0] > 0) domain[0] = 0;
    if (extent[1] < 0) domain[1] = 0;
  }
  
  if (symmetric) {
    const maxAbs = Math.max(Math.abs(extent[0]), Math.abs(extent[1]));
    domain = [-maxAbs, maxAbs];
  }
  
  const scale = d3.scaleLinear()
    .domain(domain)
    .range(range);
  
  // Apply nice() if the range is reasonable
  if (Math.abs(domain[1] - domain[0]) > niceThreshold) {
    scale.nice();
  }
  
  return scale;
};

/**
 * Create scales for multi-series data
 */
export const createMultiSeriesScales = (
  data: Array<{ series: string; x: any; y: number }>,
  xRange: [number, number],
  yRange: [number, number],
  options: {
    xType?: ScaleType;
    yType?: ScaleType;
    stackedY?: boolean;
    normalizedY?: boolean;
  } = {}
) => {
  const { xType = 'linear', yType = 'linear', stackedY = false, normalizedY = false } = options;
  
  // Extract unique x values and series
  const xValues = [...new Set(data.map(d => d.x))];
  const series = [...new Set(data.map(d => d.series))];
  
  // Create X scale
  const xScale = createScale({
    domain: xType === 'band' ? xValues.map(String) : d3.extent(xValues) as any,
    range: xRange,
    type: xType,
    nice: xType === 'linear' || xType === 'time'
  });
  
  // Create Y scale based on stacking/normalization
  let yDomain: [number, number];
  
  if (stackedY) {
    // Calculate stacked totals
    const stackedTotals = d3.rollup(
      data,
      values => d3.sum(values, d => Math.max(0, d.y)), // Only stack positive values
      d => d.x
    );
    yDomain = [0, d3.max([...stackedTotals.values()]) || 0];
  } else if (normalizedY) {
    yDomain = [0, 1];
  } else {
    const allYValues = data.map(d => d.y);
    yDomain = d3.extent(allYValues) as [number, number];
    if (yDomain[0] > 0) yDomain[0] = 0; // Include zero for better visualization
  }
  
  const yScale = createScale({
    domain: yDomain,
    range: yRange,
    type: yType,
    nice: true
  });
  
  // Color scale for series
  const colorScale = createColorScale('categorical', series);
  
  return {
    xScale,
    yScale,
    colorScale,
    series,
    xValues
  };
};

/**
 * Create scales with automatic margin calculation
 */
export const createScalesWithMargins = (
  data: any[],
  containerWidth: number,
  containerHeight: number,
  options: {
    xType?: ScaleType;
    yType?: ScaleType;
    xAxisLabel?: string;
    yAxisLabel?: string;
    titleSpace?: number;
    legendSpace?: number;
  } = {}
) => {
  const {
    xType = 'linear',
    yType = 'linear',
    xAxisLabel,
    yAxisLabel,
    titleSpace = 0,
    legendSpace = 0
  } = options;
  
  // Calculate margins based on labels and content
  let marginTop = 20 + titleSpace;
  let marginRight = 20 + legendSpace;
  let marginBottom = 40 + (xAxisLabel ? 25 : 0);
  let marginLeft = 60 + (yAxisLabel ? 25 : 0);
  
  // Adjust for band scales (categorical data) which may need more space
  if (xType === 'band') {
    marginBottom += 20; // Extra space for rotated labels
  }
  
  const innerWidth = containerWidth - marginLeft - marginRight;
  const innerHeight = containerHeight - marginTop - marginBottom;
  
  return {
    dimensions: {
      width: containerWidth,
      height: containerHeight,
      margin: { top: marginTop, right: marginRight, bottom: marginBottom, left: marginLeft }
    },
    innerDimensions: {
      width: innerWidth,
      height: innerHeight
    }
  };
};

/**
 * Utility to update scale domains dynamically
 */
export const updateScaleDomain = (
  scale: any,
  newDomain: any[],
  options: { nice?: boolean; clamp?: boolean } = {}
) => {
  const { nice = false, clamp = false } = options;
  
  scale.domain(newDomain);
  
  if (nice && typeof scale.nice === 'function') {
    scale.nice();
  }
  
  if (clamp && typeof scale.clamp === 'function') {
    scale.clamp(clamp);
  }
  
  return scale;
};

// Export commonly used scale configurations
export const commonScaleConfigs = {
  timeSeries: {
    x: { type: 'time' as ScaleType, nice: true },
    y: { type: 'linear' as ScaleType, nice: true, clamp: false }
  },
  
  categorical: {
    x: { type: 'band' as ScaleType, padding: 0.1 },
    y: { type: 'linear' as ScaleType, nice: true }
  },
  
  scatter: {
    x: { type: 'linear' as ScaleType, nice: true },
    y: { type: 'linear' as ScaleType, nice: true }
  },
  
  heatmap: {
    x: { type: 'band' as ScaleType, padding: 0.05 },
    y: { type: 'band' as ScaleType, padding: 0.05 },
    color: { type: 'sequential' }
  },
  
  gauge: {
    angle: { type: 'linear' as ScaleType, clamp: true },
    color: { type: 'sequential' }
  }
};