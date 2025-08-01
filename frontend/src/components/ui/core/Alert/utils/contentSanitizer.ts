/**
 * Content Sanitizer Utility
 * Provides secure content sanitization to prevent XSS attacks while preserving intended formatting
 */

import DOMPurify from 'dompurify';
import { RichContent, ContentValidationResult, SanitizerOptions, ContentSecurityLevel } from '../types/RichContentTypes';

// Default allowed HTML tags for different security levels
const ALLOWED_TAGS = {
  trusted: [
    'div', 'span', 'p', 'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'strong', 'em', 'b', 'i', 'u', 's', 'mark', 'small', 'sub', 'sup',
    'a', 'img', 'video', 'audio', 'source', 'track',
    'ul', 'ol', 'li', 'dl', 'dt', 'dd',
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption',
    'blockquote', 'cite', 'q', 'pre', 'code', 'kbd', 'samp', 'var',
    'details', 'summary', 'figure', 'figcaption',
    'time', 'abbr', 'dfn', 'address'
  ],
  sanitized: [
    'div', 'span', 'p', 'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'strong', 'em', 'b', 'i', 'u', 'mark', 'small',
    'a', 'img',
    'ul', 'ol', 'li',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'blockquote', 'pre', 'code'
  ],
  restricted: [
    'div', 'span', 'p', 'br', 'strong', 'em', 'b', 'i', 'code'
  ]
} as const;

// Default allowed attributes for different security levels
const ALLOWED_ATTRIBUTES = {
  trusted: {
    '*': ['class', 'id', 'title', 'aria-*', 'data-*', 'role'],
    'a': ['href', 'target', 'rel', 'download'],
    'img': ['src', 'alt', 'width', 'height', 'loading', 'sizes', 'srcset'],
    'video': ['src', 'controls', 'width', 'height', 'poster', 'preload'],
    'audio': ['src', 'controls', 'preload'],
    'source': ['src', 'type', 'media'],
    'track': ['src', 'kind', 'srclang', 'label', 'default'],
    'table': ['summary'],
    'th': ['scope', 'colspan', 'rowspan'],
    'td': ['colspan', 'rowspan'],
    'time': ['datetime'],
    'blockquote': ['cite']
  },
  sanitized: {
    '*': ['class', 'title', 'aria-label', 'aria-describedby', 'role'],
    'a': ['href', 'rel'],
    'img': ['src', 'alt', 'width', 'height', 'loading'],
    'th': ['scope'],
    'blockquote': ['cite']
  },
  restricted: {
    '*': ['class', 'aria-label', 'role']
  }
} as const;

// Allowed URL schemes
const ALLOWED_SCHEMES = ['http', 'https', 'mailto', 'tel', 'ftp', 'data'];

// Configure DOMPurify
const configureDOMPurify = (securityLevel: ContentSecurityLevel, customOptions?: Partial<SanitizerOptions>) => {
  const config = {
    ALLOWED_TAGS: customOptions?.allowedTags || ALLOWED_TAGS[securityLevel],
    ALLOWED_ATTR: customOptions?.allowedAttributes || ALLOWED_ATTRIBUTES[securityLevel],
    ALLOWED_URI_REGEXP: new RegExp(`^(?:(?:${ALLOWED_SCHEMES.join('|')}):)`),
    FORBID_SCRIPTS: true,
    FORBID_TAGS: ['script', 'object', 'embed', 'style', 'link', 'meta', 'base'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
    ALLOW_DATA_ATTR: securityLevel !== 'restricted',
    ALLOW_ARIA_ATTR: true,
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
    SANITIZE_DOM: true,
    KEEP_CONTENT: true,
    FORCE_BODY: false,
    ...customOptions
  };

  return config;
};

/**
 * Sanitize HTML content based on security level
 */
export const sanitizeHTML = (
  html: string, 
  securityLevel: ContentSecurityLevel = 'sanitized',
  customOptions?: Partial<SanitizerOptions>
): string => {
  try {
    const config = configureDOMPurify(securityLevel, customOptions);
    const sanitized = DOMPurify.sanitize(html, config);
    
    // Additional validation for restricted mode
    if (securityLevel === 'restricted') {
      // Remove any remaining potentially dangerous content
      return sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    }
    
    return sanitized;
  } catch (error) {
    console.error('HTML sanitization failed:', error);
    return ''; // Return empty string on error for security
  }
};

/**
 * Validate and sanitize markdown content
 */
export const sanitizeMarkdown = (
  markdown: string,
  securityLevel: ContentSecurityLevel = 'sanitized'
): string => {
  try {
    // Basic markdown sanitization - remove script tags and dangerous protocols
    let sanitized = markdown
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/vbscript:/gi, '')
      .replace(/data:text\/html/gi, 'data:text/plain');
    
    // For restricted mode, also remove HTML tags
    if (securityLevel === 'restricted') {
      sanitized = sanitized.replace(/<[^>]*>/g, '');
    }
    
    return sanitized;
  } catch (error) {
    console.error('Markdown sanitization failed:', error);
    return markdown; // Return original for markdown as it's less dangerous
  }
};

/**
 * Validate URL for security
 */
export const validateURL = (url: string): boolean => {
  try {
    const parsedURL = new URL(url);
    const scheme = parsedURL.protocol.slice(0, -1); // Remove trailing colon
    
    // Check if scheme is allowed
    if (!ALLOWED_SCHEMES.includes(scheme)) {
      return false;
    }
    
    // Additional checks for specific schemes
    if (scheme === 'javascript' || scheme === 'vbscript') {
      return false;
    }
    
    // Check for suspicious patterns
    if (url.includes('javascript:') || url.includes('vbscript:')) {
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
};

/**
 * Sanitize and validate rich content
 */
export const validateRichContent = (content: RichContent): ContentValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  let sanitizedContent: RichContent = { ...content };

  try {
    switch (content.type) {
      case 'text':
      case 'markdown':
        if ('content' in content) {
          const originalContent = content.content;
          sanitizedContent = {
            ...content,
            content: content.type === 'markdown' 
              ? sanitizeMarkdown(originalContent, content.securityLevel)
              : originalContent
          };
          
          if (sanitizedContent.content !== originalContent) {
            warnings.push('Content was modified during sanitization');
          }
        }
        break;
        
      case 'html':
        if ('content' in content) {
          const originalContent = content.content;
          sanitizedContent = {
            ...content,
            content: sanitizeHTML(originalContent, content.securityLevel, {
              allowedTags: content.allowedTags,
              allowedAttributes: content.allowedAttributes
            })
          };
          
          if (sanitizedContent.content !== originalContent) {
            warnings.push('HTML content was sanitized');
          }
          
          if (!sanitizedContent.content.trim()) {
            errors.push('HTML content was completely removed during sanitization');
          }
        }
        break;
        
      case 'image':
        if ('src' in content) {
          if (!validateURL(content.src)) {
            errors.push('Invalid or unsafe image URL');
          }
          if (!content.alt) {
            errors.push('Image content must include alt text for accessibility');
          }
          if (content.fallbackSrc && !validateURL(content.fallbackSrc)) {
            warnings.push('Invalid fallback URL provided');
            sanitizedContent = { ...content, fallbackSrc: undefined };
          }
        }
        break;
        
      case 'link':
        if ('href' in content) {
          if (!validateURL(content.href)) {
            errors.push('Invalid or unsafe link URL');
          }
          if (!content.text?.trim()) {
            errors.push('Link content must include descriptive text');
          }
          
          // Auto-add rel attributes for external links
          if (content.external || content.href.startsWith('http')) {
            sanitizedContent = {
              ...content,
              rel: content.rel || 'noopener noreferrer',
              target: content.target || '_blank'
            };
          }
        }
        break;
        
      case 'form':
        if ('fields' in content) {
          if (content.securityLevel === 'restricted') {
            errors.push('Forms are not allowed in restricted security mode');
          }
          if (!content.fields.length) {
            errors.push('Form content must include at least one field');
          }
          
          // Validate field names and IDs
          const fieldIds = new Set();
          const fieldNames = new Set();
          
          for (const field of content.fields) {
            if (fieldIds.has(field.id)) {
              errors.push(`Duplicate field ID: ${field.id}`);
            }
            if (fieldNames.has(field.name)) {
              errors.push(`Duplicate field name: ${field.name}`);
            }
            fieldIds.add(field.id);
            fieldNames.add(field.name);
          }
        }
        break;
        
      case 'progress':
        if ('value' in content) {
          const max = content.max || 100;
          if (content.value < 0 || content.value > max) {
            errors.push(`Progress value must be between 0 and ${max}`);
          }
        }
        break;
        
      case 'component':
        if (content.securityLevel === 'restricted') {
          errors.push('Custom components are not allowed in restricted security mode');
        }
        if (!('component' in content) || !content.component) {
          errors.push('Component content must include a valid React component');
        }
        break;
        
      case 'table':
        if ('data' in content && 'columns' in content) {
          if (!content.columns.length) {
            errors.push('Table content must include at least one column');
          }
          
          // Validate column IDs are unique
          const columnIds = new Set();
          for (const column of content.columns) {
            if (columnIds.has(column.id)) {
              errors.push(`Duplicate column ID: ${column.id}`);
            }
            columnIds.add(column.id);
          }
        }
        break;
        
      case 'code':
        if ('code' in content) {
          if (content.executable && content.securityLevel !== 'trusted') {
            errors.push('Executable code is only allowed in trusted security mode');
          }
        }
        break;
    }

    // Validate constraints
    if (content.constraints) {
      const { maxWidth, maxHeight } = content.constraints;
      if (maxWidth && !CSS.supports('width', maxWidth)) {
        warnings.push('Invalid maxWidth constraint');
      }
      if (maxHeight && !CSS.supports('height', maxHeight)) {
        warnings.push('Invalid maxHeight constraint');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      sanitizedContent
    };
    
  } catch (error) {
    return {
      valid: false,
      errors: [`Content validation failed: ${error instanceof Error ? error.message : String(error)}`],
      warnings,
      sanitizedContent: content
    };
  }
};

/**
 * Batch validate multiple rich content items
 */
export const validateRichContentBatch = (contentItems: RichContent[]): ContentValidationResult[] => {
  return contentItems.map(validateRichContent);
};

/**
 * Check if content type is allowed for security level
 */
export const isContentTypeAllowed = (type: RichContent['type'], securityLevel: ContentSecurityLevel): boolean => {
  switch (securityLevel) {
    case 'restricted':
      return ['text', 'markdown', 'image', 'link', 'progress'].includes(type);
    case 'sanitized':
      return !['component'].includes(type);
    case 'trusted':
      return true;
    default:
      return false;
  }
};

/**
 * Get security recommendations for content
 */
export const getSecurityRecommendations = (content: RichContent): string[] => {
  const recommendations: string[] = [];
  
  if (content.securityLevel === 'trusted') {
    recommendations.push('Consider using a more restrictive security level if possible');
  }
  
  if (content.type === 'html' && content.securityLevel !== 'restricted') {
    recommendations.push('HTML content should use the most restrictive security level possible');
  }
  
  if (content.type === 'component') {
    recommendations.push('Custom components should be thoroughly reviewed and tested');
    recommendations.push('Consider using component isolation for untrusted components');
  }
  
  if (content.type === 'form') {
    recommendations.push('Form submissions should be validated on the server side');
    recommendations.push('Use CSRF protection for form submissions');
  }
  
  return recommendations;
};