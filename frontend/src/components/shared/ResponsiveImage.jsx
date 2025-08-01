import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';

/**
 * ResponsiveImage - Optimized image component for Rover Mission Control
 * 
 * Features:
 * - Modern format support (WebP, AVIF with fallbacks)
 * - Responsive images with srcset
 * - Lazy loading with intersection observer
 * - Error handling and fallbacks
 * - Performance optimized
 */

const ResponsiveImage = ({
  src,
  alt,
  width,
  height,
  className = '',
  lazy = true,
  priority = false,
  breakpoints = [480, 768, 1024, 1440, 1920],
  formats = ['avif', 'webp'],
  fallbackFormat = 'png',
  onLoad,
  onError,
  ...props
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isInView, setIsInView] = useState(!lazy || priority);
  const imgRef = useRef(null);
  const observerRef = useRef(null);

  // Extract base path and filename for generating variants
  const getImageVariants = (baseSrc) => {
    const lastDot = baseSrc.lastIndexOf('.');
    const basePath = baseSrc.substring(0, lastDot);
    const extension = baseSrc.substring(lastDot + 1);
    
    return { basePath, extension };
  };

  // Generate srcset for responsive images
  const generateSrcSet = (basePath, format) => {
    return breakpoints
      .map(bp => `${basePath}-${bp}w.${format} ${bp}w`)
      .join(', ');
  };

  // Generate sizes attribute
  const generateSizes = () => {
    const defaultSizes = [
      '(max-width: 480px) 100vw',
      '(max-width: 768px) 50vw',
      '(max-width: 1024px) 33vw',
      '25vw'
    ];
    
    return defaultSizes.join(', ');
  };

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (!lazy || priority || isInView) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '50px 0px', // Start loading 50px before image comes into view
        threshold: 0.1
      }
    );

    const currentRef = imgRef.current;
    if (currentRef) {
      observer.observe(currentRef);
      observerRef.current = observer;
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [lazy, priority, isInView]);

  // Handle image load
  const handleLoad = (event) => {
    setIsLoaded(true);
    setHasError(false);
    if (onLoad) onLoad(event);
  };

  // Handle image error
  const handleError = (event) => {
    setHasError(true);
    if (onError) onError(event);
  };

  // Don't render image sources until in view (for lazy loading)
  if (!isInView) {
    return (
      <div
        ref={imgRef}
        className={`responsive-image-placeholder ${className}`}
        style={{
          width: width || '100%',
          height: height || 'auto',
          backgroundColor: 'var(--bg-secondary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-muted)',
          fontSize: '0.8rem'
        }}
        {...props}
      >
        {!priority && 'Loading...'}
      </div>
    );
  }

  const { basePath, extension } = getImageVariants(src);
  
  // Generate modern format sources
  const modernSources = formats.map(format => {
    const srcSet = generateSrcSet(basePath, format);
    return (
      <source
        key={format}
        type={`image/${format}`}
        srcSet={srcSet}
        sizes={generateSizes()}
      />
    );
  });

  // Fallback source (original format)
  const fallbackSrcSet = generateSrcSet(basePath, extension);

  return (
    <div 
      className={`responsive-image-container ${className} ${isLoaded ? 'loaded' : ''} ${hasError ? 'error' : ''}`}
      style={{ position: 'relative' }}
    >
      <picture>
        {/* Modern format sources (AVIF, WebP) */}
        {modernSources}
        
        {/* Fallback source */}
        <source
          type={`image/${extension}`}
          srcSet={fallbackSrcSet}
          sizes={generateSizes()}
        />
        
        {/* Final fallback img element */}
        <img
          ref={imgRef}
          src={src} // Fallback for browsers that don't support srcset
          alt={alt || ''}
          width={width}
          height={height}
          loading={lazy && !priority ? 'lazy' : 'eager'}
          decoding={priority ? 'sync' : 'async'}
          onLoad={handleLoad}
          onError={handleError}
          className={`responsive-image ${isLoaded ? 'fade-in' : ''}`}
          style={{
            maxWidth: '100%',
            height: 'auto',
            opacity: isLoaded ? 1 : 0,
            transition: 'opacity 0.3s ease-in-out'
          }}
          {...props}
        />
      </picture>
      
      {/* Loading indicator */}
      {!isLoaded && !hasError && (
        <div className="image-loading-indicator">
          <div className="loading-spinner" />
        </div>
      )}
      
      {/* Error fallback */}
      {hasError && (
        <div className="image-error-fallback">
          <span>⚠️ Image failed to load</span>
        </div>
      )}
    </div>
  );
};

ResponsiveImage.propTypes = {
  src: PropTypes.string.isRequired,
  alt: PropTypes.string.isRequired,
  width: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  height: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  className: PropTypes.string,
  lazy: PropTypes.bool,
  priority: PropTypes.bool,
  breakpoints: PropTypes.arrayOf(PropTypes.number),
  formats: PropTypes.arrayOf(PropTypes.string),
  fallbackFormat: PropTypes.string,
  onLoad: PropTypes.func,
  onError: PropTypes.func
};

export default ResponsiveImage;