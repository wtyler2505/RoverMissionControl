/**
 * Rich Content Types for Alert System
 * Defines types for rich content components including text, images, forms, and embeds
 */

import { ReactNode } from 'react';
import { AlertAction } from './AlertActionTypes';

// Base content types
export type RichContentType = 
  | 'text' 
  | 'markdown' 
  | 'html' 
  | 'image' 
  | 'link' 
  | 'form' 
  | 'progress' 
  | 'component' 
  | 'table'
  | 'list'
  | 'code';

// Content security levels
export type ContentSecurityLevel = 'trusted' | 'sanitized' | 'restricted';

// Content sizing constraints
export interface ContentConstraints {
  maxWidth?: string;
  maxHeight?: string;
  aspectRatio?: string;
  responsive?: boolean;
  mobile?: {
    maxWidth?: string;
    maxHeight?: string;
    hide?: boolean;
  };
}

// Base rich content interface
export interface BaseRichContent {
  id: string;
  type: RichContentType;
  securityLevel: ContentSecurityLevel;
  constraints?: ContentConstraints;
  ariaLabel?: string;
  ariaDescription?: string;
  className?: string;
  testId?: string;
}

// Rich text content (supports markdown/HTML)
export interface RichTextContent extends BaseRichContent {
  type: 'text' | 'markdown' | 'html';
  content: string;
  allowedTags?: string[]; // For HTML sanitization
  allowedAttributes?: Record<string, string[]>;
  linkTarget?: '_blank' | '_self';
  enableSyntaxHighlighting?: boolean;
}

// Image content
export interface ImageContent extends BaseRichContent {
  type: 'image';
  src: string;
  alt: string;
  title?: string;
  loading?: 'lazy' | 'eager';
  sizes?: string;
  srcSet?: string;
  fallbackSrc?: string;
  onLoad?: () => void;
  onError?: () => void;
}

// Link content
export interface LinkContent extends BaseRichContent {
  type: 'link';
  href: string;
  text: string;
  external?: boolean;
  target?: '_blank' | '_self';
  rel?: string;
  onClick?: (event: React.MouseEvent) => void;
  icon?: ReactNode;
}

// Form content
export interface FormFieldBase {
  id: string;
  name: string;
  label: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  ariaDescription?: string;
  validation?: {
    pattern?: string;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    custom?: (value: any) => string | null;
  };
}

export interface TextFormField extends FormFieldBase {
  type: 'text' | 'email' | 'password' | 'tel' | 'url';
  value?: string;
  multiline?: boolean;
  rows?: number;
}

export interface SelectFormField extends FormFieldBase {
  type: 'select';
  options: Array<{ value: string; label: string; disabled?: boolean }>;
  value?: string;
  multiple?: boolean;
}

export interface CheckboxFormField extends FormFieldBase {
  type: 'checkbox';
  checked?: boolean;
}

export interface RadioFormField extends FormFieldBase {
  type: 'radio';
  options: Array<{ value: string; label: string; disabled?: boolean }>;
  value?: string;
}

export type FormField = TextFormField | SelectFormField | CheckboxFormField | RadioFormField;

export interface FormContent extends BaseRichContent {
  type: 'form';
  fields: FormField[];
  submitText?: string;
  cancelText?: string;
  onSubmit: (data: Record<string, any>) => Promise<{ success: boolean; error?: string }>;
  onCancel?: () => void;
  initialData?: Record<string, any>;
  validationMode?: 'onChange' | 'onBlur' | 'onSubmit';
}

// Progress bar content
export interface ProgressContent extends BaseRichContent {
  type: 'progress';
  value: number; // 0-100
  max?: number;
  label?: string;
  showPercentage?: boolean;
  showValue?: boolean;
  variant?: 'linear' | 'circular';
  size?: 'small' | 'medium' | 'large';
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error';
  indeterminate?: boolean;
  buffer?: number; // For buffered progress
}

// Custom component content
export interface ComponentContent extends BaseRichContent {
  type: 'component';
  component: ReactNode;
  props?: Record<string, any>;
  isolate?: boolean; // Render in isolation (iframe/shadow DOM)
  onMount?: () => void;
  onUnmount?: () => void;
}

// Table content
export interface TableColumn {
  id: string;
  label: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  render?: (value: any, row: any) => ReactNode;
}

export interface TableContent extends BaseRichContent {
  type: 'table';
  columns: TableColumn[];
  data: Record<string, any>[];
  sortable?: boolean;
  searchable?: boolean;
  maxRows?: number;
  emptyMessage?: string;
  loading?: boolean;
}

// List content
export interface ListItem {
  id: string;
  content: RichContent;
  actions?: AlertAction[];
  metadata?: Record<string, any>;
}

export interface ListContent extends BaseRichContent {
  type: 'list';
  items: ListItem[];
  ordered?: boolean;
  collapsible?: boolean;
  maxVisible?: number;
  showMore?: boolean;
}

// Code content
export interface CodeContent extends BaseRichContent {
  type: 'code';
  code: string;
  language?: string;
  theme?: 'light' | 'dark' | 'auto';
  showLineNumbers?: boolean;
  highlight?: number[];
  copyable?: boolean;
  executable?: boolean;
  onExecute?: (code: string) => Promise<any>;
}

// Union type for all rich content
export type RichContent = 
  | RichTextContent
  | ImageContent
  | LinkContent
  | FormContent
  | ProgressContent
  | ComponentContent
  | TableContent
  | ListContent
  | CodeContent;

// Rich content container configuration
export interface RichContentConfig {
  maxContentHeight?: string;
  allowScrolling?: boolean;
  enableResizing?: boolean;
  sandboxMode?: boolean;
  securityPolicy?: {
    allowScripts?: boolean;
    allowExternalLinks?: boolean;
    allowFormSubmissions?: boolean;
    allowFileUploads?: boolean;
    trustedDomains?: string[];
  };
  accessibility?: {
    announceChanges?: boolean;
    supportScreenReader?: boolean;
    enforceColorContrast?: boolean;
    requireAltText?: boolean;
  };
}

// Rich content renderer props
export interface RichContentRendererProps {
  content: RichContent[];
  config?: RichContentConfig;
  alertId?: string;
  alertPriority?: string;
  onContentLoad?: (contentId: string) => void;
  onContentError?: (contentId: string, error: Error) => void;
  onInteraction?: (contentId: string, action: string, data?: any) => void;
  className?: string;
  style?: React.CSSProperties;
}

// Content validation result
export interface ContentValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  sanitizedContent?: RichContent;
}

// Content sanitizer options
export interface SanitizerOptions {
  allowedTags: string[];
  allowedAttributes: Record<string, string[]>;
  allowedSchemes: string[];
  stripIgnoreTag: boolean;
  stripIgnoreTagBody: string[];
  transformTags?: Record<string, string | ((tagName: string, attribs: Record<string, string>) => any)>;
}

// Export utility types
export type RichContentComponent<T extends RichContent = RichContent> = React.FC<{
  content: T;
  config: RichContentConfig;
  onLoad?: () => void;
  onError?: (error: Error) => void;
  onInteraction?: (action: string, data?: any) => void;
}>;