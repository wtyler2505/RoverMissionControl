import React, { useEffect, useState } from 'react';
import assetLoader from '../../utils/assetLoader';

/**
 * ResourcePreloader - Critical resource loading for Rover Mission Control
 * 
 * Handles:
 * - Font preloading with fallbacks
 * - Critical image preloading
 * - Modern format detection
 * - Loading state management
 * - Error handling and recovery
 */

const ResourcePreloader = ({ children, onLoadingComplete }) => {
  const [loadingState, setLoadingState] = useState({
    fonts: false,
    images: false,
    complete: false,
    error: null
  });

  const [progress, setProgress] = useState(0);

  useEffect(() => {
    initializeAssets();
  }, []);

  const initializeAssets = async () => {
    try {
      console.log('🚀 Starting resource preload...');
      
      // Initialize asset loader
      await assetLoader.initialize();
      setProgress(25);
      
      // Load critical fonts
      await loadFonts();
      setProgress(50);
      
      // Load critical images
      await loadImages();
      setProgress(75);
      
      // Complete initialization
      setLoadingState(prev => ({
        ...prev,
        complete: true
      }));
      setProgress(100);
      
      console.log('✅ Resource preload complete');
      
      if (onLoadingComplete) {
        onLoadingComplete();
      }
      
    } catch (error) {
      console.error('❌ Resource preload failed:', error);
      setLoadingState(prev => ({
        ...prev,
        error: error.message,
        complete: true // Continue anyway
      }));
      
      if (onLoadingComplete) {
        onLoadingComplete(error);
      }
    }
  };

  const loadFonts = async () => {
    try {
      const criticalFonts = [
        {
          family: 'RoverMono',
          weight: '400',
          style: 'normal',
          formats: ['woff2', 'woff']
        },
        {
          family: 'RoverMono',
          weight: '700',
          style: 'normal',
          formats: ['woff2', 'woff']
        }
      ];
      
      await assetLoader.preloadFonts(criticalFonts);
      
      setLoadingState(prev => ({
        ...prev,
        fonts: true
      }));
      
      console.log('✅ Critical fonts loaded');
      
    } catch (error) {
      console.warn('⚠️ Font loading failed, using fallbacks:', error);
      // Continue with system fonts
      document.documentElement.classList.add('fonts-fallback');
      
      setLoadingState(prev => ({
        ...prev,
        fonts: true // Mark as complete even with fallback
      }));
    }
  };

  const loadImages = async () => {
    try {
      const criticalImages = [
        '/assets/images/rover-hero',
        '/assets/images/mission-badge',
        '/assets/images/icons/control-32',
        '/assets/images/icons/telemetry-32',
        '/assets/images/icons/warning-32',
        '/assets/images/icons/error-32'
      ];
      
      // Preload with modern format detection
      const preloadPromises = criticalImages.map(async (baseSrc) => {
        try {
          const optimalSrc = assetLoader.getOptimalImageSrc(baseSrc);
          assetLoader.preloadImage(optimalSrc, { priority: 'high' });
          return true;
        } catch (error) {
          console.warn(`Failed to preload ${baseSrc}:`, error);
          return false;
        }
      });
      
      await Promise.allSettled(preloadPromises);
      
      setLoadingState(prev => ({
        ...prev,
        images: true
      }));
      
      console.log('✅ Critical images preloaded');
      
    } catch (error) {
      console.warn('⚠️ Image preloading failed:', error);
      
      setLoadingState(prev => ({
        ...prev,
        images: true // Continue anyway
      }));
    }
  };

  // Show loading screen until resources are ready
  if (!loadingState.complete) {
    return (
      <div className="resource-preloader">
        <div className="preloader-container">
          <div className="rover-logo">
            <div className="logo-animation">
              🚀
            </div>
          </div>
          
          <h2 className="preloader-title">
            Rover Mission Control
          </h2>
          
          <div className="loading-progress">
            <div className="progress-bar">
              <div 
                className="progress-fill"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="progress-text">
              {progress < 25 && 'Initializing systems...'}
              {progress >= 25 && progress < 50 && 'Loading fonts...'}
              {progress >= 50 && progress < 75 && 'Optimizing images...'}
              {progress >= 75 && progress < 100 && 'Finalizing...'}
              {progress === 100 && 'Ready for launch!'}
            </div>
          </div>
          
          <div className="loading-details">
            <div className={`detail-item ${loadingState.fonts ? 'complete' : 'loading'}`}>
              <span className="icon">{loadingState.fonts ? '✅' : '⏳'}</span>
              Critical fonts
            </div>
            <div className={`detail-item ${loadingState.images ? 'complete' : 'loading'}`}>
              <span className="icon">{loadingState.images ? '✅' : '⏳'}</span>
              Essential images
            </div>
          </div>
          
          {loadingState.error && (
            <div className="preloader-error">
              <span className="error-icon">⚠️</span>
              <span className="error-message">
                Some resources failed to load, continuing with fallbacks
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Resources loaded, render application
  return children;
};

export default ResourcePreloader;