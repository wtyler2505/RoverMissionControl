/**
 * RichContentContainer
 * Main container that renders and manages rich content components within alerts
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import styled from '@emotion/styled';
import { css } from '@emotion/react';
import { Theme } from '../../../../../theme/themes';
import { 
  RichContent, 
  RichContentConfig, 
  RichContentRendererProps,
  ContentValidationResult
} from '../types/RichContentTypes';
import { validateRichContent, isContentTypeAllowed } from '../utils/contentSanitizer';

// Import content renderers
import { RichTextRenderer } from './RichTextRenderer';
import { AlertImageComponent } from './AlertImageComponent';
import { AlertLinkComponent } from './AlertLinkComponent';
import { AlertFormComponent } from './AlertFormComponent';
import { ProgressBarComponent } from './ProgressBarComponent';
import { AlertTableComponent } from './AlertTableComponent';

interface RichContentContainerProps extends RichContentRendererProps {
  maxContentItems?: number;
  enableVirtualization?: boolean;
  onValidationError?: (contentId: string, errors: string[]) => void;
}

const ContentContainer = styled.div<{ 
  theme: Theme;
  config: RichContentConfig;
  itemCount: number;
}>`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[3]};
  
  /* Apply global constraints */
  ${({ config }) => config.maxContentHeight && css`
    max-height: ${config.maxContentHeight};
    overflow-y: ${config.allowScrolling !== false ? 'auto' : 'hidden'};
    
    /* Custom scrollbar */
    &::-webkit-scrollbar {
      width: 8px;
    }
    
    &::-webkit-scrollbar-track {
      background: ${({ theme }) => theme.colors.background.elevated};
      border-radius: 4px;
    }
    
    &::-webkit-scrollbar-thumb {
      background: ${({ theme }) => theme.colors.text.secondary}60;
      border-radius: 4px;
      
      &:hover {
        background: ${({ theme }) => theme.colors.text.secondary}80;
      }
    }
  `}
  
  /* Sandbox mode styling */
  ${({ config, theme }) => config.sandboxMode && css`
    border: 2px dashed ${theme.colors.warning.main};
    border-radius: ${theme.borderRadius.md};
    background: ${theme.colors.warning.main}05;
    padding: ${theme.spacing[3]};
    position: relative;
    
    &::before {
      content: "Sandboxed Content";
      position: absolute;
      top: -12px;
      left: ${theme.spacing[3]};
      background: ${theme.colors.background.paper};
      padding: 0 ${theme.spacing[2]};
      font-size: ${theme.typography.fontSize.xs};
      color: ${theme.colors.warning.dark};
      font-weight: ${theme.typography.fontWeight.medium};
    }
  `}
  
  /* Performance optimization for many items */
  ${({ itemCount }) => itemCount > 10 && css`
    contain: layout style paint;
  `}
`;

const ContentItem = styled.div<{ 
  theme: Theme;
  index: number;
  hasError: boolean;
}>`
  position: relative;
  
  /* Error state styling */
  ${({ hasError, theme }) => hasError && css`
    border: 1px solid ${theme.colors.error.main};
    border-radius: ${theme.borderRadius.md};
    background: ${theme.colors.error.main}10;
    padding: ${theme.spacing[3]};
    
    &::before {
      content: "Content Error";
      position: absolute;
      top: -8px;
      right: ${theme.spacing[2]};
      background: ${theme.colors.error.main};
      color: ${theme.colors.error.contrast};
      padding: 0 ${theme.spacing[2]};
      font-size: ${theme.typography.fontSize.xs};
      border-radius: ${theme.borderRadius.sm};
      font-weight: ${theme.typography.fontWeight.medium};
    }
  `}
  
  /* Loading state */
  &[data-loading="true"] {
    opacity: 0.7;
    pointer-events: none;
    
    &::after {
      content: "";
      position: absolute;
      top: 50%;
      left: 50%;
      width: 20px;
      height: 20px;
      margin: -10px 0 0 -10px;
      border: 2px solid ${({ theme }) => theme.colors.text.secondary}30;
      border-top: 2px solid ${({ theme }) => theme.colors.text.secondary};
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    
    /* Reduced motion */
    @media (prefers-reduced-motion: reduce) {
      &::after {
        animation: none;
        border: 2px solid ${({ theme }) => theme.colors.text.secondary};
      }
    }
  }
`;

const ErrorMessage = styled.div<{ theme: Theme }>`
  display: flex;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing[2]};
  color: ${({ theme }) => theme.colors.error.main};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  background: ${({ theme }) => theme.colors.error.main}10;
  border: 1px solid ${({ theme }) => theme.colors.error.main}30;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  padding: ${({ theme }) => theme.spacing[3]};
  
  .error-icon {
    width: 20px;
    height: 20px;
    fill: currentColor;
    flex-shrink: 0;
    margin-top: 2px;
  }
  
  .error-content {
    flex: 1;
  }
  
  .error-title {
    font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
    margin-bottom: ${({ theme }) => theme.spacing[1]};
  }
  
  .error-details {
    font-size: ${({ theme }) => theme.typography.fontSize.xs};
    opacity: 0.8;
  }
`;

const ValidationWarning = styled.div<{ theme: Theme }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
  color: ${({ theme }) => theme.colors.warning.dark};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  background: ${({ theme }) => theme.colors.warning.main}20;
  border: 1px solid ${({ theme }) => theme.colors.warning.main}40;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  padding: ${({ theme }) => theme.spacing[2]};
  margin-bottom: ${({ theme }) => theme.spacing[2]};
  
  .warning-icon {
    width: 16px;
    height: 16px;
    fill: currentColor;
    flex-shrink: 0;
  }
`;

const SecurityNotice = styled.div<{ theme: Theme }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
  color: ${({ theme }) => theme.colors.info.dark};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  background: ${({ theme }) => theme.colors.info.main}20;
  border: 1px solid ${({ theme }) => theme.colors.info.main}40;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  padding: ${({ theme }) => theme.spacing[2]};
  margin-bottom: ${({ theme }) => theme.spacing[3]};
  
  .security-icon {
    width: 16px;
    height: 16px;
    fill: currentColor;
    flex-shrink: 0;
  }
`;

// Default configuration
const defaultConfig: RichContentConfig = {
  maxContentHeight: '400px',
  allowScrolling: true,
  enableResizing: false,
  sandboxMode: false,
  securityPolicy: {
    allowScripts: false,
    allowExternalLinks: true,
    allowFormSubmissions: true,
    allowFileUploads: false,
    trustedDomains: []
  },
  accessibility: {
    announceChanges: true,
    supportScreenReader: true,
    enforceColorContrast: true,
    requireAltText: true
  }
};

export const RichContentContainer: React.FC<RichContentContainerProps> = ({
  content,
  config: userConfig,
  alertId,
  alertPriority,
  maxContentItems = 50,
  enableVirtualization = false,
  onContentLoad,
  onContentError,
  onInteraction,
  onValidationError,
  className,
  style
}) => {
  const [loadingItems, setLoadingItems] = useState<Set<string>>(new Set());
  const [errorItems, setErrorItems] = useState<Map<string, Error>>(new Map());
  const [validationResults, setValidationResults] = useState<Map<string, ContentValidationResult>>(new Map());
  
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Merge configuration with defaults
  const config = useMemo(() => ({
    ...defaultConfig,
    ...userConfig,
    securityPolicy: {
      ...defaultConfig.securityPolicy,
      ...userConfig?.securityPolicy
    },
    accessibility: {
      ...defaultConfig.accessibility,
      ...userConfig?.accessibility
    }
  }), [userConfig]);

  // Validate all content items
  const validatedContent = useMemo(() => {
    const results = new Map<string, ContentValidationResult>();
    const validContent: RichContent[] = [];
    
    for (const item of content.slice(0, maxContentItems)) {
      // Check if content type is allowed for security level
      if (!isContentTypeAllowed(item.type, item.securityLevel)) {
        results.set(item.id, {
          valid: false,
          errors: [`Content type '${item.type}' not allowed for security level '${item.securityLevel}'`],
          warnings: []
        });
        continue;
      }
      
      const validation = validateRichContent(item);
      results.set(item.id, validation);
      
      if (validation.valid) {
        validContent.push(validation.sanitizedContent || item);
      } else {
        onValidationError?.(item.id, validation.errors);
      }
    }
    
    setValidationResults(results);
    return validContent;
  }, [content, maxContentItems, onValidationError]);

  // Handle item loading state
  const handleItemLoad = useCallback((itemId: string) => {
    setLoadingItems(prev => {
      const next = new Set(prev);
      next.delete(itemId);
      return next;
    });
    onContentLoad?.(itemId);
  }, [onContentLoad]);

  // Handle item errors
  const handleItemError = useCallback((itemId: string, error: Error) => {
    setErrorItems(prev => new Map(prev).set(itemId, error));
    setLoadingItems(prev => {
      const next = new Set(prev);
      next.delete(itemId);
      return next;
    });
    onContentError?.(itemId, error);
  }, [onContentError]);

  // Handle interactions
  const handleItemInteraction = useCallback((itemId: string, action: string, data?: any) => {
    onInteraction?.(itemId, action, {
      ...data,
      alertId,
      alertPriority,
      timestamp: new Date().toISOString()
    });
  }, [onInteraction, alertId, alertPriority]);

  // Start loading when component mounts
  useEffect(() => {
    const loadingSet = new Set<string>();
    validatedContent.forEach(item => loadingSet.add(item.id));
    setLoadingItems(loadingSet);
  }, [validatedContent]);

  // Render content item
  const renderContentItem = useCallback((item: RichContent, index: number) => {
    const isLoading = loadingItems.has(item.id);
    const error = errorItems.get(item.id);
    const validation = validationResults.get(item.id);
    
    const commonProps = {
      content: item,
      config,
      onLoad: () => handleItemLoad(item.id),
      onError: (err: Error) => handleItemError(item.id, err),
      onInteraction: (action: string, data?: any) => handleItemInteraction(item.id, action, data)
    };

    let contentComponent: React.ReactNode = null;

    try {
      switch (item.type) {
        case 'text':
        case 'markdown':
        case 'html':
          contentComponent = <RichTextRenderer {...commonProps} content={item} />;
          break;
          
        case 'image':
          contentComponent = <AlertImageComponent {...commonProps} content={item} />;
          break;
          
        case 'link':
          contentComponent = <AlertLinkComponent {...commonProps} content={item} />;
          break;
          
        case 'form':
          contentComponent = <AlertFormComponent {...commonProps} content={item} />;
          break;
          
        case 'progress':
          contentComponent = <ProgressBarComponent {...commonProps} content={item} />;
          break;
          
        case 'table':
          contentComponent = <AlertTableComponent {...commonProps} content={item} />;
          break;
          
        case 'component':
          // For custom components, render in a safe container
          if (item.securityLevel === 'trusted' && 'component' in item) {
            contentComponent = (
              <div className="custom-component-container">
                {item.component}
              </div>
            );
          } else {
            contentComponent = (
              <ErrorMessage>
                <svg className="error-icon" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                </svg>
                <div className="error-content">
                  <div className="error-title">Custom Component Blocked</div>
                  <div className="error-details">
                    Custom components require trusted security level
                  </div>
                </div>
              </ErrorMessage>
            );
          }
          break;
          
        default:
          contentComponent = (
            <ErrorMessage>
              <svg className="error-icon" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
              </svg>
              <div className="error-content">
                <div className="error-title">Unsupported Content Type</div>
                <div className="error-details">
                  Content type '{item.type}' is not supported
                </div>
              </div>
            </ErrorMessage>
          );
      }
    } catch (renderError) {
      contentComponent = (
        <ErrorMessage>
          <svg className="error-icon" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
          <div className="error-content">
            <div className="error-title">Render Error</div>
            <div className="error-details">
              {renderError instanceof Error ? renderError.message : 'Unknown error occurred'}
            </div>
          </div>
        </ErrorMessage>
      );
    }

    return (
      <ContentItem
        key={item.id}
        index={index}
        hasError={Boolean(error)}
        data-loading={isLoading}
        data-content-type={item.type}
        data-security-level={item.securityLevel}
        data-testid={`rich-content-item-${item.id}`}
      >
        {/* Validation warnings */}
        {validation?.warnings && validation.warnings.length > 0 && (
          <ValidationWarning>
            <svg className="warning-icon" viewBox="0 0 24 24">
              <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
            </svg>
            <div>
              {validation.warnings.length === 1 
                ? validation.warnings[0]
                : `${validation.warnings.length} validation warnings`
              }
            </div>
          </ValidationWarning>
        )}
        
        {/* Error display */}
        {error ? (
          <ErrorMessage>
            <svg className="error-icon" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            </svg>
            <div className="error-content">
              <div className="error-title">Content Error</div>
              <div className="error-details">{error.message}</div>
            </div>
          </ErrorMessage>
        ) : contentComponent}
      </ContentItem>
    );
  }, [
    loadingItems, 
    errorItems, 
    validationResults, 
    config, 
    handleItemLoad, 
    handleItemError, 
    handleItemInteraction
  ]);

  // Show security notice if sandbox mode is enabled
  const showSecurityNotice = config.sandboxMode || 
    validatedContent.some(item => item.securityLevel !== 'trusted');

  if (validatedContent.length === 0) {
    return (
      <div 
        className={className}
        style={style}
        data-testid="rich-content-empty"
      >
        <em style={{ color: 'var(--text-secondary)' }}>
          No valid content to display
        </em>
      </div>
    );
  }

  return (
    <ContentContainer
      ref={containerRef}
      config={config}
      itemCount={validatedContent.length}
      className={className}
      style={style}
      data-testid="rich-content-container"
      role="region"
      aria-label="Rich content"
    >
      {/* Security notice */}
      {showSecurityNotice && (
        <SecurityNotice>
          <svg className="security-icon" viewBox="0 0 24 24">
            <path d="M12,1L3,5V11C3,16.55 6.84,21.74 12,23C17.16,21.74 21,16.55 21,11V5L12,1M12,7C13.4,7 14.8,8.6 14.8,10V11H16V18H8V11H9.2V10C9.2,8.6 10.6,7 12,7M12,8.2C11.2,8.2 10.4,8.7 10.4,10V11H13.6V10C13.6,8.7 12.8,8.2 12,8.2Z"/>
          </svg>
          <div>
            This content is subject to security restrictions and has been sanitized.
          </div>
        </SecurityNotice>
      )}
      
      {/* Content items */}
      {validatedContent.map(renderContentItem)}
    </ContentContainer>
  );
};