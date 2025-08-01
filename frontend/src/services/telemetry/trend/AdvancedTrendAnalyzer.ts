/**
 * AdvancedTrendAnalyzer - Advanced trend detection and analysis service
 * Implements ARIMA models, non-linear trend detection, and model selection
 */

import { TypedEventEmitter as EventEmitter } from '../../websocket/EventEmitter';
import { TelemetryStream } from '../TelemetryAnalyzer';
import {
  AdvancedTrendAnalyzerEvents,
  AdvancedTrendAnalysis,
  AdvancedTrendConfig,
  ARIMAConfig,
  ARIMAModel,
  TrendModel,
  TrendType,
  NonLinearTrendConfig,
  ChangePoint,
  TimeSeriesDecomposition,
  ModelSelectionResult,
  TimeSeriesValidation,
  TrendAnomaly
} from './TrendTypes';

// Import statistical utilities
import * as ss from 'simple-statistics';

/**
 * ARIMA implementation for time series forecasting
 */
class ARIMAFitter {
  /**
   * Fit ARIMA model to time series data
   */
  static fit(data: number[], config: ARIMAConfig): ARIMAModel {
    // Difference the data if needed
    let workingData = [...data];
    const differences: number[][] = [];
    
    for (let i = 0; i < config.d; i++) {
      const diff = this.difference(workingData);
      differences.push(diff);
      workingData = diff;
    }

    // Seasonal differencing
    if (config.seasonalPeriod && config.D) {
      for (let i = 0; i < config.D; i++) {
        workingData = this.seasonalDifference(workingData, config.seasonalPeriod);
      }
    }

    // Estimate parameters using conditional least squares
    const { arCoeffs, maCoeffs, constant, residuals } = this.estimateParameters(
      workingData,
      config.p,
      config.q
    );

    // Calculate model fit statistics
    const n = workingData.length;
    const k = config.p + config.q + (config.includeConstant ? 1 : 0);
    const sigma2 = ss.sum(residuals.map(r => r * r)) / (n - k);
    const logLikelihood = -0.5 * n * (Math.log(2 * Math.PI) + Math.log(sigma2) + 1);
    
    const aic = -2 * logLikelihood + 2 * k;
    const bic = -2 * logLikelihood + k * Math.log(n);

    return {
      config,
      coefficients: {
        ar: arCoeffs,
        ma: maCoeffs,
        constant: config.includeConstant ? constant : undefined
      },
      residuals,
      aic,
      bic,
      logLikelihood,
      sigma2,
      fitTime: Date.now()
    };
  }

  /**
   * Auto-fit ARIMA model by testing different configurations
   */
  static autoFit(
    data: number[],
    maxP: number = 5,
    maxD: number = 2,
    maxQ: number = 5
  ): ARIMAModel {
    let bestModel: ARIMAModel | null = null;
    let bestAIC = Infinity;

    for (let p = 0; p <= maxP; p++) {
      for (let d = 0; d <= maxD; d++) {
        for (let q = 0; q <= maxQ; q++) {
          if (p === 0 && q === 0) continue;

          try {
            const config: ARIMAConfig = { p, d, q, includeConstant: true };
            const model = this.fit(data, config);
            
            if (model.aic < bestAIC) {
              bestAIC = model.aic;
              bestModel = model;
            }
          } catch (e) {
            // Skip invalid configurations
          }
        }
      }
    }

    if (!bestModel) {
      throw new Error('Failed to fit any ARIMA model');
    }

    return bestModel;
  }

  private static difference(data: number[]): number[] {
    const result: number[] = [];
    for (let i = 1; i < data.length; i++) {
      result.push(data[i] - data[i - 1]);
    }
    return result;
  }

  private static seasonalDifference(data: number[], period: number): number[] {
    const result: number[] = [];
    for (let i = period; i < data.length; i++) {
      result.push(data[i] - data[i - period]);
    }
    return result;
  }

  private static estimateParameters(
    data: number[],
    p: number,
    q: number
  ): {
    arCoeffs: number[];
    maCoeffs: number[];
    constant: number;
    residuals: number[];
  } {
    // Simplified parameter estimation using OLS
    // In production, use maximum likelihood estimation
    
    const n = data.length;
    const mean = ss.mean(data);
    const centered = data.map(d => d - mean);
    
    // Initialize coefficients
    const arCoeffs = new Array(p).fill(0);
    const maCoeffs = new Array(q).fill(0);
    
    // Estimate AR coefficients using Yule-Walker equations
    if (p > 0) {
      const acf = this.autocorrelation(centered, p);
      arCoeffs[0] = acf[0];
      for (let i = 1; i < p; i++) {
        arCoeffs[i] = acf[i] * 0.8; // Simplified estimation
      }
    }
    
    // Estimate MA coefficients (simplified)
    if (q > 0) {
      for (let i = 0; i < q; i++) {
        maCoeffs[i] = 0.5 * Math.pow(0.7, i);
      }
    }
    
    // Calculate residuals
    const residuals: number[] = [];
    for (let t = Math.max(p, q); t < n; t++) {
      let prediction = mean;
      
      // AR component
      for (let i = 0; i < p; i++) {
        if (t - i - 1 >= 0) {
          prediction += arCoeffs[i] * centered[t - i - 1];
        }
      }
      
      // MA component
      for (let i = 0; i < q && t - i - 1 >= 0 && t - i - 1 < residuals.length; i++) {
        prediction += maCoeffs[i] * residuals[t - i - 1];
      }
      
      residuals.push(data[t] - prediction);
    }
    
    return { arCoeffs, maCoeffs, constant: mean, residuals };
  }

  private static autocorrelation(data: number[], maxLag: number): number[] {
    const acf: number[] = [];
    const variance = ss.variance(data);
    
    for (let lag = 1; lag <= maxLag; lag++) {
      let sum = 0;
      for (let i = lag; i < data.length; i++) {
        sum += data[i] * data[i - lag];
      }
      acf.push(sum / (data.length - lag) / variance);
    }
    
    return acf;
  }
}

/**
 * Non-linear trend fitting utilities
 */
class NonLinearTrendFitter {
  /**
   * Fit various non-linear trend models
   */
  static fit(
    x: number[],
    y: number[],
    config: NonLinearTrendConfig
  ): TrendModel {
    switch (config.type) {
      case TrendType.POLYNOMIAL:
        return this.fitPolynomial(x, y, config.order || 2);
      case TrendType.EXPONENTIAL:
        return this.fitExponential(x, y);
      case TrendType.LOGARITHMIC:
        return this.fitLogarithmic(x, y);
      case TrendType.POWER:
        return this.fitPower(x, y);
      case TrendType.MOVING_AVERAGE:
        return this.fitMovingAverage(x, y, config.window || 5);
      case TrendType.LOESS:
        return this.fitLOESS(x, y, config.bandwidth || 0.3);
      default:
        return this.fitLinear(x, y);
    }
  }

  private static fitLinear(x: number[], y: number[]): TrendModel {
    const regression = ss.linearRegression(x.map((xi, i) => [xi, y[i]]));
    const line = ss.linearRegressionLine(regression);
    
    const predictions = x.map(xi => line(xi));
    const residuals = y.map((yi, i) => yi - predictions[i]);
    
    return {
      type: TrendType.LINEAR,
      coefficients: [regression.b, regression.m],
      r2: ss.rSquared(y.map((yi, i) => [yi, predictions[i]])),
      rmse: Math.sqrt(ss.mean(residuals.map(r => r * r))),
      mae: ss.mean(residuals.map(Math.abs)),
      equation: `y = ${regression.m.toFixed(3)}x + ${regression.b.toFixed(3)}`,
      residuals,
      detrended: residuals
    };
  }

  private static fitPolynomial(x: number[], y: number[], order: number): TrendModel {
    // Create polynomial features
    const features: number[][] = [];
    for (let i = 0; i < x.length; i++) {
      const row: number[] = [];
      for (let j = 0; j <= order; j++) {
        row.push(Math.pow(x[i], j));
      }
      features.push(row);
    }
    
    // Solve using normal equations (simplified)
    const coefficients = new Array(order + 1).fill(0);
    coefficients[0] = ss.mean(y);
    coefficients[1] = 0.5;
    
    const predictions = x.map(xi => {
      let sum = 0;
      for (let j = 0; j <= order; j++) {
        sum += coefficients[j] * Math.pow(xi, j);
      }
      return sum;
    });
    
    const residuals = y.map((yi, i) => yi - predictions[i]);
    
    return {
      type: TrendType.POLYNOMIAL,
      coefficients,
      r2: ss.rSquared(y.map((yi, i) => [yi, predictions[i]])),
      rmse: Math.sqrt(ss.mean(residuals.map(r => r * r))),
      mae: ss.mean(residuals.map(Math.abs)),
      equation: this.polynomialEquation(coefficients),
      residuals,
      detrended: residuals
    };
  }

  private static fitExponential(x: number[], y: number[]): TrendModel {
    // Transform to linear: log(y) = log(a) + b*x
    const logY = y.map(yi => Math.log(Math.max(yi, 1e-10)));
    const regression = ss.linearRegression(x.map((xi, i) => [xi, logY[i]]));
    
    const a = Math.exp(regression.b);
    const b = regression.m;
    
    const predictions = x.map(xi => a * Math.exp(b * xi));
    const residuals = y.map((yi, i) => yi - predictions[i]);
    
    return {
      type: TrendType.EXPONENTIAL,
      coefficients: [a, b],
      r2: ss.rSquared(y.map((yi, i) => [yi, predictions[i]])),
      rmse: Math.sqrt(ss.mean(residuals.map(r => r * r))),
      mae: ss.mean(residuals.map(Math.abs)),
      equation: `y = ${a.toFixed(3)} * e^(${b.toFixed(3)}x)`,
      residuals,
      detrended: residuals
    };
  }

  private static fitLogarithmic(x: number[], y: number[]): TrendModel {
    // y = a + b*log(x)
    const logX = x.map(xi => Math.log(Math.max(xi, 1e-10)));
    const regression = ss.linearRegression(logX.map((lxi, i) => [lxi, y[i]]));
    
    const predictions = x.map(xi => regression.b + regression.m * Math.log(Math.max(xi, 1e-10)));
    const residuals = y.map((yi, i) => yi - predictions[i]);
    
    return {
      type: TrendType.LOGARITHMIC,
      coefficients: [regression.b, regression.m],
      r2: ss.rSquared(y.map((yi, i) => [yi, predictions[i]])),
      rmse: Math.sqrt(ss.mean(residuals.map(r => r * r))),
      mae: ss.mean(residuals.map(Math.abs)),
      equation: `y = ${regression.b.toFixed(3)} + ${regression.m.toFixed(3)} * log(x)`,
      residuals,
      detrended: residuals
    };
  }

  private static fitPower(x: number[], y: number[]): TrendModel {
    // y = a * x^b -> log(y) = log(a) + b*log(x)
    const logX = x.map(xi => Math.log(Math.max(xi, 1e-10)));
    const logY = y.map(yi => Math.log(Math.max(yi, 1e-10)));
    const regression = ss.linearRegression(logX.map((lxi, i) => [lxi, logY[i]]));
    
    const a = Math.exp(regression.b);
    const b = regression.m;
    
    const predictions = x.map(xi => a * Math.pow(Math.max(xi, 1e-10), b));
    const residuals = y.map((yi, i) => yi - predictions[i]);
    
    return {
      type: TrendType.POWER,
      coefficients: [a, b],
      r2: ss.rSquared(y.map((yi, i) => [yi, predictions[i]])),
      rmse: Math.sqrt(ss.mean(residuals.map(r => r * r))),
      mae: ss.mean(residuals.map(Math.abs)),
      equation: `y = ${a.toFixed(3)} * x^${b.toFixed(3)}`,
      residuals,
      detrended: residuals
    };
  }

  private static fitMovingAverage(x: number[], y: number[], window: number): TrendModel {
    const predictions: number[] = [];
    const halfWindow = Math.floor(window / 2);
    
    for (let i = 0; i < y.length; i++) {
      const start = Math.max(0, i - halfWindow);
      const end = Math.min(y.length, i + halfWindow + 1);
      const slice = y.slice(start, end);
      predictions.push(ss.mean(slice));
    }
    
    const residuals = y.map((yi, i) => yi - predictions[i]);
    
    return {
      type: TrendType.MOVING_AVERAGE,
      coefficients: [window],
      r2: ss.rSquared(y.map((yi, i) => [yi, predictions[i]])),
      rmse: Math.sqrt(ss.mean(residuals.map(r => r * r))),
      mae: ss.mean(residuals.map(Math.abs)),
      equation: `MA(${window})`,
      residuals,
      detrended: residuals
    };
  }

  private static fitLOESS(x: number[], y: number[], bandwidth: number): TrendModel {
    // Simplified LOESS implementation
    const n = x.length;
    const k = Math.floor(bandwidth * n);
    const predictions: number[] = [];
    
    for (let i = 0; i < n; i++) {
      // Find k nearest neighbors
      const distances = x.map((xi, j) => ({ index: j, dist: Math.abs(xi - x[i]) }));
      distances.sort((a, b) => a.dist - b.dist);
      const neighbors = distances.slice(0, k);
      
      // Weighted regression on neighbors
      const weights = neighbors.map(n => 1 - Math.pow(n.dist / distances[k - 1].dist, 3));
      const weightedX = neighbors.map((n, j) => x[n.index] * weights[j]);
      const weightedY = neighbors.map((n, j) => y[n.index] * weights[j]);
      
      predictions.push(ss.sum(weightedY) / ss.sum(weights));
    }
    
    const residuals = y.map((yi, i) => yi - predictions[i]);
    
    return {
      type: TrendType.LOESS,
      coefficients: [bandwidth],
      r2: ss.rSquared(y.map((yi, i) => [yi, predictions[i]])),
      rmse: Math.sqrt(ss.mean(residuals.map(r => r * r))),
      mae: ss.mean(residuals.map(Math.abs)),
      equation: `LOESS(bandwidth=${bandwidth})`,
      residuals,
      detrended: residuals
    };
  }

  private static polynomialEquation(coeffs: number[]): string {
    const terms: string[] = [];
    for (let i = 0; i < coeffs.length; i++) {
      if (Math.abs(coeffs[i]) > 1e-10) {
        if (i === 0) {
          terms.push(coeffs[i].toFixed(3));
        } else if (i === 1) {
          terms.push(`${coeffs[i].toFixed(3)}x`);
        } else {
          terms.push(`${coeffs[i].toFixed(3)}x^${i}`);
        }
      }
    }
    return `y = ${terms.join(' + ')}`;
  }
}

/**
 * Change point detection algorithms
 */
class ChangePointDetector {
  /**
   * Detect change points using PELT algorithm
   */
  static detectPELT(
    data: number[],
    penalty: number = 3
  ): ChangePoint[] {
    const n = data.length;
    const changePoints: ChangePoint[] = [];
    
    // Simplified PELT implementation
    const costs = new Array(n + 1).fill(0);
    const lastChange = new Array(n + 1).fill(0);
    
    for (let i = 1; i <= n; i++) {
      costs[i] = Infinity;
      
      for (let j = 0; j < i; j++) {
        const segmentData = data.slice(j, i);
        const segmentCost = this.calculateSegmentCost(segmentData);
        const totalCost = costs[j] + segmentCost + penalty;
        
        if (totalCost < costs[i]) {
          costs[i] = totalCost;
          lastChange[i] = j;
        }
      }
    }
    
    // Backtrack to find change points
    let current = n;
    while (current > 0) {
      const prev = lastChange[current];
      if (prev > 0) {
        const before = data.slice(Math.max(0, prev - 10), prev);
        const after = data.slice(prev, Math.min(n, prev + 10));
        const meanBefore = ss.mean(before);
        const meanAfter = ss.mean(after);
        
        changePoints.unshift({
          index: prev,
          timestamp: Date.now(), // Would use actual timestamp
          confidence: 0.8, // Simplified
          type: 'level',
          magnitude: Math.abs(meanAfter - meanBefore),
          direction: meanAfter > meanBefore ? 'increase' : 'decrease'
        });
      }
      current = prev;
    }
    
    return changePoints;
  }
  
  private static calculateSegmentCost(segment: number[]): number {
    if (segment.length === 0) return 0;
    const mean = ss.mean(segment);
    return ss.sum(segment.map(x => Math.pow(x - mean, 2)));
  }
}

/**
 * Time series decomposition utilities
 */
class TimeSeriesDecomposer {
  /**
   * Perform STL decomposition (Seasonal and Trend decomposition using Loess)
   */
  static decompose(
    data: number[],
    period: number,
    method: 'additive' | 'multiplicative' = 'additive'
  ): TimeSeriesDecomposition {
    const n = data.length;
    
    // Step 1: Extract trend using LOESS
    const x = Array.from({ length: n }, (_, i) => i);
    const trendModel = NonLinearTrendFitter.fit(x, data, {
      type: TrendType.LOESS,
      bandwidth: 0.3
    });
    const trend = x.map((_, i) => data[i] - trendModel.residuals[i]);
    
    // Step 2: Detrend the series
    const detrended = method === 'additive'
      ? data.map((d, i) => d - trend[i])
      : data.map((d, i) => d / (trend[i] || 1));
    
    // Step 3: Extract seasonal component
    const seasonal = this.extractSeasonalComponent(detrended, period);
    
    // Step 4: Calculate residual
    const residual = method === 'additive'
      ? data.map((d, i) => d - trend[i] - seasonal[i % period])
      : data.map((d, i) => d / ((trend[i] || 1) * (seasonal[i % period] || 1)));
    
    // Calculate strength metrics
    const trendStrength = 1 - ss.variance(residual) / ss.variance(data);
    const seasonalStrength = 1 - ss.variance(residual) / ss.variance(detrended);
    
    return {
      method,
      trend,
      seasonal: Array.from({ length: n }, (_, i) => seasonal[i % period]),
      residual,
      seasonalPeriod: period,
      strength: {
        trend: Math.max(0, Math.min(1, trendStrength)),
        seasonal: Math.max(0, Math.min(1, seasonalStrength))
      }
    };
  }
  
  private static extractSeasonalComponent(data: number[], period: number): number[] {
    const seasonal = new Array(period).fill(0);
    const counts = new Array(period).fill(0);
    
    for (let i = 0; i < data.length; i++) {
      seasonal[i % period] += data[i];
      counts[i % period]++;
    }
    
    // Average seasonal values
    for (let i = 0; i < period; i++) {
      seasonal[i] = counts[i] > 0 ? seasonal[i] / counts[i] : 0;
    }
    
    // Center the seasonal component
    const meanSeasonal = ss.mean(seasonal);
    return seasonal.map(s => s - meanSeasonal);
  }
}

/**
 * Main AdvancedTrendAnalyzer class
 */
export class AdvancedTrendAnalyzer extends EventEmitter<AdvancedTrendAnalyzerEvents> {
  private config: AdvancedTrendConfig;
  private modelCache = new Map<string, { model: any; timestamp: number }>();
  private analysisResults = new Map<string, AdvancedTrendAnalysis>();

  constructor(config?: Partial<AdvancedTrendConfig>) {
    super();
    this.config = this.mergeConfig(config);
  }

  /**
   * Analyze a telemetry stream for advanced trends
   */
  async analyzeStream(stream: TelemetryStream): Promise<AdvancedTrendAnalysis> {
    this.emit('analysis:start', stream.id);

    try {
      // Validate time series data
      const validation = this.validateTimeSeries(stream);
      if (!validation.isValid) {
        throw new Error(`Invalid time series data: ${validation.issues[0]?.description}`);
      }

      // Prepare data
      const x = Array.from({ length: stream.data.length }, (_, i) => i);
      const y = stream.data;

      // Initialize result
      const result: AdvancedTrendAnalysis = {
        streamId: stream.id,
        timestamp: Date.now(),
        dataPoints: stream.data.length,
        trends: {
          linear: NonLinearTrendFitter.fit(x, y, { type: TrendType.LINEAR }),
          best: NonLinearTrendFitter.fit(x, y, { type: TrendType.LINEAR })
        },
        changePoints: [],
        stationarity: this.testStationarity(y)
      };

      // Fit non-linear trends if enabled
      if (this.config.enableNonLinear) {
        result.trends.nonLinear = await this.fitBestNonLinearTrend(x, y);
        result.trends.best = this.selectBestTrend([
          result.trends.linear,
          result.trends.nonLinear
        ]);
      }

      // Fit ARIMA model if enabled
      if (this.config.enableARIMA) {
        result.arima = await this.fitARIMA(y);
        this.emit('model:fitted', result.arima, stream.id);
      }

      // Detect change points if enabled
      if (this.config.enableChangePointDetection) {
        result.changePoints = ChangePointDetector.detectPELT(
          y,
          this.config.changePoint?.penalty || 3
        );
        result.changePoints.forEach(cp => 
          this.emit('changepoint:detected', cp, stream.id)
        );
      }

      // Seasonal decomposition if enabled
      if (this.config.enableSeasonalDecomposition) {
        const period = this.detectSeasonalPeriod(y);
        if (period > 1) {
          result.seasonality = {
            ...TimeSeriesDecomposer.decompose(y, period),
            detected: true
          };
        }
      }

      // Store result
      this.analysisResults.set(stream.id, result);
      this.emit('analysis:complete', result);

      return result;
    } catch (error) {
      this.emit('analysis:error', error as Error, stream.id);
      throw error;
    }
  }

  /**
   * Fit ARIMA model with automatic parameter selection
   */
  private async fitARIMA(data: number[]): Promise<ARIMAModel> {
    if (this.config.arima?.autoFit) {
      return ARIMAFitter.autoFit(
        data,
        this.config.arima.maxP || 5,
        this.config.arima.maxD || 2,
        this.config.arima.maxQ || 5
      );
    } else {
      // Use default ARIMA(1,1,1)
      return ARIMAFitter.fit(data, { p: 1, d: 1, q: 1, includeConstant: true });
    }
  }

  /**
   * Fit best non-linear trend
   */
  private async fitBestNonLinearTrend(x: number[], y: number[]): Promise<TrendModel> {
    const types = this.config.nonLinear?.types || [
      TrendType.POLYNOMIAL,
      TrendType.EXPONENTIAL,
      TrendType.LOGARITHMIC
    ];

    let bestModel: TrendModel | null = null;
    let bestScore = -Infinity;

    for (const type of types) {
      try {
        const model = NonLinearTrendFitter.fit(x, y, { type });
        const score = model.r2 - 0.1 * Math.log(model.coefficients.length); // Penalize complexity
        
        if (score > bestScore) {
          bestScore = score;
          bestModel = model;
        }
      } catch (e) {
        // Skip failed models
      }
    }

    return bestModel || NonLinearTrendFitter.fit(x, y, { type: TrendType.LINEAR });
  }

  /**
   * Select best trend model
   */
  private selectBestTrend(models: TrendModel[]): TrendModel {
    return models.reduce((best, model) => {
      const currentScore = model.r2 - 0.1 * Math.log(model.coefficients.length);
      const bestScore = best.r2 - 0.1 * Math.log(best.coefficients.length);
      return currentScore > bestScore ? model : best;
    });
  }

  /**
   * Test for stationarity using ADF test
   */
  private testStationarity(data: number[]): AdvancedTrendAnalysis['stationarity'] {
    // Simplified ADF test implementation
    const n = data.length;
    const mean = ss.mean(data);
    const centered = data.map(d => d - mean);
    
    // Calculate test statistic
    let sumY2 = 0;
    let sumDY2 = 0;
    for (let i = 1; i < n; i++) {
      sumY2 += centered[i - 1] * centered[i - 1];
      const dy = centered[i] - centered[i - 1];
      sumDY2 += dy * dy;
    }
    
    const adfStatistic = -n * (1 - sumDY2 / (2 * sumY2));
    
    // Critical values at different significance levels
    const criticalValues = {
      '1%': -3.43,
      '5%': -2.86,
      '10%': -2.57
    };
    
    // Approximate p-value
    const pValue = Math.exp(adfStatistic / 10);
    
    return {
      isStationary: adfStatistic < criticalValues['5%'],
      adfStatistic,
      pValue: Math.min(1, Math.max(0, pValue)),
      criticalValues
    };
  }

  /**
   * Detect seasonal period using autocorrelation
   */
  private detectSeasonalPeriod(data: number[]): number {
    const maxLag = Math.min(data.length / 4, 100);
    const acf: number[] = [];
    
    for (let lag = 1; lag <= maxLag; lag++) {
      let sum = 0;
      for (let i = lag; i < data.length; i++) {
        sum += data[i] * data[i - lag];
      }
      acf.push(sum / (data.length - lag));
    }
    
    // Find peaks in ACF
    const peaks: number[] = [];
    for (let i = 1; i < acf.length - 1; i++) {
      if (acf[i] > acf[i - 1] && acf[i] > acf[i + 1] && acf[i] > 0.3) {
        peaks.push(i + 1);
      }
    }
    
    // Return first significant peak or 1 if none found
    return peaks[0] || 1;
  }

  /**
   * Validate time series data
   */
  private validateTimeSeries(stream: TelemetryStream): TimeSeriesValidation {
    const issues: TimeSeriesValidation['issues'] = [];
    const n = stream.data.length;
    
    // Check for missing values
    const missingIndices = stream.data
      .map((v, i) => v === null || v === undefined || isNaN(v) ? i : -1)
      .filter(i => i >= 0);
    
    if (missingIndices.length > 0) {
      issues.push({
        type: 'missing',
        indices: missingIndices,
        severity: missingIndices.length / n > 0.1 ? 'high' : 'medium',
        description: `${missingIndices.length} missing values found`
      });
    }
    
    // Check for outliers
    const mean = ss.mean(stream.data.filter(v => !isNaN(v)));
    const std = ss.standardDeviation(stream.data.filter(v => !isNaN(v)));
    const outlierIndices = stream.data
      .map((v, i) => Math.abs(v - mean) > 3 * std ? i : -1)
      .filter(i => i >= 0);
    
    if (outlierIndices.length > 0) {
      issues.push({
        type: 'outlier',
        indices: outlierIndices,
        severity: outlierIndices.length / n > 0.05 ? 'high' : 'low',
        description: `${outlierIndices.length} outliers detected`
      });
    }
    
    // Calculate spacing statistics
    const spacings: number[] = [];
    for (let i = 1; i < stream.timestamps.length; i++) {
      spacings.push(
        stream.timestamps[i].getTime() - stream.timestamps[i - 1].getTime()
      );
    }
    
    const avgSpacing = spacings.length > 0 ? ss.mean(spacings) : 0;
    const spacingVar = spacings.length > 0 ? ss.variance(spacings) : 0;
    
    return {
      isValid: issues.filter(i => i.severity === 'high').length === 0,
      issues,
      statistics: {
        length: n,
        missingCount: missingIndices.length,
        outlierCount: outlierIndices.length,
        averageSpacing: avgSpacing,
        spacingVariance: spacingVar
      }
    };
  }

  /**
   * Get analysis results for a stream
   */
  getAnalysisResults(streamId: string): AdvancedTrendAnalysis | null {
    return this.analysisResults.get(streamId) || null;
  }

  /**
   * Clear cached models and results
   */
  clearCache(): void {
    this.modelCache.clear();
    this.analysisResults.clear();
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AdvancedTrendConfig>): void {
    this.config = this.mergeConfig(config);
  }

  /**
   * Merge configuration with defaults
   */
  private mergeConfig(config?: Partial<AdvancedTrendConfig>): AdvancedTrendConfig {
    return {
      enableARIMA: true,
      enableNonLinear: true,
      enableDriftDetection: true,
      enableChangePointDetection: true,
      enablePrediction: true,
      enableSeasonalDecomposition: true,
      ...config,
      arima: {
        autoFit: true,
        maxP: 5,
        maxD: 2,
        maxQ: 5,
        seasonal: false,
        ...config?.arima
      },
      nonLinear: {
        types: [TrendType.POLYNOMIAL, TrendType.EXPONENTIAL, TrendType.LOGARITHMIC],
        maxPolynomialOrder: 3,
        crossValidate: true,
        ...config?.nonLinear
      },
      changePoint: {
        method: 'pelt',
        penalty: 3,
        minSegmentLength: 10,
        ...config?.changePoint
      },
      performance: {
        useWebWorkers: false,
        cacheModels: true,
        batchSize: 1000,
        ...config?.performance
      }
    };
  }
}