/**
 * AlertLinkComponent
 * Secure link component with proper external link handling and accessibility
 */

import React, { useCallback } from 'react';
import styled from '@emotion/styled';
import { css } from '@emotion/react';
import { Theme } from '../../../../../theme/themes';
import { LinkContent, RichContentConfig } from '../types/RichContentTypes';
import { validateURL } from '../utils/contentSanitizer';

interface AlertLinkComponentProps {
  content: LinkContent;
  config: RichContentConfig;
  onLoad?: () => void;
  onError?: (error: Error) => void;
  onInteraction?: (action: string, data?: any) => void;
}

const LinkContainer = styled.div<{ 
  theme: Theme;
  disabled: boolean;
}>`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[1]};
  
  ${({ disabled, theme }) => disabled && css`
    opacity: 0.6;
    cursor: not-allowed;
    
    * {
      pointer-events: none;
    }
    
    &::after {
      content: " (disabled)";
      font-size: ${theme.typography.fontSize.xs};
      color: ${theme.colors.text.secondary};
    }
  `}
`;

const StyledLink = styled.a<{ 
  theme: Theme;
  isExternal: boolean;
  securityLevel: LinkContent['securityLevel'];
}>`
  color: ${({ theme }) => theme.colors.primary.main};
  text-decoration: underline;
  font-family: ${({ theme }) => theme.typography.fontFamily.primary};
  font-size: inherit;
  line-height: inherit;
  cursor: pointer;
  transition: all 0.2s ease;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  padding: 0 ${({ theme }) => theme.spacing[1]};
  margin: 0 -${({ theme }) => theme.spacing[1]};
  
  &:hover {
    color: ${({ theme }) => theme.colors.primary.dark};
    background-color: ${({ theme }) => theme.colors.primary.main}10;
    text-decoration: underline;
  }
  
  &:focus {
    outline: 2px solid ${({ theme }) => theme.colors.primary.main};
    outline-offset: 2px;
    text-decoration: none;
  }
  
  &:visited {
    color: ${({ theme }) => theme.colors.primary.dark}90;
  }
  
  &:active {
    color: ${({ theme }) => theme.colors.primary.dark};
  }
  
  /* External link styling */
  ${({ isExternal, theme }) => isExternal && css`
    &::after {
      content: "↗";
      font-size: 0.8em;
      margin-left: 0.2em;
      opacity: 0.7;
      vertical-align: super;
      line-height: 1;
    }
  `}
  
  /* Security level specific styling */
  ${({ securityLevel, theme }) => {
    switch (securityLevel) {
      case 'restricted':
        return css`
          pointer-events: none;
          color: ${theme.colors.text.secondary};
          text-decoration: line-through;
          cursor: not-allowed;
          
          &::after {
            content: " (blocked)";
            font-size: 0.8em;
            opacity: 0.7;
            vertical-align: baseline;
            margin-left: 0.3em;
          }
          
          &:hover {
            background: none;
            color: ${theme.colors.text.secondary};
          }
        `;
      case 'sanitized':
        return css`
          /* Show warning indicator for external links */
          ${isExternal && css`
            position: relative;
            
            &:hover::before {
              content: "External link - opens in new tab";
              position: absolute;
              bottom: 100%;
              left: 50%;
              transform: translateX(-50%);
              background: ${theme.colors.background.paper};
              color: ${theme.colors.text.primary};
              padding: ${theme.spacing[2]};
              border: 1px solid ${theme.colors.divider};
              border-radius: ${theme.borderRadius.md};
              font-size: ${theme.typography.fontSize.xs};
              white-space: nowrap;
              z-index: 1000;
              box-shadow: ${theme.shadows.md};
              margin-bottom: ${theme.spacing[1]};
            }
          `}
        `;
      default:
        return '';
    }
  }}
  
  /* High contrast mode */
  @media (prefers-contrast: high) {
    text-decoration: underline;
    text-decoration-thickness: 2px;
    text-underline-offset: 2px;
    
    &:focus {
      outline-width: 3px;
    }
  }
  
  /* Print styles */
  @media print {
    color: black !important;
    text-decoration: underline;
    
    &[href]::after {
      content: " (" attr(href) ")";
      font-size: 0.8em;
      color: black;
    }
  }
`;

const IconWrapper = styled.span<{ theme: Theme }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1em;
  height: 1em;
  margin-right: ${({ theme }) => theme.spacing[1]};
  color: inherit;
  
  svg {
    width: 100%;
    height: 100%;
    fill: currentColor;
  }
`;

const SecurityWarning = styled.div<{ theme: Theme }>`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[1]};
  margin-left: ${({ theme }) => theme.spacing[2]};
  padding: ${({ theme }) => theme.spacing[1]} ${({ theme }) => theme.spacing[2]};
  background-color: ${({ theme }) => theme.colors.warning.main}20;
  border: 1px solid ${({ theme }) => theme.colors.warning.main}40;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.warning.dark};
  
  .warning-icon {
    width: 12px;
    height: 12px;
    fill: currentColor;
  }
`;

export const AlertLinkComponent: React.FC<AlertLinkComponentProps> = ({
  content,
  config,
  onLoad,
  onError,
  onInteraction
}) => {
  // Validate URL
  const isValidURL = validateURL(content.href);
  const isExternal = content.external !== false && (
    content.href.startsWith('http://') || 
    content.href.startsWith('https://') ||
    content.href.includes('://')
  );
  
  // Determine if link should be disabled
  const isDisabled = !isValidURL || 
    (content.securityLevel === 'restricted') ||
    (isExternal && config.securityPolicy?.allowExternalLinks === false);

  // Handle click
  const handleClick = useCallback((event: React.MouseEvent<HTMLAnchorElement>) => {
    // Call custom onClick handler first
    content.onClick?.(event);
    
    // If event was prevented, don't proceed
    if (event.defaultPrevented) {
      return;
    }
    
    // Security checks
    if (isDisabled) {
      event.preventDefault();
      onError?.(new Error('Link is disabled due to security restrictions'));
      return;
    }
    
    if (!isValidURL) {
      event.preventDefault();
      onError?.(new Error('Invalid or unsafe URL'));
      return;
    }
    
    // Track interaction
    onInteraction?.('link-click', {
      href: content.href,
      text: content.text,
      external: isExternal,
      target: content.target
    });
    
    // For external links, show confirmation if required
    if (isExternal && config.securityPolicy?.allowExternalLinks !== true) {
      const confirmed = window.confirm(
        `You are about to visit an external website:\n\n${content.href}\n\nDo you want to continue?`
      );
      
      if (!confirmed) {
        event.preventDefault();
        return;
      }
    }
  }, [content, config, isDisabled, isValidURL, isExternal, onError, onInteraction]);

  // Determine target and rel attributes
  const target = content.target || (isExternal ? '_blank' : '_self');
  const rel = content.rel || (isExternal ? 'noopener noreferrer' : undefined);

  // Load callback
  React.useEffect(() => {
    onLoad?.();
  }, [onLoad]);

  return (
    <LinkContainer
      disabled={isDisabled}
      className={content.className}
      data-testid={content.testId || `link-${content.id}`}
    >
      {/* Icon */}
      {content.icon && (
        <IconWrapper>
          {content.icon}
        </IconWrapper>
      )}
      
      {/* Link */}
      <StyledLink
        href={isDisabled ? undefined : content.href}
        target={isDisabled ? undefined : target}
        rel={isDisabled ? undefined : rel}
        isExternal={isExternal}
        securityLevel={content.securityLevel}
        onClick={handleClick}
        aria-label={content.ariaLabel}
        aria-describedby={content.ariaDescription}
        role={isDisabled ? 'text' : undefined}
        tabIndex={isDisabled ? -1 : undefined}
      >
        {content.text}
      </StyledLink>
      
      {/* Security Warning */}
      {!isValidURL && (
        <SecurityWarning>
          <svg className="warning-icon" viewBox="0 0 24 24">
            <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
          </svg>
          Invalid URL
        </SecurityWarning>
      )}
      
      {isExternal && content.securityLevel === 'sanitized' && config.securityPolicy?.allowExternalLinks !== true && (
        <SecurityWarning>
          <svg className="warning-icon" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
          External link
        </SecurityWarning>
      )}
    </LinkContainer>
  );
};