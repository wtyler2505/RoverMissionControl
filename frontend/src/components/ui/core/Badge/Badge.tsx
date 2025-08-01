import React, { forwardRef } from 'react';
import styled from '@emotion/styled';
import { css } from '@emotion/react';
import { BadgeProps, BadgeVariant } from '../types';
import { Theme } from '../../../../theme/themes';
import { transitionStyles } from '../utils';

const getVariantStyles = (theme: Theme, variant: BadgeVariant) => {
  const variants = {
    primary: css`
      background-color: ${theme.colors.primary.main};
      color: ${theme.colors.primary.contrast};
    `,
    secondary: css`
      background-color: ${theme.colors.secondary.main};
      color: ${theme.colors.secondary.contrast};
    `,
    success: css`
      background-color: ${theme.colors.success.main};
      color: ${theme.colors.success.contrast};
    `,
    warning: css`
      background-color: ${theme.colors.warning.main};
      color: ${theme.colors.warning.contrast};
    `,
    error: css`
      background-color: ${theme.colors.error.main};
      color: ${theme.colors.error.contrast};
    `,
    info: css`
      background-color: ${theme.colors.info.main};
      color: ${theme.colors.info.contrast};
    `,
    neutral: css`
      background-color: ${theme.colors.neutral[600]};
      color: ${theme.colors.neutral[0]};
    `,
  };
  
  return variants[variant];
};

const BadgeContainer = styled.span<{
  theme: Theme;
  variant: BadgeVariant;
  dot: boolean;
  invisible: boolean;
}>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: ${({ theme }) => theme.typography.fontFamily.primary};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  line-height: 1;
  white-space: nowrap;
  text-align: center;
  vertical-align: baseline;
  border-radius: ${({ theme }) => theme.borderRadius.full};
  
  ${({ theme, variant }) => getVariantStyles(theme, variant)}
  ${({ theme }) => transitionStyles(theme, ['transform', 'opacity'])}
  
  /* Size styles */
  ${({ dot, theme }) => dot ? css`
    width: 8px;
    height: 8px;
    padding: 0;
  ` : css`
    min-width: 20px;
    height: 20px;
    padding: 0 ${theme.spacing[2]};
    font-size: ${theme.typography.fontSize.xs};
  `}
  
  /* Invisible state */
  ${({ invisible }) => invisible && css`
    transform: scale(0);
    opacity: 0;
  `}
  
  /* High contrast mode adjustments */
  @media (prefers-contrast: high) {
    border: 2px solid currentColor;
  }
`;

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  (
    {
      variant = 'primary',
      children,
      dot = false,
      max = 99,
      showZero = false,
      invisible = false,
      testId,
      className,
      ...props
    },
    ref
  ) => {
    // Handle numeric content
    let displayContent = children;
    
    if (typeof children === 'number') {
      if (children === 0 && !showZero) {
        invisible = true;
      } else if (max && children > max) {
        displayContent = `${max}+`;
      }
    }
    
    // Don't render anything if it's a dot badge with no content
    if (dot) {
      displayContent = null;
    }
    
    return (
      <BadgeContainer
        ref={ref}
        variant={variant}
        dot={dot}
        invisible={invisible}
        className={className}
        data-testid={testId}
        aria-hidden={invisible}
        {...props}
      >
        {displayContent}
      </BadgeContainer>
    );
  }
);

Badge.displayName = 'Badge';