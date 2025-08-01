/**
 * TypeScript interfaces for UI component library
 */

import { ReactNode, HTMLAttributes, ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes } from 'react';
import { ComponentSize, ComponentStates } from './utils';

// Base props that all components share
export interface BaseComponentProps extends ComponentStates {
  className?: string;
  id?: string;
  testId?: string;
  size?: ComponentSize;
}

// Button Component Props
export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'danger' | 'ghost';
export type ButtonType = 'button' | 'submit' | 'reset';

export interface ButtonProps extends BaseComponentProps, Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'size' | 'type'> {
  variant?: ButtonVariant;
  type?: ButtonType;
  fullWidth?: boolean;
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
  children?: ReactNode;
}

// Input Component Props
export type InputType = 'text' | 'password' | 'email' | 'number' | 'tel' | 'url' | 'search';
export type ValidationState = 'default' | 'error' | 'success' | 'warning';

export interface InputProps extends BaseComponentProps, Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'type'> {
  type?: InputType;
  label?: string;
  helperText?: string;
  validationState?: ValidationState;
  validationMessage?: string;
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
  clearable?: boolean;
  onClear?: () => void;
}

// Select Component Props
export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
  group?: string;
}

export interface SelectProps extends BaseComponentProps, Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  options: SelectOption[];
  label?: string;
  helperText?: string;
  validationState?: ValidationState;
  validationMessage?: string;
  placeholder?: string;
  clearable?: boolean;
  searchable?: boolean;
  multiple?: boolean;
  value?: string | number | (string | number)[];
  onChange?: (value: string | number | (string | number)[]) => void;
  onClear?: () => void;
  maxHeight?: number;
}

// Checkbox Component Props
export interface CheckboxProps extends BaseComponentProps, Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'type'> {
  label?: string;
  indeterminate?: boolean;
  validationState?: ValidationState;
  validationMessage?: string;
}

// Radio Component Props
export interface RadioProps extends BaseComponentProps, Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'type'> {
  label?: string;
  value: string | number;
  validationState?: ValidationState;
}

// Radio Group Props
export interface RadioGroupProps extends BaseComponentProps {
  name: string;
  value?: string | number;
  onChange?: (value: string | number) => void;
  options: Array<{
    value: string | number;
    label: string;
    disabled?: boolean;
  }>;
  direction?: 'horizontal' | 'vertical';
  label?: string;
  helperText?: string;
  validationState?: ValidationState;
  validationMessage?: string;
}

// Toggle Switch Props
export interface ToggleProps extends BaseComponentProps, Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'type'> {
  label?: string;
  labelPosition?: 'left' | 'right';
  validationState?: ValidationState;
  validationMessage?: string;
}

// Card Component Props
export type CardVariant = 'basic' | 'interactive' | 'outlined';

export interface CardProps extends BaseComponentProps, HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  elevated?: boolean;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  onExpandChange?: (expanded: boolean) => void;
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}

// Modal Component Props
export type ModalSize = 'small' | 'medium' | 'large' | 'fullscreen';
export type ModalVariant = 'standard' | 'confirmation' | 'alert';

export interface ModalProps extends BaseComponentProps {
  open: boolean;
  onClose: () => void;
  size?: ModalSize;
  variant?: ModalVariant;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  closeOnBackdropClick?: boolean;
  closeOnEsc?: boolean;
  showCloseButton?: boolean;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
  danger?: boolean;
}

// Tooltip Component Props
export type TooltipPosition = 'top' | 'right' | 'bottom' | 'left' | 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end';
export type TooltipTrigger = 'hover' | 'click' | 'focus' | 'manual';

export interface TooltipProps extends BaseComponentProps {
  content: ReactNode;
  children: ReactNode;
  position?: TooltipPosition;
  trigger?: TooltipTrigger;
  delay?: number;
  offset?: number;
  arrow?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  maxWidth?: number;
}

// Alert Component Props
export type AlertVariant = 'info' | 'success' | 'warning' | 'error';

export interface AlertProps extends BaseComponentProps, HTMLAttributes<HTMLDivElement> {
  variant: AlertVariant;
  title?: string;
  children: ReactNode;
  closable?: boolean;
  onClose?: () => void;
  icon?: ReactNode | boolean;
  action?: ReactNode;
}

// Badge Component Props
export type BadgeVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' | 'neutral';

export interface BadgeProps extends BaseComponentProps, HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  children: ReactNode;
  dot?: boolean;
  max?: number;
  showZero?: boolean;
  invisible?: boolean;
}