/**
 * Asset Loader Utilities for Rover Mission Control
 * Handles optimal loading of fonts, images, and other assets
 */

class AssetLoader {
  constructor() {
    this.fontLoadPromises = new Map();
    this.imageCache = new Map();
    this.preloadedAssets = new Set();
  }

  /**
   * Preload critical fonts with optimal loading strategy
   */
  async preloadFonts(fonts = []) {
    const defaultFonts = [
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

    const fontsToLoad = fonts.length > 0 ? fonts : defaultFonts;
    
    const loadPromises = fontsToLoad.map(font => this.loadFont(font));
    
    try {
      await Promise.all(loadPromises);
      console.log('✅ All critical fonts loaded');
      document.documentElement.classList.add('fonts-loaded');
    } catch (error) {
      console.warn('⚠️ Some fonts failed to load:', error);
      document.documentElement.classList.add('fonts-fallback');
    }
  }

  /**
   * Load individual font with error handling
   */
  async loadFont({ family, weight, style, formats }) {
    const fontKey = `${family}-${weight}-${style}`;
    
    if (this.fontLoadPromises.has(fontKey)) {
      return this.fontLoadPromises.get(fontKey);
    }

    const promise = this._loadFontFace(family, weight, style, formats);
    this.fontLoadPromises.set(fontKey, promise);
    
    return promise;
  }

  async _loadFontFace(family, weight, style, formats) {
    // Check if font is already loaded
    if ('fonts' in document && document.fonts.check(`${weight} 16px ${family}`)) {
      return Promise.resolve();
    }

    // Generate font URLs for different formats
    const fontUrls = formats.map(format => {
      const fileName = `${family.toLowerCase()}-${weight === '400' ? 'regular' : 'bold'}.${format}`;
      return `url('./assets/fonts/${fileName}') format('${format}')`;
    }).join(', ');

    // Create font face
    const fontFace = new FontFace(family, fontUrls, {
      weight,
      style,
      display: 'swap'
    });

    try {
      const loadedFont = await fontFace.load();
      document.fonts.add(loadedFont);
      return loadedFont;
    } catch (error) {
      console.warn(`Failed to load font ${family} ${weight}:`, error);
      throw error;
    }
  }

  /**
   * Preload critical images
   */
  preloadImages(images = []) {
    const criticalImages = [
      '/assets/images/rover-hero.webp',
      '/assets/images/mission-badge.webp',
      '/assets/images/icons/control-32.webp'
    ];

    const imagesToPreload = images.length > 0 ? images : criticalImages;
    
    imagesToPreload.forEach(src => this.preloadImage(src));
  }

  /**
   * Preload individual image with modern format support
   */
  preloadImage(src, options = {}) {
    if (this.preloadedAssets.has(src)) {
      return;
    }

    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = src;
    
    if (options.type) {
      link.type = options.type;
    }

    // Add fetchpriority for high priority images
    if (options.priority === 'high') {
      link.fetchPriority = 'high';
    }

    document.head.appendChild(link);
    this.preloadedAssets.add(src);
  }

  /**
   * Load image with modern format detection
   */
  async loadImageWithFallback(baseSrc, formats = ['avif', 'webp']) {
    const cacheKey = `${baseSrc}-${formats.join('-')}`;
    
    if (this.imageCache.has(cacheKey)) {
      return this.imageCache.get(cacheKey);
    }

    // Extract base path for format variants
    const lastDot = baseSrc.lastIndexOf('.');
    const basePath = baseSrc.substring(0, lastDot);
    
    // Try modern formats first
    for (const format of formats) {
      const modernSrc = `${basePath}.${format}`;
      
      try {
        const img = await this._loadImage(modernSrc);
        this.imageCache.set(cacheKey, { src: modernSrc, img });
        return { src: modernSrc, img };
      } catch (error) {
        console.log(`Format ${format} not available for ${basePath}`);
      }
    }

    // Fallback to original
    try {
      const img = await this._loadImage(baseSrc);
      this.imageCache.set(cacheKey, { src: baseSrc, img });
      return { src: baseSrc, img };
    } catch (error) {
      console.error(`Failed to load image: ${baseSrc}`, error);
      throw error;
    }
  }

  _loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  /**
   * Detect browser support for modern image formats
   */
  async detectImageFormatSupport() {
    const formats = {
      webp: 'data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA',
      avif: 'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgABogQEAwgMg8f8D///8WfhwB8+ErK42A='
    };

    const support = {};
    
    for (const [format, dataUrl] of Object.entries(formats)) {
      try {
        await this._loadImage(dataUrl);
        support[format] = true;
      } catch {
        support[format] = false;
      }
    }
    
    return support;
  }

  /**
   * Initialize asset loading strategy
   */
  async initialize() {
    console.log('🚀 Initializing Rover Mission Control asset loader...');
    
    // Detect format support
    const formatSupport = await this.detectImageFormatSupport();
    console.log('📊 Image format support:', formatSupport);
    
    // Store support info for use in components
    window.roverAssetSupport = formatSupport;
    
    // Start loading critical assets
    this.preloadFonts();
    this.preloadImages();
    
    // Set up service worker for asset caching if available
    if ('serviceWorker' in navigator) {
      this.setupServiceWorker();
    }
    
    console.log('✅ Asset loader initialized');
  }

  /**
   * Setup secure service worker with enhanced features
   */
  async setupServiceWorker() {
    // Check if we're in a secure context
    if (!window.isSecureContext) {
      console.warn('⚠️ Service Worker requires secure context (HTTPS)');
      return;
    }

    try {
      // Register service worker with scope limiting for security
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none' // Always check for updates
      });

      console.log('✅ Service Worker registered:', registration.scope);

      // Set up update monitoring
      this.setupUpdateMonitoring(registration);

      // Set up security monitoring
      this.setupSecurityMonitoring();

      // Set up message handling
      this.setupServiceWorkerMessaging();

      // Check for waiting service worker
      if (registration.waiting) {
        this.showUpdateAvailableNotification();
      }

      // Listen for updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        console.log('🔄 Service Worker update found');
        
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            this.showUpdateAvailableNotification();
          }
        });
      });

    } catch (error) {
      console.error('❌ Service Worker registration failed:', error);
      this.reportSecurityIncident('sw_registration_failed', { error: error.message });
    }
  }

  /**
   * Setup update monitoring for the service worker
   */
  setupUpdateMonitoring(registration) {
    // Check for updates every hour
    setInterval(() => {
      registration.update().catch(error => {
        console.log('Service Worker update check failed:', error);
      });
    }, 60 * 60 * 1000);

    // Listen for controller changes
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('🔄 Service Worker controller changed - reloading page');
      window.location.reload();
    });
  }

  /**
   * Setup security monitoring for service worker events
   */
  setupSecurityMonitoring() {
    // Monitor for security policy violations
    document.addEventListener('securitypolicyviolation', (event) => {
      this.reportSecurityIncident('csp_violation', {
        directive: event.violatedDirective,
        blockedURI: event.blockedURI,
        documentURI: event.documentURI
      });
    });

    // Monitor for suspicious network activity
    if ('performance' in window && 'getEntriesByType' in performance) {
      setInterval(() => {
        this.checkNetworkSecurity();
      }, 30000); // Check every 30 seconds
    }
  }

  /**
   * Setup messaging with service worker
   */
  setupServiceWorkerMessaging() {
    navigator.serviceWorker.addEventListener('message', (event) => {
      const { data } = event;
      
      if (data && data.type) {
        switch (data.type) {
          case 'SW_UPDATE_AVAILABLE':
            this.handleUpdateAvailable(data);
            break;
          case 'SW_SYNC_COMPLETE':
            this.handleSyncComplete(data);
            break;
          case 'SW_CACHE_UPDATED':
            console.log('📦 Cache updated:', data.url);
            break;
          default:
            console.log('📨 Service Worker message:', data);
        }
      }
    });
  }

  /**
   * Handle service worker update availability
   */
  handleUpdateAvailable(data) {
    console.log('🆕 Service Worker update available:', data.version);
    
    // Show user notification
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Rover Mission Control Update', {
        body: `Version ${data.version} is available. Refresh to update.`,
        icon: '/assets/images/mission-badge.png',
        tag: 'sw-update'
      });
    }
    
    // Dispatch custom event for UI components
    window.dispatchEvent(new CustomEvent('sw-update-available', {
      detail: data
    }));
  }

  /**
   * Handle background sync completion
   */
  handleSyncComplete(data) {
    console.log('🔄 Background sync completed:', data.syncType);
    
    // Dispatch event for UI updates
    window.dispatchEvent(new CustomEvent('sw-sync-complete', {
      detail: data
    }));
  }

  /**
   * Show update available notification
   */
  showUpdateAvailableNotification() {
    // Create notification element or use existing UI framework
    console.log('🆕 Update available - please refresh');
    
    // Could integrate with your notification system here
    if (window.showNotification) {
      window.showNotification({
        type: 'info',
        title: 'Update Available',
        message: 'A new version is available. Please refresh to update.',
        actions: [{
          label: 'Refresh Now',
          handler: () => window.location.reload()
        }]
      });
    }
  }

  /**
   * Check network security patterns
   */
  checkNetworkSecurity() {
    try {
      const networkEntries = performance.getEntriesByType('navigation');
      const resourceEntries = performance.getEntriesByType('resource');
      
      // Check for suspicious patterns
      const allEntries = [...networkEntries, ...resourceEntries];
      
      allEntries.forEach(entry => {
        // Check for insecure origins
        if (entry.name && entry.name.startsWith('http://') && 
            !entry.name.includes('localhost') && 
            !entry.name.includes('127.0.0.1')) {
          this.reportSecurityIncident('insecure_resource', {
            url: entry.name,
            type: entry.initiatorType
          });
        }
        
        // Check for unusually long load times (potential security issues)
        if (entry.duration > 30000) { // 30 seconds
          console.warn('⚠️ Slow loading resource detected:', entry.name);
        }
      });
    } catch (error) {
      console.log('Network security check failed:', error);
    }
  }

  /**
   * Report security incidents to service worker
   */
  reportSecurityIncident(type, details) {
    console.error(`🚨 Security incident: ${type}`, details);
    
    // Send to service worker for logging
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'SECURITY_REPORT',
        details: {
          type,
          details,
          timestamp: Date.now(),
          userAgent: navigator.userAgent,
          url: window.location.href
        }
      });
    }
    
    // Could also send to analytics or monitoring service
  }

  /**
   * Force service worker update
   */
  async forceServiceWorkerUpdate() {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      await registration.update();
      
      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
    }
  }

  /**
   * Clear all service worker caches
   */
  async clearServiceWorkerCaches() {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      return new Promise((resolve) => {
        const messageChannel = new MessageChannel();
        messageChannel.port1.onmessage = (event) => {
          resolve(event.data.success);
        };
        
        navigator.serviceWorker.controller.postMessage(
          { type: 'CLEAR_CACHE' },
          [messageChannel.port2]
        );
      });
    }
  }

  /**
   * Get optimal image source based on browser support
   */
  getOptimalImageSrc(baseSrc, preferredFormats = ['avif', 'webp']) {
    const support = window.roverAssetSupport || {};
    const lastDot = baseSrc.lastIndexOf('.');
    const basePath = baseSrc.substring(0, lastDot);
    
    // Check for supported modern formats
    for (const format of preferredFormats) {
      if (support[format]) {
        return `${basePath}.${format}`;
      }
    }
    
    // Return original if no modern format is supported
    return baseSrc;
  }
}

// Create singleton instance
const assetLoader = new AssetLoader();

export default assetLoader;