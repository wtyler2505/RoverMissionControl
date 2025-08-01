/**
 * RichTextRenderer Component
 * Renders rich text content with markdown and HTML support, includes sanitization
 */

import React, { useMemo, useCallback } from 'react';
import styled from '@emotion/styled';
import { css } from '@emotion/react';
import { Theme } from '../../../../../theme/themes';
import { RichTextContent, RichContentConfig } from '../types/RichContentTypes';
import { sanitizeHTML, sanitizeMarkdown } from '../utils/contentSanitizer';

interface RichTextRendererProps {
  content: RichTextContent;
  config: RichContentConfig;
  onLoad?: () => void;
  onError?: (error: Error) => void;
  onInteraction?: (action: string, data?: any) => void;
}

const TextContainer = styled.div<{ 
  theme: Theme; 
  securityLevel: RichTextContent['securityLevel'];
  constraints?: RichTextContent['constraints'];
}>`
  color: ${({ theme }) => theme.colors.text.primary};
  font-family: ${({ theme }) => theme.typography.fontFamily.primary};
  line-height: ${({ theme }) => theme.typography.lineHeight.relaxed};
  
  /* Apply constraints */
  ${({ constraints, theme }) => constraints && css`
    max-width: ${constraints.maxWidth || '100%'};
    max-height: ${constraints.maxHeight || 'none'};
    ${constraints.maxHeight && css`
      overflow-y: auto;
      padding-right: ${theme.spacing[2]};
      
      /* Custom scrollbar */
      &::-webkit-scrollbar {
        width: 6px;
      }
      
      &::-webkit-scrollbar-track {
        background: ${theme.colors.background.elevated};
        border-radius: 3px;
      }
      
      &::-webkit-scrollbar-thumb {
        background: ${theme.colors.text.secondary};
        border-radius: 3px;
        
        &:hover {
          background: ${theme.colors.text.primary};
        }
      }
    `}
    
    /* Mobile responsive */
    @media (max-width: 768px) {
      ${constraints.mobile?.maxWidth && css`
        max-width: ${constraints.mobile.maxWidth};
      `}
      ${constraints.mobile?.maxHeight && css`
        max-height: ${constraints.mobile.maxHeight};
      `}
      ${constraints.mobile?.hide && css`
        display: none;
      `}
    }
  `}
  
  /* Rich text styles */
  h1, h2, h3, h4, h5, h6 {
    margin: ${({ theme }) => theme.spacing[3]} 0 ${({ theme }) => theme.spacing[2]};
    font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
    color: ${({ theme }) => theme.colors.text.primary};
    line-height: ${({ theme }) => theme.typography.lineHeight.tight};
  }
  
  h1 { font-size: ${({ theme }) => theme.typography.fontSize.xl}; }
  h2 { font-size: ${({ theme }) => theme.typography.fontSize.lg}; }
  h3 { font-size: ${({ theme }) => theme.typography.fontSize.base}; }
  h4 { font-size: ${({ theme }) => theme.typography.fontSize.sm}; }
  h5 { font-size: ${({ theme }) => theme.typography.fontSize.xs}; }
  h6 { font-size: ${({ theme }) => theme.typography.fontSize.xs}; }
  
  p {
    margin: ${({ theme }) => theme.spacing[2]} 0;
    &:first-of-type { margin-top: 0; }
    &:last-of-type { margin-bottom: 0; }
  }
  
  strong, b {
    font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  }
  
  em, i {
    font-style: italic;
  }
  
  u {
    text-decoration: underline;
  }
  
  s {
    text-decoration: line-through;
  }
  
  mark {
    background-color: ${({ theme }) => theme.colors.warning.light}20;
    padding: 0 ${({ theme }) => theme.spacing[1]};
    border-radius: ${({ theme }) => theme.borderRadius.sm};
  }
  
  small {
    font-size: ${({ theme }) => theme.typography.fontSize.xs};
    color: ${({ theme }) => theme.colors.text.secondary};
  }
  
  code {
    font-family: ${({ theme }) => theme.typography.fontFamily.mono};
    font-size: 0.9em;
    background-color: ${({ theme }) => theme.colors.background.elevated};
    color: ${({ theme }) => theme.colors.text.primary};
    padding: 0.1em 0.3em;
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    border: 1px solid ${({ theme }) => theme.colors.divider};
  }
  
  pre {
    font-family: ${({ theme }) => theme.typography.fontFamily.mono};
    background-color: ${({ theme }) => theme.colors.background.elevated};
    color: ${({ theme }) => theme.colors.text.primary};
    padding: ${({ theme }) => theme.spacing[3]};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    border: 1px solid ${({ theme }) => theme.colors.divider};
    overflow-x: auto;
    margin: ${({ theme }) => theme.spacing[2]} 0;
    
    code {
      background: none;
      border: none;
      padding: 0;
    }
  }
  
  blockquote {
    margin: ${({ theme }) => theme.spacing[3]} 0;
    padding: ${({ theme }) => theme.spacing[3]} ${({ theme }) => theme.spacing[4]};
    border-left: 4px solid ${({ theme }) => theme.colors.primary.main};
    background-color: ${({ theme }) => theme.colors.background.elevated};
    border-radius: 0 ${({ theme }) => theme.borderRadius.md} ${({ theme }) => theme.borderRadius.md} 0;
    font-style: italic;
    
    p:last-child {
      margin-bottom: 0;
    }
  }
  
  ul, ol {
    margin: ${({ theme }) => theme.spacing[2]} 0;
    padding-left: ${({ theme }) => theme.spacing[6]};
    
    li {
      margin: ${({ theme }) => theme.spacing[1]} 0;
      line-height: ${({ theme }) => theme.typography.lineHeight.relaxed};
    }
    
    /* Nested lists */
    ul, ol {
      margin: ${({ theme }) => theme.spacing[1]} 0;
    }
  }
  
  a {
    color: ${({ theme }) => theme.colors.primary.main};
    text-decoration: underline;
    transition: color 0.2s ease;
    
    &:hover {
      color: ${({ theme }) => theme.colors.primary.dark};
    }
    
    &:focus {
      outline: 2px solid ${({ theme }) => theme.colors.primary.main};
      outline-offset: 2px;
      border-radius: ${({ theme }) => theme.borderRadius.sm};
    }
    
    /* External link indicator */
    &[target="_blank"]::after {
      content: "↗";
      font-size: 0.8em;
      margin-left: 0.2em;
      opacity: 0.7;
    }
  }
  
  hr {
    border: none;
    border-top: 1px solid ${({ theme }) => theme.colors.divider};
    margin: ${({ theme }) => theme.spacing[4]} 0;
  }
  
  /* Table styles */
  table {
    width: 100%;
    border-collapse: collapse;
    margin: ${({ theme }) => theme.spacing[3]} 0;
    border: 1px solid ${({ theme }) => theme.colors.divider};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    overflow: hidden;
  }
  
  th, td {
    padding: ${({ theme }) => theme.spacing[3]};
    text-align: left;
    border-bottom: 1px solid ${({ theme }) => theme.colors.divider};
    
    &:not(:last-child) {
      border-right: 1px solid ${({ theme }) => theme.colors.divider};
    }
  }
  
  th {
    background-color: ${({ theme }) => theme.colors.background.elevated};
    font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
    color: ${({ theme }) => theme.colors.text.primary};
  }
  
  tbody tr:hover {
    background-color: ${({ theme }) => theme.colors.background.elevated}50;
  }
  
  /* Image styles */
  img {
    max-width: 100%;
    height: auto;
    border-radius: ${({ theme }) => theme.borderRadius.md};
    
    &[alt=""] {
      outline: 2px dashed ${({ theme }) => theme.colors.error.main};
      outline-offset: 2px;
    }
  }
  
  /* Security level specific styles */
  ${({ securityLevel, theme }) => {
    if (securityLevel === 'restricted') {
      return css`
        /* More conservative styling for restricted content */
        a {
          pointer-events: none;
          color: ${theme.colors.text.secondary};
          text-decoration: none;
          cursor: default;
          
          &::after {
            content: " (link disabled)";
            font-size: 0.8em;
            opacity: 0.7;
          }
        }
        
        img, video, audio {
          display: none;
        }
      `;
    }
    return '';
  }}
  
  /* High contrast mode */
  @media (prefers-contrast: high) {
    code {
      border-width: 2px;
    }
    
    pre {
      border-width: 2px;
    }
    
    blockquote {
      border-left-width: 6px;
    }
    
    a {
      text-decoration: underline;
      text-decoration-thickness: 2px;
    }
  }
  
  /* Print styles */
  @media print {
    * {
      background: none !important;
      color: black !important;
    }
    
    a {
      text-decoration: underline;
      
      &[href]::after {
        content: " (" attr(href) ")";
        font-size: 0.8em;
      }
    }
  }
`;

// Simple markdown parser for basic formatting
const parseMarkdown = (text: string): string => {
  return text
    // Headers
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    
    // Bold
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.*?)__/g, '<strong>$1</strong>')
    
    // Italic
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/_(.*?)_/g, '<em>$1</em>')
    
    // Code
    .replace(/`(.*?)`/g, '<code>$1</code>')
    
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    
    // Line breaks
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
    
    // Wrap in paragraphs if not already wrapped
    .replace(/^(?!<[hup])/gm, '<p>')
    .replace(/(?<!<\/[hup]>)$/gm, '</p>')
    
    // Clean up empty paragraphs
    .replace(/<p><\/p>/g, '');
};

export const RichTextRenderer: React.FC<RichTextRendererProps> = ({
  content,
  config,
  onLoad,
  onError,
  onInteraction
}) => {
  // Process content based on type
  const processedContent = useMemo(() => {
    try {
      let processed = content.content;
      
      switch (content.type) {
        case 'markdown':
          processed = parseMarkdown(sanitizeMarkdown(processed, content.securityLevel));
          break;
          
        case 'html':
          processed = sanitizeHTML(processed, content.securityLevel, {
            allowedTags: content.allowedTags,
            allowedAttributes: content.allowedAttributes
          });
          break;
          
        case 'text':
        default:
          // Escape HTML entities for plain text
          processed = processed
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\n/g, '<br>');
          break;
      }
      
      // Handle link targets
      if (content.linkTarget && (content.type === 'markdown' || content.type === 'html')) {
        processed = processed.replace(
          /<a\s+([^>]*?)href="([^"]*?)"([^>]*?)>/g,
          `<a $1href="$2"$3 target="${content.linkTarget}" rel="noopener noreferrer">`
        );
      }
      
      return processed;
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error(String(error)));
      return 'Error processing content';
    }
  }, [content, onError]);
  
  // Handle clicks for interaction tracking
  const handleClick = useCallback((event: React.MouseEvent) => {
    const target = event.target as HTMLElement;
    
    // Track link clicks
    if (target.tagName === 'A') {
      const href = target.getAttribute('href');
      onInteraction?.('link-click', { href, text: target.textContent });
    }
    
    // Track other interactions
    if (target.dataset.action) {
      event.preventDefault();
      onInteraction?.(target.dataset.action, target.dataset);
    }
  }, [onInteraction]);
  
  // Handle load event
  React.useEffect(() => {
    onLoad?.();
  }, [onLoad]);
  
  return (
    <TextContainer
      securityLevel={content.securityLevel}
      constraints={content.constraints}
      onClick={handleClick}
      className={content.className}
      aria-label={content.ariaLabel}
      aria-describedby={content.ariaDescription}
      data-testid={content.testId || `rich-text-${content.id}`}
      dangerouslySetInnerHTML={{ __html: processedContent }}
    />
  );
};