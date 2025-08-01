/**
 * Command Validation Feedback Component
 * Displays validation errors and warnings with user-friendly UI
 */

import React, { useMemo } from 'react';
import { 
  Alert, 
  AlertTitle, 
  Box, 
  Chip, 
  Collapse, 
  IconButton, 
  List, 
  ListItem, 
  ListItemIcon, 
  ListItemText, 
  Paper, 
  Tooltip, 
  Typography 
} from '@mui/material';
import {
  Error as ErrorIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { ValidationState } from '../../hooks/useCommandValidation';

export interface CommandValidationFeedbackProps {
  validationState: ValidationState;
  showSuccessMessage?: boolean;
  successMessage?: string;
  compact?: boolean;
  autoCollapse?: boolean;
  maxErrorsShown?: number;
  className?: string;
}

export const CommandValidationFeedback: React.FC<CommandValidationFeedbackProps> = ({
  validationState,
  showSuccessMessage = true,
  successMessage = "Command is valid and ready to send",
  compact = false,
  autoCollapse = false,
  maxErrorsShown = 5,
  className
}) => {
  const [expanded, setExpanded] = React.useState(!autoCollapse);

  const { isValid, errors, warnings, isValidating } = validationState;

  // Group errors by path prefix for better organization
  const groupedErrors = useMemo(() => {
    const groups: Record<string, Array<{ path: string; message: string }>> = {};
    
    errors.forEach(error => {
      const prefix = error.path.split('.')[0];
      if (!groups[prefix]) {
        groups[prefix] = [];
      }
      groups[prefix].push(error);
    });

    return groups;
  }, [errors]);

  // Don't show anything if validating or no feedback needed
  if (isValidating || (isValid && !showSuccessMessage && warnings.length === 0)) {
    return null;
  }

  // Compact mode - just show icon with tooltip
  if (compact) {
    if (!isValid) {
      return (
        <Tooltip title={`${errors.length} validation error${errors.length > 1 ? 's' : ''}`}>
          <ErrorIcon color="error" />
        </Tooltip>
      );
    }
    if (warnings.length > 0) {
      return (
        <Tooltip title={`${warnings.length} warning${warnings.length > 1 ? 's' : ''}`}>
          <WarningIcon color="warning" />
        </Tooltip>
      );
    }
    if (showSuccessMessage) {
      return (
        <Tooltip title={successMessage}>
          <CheckCircleIcon color="success" />
        </Tooltip>
      );
    }
    return null;
  }

  // Full feedback display
  return (
    <Box className={className}>
      {/* Success State */}
      {isValid && showSuccessMessage && warnings.length === 0 && (
        <Alert severity="success" icon={<CheckCircleIcon />}>
          {successMessage}
        </Alert>
      )}

      {/* Error State */}
      {!isValid && (
        <Alert 
          severity="error" 
          icon={<ErrorIcon />}
          action={
            errors.length > maxErrorsShown && (
              <IconButton
                aria-label="toggle error details"
                size="small"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            )
          }
        >
          <AlertTitle>
            Validation Failed
            <Chip 
              label={`${errors.length} error${errors.length > 1 ? 's' : ''}`}
              size="small"
              color="error"
              sx={{ ml: 1 }}
            />
          </AlertTitle>
          
          <Collapse in={expanded || errors.length <= maxErrorsShown}>
            <List dense sx={{ mt: 1 }}>
              {Object.entries(groupedErrors).map(([group, groupErrors]) => (
                <Box key={group} sx={{ mb: 1 }}>
                  <Typography variant="subtitle2" color="error" sx={{ fontWeight: 600 }}>
                    {formatFieldGroup(group)}
                  </Typography>
                  {groupErrors.map((error, index) => (
                    <ListItem key={`${error.path}-${index}`} sx={{ pl: 2 }}>
                      <ListItemIcon sx={{ minWidth: 30 }}>
                        <ErrorIcon fontSize="small" color="error" />
                      </ListItemIcon>
                      <ListItemText
                        primary={error.message}
                        secondary={formatFieldPath(error.path)}
                        primaryTypographyProps={{ variant: 'body2' }}
                        secondaryTypographyProps={{ variant: 'caption' }}
                      />
                    </ListItem>
                  ))}
                </Box>
              ))}
            </List>
          </Collapse>

          {errors.length > maxErrorsShown && !expanded && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              ...and {errors.length - maxErrorsShown} more error{errors.length - maxErrorsShown > 1 ? 's' : ''}
            </Typography>
          )}
        </Alert>
      )}

      {/* Warning State */}
      {warnings.length > 0 && (
        <Alert 
          severity="warning" 
          icon={<WarningIcon />}
          sx={{ mt: isValid ? 0 : 1 }}
        >
          <AlertTitle>
            Warning{warnings.length > 1 ? 's' : ''}
            <Chip 
              label={warnings.length}
              size="small"
              color="warning"
              sx={{ ml: 1 }}
            />
          </AlertTitle>
          <List dense>
            {warnings.map((warning, index) => (
              <ListItem key={index}>
                <ListItemIcon sx={{ minWidth: 30 }}>
                  <InfoIcon fontSize="small" color="warning" />
                </ListItemIcon>
                <ListItemText
                  primary={warning}
                  primaryTypographyProps={{ variant: 'body2' }}
                />
              </ListItem>
            ))}
          </List>
        </Alert>
      )}
    </Box>
  );
};

/**
 * Inline validation feedback for form fields
 */
export interface FieldValidationFeedbackProps {
  error?: string;
  warning?: string;
  touched?: boolean;
  showUntouched?: boolean;
}

export const FieldValidationFeedback: React.FC<FieldValidationFeedbackProps> = ({
  error,
  warning,
  touched = false,
  showUntouched = false
}) => {
  // Don't show if field hasn't been touched (unless forced)
  if (!touched && !showUntouched) {
    return null;
  }

  if (error) {
    return (
      <Typography 
        variant="caption" 
        color="error" 
        sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          mt: 0.5,
          gap: 0.5 
        }}
      >
        <ErrorIcon fontSize="small" />
        {error}
      </Typography>
    );
  }

  if (warning) {
    return (
      <Typography 
        variant="caption" 
        color="warning.main" 
        sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          mt: 0.5,
          gap: 0.5 
        }}
      >
        <WarningIcon fontSize="small" />
        {warning}
      </Typography>
    );
  }

  return null;
};

/**
 * Validation summary card
 */
export interface ValidationSummaryProps {
  validationState: ValidationState;
  title?: string;
  showDetails?: boolean;
}

export const ValidationSummary: React.FC<ValidationSummaryProps> = ({
  validationState,
  title = "Validation Summary",
  showDetails = true
}) => {
  const { isValid, errors, warnings } = validationState;

  const severity = useMemo(() => {
    if (!isValid) return 'error';
    if (warnings.length > 0) return 'warning';
    return 'success';
  }, [isValid, warnings.length]);

  const summaryText = useMemo(() => {
    if (!isValid) {
      return `${errors.length} error${errors.length !== 1 ? 's' : ''} found`;
    }
    if (warnings.length > 0) {
      return `${warnings.length} warning${warnings.length !== 1 ? 's' : ''}`;
    }
    return 'All checks passed';
  }, [isValid, errors.length, warnings.length]);

  return (
    <Paper 
      variant="outlined" 
      sx={{ 
        p: 2, 
        borderColor: severity === 'error' ? 'error.main' : 
                    severity === 'warning' ? 'warning.main' : 
                    'success.main'
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {severity === 'error' && <ErrorIcon color="error" />}
        {severity === 'warning' && <WarningIcon color="warning" />}
        {severity === 'success' && <CheckCircleIcon color="success" />}
        
        <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
          {title}
        </Typography>
        
        <Typography 
          variant="body2" 
          color={`${severity}.main`}
          sx={{ fontWeight: 600 }}
        >
          {summaryText}
        </Typography>
      </Box>

      {showDetails && (errors.length > 0 || warnings.length > 0) && (
        <Box sx={{ mt: 2 }}>
          <CommandValidationFeedback
            validationState={validationState}
            showSuccessMessage={false}
            autoCollapse={false}
          />
        </Box>
      )}
    </Paper>
  );
};

// Helper functions
function formatFieldGroup(group: string): string {
  const groupNames: Record<string, string> = {
    parameters: 'Parameters',
    metadata: 'Metadata',
    safety: 'Safety Checks',
    general: 'General'
  };
  return groupNames[group] || group.charAt(0).toUpperCase() + group.slice(1);
}

function formatFieldPath(path: string): string {
  return path
    .split('.')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' → ');
}