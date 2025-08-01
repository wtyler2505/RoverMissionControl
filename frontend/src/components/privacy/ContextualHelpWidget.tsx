/**
 * Contextual Help Widget
 * Provides contextual privacy help throughout the application
 */

import React, { useState, useEffect, useCallback } from 'react';
import styled from '@emotion/styled';
import { useTheme } from '@emotion/react';
import { 
  ContextualHelp,
  privacyPolicyService 
} from '../../services/privacy/PrivacyPolicyService';
import { Modal } from '../ui/core/Modal';
import { Button } from '../ui/core/Button';

interface ContextualHelpWidgetProps {
  contextKey: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  trigger?: 'hover' | 'click' | 'always';
  showIcon?: boolean;
  iconSize?: 'small' | 'medium' | 'large';
  language?: string;
  className?: string;
  children?: React.ReactNode;
}

interface TooltipProps {
  placement: string;
  visible: boolean;
}

const HelpContainer = styled.div`
  position: relative;
  display: inline-block;
`;

const HelpTrigger = styled.button<{ size?: string }>`
  background: ${props => props.theme.colors.primary}20;
  border: 1px solid ${props => props.theme.colors.primary}40;
  border-radius: 50%;
  color: ${props => props.theme.colors.primary};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: all 0.2s ease;
  
  width: ${props => {
    const sizes = { small: '20px', medium: '24px', large: '28px' };
    return sizes[props.size as keyof typeof sizes] || sizes.medium;
  }};
  height: ${props => {
    const sizes = { small: '20px', medium: '24px', large: '28px' };
    return sizes[props.size as keyof typeof sizes] || sizes.medium;
  }};
  font-size: ${props => {
    const sizes = { small: '10px', medium: '12px', large: '14px' };
    return sizes[props.size as keyof typeof sizes] || sizes.medium;
  }};

  &:hover, &:focus {
    background: ${props => props.theme.colors.primary}30;
    border-color: ${props => props.theme.colors.primary};
    transform: scale(1.1);
  }

  &:focus {
    outline: 2px solid ${props => props.theme.colors.primary};
    outline-offset: 2px;
  }
`;

const Tooltip = styled.div<TooltipProps>`
  position: absolute;
  z-index: 1000;
  background: ${props => props.theme.colors.background.primary};
  border: 1px solid ${props => props.theme.colors.border.primary};
  border-radius: 8px;
  padding: 1rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  max-width: 320px;
  opacity: ${props => props.visible ? 1 : 0};
  visibility: ${props => props.visible ? 'visible' : 'hidden'};
  transition: all 0.2s ease;
  
  ${props => {
    const offset = '8px';
    const placement = props.placement;
    
    if (placement === 'top') {
      return `
        bottom: calc(100% + ${offset});
        left: 50%;
        transform: translateX(-50%);
      `;
    } else if (placement === 'bottom') {
      return `
        top: calc(100% + ${offset});
        left: 50%;
        transform: translateX(-50%);
      `;
    } else if (placement === 'left') {
      return `
        right: calc(100% + ${offset});
        top: 50%;
        transform: translateY(-50%);
      `;
    } else if (placement === 'right') {
      return `
        left: calc(100% + ${offset});
        top: 50%;
        transform: translateY(-50%);
      `;
    }
    return '';
  }}
  
  &::before {
    content: '';
    position: absolute;
    border: 6px solid transparent;
    
    ${props => {
      const placement = props.placement;
      
      if (placement === 'top') {
        return `
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          border-top-color: ${props.theme.colors.border.primary};
        `;
      } else if (placement === 'bottom') {
        return `
          bottom: 100%;
          left: 50%;
          transform: translateX(-50%);
          border-bottom-color: ${props.theme.colors.border.primary};
        `;
      } else if (placement === 'left') {
        return `
          left: 100%;
          top: 50%;
          transform: translateY(-50%);
          border-left-color: ${props.theme.colors.border.primary};
        `;
      } else if (placement === 'right') {
        return `
          right: 100%;
          top: 50%;
          transform: translateY(-50%);
          border-right-color: ${props.theme.colors.border.primary};
        `;
      }
      return '';
    }}
  }
`;

const TooltipHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
`;

const TooltipIcon = styled.span`
  font-size: 1.125rem;
`;

const TooltipTitle = styled.h4`
  font-size: 0.875rem;
  font-weight: 600;
  color: ${props => props.theme.colors.text.primary};
  margin: 0;
`;

const TooltipContent = styled.div`
  font-size: 0.875rem;
  line-height: 1.4;
  color: ${props => props.theme.colors.text.secondary};
  margin-bottom: 0.75rem;
`;

const PlainLanguageContent = styled.div`
  font-size: 0.8125rem;
  line-height: 1.4;
  color: ${props => props.theme.colors.text.tertiary};
  font-style: italic;
  margin-bottom: 0.75rem;
  padding: 0.5rem;
  background: ${props => props.theme.colors.background.tertiary};
  border-radius: 4px;
`;

const RelatedSections = styled.div`
  margin-bottom: 0.75rem;
`;

const RelatedSectionTitle = styled.div`
  font-size: 0.75rem;
  font-weight: 600;
  color: ${props => props.theme.colors.text.primary};
  margin-bottom: 0.25rem;
`;

const RelatedSectionList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
`;

const RelatedSectionItem = styled.li`
  font-size: 0.75rem;
  color: ${props => props.theme.colors.text.secondary};
  margin-bottom: 0.125rem;
`;

const TooltipActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
`;

const ViewMoreButton = styled(Button)`
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
`;

const LoadingSpinner = styled.div`
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid ${props => props.theme.colors.border.secondary};
  border-radius: 50%;
  border-top-color: ${props => props.theme.colors.primary};
  animation: spin 1s ease-in-out infinite;

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

const ErrorMessage = styled.div`
  font-size: 0.875rem;
  color: ${props => props.theme.colors.status.error};
  text-align: center;
`;

export const ContextualHelpWidget: React.FC<ContextualHelpWidgetProps> = ({
  contextKey,
  placement = 'top',
  trigger = 'hover',
  showIcon = true,
  iconSize = 'medium',
  language = 'en',
  className,
  children
}) => {
  const theme = useTheme();
  const [helpContent, setHelpContent] = useState<ContextualHelp | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  // Load help content
  const loadHelpContent = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const content = await privacyPolicyService.getContextualHelp(contextKey, language);
      setHelpContent(content);
    } catch (err) {
      console.error('Failed to load contextual help:', err);
      setError('Help content unavailable');
    } finally {
      setLoading(false);
    }
  }, [contextKey, language]);

  // Load content when component mounts or contextKey changes
  useEffect(() => {
    loadHelpContent();
  }, [loadHelpContent]);

  // Handle trigger interactions
  const handleMouseEnter = useCallback(() => {
    if (trigger === 'hover' || trigger === 'always') {
      setTooltipVisible(true);
    }
  }, [trigger]);

  const handleMouseLeave = useCallback(() => {
    if (trigger === 'hover') {
      setTooltipVisible(false);
    }
  }, [trigger]);

  const handleClick = useCallback(() => {
    if (trigger === 'click') {
      setTooltipVisible(!tooltipVisible);
    }
  }, [trigger, tooltipVisible]);

  const handleViewMore = useCallback(() => {
    setModalVisible(true);
    setTooltipVisible(false);
  }, []);

  // Show tooltip for 'always' trigger
  useEffect(() => {
    if (trigger === 'always') {
      setTooltipVisible(true);
    }
  }, [trigger]);

  // Keyboard accessibility
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      setTooltipVisible(false);
      setModalVisible(false);
    }
  }, []);

  // Don't render if no help content is available
  if (!helpContent && !loading && !error) {
    return children ? <>{children}</> : null;
  }

  const renderTooltipContent = () => {
    if (loading) {
      return (
        <div style={{ textAlign: 'center', padding: '1rem' }}>
          <LoadingSpinner />
        </div>
      );
    }

    if (error) {
      return <ErrorMessage>{error}</ErrorMessage>;
    }

    if (!helpContent) {
      return <ErrorMessage>No help content available</ErrorMessage>;
    }

    return (
      <>
        <TooltipHeader>
          <TooltipIcon>💡</TooltipIcon>
          <TooltipTitle>{helpContent.title}</TooltipTitle>
        </TooltipHeader>

        <TooltipContent>
          {helpContent.content.length > 150 
            ? `${helpContent.content.substring(0, 150)}...`
            : helpContent.content
          }
        </TooltipContent>

        {helpContent.plain_language_content && (
          <PlainLanguageContent>
            <strong>In simple terms:</strong> {helpContent.plain_language_content}
          </PlainLanguageContent>
        )}

        {helpContent.related_sections && helpContent.related_sections.length > 0 && (
          <RelatedSections>
            <RelatedSectionTitle>Related policy sections:</RelatedSectionTitle>
            <RelatedSectionList>
              {helpContent.related_sections.slice(0, 3).map((section, index) => (
                <RelatedSectionItem key={index}>
                  • {section.title}
                </RelatedSectionItem>
              ))}
            </RelatedSectionList>
          </RelatedSections>
        )}

        <TooltipActions>
          <ViewMoreButton
            variant="secondary"
            size="small"
            onClick={handleViewMore}
          >
            View Full Policy
          </ViewMoreButton>
        </TooltipActions>
      </>
    );
  };

  const renderModalContent = () => {
    if (!helpContent) return null;

    return (
      <div>
        <div style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '0.5rem' }}>{helpContent.title}</h3>
          <div style={{ 
            fontSize: '0.875rem',
            color: theme.colors.text.secondary,
            marginBottom: '1rem'
          }}>
            Context: {contextKey}
          </div>
        </div>

        <div style={{ 
          fontSize: '1rem',
          lineHeight: 1.6,
          color: theme.colors.text.primary,
          marginBottom: '1.5rem'
        }}>
          {helpContent.content}
        </div>

        {helpContent.plain_language_content && (
          <div style={{
            background: theme.colors.background.tertiary,
            padding: '1rem',
            borderRadius: '8px',
            marginBottom: '1.5rem'
          }}>
            <h4 style={{ marginBottom: '0.5rem' }}>In Simple Terms</h4>
            <p style={{ margin: 0, fontStyle: 'italic' }}>
              {helpContent.plain_language_content}
            </p>
          </div>
        )}

        {helpContent.related_sections && helpContent.related_sections.length > 0 && (
          <div>
            <h4 style={{ marginBottom: '1rem' }}>Related Policy Sections</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {helpContent.related_sections.map((section, index) => (
                <div
                  key={index}
                  style={{
                    padding: '1rem',
                    border: `1px solid ${theme.colors.border.secondary}`,
                    borderRadius: '8px',
                    background: theme.colors.background.secondary
                  }}
                >
                  <h5 style={{ marginBottom: '0.5rem' }}>{section.title}</h5>
                  {section.plain_language_summary && (
                    <p style={{ 
                      margin: 0, 
                      fontSize: '0.875rem',
                      color: theme.colors.text.secondary,
                      fontStyle: 'italic'
                    }}>
                      {section.plain_language_summary}
                    </p>
                  )}
                  {section.gdpr_article && (
                    <div style={{ 
                      marginTop: '0.5rem',
                      fontSize: '0.75rem',
                      color: theme.colors.text.tertiary
                    }}>
                      GDPR {section.gdpr_article}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <HelpContainer 
        className={className}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onKeyDown={handleKeyDown}
      >
        {children || (
          showIcon && (
            <HelpTrigger
              size={iconSize}
              onClick={handleClick}
              aria-label={`Get help about ${contextKey}`}
              aria-expanded={tooltipVisible}
              aria-haspopup="true"
            >
              ?
            </HelpTrigger>
          )
        )}

        <Tooltip
          placement={placement}
          visible={tooltipVisible}
          role="tooltip"
          aria-live="polite"
        >
          {renderTooltipContent()}
        </Tooltip>
      </HelpContainer>

      {/* Full content modal */}
      <Modal
        isOpen={modalVisible}
        onClose={() => setModalVisible(false)}
        title="Privacy Help"
        maxWidth="600px"
      >
        {renderModalContent()}
      </Modal>
    </>
  );
};

// Convenience component for common use cases
export const PrivacyHelpIcon: React.FC<{
  contextKey: string;
  size?: 'small' | 'medium' | 'large';
  placement?: 'top' | 'bottom' | 'left' | 'right';
}> = ({ contextKey, size = 'medium', placement = 'top' }) => (
  <ContextualHelpWidget
    contextKey={contextKey}
    iconSize={size}
    placement={placement}
    trigger="hover"
  />
);

// Higher-order component to add contextual help to any component
export const withContextualHelp = <P extends object>(
  Component: React.ComponentType<P>,
  contextKey: string,
  helpProps?: Partial<ContextualHelpWidgetProps>
) => {
  return (props: P) => (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <Component {...props} />
      <div style={{ 
        position: 'absolute', 
        top: '0', 
        right: '-30px',
        zIndex: 10
      }}>
        <ContextualHelpWidget
          contextKey={contextKey}
          placement="right"
          trigger="hover"
          iconSize="small"
          {...helpProps}
        />
      </div>
    </div>
  );
};