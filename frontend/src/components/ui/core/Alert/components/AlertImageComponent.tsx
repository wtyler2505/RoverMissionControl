/**
 * AlertImageComponent
 * Responsive image component with lazy loading, error handling, and size constraints
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import styled from '@emotion/styled';
import { css } from '@emotion/react';
import { Theme } from '../../../../../theme/themes';
import { ImageContent, RichContentConfig } from '../types/RichContentTypes';
import { validateURL } from '../utils/contentSanitizer';

interface AlertImageComponentProps {
  content: ImageContent;
  config: RichContentConfig;
  onLoad?: () => void;
  onError?: (error: Error) => void;
  onInteraction?: (action: string, data?: any) => void;
}

const ImageContainer = styled.div<{ 
  theme: Theme; 
  constraints?: ImageContent['constraints'];
  loading: boolean;
  error: boolean;
}>`
  position: relative;
  display: inline-block;
  overflow: hidden;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background-color: ${({ theme }) => theme.colors.background.elevated};
  
  /* Apply constraints */
  ${({ constraints }) => constraints && css`
    max-width: ${constraints.maxWidth || '100%'};
    max-height: ${constraints.maxHeight || 'none'};
    ${constraints.aspectRatio && css`
      aspect-ratio: ${constraints.aspectRatio};
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
  
  /* Loading state */
  ${({ loading, theme }) => loading && css`
    background: linear-gradient(
      90deg,
      ${theme.colors.background.elevated} 25%,
      ${theme.colors.background.paper} 50%,
      ${theme.colors.background.elevated} 75%
    );
    background-size: 200% 100%;
    animation: loading 1.5s infinite;
    
    @keyframes loading {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
    
    /* Reduced motion */
    @media (prefers-reduced-motion: reduce) {
      animation: none;
      background: ${theme.colors.background.elevated};
    }
  `}
  
  /* Error state */
  ${({ error, theme }) => error && css`
    border: 2px dashed ${theme.colors.error.main};
    background-color: ${theme.colors.error.main}10;
  `}
`;

const Image = styled.img<{ 
  theme: Theme;
  loaded: boolean;
}>`
  display: block;
  width: 100%;
  height: auto;
  transition: opacity 0.3s ease;
  opacity: ${({ loaded }) => loaded ? 1 : 0};
  
  /* Ensure accessibility */
  &[alt=""] {
    outline: 2px dashed ${({ theme }) => theme.colors.warning.main};
    outline-offset: 2px;
  }
  
  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    transition: none;
    opacity: 1;
  }
`;

const LoadingPlaceholder = styled.div<{ theme: Theme }>`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
  color: ${({ theme }) => theme.colors.text.secondary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  
  .loading-icon {
    width: 24px;
    height: 24px;
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
    .loading-icon {
      animation: none;
      border: 2px solid ${({ theme }) => theme.colors.text.secondary};
    }
  }
`;

const ErrorPlaceholder = styled.div<{ theme: Theme }>`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
  color: ${({ theme }) => theme.colors.error.main};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  text-align: center;
  padding: ${({ theme }) => theme.spacing[4]};
  
  .error-icon {
    width: 24px;
    height: 24px;
    fill: currentColor;
  }
`;

const ImageOverlay = styled.div<{ theme: Theme; show: boolean }>`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: ${({ show }) => show ? 1 : 0};
  visibility: ${({ show }) => show ? 'visible' : 'hidden'};
  transition: opacity 0.3s ease, visibility 0.3s ease;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  
  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

const ImageActions = styled.div<{ theme: Theme }>`
  display: flex;
  gap: ${({ theme }) => theme.spacing[2]};
`;

const ActionButton = styled.button<{ theme: Theme }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: rgba(255, 255, 255, 0.9);
  border: none;
  border-radius: ${({ theme }) => theme.borderRadius.full};
  cursor: pointer;
  color: ${({ theme }) => theme.colors.text.primary};
  transition: all 0.2s ease;
  
  &:hover {
    background: rgba(255, 255, 255, 1);
    transform: scale(1.1);
  }
  
  &:focus {
    outline: 2px solid ${({ theme }) => theme.colors.primary.main};
    outline-offset: 2px;
  }
  
  svg {
    width: 20px;
    height: 20px;
    fill: currentColor;
  }
  
  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    transition: none;
    
    &:hover {
      transform: none;
    }
  }
`;

const SizeInfo = styled.div<{ theme: Theme }>`
  position: absolute;
  bottom: ${({ theme }) => theme.spacing[2]};
  right: ${({ theme }) => theme.spacing[2]};
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: ${({ theme }) => theme.spacing[1]} ${({ theme }) => theme.spacing[2]};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
`;

export const AlertImageComponent: React.FC<AlertImageComponentProps> = ({
  content,
  config,
  onLoad,
  onError,
  onInteraction
}) => {
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showOverlay, setShowOverlay] = useState(false);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [currentSrc, setCurrentSrc] = useState(content.src);
  
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Validate URL
  useEffect(() => {
    if (!validateURL(content.src)) {
      setError('Invalid or unsafe image URL');
      setLoading(false);
      onError?.(new Error('Invalid or unsafe image URL'));
    }
  }, [content.src, onError]);

  // Handle image load
  const handleLoad = useCallback(() => {
    setLoaded(true);
    setLoading(false);
    setError(null);
    
    // Get natural dimensions
    if (imageRef.current) {
      setNaturalSize({
        width: imageRef.current.naturalWidth,
        height: imageRef.current.naturalHeight
      });
    }
    
    onLoad?.();
    content.onLoad?.();
  }, [onLoad, content]);

  // Handle image error
  const handleError = useCallback(() => {
    setLoading(false);
    setLoaded(false);
    
    // Try fallback if available and not already tried
    if (content.fallbackSrc && currentSrc !== content.fallbackSrc) {
      if (validateURL(content.fallbackSrc)) {
        setCurrentSrc(content.fallbackSrc);
        return;
      }
    }
    
    const errorMsg = 'Failed to load image';
    setError(errorMsg);
    
    const error = new Error(errorMsg);
    onError?.(error);
    content.onError?.();
  }, [content, onError, currentSrc]);

  // Handle click interactions
  const handleClick = useCallback((event: React.MouseEvent) => {
    onInteraction?.('image-click', {
      src: currentSrc,
      alt: content.alt,
      naturalSize
    });
  }, [onInteraction, currentSrc, content.alt, naturalSize]);

  // Handle zoom action
  const handleZoom = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    onInteraction?.('image-zoom', {
      src: currentSrc,
      alt: content.alt,
      naturalSize
    });
  }, [onInteraction, currentSrc, content.alt, naturalSize]);

  // Handle download action
  const handleDownload = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    
    // Create download link
    const link = document.createElement('a');
    link.href = currentSrc;
    link.download = content.alt || 'image';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    onInteraction?.('image-download', {
      src: currentSrc,
      alt: content.alt
    });
  }, [onInteraction, currentSrc, content.alt]);

  // Security check for restricted mode
  if (content.securityLevel === 'restricted') {
    return (
      <div data-testid={content.testId || `image-restricted-${content.id}`}>
        <em style={{ color: 'var(--text-secondary)' }}>
          [Image blocked in restricted mode: {content.alt}]
        </em>
      </div>
    );
  }

  return (
    <ImageContainer
      ref={containerRef}
      constraints={content.constraints}
      loading={loading}
      error={!!error}
      onMouseEnter={() => setShowOverlay(true)}
      onMouseLeave={() => setShowOverlay(false)}
      onClick={handleClick}
      className={content.className}
      data-testid={content.testId || `image-${content.id}`}
      role="img"
      aria-label={content.ariaLabel || content.alt}
      aria-describedby={content.ariaDescription}
    >
      {/* Main Image */}
      {!error && (
        <Image
          ref={imageRef}
          src={currentSrc}
          alt={content.alt}
          title={content.title}
          loading={content.loading || 'lazy'}
          sizes={content.sizes}
          srcSet={content.srcSet}
          loaded={loaded}
          onLoad={handleLoad}
          onError={handleError}
        />
      )}

      {/* Loading Placeholder */}
      {loading && !error && (
        <LoadingPlaceholder>
          <div className="loading-icon" />
          <span>Loading image...</span>
        </LoadingPlaceholder>
      )}

      {/* Error Placeholder */}
      {error && (
        <ErrorPlaceholder>
          <svg className="error-icon" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
          <div>
            <div>Image unavailable</div>
            <div style={{ fontSize: '0.8em', opacity: 0.8 }}>
              {content.alt}
            </div>
          </div>
        </ErrorPlaceholder>
      )}

      {/* Interactive Overlay */}
      {loaded && !error && config.accessibility?.supportScreenReader !== false && (
        <ImageOverlay show={showOverlay}>
          <ImageActions>
            <ActionButton
              onClick={handleZoom}
              title="View full size"
              aria-label="View image in full size"
            >
              <svg viewBox="0 0 24 24">
                <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                <path d="M12 10h-2v2H9v-2H7V9h2V7h1v2h2v1z"/>
              </svg>
            </ActionButton>
            
            {config.securityPolicy?.allowFileUploads !== false && (
              <ActionButton
                onClick={handleDownload}
                title="Download image"
                aria-label="Download image"
              >
                <svg viewBox="0 0 24 24">
                  <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                </svg>
              </ActionButton>
            )}
          </ImageActions>
        </ImageOverlay>
      )}

      {/* Size Information */}
      {loaded && naturalSize && config.accessibility?.supportScreenReader !== false && (
        <SizeInfo>
          {naturalSize.width} × {naturalSize.height}
        </SizeInfo>
      )}
    </ImageContainer>
  );
};