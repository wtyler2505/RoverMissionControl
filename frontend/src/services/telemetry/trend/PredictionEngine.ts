/**
 * PredictionEngine - Advanced prediction service with confidence intervals
 * Implements multi-step forecasting with various methods and ensemble predictions
 */

import { TypedEventEmitter as EventEmitter } from '../../websocket/EventEmitter';
import { TelemetryStream } from '../TelemetryAnalyzer';
import {
  PredictionConfig,
  PredictionResult,
  EnsemblePrediction,
  ARIMAModel
} from './TrendTypes';
import { AdvancedTrendAnalyzer } from './AdvancedTrendAnalyzer';
import * as ss from 'simple-statistics';

/**
 * Prediction engine events
 */
export interface PredictionEngineEvents {
  'prediction:start': (streamId: string, horizon: number) => void;
  'prediction:complete': (result: PredictionResult) => void;
  'prediction:error': (error: Error, streamId: string) => void;
  'model:updated': (modelName: string, performance: number) => void;
}

/**
 * Individual prediction model interface
 */
interface PredictionModel {
  name: string;
  predict(data: number[], horizon: number): number[];
  getConfidenceInterval(predictions: number[], level: number): { lower: number[]; upper: number[] };
  updatePerformance(actual: number[], predicted: number[]): void;
  getPerformance(): number;
}

/**
 * Simple Exponential Smoothing model
 */
class ExponentialSmoothingModel implements PredictionModel {
  name = 'Exponential Smoothing';
  private alpha: number;
  private performance = 0.5;

  constructor(alpha: number = 0.3) {
    this.alpha = alpha;
  }

  predict(data: number[], horizon: number): number[] {
    if (data.length === 0) return [];
    
    // Calculate initial level
    let level = data[0];
    
    // Update level through the data
    for (let i = 1; i < data.length; i++) {
      level = this.alpha * data[i] + (1 - this.alpha) * level;
    }
    
    // Generate forecasts
    const predictions: number[] = [];
    for (let h = 0; h < horizon; h++) {
      predictions.push(level);
    }
    
    return predictions;
  }

  getConfidenceInterval(predictions: number[], level: number): { lower: number[]; upper: number[] } {
    const z = this.getZScore(level);
    const stdError = 0.1; // Simplified
    
    return {
      lower: predictions.map(p => p - z * stdError * p),
      upper: predictions.map(p => p + z * stdError * p)
    };
  }

  updatePerformance(actual: number[], predicted: number[]): void {
    const mape = this.calculateMAPE(actual, predicted);
    this.performance = Math.max(0, 1 - mape);
  }

  getPerformance(): number {
    return this.performance;
  }

  private getZScore(confidenceLevel: number): number {
    // Common confidence levels
    const zScores: Record<number, number> = {
      0.90: 1.645,
      0.95: 1.96,
      0.99: 2.576
    };
    return zScores[confidenceLevel] || 1.96;
  }

  private calculateMAPE(actual: number[], predicted: number[]): number {
    if (actual.length !== predicted.length || actual.length === 0) return 1;
    
    let sum = 0;
    let count = 0;
    
    for (let i = 0; i < actual.length; i++) {
      if (actual[i] !== 0) {
        sum += Math.abs((actual[i] - predicted[i]) / actual[i]);
        count++;
      }
    }
    
    return count > 0 ? sum / count : 1;
  }
}

/**
 * Holt-Winters model with trend and seasonality
 */
class HoltWintersModel implements PredictionModel {
  name = 'Holt-Winters';
  private alpha: number;
  private beta: number;
  private gamma: number;
  private seasonalPeriod: number;
  private performance = 0.5;

  constructor(alpha = 0.3, beta = 0.1, gamma = 0.1, seasonalPeriod = 12) {
    this.alpha = alpha;
    this.beta = beta;
    this.gamma = gamma;
    this.seasonalPeriod = seasonalPeriod;
  }

  predict(data: number[], horizon: number): number[] {
    if (data.length < this.seasonalPeriod * 2) {
      // Fall back to simple exponential smoothing
      return new ExponentialSmoothingModel(this.alpha).predict(data, horizon);
    }
    
    // Initialize components
    const { level, trend, seasonal } = this.initializeComponents(data);
    let currentLevel = level;
    let currentTrend = trend;
    const currentSeasonal = [...seasonal];
    
    // Update components through the data
    for (let i = this.seasonalPeriod; i < data.length; i++) {
      const seasonalIndex = i % this.seasonalPeriod;
      const oldLevel = currentLevel;
      
      currentLevel = this.alpha * (data[i] / currentSeasonal[seasonalIndex]) + 
                    (1 - this.alpha) * (currentLevel + currentTrend);
      currentTrend = this.beta * (currentLevel - oldLevel) + 
                    (1 - this.beta) * currentTrend;
      currentSeasonal[seasonalIndex] = this.gamma * (data[i] / currentLevel) + 
                                       (1 - this.gamma) * currentSeasonal[seasonalIndex];
    }
    
    // Generate forecasts
    const predictions: number[] = [];
    for (let h = 0; h < horizon; h++) {
      const seasonalIndex = (data.length + h) % this.seasonalPeriod;
      predictions.push((currentLevel + currentTrend * (h + 1)) * currentSeasonal[seasonalIndex]);
    }
    
    return predictions;
  }

  getConfidenceInterval(predictions: number[], level: number): { lower: number[]; upper: number[] } {
    const z = this.getZScore(level);
    const stdError = 0.15; // Simplified, increases with horizon
    
    return {
      lower: predictions.map((p, i) => p - z * stdError * p * Math.sqrt(i + 1)),
      upper: predictions.map((p, i) => p + z * stdError * p * Math.sqrt(i + 1))
    };
  }

  updatePerformance(actual: number[], predicted: number[]): void {
    const mape = this.calculateMAPE(actual, predicted);
    this.performance = Math.max(0, 1 - mape);
  }

  getPerformance(): number {
    return this.performance;
  }

  private initializeComponents(data: number[]): { level: number; trend: number; seasonal: number[] } {
    // Simple initialization
    const firstSeason = data.slice(0, this.seasonalPeriod);
    const secondSeason = data.slice(this.seasonalPeriod, 2 * this.seasonalPeriod);
    
    const level = ss.mean(firstSeason);
    const trend = (ss.mean(secondSeason) - ss.mean(firstSeason)) / this.seasonalPeriod;
    
    const seasonal: number[] = [];
    for (let i = 0; i < this.seasonalPeriod; i++) {
      seasonal.push(data[i] / level);
    }
    
    return { level, trend, seasonal };
  }

  private getZScore(confidenceLevel: number): number {
    const zScores: Record<number, number> = {
      0.90: 1.645,
      0.95: 1.96,
      0.99: 2.576
    };
    return zScores[confidenceLevel] || 1.96;
  }

  private calculateMAPE(actual: number[], predicted: number[]): number {
    if (actual.length !== predicted.length || actual.length === 0) return 1;
    
    let sum = 0;
    let count = 0;
    
    for (let i = 0; i < actual.length; i++) {
      if (actual[i] !== 0) {
        sum += Math.abs((actual[i] - predicted[i]) / actual[i]);
        count++;
      }
    }
    
    return count > 0 ? sum / count : 1;
  }
}

/**
 * ARIMA-based prediction model
 */
class ARIMAPredictionModel implements PredictionModel {
  name = 'ARIMA';
  private model?: ARIMAModel;
  private performance = 0.5;
  private trendAnalyzer: AdvancedTrendAnalyzer;

  constructor(trendAnalyzer: AdvancedTrendAnalyzer) {
    this.trendAnalyzer = trendAnalyzer;
  }

  async fit(data: number[]): Promise<void> {
    // Use AdvancedTrendAnalyzer to fit ARIMA model
    const stream: TelemetryStream = {
      id: 'temp',
      name: 'temp',
      data,
      timestamps: data.map((_, i) => new Date(Date.now() - (data.length - i) * 1000)),
      sampleRate: 1
    };
    
    const analysis = await this.trendAnalyzer.analyzeStream(stream);
    this.model = analysis.arima;
  }

  predict(data: number[], horizon: number): number[] {
    if (!this.model) {
      // Fallback to exponential smoothing if ARIMA not fitted
      return new ExponentialSmoothingModel().predict(data, horizon);
    }
    
    const predictions: number[] = [];
    const { ar, ma, constant = 0 } = this.model.coefficients;
    
    // Use the last values as initial conditions
    const lastValues = data.slice(-Math.max(ar.length, ma.length));
    const residuals = new Array(ma.length).fill(0);
    
    for (let h = 0; h < horizon; h++) {
      let prediction = constant || 0;
      
      // AR component
      for (let i = 0; i < ar.length; i++) {
        const index = lastValues.length - 1 - i + h;
        if (index >= 0 && index < lastValues.length) {
          prediction += ar[i] * lastValues[index];
        } else if (index >= lastValues.length) {
          prediction += ar[i] * predictions[index - lastValues.length];
        }
      }
      
      // MA component
      for (let i = 0; i < ma.length; i++) {
        if (i < residuals.length) {
          prediction += ma[i] * residuals[i];
        }
      }
      
      predictions.push(prediction);
    }
    
    return predictions;
  }

  getConfidenceInterval(predictions: number[], level: number): { lower: number[]; upper: number[] } {
    const z = this.getZScore(level);
    const sigma = this.model ? Math.sqrt(this.model.sigma2) : 0.1;
    
    // Confidence intervals widen with forecast horizon
    return {
      lower: predictions.map((p, i) => p - z * sigma * Math.sqrt(i + 1)),
      upper: predictions.map((p, i) => p + z * sigma * Math.sqrt(i + 1))
    };
  }

  updatePerformance(actual: number[], predicted: number[]): void {
    const mape = this.calculateMAPE(actual, predicted);
    this.performance = Math.max(0, 1 - mape);
  }

  getPerformance(): number {
    return this.performance;
  }

  private getZScore(confidenceLevel: number): number {
    const zScores: Record<number, number> = {
      0.90: 1.645,
      0.95: 1.96,
      0.99: 2.576
    };
    return zScores[confidenceLevel] || 1.96;
  }

  private calculateMAPE(actual: number[], predicted: number[]): number {
    if (actual.length !== predicted.length || actual.length === 0) return 1;
    
    let sum = 0;
    let count = 0;
    
    for (let i = 0; i < actual.length; i++) {
      if (actual[i] !== 0) {
        sum += Math.abs((actual[i] - predicted[i]) / actual[i]);
        count++;
      }
    }
    
    return count > 0 ? sum / count : 1;
  }
}

/**
 * Trend-based prediction model
 */
class TrendPredictionModel implements PredictionModel {
  name = 'Trend';
  private trendType: 'linear' | 'polynomial' | 'exponential' = 'linear';
  private coefficients: number[] = [];
  private performance = 0.5;

  predict(data: number[], horizon: number): number[] {
    // Fit trend to historical data
    const x = Array.from({ length: data.length }, (_, i) => i);
    this.fitTrend(x, data);
    
    // Extrapolate trend
    const predictions: number[] = [];
    for (let h = 0; h < horizon; h++) {
      const xValue = data.length + h;
      predictions.push(this.evaluateTrend(xValue));
    }
    
    return predictions;
  }

  getConfidenceInterval(predictions: number[], level: number): { lower: number[]; upper: number[] } {
    const z = this.getZScore(level);
    const stdError = 0.1; // Simplified, should be based on residuals
    
    // Confidence intervals widen with forecast horizon
    return {
      lower: predictions.map((p, i) => p - z * stdError * p * Math.sqrt(i + 1)),
      upper: predictions.map((p, i) => p + z * stdError * p * Math.sqrt(i + 1))
    };
  }

  updatePerformance(actual: number[], predicted: number[]): void {
    const mape = this.calculateMAPE(actual, predicted);
    this.performance = Math.max(0, 1 - mape);
  }

  getPerformance(): number {
    return this.performance;
  }

  private fitTrend(x: number[], y: number[]): void {
    // Simple linear regression
    const regression = ss.linearRegression(x.map((xi, i) => [xi, y[i]]));
    this.coefficients = [regression.b, regression.m];
    this.trendType = 'linear';
  }

  private evaluateTrend(x: number): number {
    if (this.trendType === 'linear' && this.coefficients.length >= 2) {
      return this.coefficients[0] + this.coefficients[1] * x;
    }
    return 0;
  }

  private getZScore(confidenceLevel: number): number {
    const zScores: Record<number, number> = {
      0.90: 1.645,
      0.95: 1.96,
      0.99: 2.576
    };
    return zScores[confidenceLevel] || 1.96;
  }

  private calculateMAPE(actual: number[], predicted: number[]): number {
    if (actual.length !== predicted.length || actual.length === 0) return 1;
    
    let sum = 0;
    let count = 0;
    
    for (let i = 0; i < actual.length; i++) {
      if (actual[i] !== 0) {
        sum += Math.abs((actual[i] - predicted[i]) / actual[i]);
        count++;
      }
    }
    
    return count > 0 ? sum / count : 1;
  }
}

/**
 * Main PredictionEngine class
 */
export class PredictionEngine extends EventEmitter<PredictionEngineEvents> {
  private models: Map<string, PredictionModel> = new Map();
  private trendAnalyzer: AdvancedTrendAnalyzer;
  private historicalPredictions: Map<string, PredictionResult[]> = new Map();

  constructor(trendAnalyzer: AdvancedTrendAnalyzer) {
    super();
    this.trendAnalyzer = trendAnalyzer;
    
    // Initialize models
    this.models.set('exponential', new ExponentialSmoothingModel());
    this.models.set('holt-winters', new HoltWintersModel());
    this.models.set('arima', new ARIMAPredictionModel(trendAnalyzer));
    this.models.set('trend', new TrendPredictionModel());
  }

  /**
   * Generate predictions for a telemetry stream
   */
  async predict(
    stream: TelemetryStream,
    config: PredictionConfig
  ): Promise<PredictionResult> {
    this.emit('prediction:start', stream.id, config.horizon);
    
    try {
      let result: PredictionResult;
      
      if (config.method === 'ensemble') {
        result = await this.ensemblePredict(stream, config);
      } else {
        result = await this.singleModelPredict(stream, config);
      }
      
      // Store historical prediction for performance tracking
      if (!this.historicalPredictions.has(stream.id)) {
        this.historicalPredictions.set(stream.id, []);
      }
      this.historicalPredictions.get(stream.id)!.push(result);
      
      // Limit historical storage
      const history = this.historicalPredictions.get(stream.id)!;
      if (history.length > 100) {
        history.shift();
      }
      
      this.emit('prediction:complete', result);
      return result;
      
    } catch (error) {
      this.emit('prediction:error', error as Error, stream.id);
      throw error;
    }
  }

  /**
   * Single model prediction
   */
  private async singleModelPredict(
    stream: TelemetryStream,
    config: PredictionConfig
  ): Promise<PredictionResult> {
    const modelKey = config.method === 'arima' ? 'arima' : 
                    config.method === 'exponential' ? 'exponential' : 
                    config.method === 'trend' ? 'trend' : 'holt-winters';
    
    const model = this.models.get(modelKey);
    if (!model) {
      throw new Error(`Unknown prediction method: ${config.method}`);
    }
    
    // Fit ARIMA model if needed
    if (modelKey === 'arima' && model instanceof ARIMAPredictionModel) {
      await model.fit(stream.data);
    }
    
    // Generate predictions
    const predictions = model.predict(stream.data, config.horizon);
    
    // Generate timestamps
    const lastTimestamp = stream.timestamps[stream.timestamps.length - 1].getTime();
    const avgInterval = this.calculateAverageInterval(stream.timestamps);
    const timestamps = Array.from({ length: config.horizon }, (_, i) => 
      lastTimestamp + (i + 1) * avgInterval
    );
    
    // Calculate confidence intervals
    const { lower, upper } = model.getConfidenceInterval(predictions, config.confidenceLevel);
    
    // Calculate prediction intervals (wider than confidence intervals)
    const predictionIntervals = this.calculatePredictionIntervals(
      predictions,
      lower,
      upper,
      config.confidenceLevel
    );
    
    return {
      predictions,
      timestamps,
      confidenceIntervals: {
        lower,
        upper,
        level: config.confidenceLevel
      },
      predictionIntervals,
      method: model.name
    };
  }

  /**
   * Ensemble prediction combining multiple models
   */
  private async ensemblePredict(
    stream: TelemetryStream,
    config: PredictionConfig
  ): Promise<EnsemblePrediction> {
    const modelPredictions: Array<{
      name: string;
      weight: number;
      predictions: number[];
      performance: number;
    }> = [];
    
    // Get predictions from each model
    for (const [key, model] of this.models) {
      try {
        // Fit ARIMA if needed
        if (key === 'arima' && model instanceof ARIMAPredictionModel) {
          await model.fit(stream.data);
        }
        
        const predictions = model.predict(stream.data, config.horizon);
        const performance = model.getPerformance();
        
        modelPredictions.push({
          name: model.name,
          weight: performance,
          predictions,
          performance
        });
      } catch (error) {
        // Skip failed models
        console.warn(`Model ${model.name} failed:`, error);
      }
    }
    
    if (modelPredictions.length === 0) {
      throw new Error('All models failed to generate predictions');
    }
    
    // Normalize weights
    const totalWeight = modelPredictions.reduce((sum, m) => sum + m.weight, 0);
    modelPredictions.forEach(m => m.weight /= totalWeight);
    
    // Calculate weighted ensemble predictions
    const ensemblePredictions = new Array(config.horizon).fill(0);
    for (let i = 0; i < config.horizon; i++) {
      for (const model of modelPredictions) {
        ensemblePredictions[i] += model.predictions[i] * model.weight;
      }
    }
    
    // Generate timestamps
    const lastTimestamp = stream.timestamps[stream.timestamps.length - 1].getTime();
    const avgInterval = this.calculateAverageInterval(stream.timestamps);
    const timestamps = Array.from({ length: config.horizon }, (_, i) => 
      lastTimestamp + (i + 1) * avgInterval
    );
    
    // Calculate ensemble confidence intervals
    const { lower, upper } = this.calculateEnsembleConfidenceIntervals(
      modelPredictions,
      ensemblePredictions,
      config.confidenceLevel
    );
    
    // Calculate prediction intervals
    const predictionIntervals = this.calculatePredictionIntervals(
      ensemblePredictions,
      lower,
      upper,
      config.confidenceLevel
    );
    
    return {
      predictions: ensemblePredictions,
      timestamps,
      confidenceIntervals: {
        lower,
        upper,
        level: config.confidenceLevel
      },
      predictionIntervals,
      method: 'Ensemble',
      models: modelPredictions,
      aggregationMethod: 'weighted'
    };
  }

  /**
   * Update model performance based on actual vs predicted
   */
  updateModelPerformance(streamId: string, actual: number[]): void {
    const history = this.historicalPredictions.get(streamId);
    if (!history || history.length === 0) return;
    
    // Find predictions that can be evaluated
    for (const prediction of history) {
      const predictedValues = prediction.predictions.slice(0, actual.length);
      if (predictedValues.length === 0) continue;
      
      // Update performance for the model that made this prediction
      for (const [key, model] of this.models) {
        if (model.name === prediction.method) {
          model.updatePerformance(actual.slice(0, predictedValues.length), predictedValues);
          this.emit('model:updated', model.name, model.getPerformance());
          break;
        }
      }
    }
  }

  /**
   * Calculate average time interval
   */
  private calculateAverageInterval(timestamps: Date[]): number {
    if (timestamps.length < 2) return 1000; // Default 1 second
    
    let totalInterval = 0;
    for (let i = 1; i < timestamps.length; i++) {
      totalInterval += timestamps[i].getTime() - timestamps[i - 1].getTime();
    }
    
    return totalInterval / (timestamps.length - 1);
  }

  /**
   * Calculate prediction intervals (wider than confidence intervals)
   */
  private calculatePredictionIntervals(
    predictions: number[],
    lowerCI: number[],
    upperCI: number[],
    level: number
  ): { lower: number[]; upper: number[]; level: number } {
    // Prediction intervals are typically 1.5-2x wider than confidence intervals
    const factor = 1.5;
    
    return {
      lower: predictions.map((p, i) => p - factor * (p - lowerCI[i])),
      upper: predictions.map((p, i) => p + factor * (upperCI[i] - p)),
      level
    };
  }

  /**
   * Calculate ensemble confidence intervals
   */
  private calculateEnsembleConfidenceIntervals(
    models: Array<{ predictions: number[]; weight: number }>,
    ensemble: number[],
    level: number
  ): { lower: number[]; upper: number[] } {
    const z = this.getZScore(level);
    const lower: number[] = [];
    const upper: number[] = [];
    
    for (let i = 0; i < ensemble.length; i++) {
      // Calculate weighted variance across models
      let variance = 0;
      for (const model of models) {
        const diff = model.predictions[i] - ensemble[i];
        variance += model.weight * diff * diff;
      }
      
      const stdDev = Math.sqrt(variance) * Math.sqrt(i + 1); // Increase with horizon
      lower.push(ensemble[i] - z * stdDev);
      upper.push(ensemble[i] + z * stdDev);
    }
    
    return { lower, upper };
  }

  /**
   * Get Z-score for confidence level
   */
  private getZScore(confidenceLevel: number): number {
    const zScores: Record<number, number> = {
      0.90: 1.645,
      0.95: 1.96,
      0.99: 2.576
    };
    return zScores[confidenceLevel] || 1.96;
  }

  /**
   * Get model performance metrics
   */
  getModelPerformance(): Map<string, number> {
    const performance = new Map<string, number>();
    for (const [key, model] of this.models) {
      performance.set(model.name, model.getPerformance());
    }
    return performance;
  }

  /**
   * Clear historical predictions
   */
  clearHistory(): void {
    this.historicalPredictions.clear();
  }
}