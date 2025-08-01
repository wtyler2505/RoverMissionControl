import React, { forwardRef, useState } from 'react';
import styled from '@emotion/styled';
import { css } from '@emotion/react';
import { CardProps, CardVariant } from '../types';
import { Theme } from '../../../../theme/themes';
import {
  focusStyles,
  disabledStyles,
  transitionStyles,
  generateId,
} from '../utils';

const getVariantStyles = (theme: Theme, variant: CardVariant, interactive: boolean) => {
  const baseStyles = css`
    background-color: ${theme.colors.background.paper};
    border-radius: ${theme.borderRadius.lg};
  `;
  
  const variants = {
    basic: css`
      ${baseStyles}
      border: none;
      box-shadow: ${theme.shadows.sm};
    `,
    interactive: css`
      ${baseStyles}
      border: 2px solid transparent;
      box-shadow: ${theme.shadows.sm};
      cursor: pointer;
      
      &:hover:not(:disabled) {
        box-shadow: ${theme.shadows.md};
        transform: translateY(-2px);
        border-color: ${theme.colors.primary.main};
      }
      
      &:active:not(:disabled) {
        transform: translateY(0);
        box-shadow: ${theme.shadows.sm};
      }
    `,
    outlined: css`
      ${baseStyles}
      border: 2px solid ${theme.colors.divider};
      box-shadow: none;
      
      ${interactive && css`
        cursor: pointer;
        
        &:hover:not(:disabled) {
          border-color: ${theme.colors.primary.main};
          background-color: ${theme.colors.background.elevated};
        }
        
        &:active:not(:disabled) {
          background-color: ${theme.colors.divider};
        }
      `}
    `,
  };
  
  return variants[variant];
};

const StyledCard = styled.div<{
  theme: Theme;
  variant: CardVariant;
  elevated: boolean;
  disabled?: boolean;
  interactive: boolean;
}>`
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  overflow: hidden;
  
  ${({ theme, variant, interactive }) => getVariantStyles(theme, variant, interactive)}
  ${({ theme }) => transitionStyles(theme, ['box-shadow', 'transform', 'border-color', 'background-color'])}
  
  /* Elevated state */
  ${({ elevated, theme }) => elevated && css`
    box-shadow: ${theme.shadows.xl};
  `}
  
  /* Focus state for interactive cards */
  ${({ interactive, theme }) => interactive && css`
    &:focus-visible {
      ${focusStyles(theme)}
    }
  `}
  
  /* Disabled state */
  ${({ disabled, theme }) => disabled && css`
    ${disabledStyles(theme)}
    background-color: ${theme.colors.background.default};
  `}
  
  /* Loading state */
  &[aria-busy="true"] {
    pointer-events: none;
    
    &::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: ${({ theme }) => theme.colors.background.paper};
      opacity: 0.7;
      z-index: 1;
    }
  }
  
  /* High contrast mode adjustments */
  @media (prefers-contrast: high) {
    border: 3px solid ${({ theme }) => theme.colors.text.primary};
  }
`;

const CardHeader = styled.div<{
  theme: Theme;
  collapsible: boolean;
}>`
  padding: ${({ theme }) => theme.spacing[4]};
  border-bottom: 1px solid ${({ theme }) => theme.colors.divider};
  
  ${({ collapsible }) => collapsible && css`
    cursor: pointer;
    user-select: none;
    
    &:hover {
      background-color: ${({ theme }) => theme.colors.background.elevated};
    }
  `}
  
  ${({ theme }) => transitionStyles(theme, ['background-color'])}
`;

const CardContent = styled.div<{
  theme: Theme;
  collapsed: boolean;
}>`
  padding: ${({ theme }) => theme.spacing[4]};
  flex: 1;
  
  ${({ collapsed }) => collapsed && css`
    display: none;
  `}
`;

const CardFooter = styled.div<{
  theme: Theme;
}>`
  padding: ${({ theme }) => theme.spacing[4]};
  border-top: 1px solid ${({ theme }) => theme.colors.divider};
`;

const CollapseIcon = styled.span<{
  theme: Theme;
  expanded: boolean;
}>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  margin-left: auto;
  color: ${({ theme }) => theme.colors.text.secondary};
  transform: ${({ expanded }) => expanded ? 'rotate(180deg)' : 'rotate(0deg)'};
  transition: transform ${({ theme }) => theme.transitions.duration.base} ${({ theme }) => theme.transitions.timing.ease};
  
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

const HeaderContent = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[3]};
`;

export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      variant = 'basic',
      elevated = false,
      collapsible = false,
      defaultExpanded = true,
      onExpandChange,
      header,
      footer,
      children,
      disabled = false,
      loading = false,
      testId,
      className,
      onClick,
      ...props
    },
    ref
  ) => {
    const [expanded, setExpanded] = useState(defaultExpanded);
    const id = generateId('card');
    const interactive = variant === 'interactive' || Boolean(onClick);
    
    const handleHeaderClick = () => {
      if (collapsible && !disabled && !loading) {
        const newExpanded = !expanded;
        setExpanded(newExpanded);
        onExpandChange?.(newExpanded);
      }
    };
    
    const handleCardClick = (event: React.MouseEvent<HTMLDivElement>) => {
      if (!collapsible && interactive && !disabled && !loading && onClick) {
        onClick(event);
      }
    };
    
    return (
      <StyledCard
        ref={ref}
        variant={variant}
        elevated={elevated}
        disabled={disabled}
        interactive={interactive}
        className={className}
        onClick={handleCardClick}
        tabIndex={interactive && !disabled ? 0 : undefined}
        role={interactive ? 'button' : undefined}
        aria-busy={loading}
        aria-disabled={disabled}
        data-testid={testId}
        {...props}
      >
        {header && (
          <CardHeader
            collapsible={collapsible}
            onClick={collapsible ? handleHeaderClick : undefined}
            role={collapsible ? 'button' : undefined}
            tabIndex={collapsible && !disabled ? 0 : undefined}
            aria-expanded={collapsible ? expanded : undefined}
            aria-controls={collapsible ? `${id}-content` : undefined}
          >
            <HeaderContent>
              {header}
              {collapsible && (
                <CollapseIcon expanded={expanded} aria-hidden="true">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M7 10l5 5 5-5z" />
                  </svg>
                </CollapseIcon>
              )}
            </HeaderContent>
          </CardHeader>
        )}
        
        <CardContent
          id={collapsible ? `${id}-content` : undefined}
          collapsed={collapsible && !expanded}
          aria-hidden={collapsible && !expanded}
        >
          {children}
        </CardContent>
        
        {footer && expanded && (
          <CardFooter>
            {footer}
          </CardFooter>
        )}
      </StyledCard>
    );
  }
);

Card.displayName = 'Card';