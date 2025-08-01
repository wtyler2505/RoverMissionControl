/**
 * Annotation Components Export
 * Central export for all annotation-related components
 */

// Core annotation components
export { ChartAnnotations } from '../ChartAnnotations';
export type { ChartAnnotationsProps } from '../ChartAnnotations';

export { TimelineAnnotations } from '../TimelineAnnotations';
export type { TimelineAnnotationsProps, TimelineAnnotation } from '../TimelineAnnotations';

// Annotation types
export * from '../../../types/annotations';

// Annotation service
export { AnnotationService, getAnnotationService, destroyAnnotationService } from '../../../services/AnnotationService';
export type { AnnotationServiceConfig } from '../../../services/AnnotationService';