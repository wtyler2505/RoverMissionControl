/**
 * Chart Utility Functions
 */

export {
  binData,
  decimateData,
  smoothData,
  removeOutliers,
  aggregateByTimeWindow,
  convertToHeatmapData,
  pivotData,
  interpolateMissingValues,
  calculateCorrelationMatrix,
  createTransformationPipeline,
  commonPipelines
} from './dataTransformers';

export {
  createScale,
  inferScaleType,
  createTimeScale,
  createColorScale,
  createAdaptiveScale,
  createMultiSeriesScales,
  createScalesWithMargins,
  updateScaleDomain,
  commonScaleConfigs
} from './scaleFactories';