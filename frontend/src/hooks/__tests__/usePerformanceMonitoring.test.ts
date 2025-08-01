import { renderHook, act, waitFor } from '@testing-library/react';
import { usePerformanceMonitoring } from '../usePerformanceMonitoring';

// Mock the performance API
const mockPerformanceEntries = [
  {
    name: 'measure-1',
    entryType: 'measure',
    startTime: 100,
    duration: 50
  },
  {
    name: 'navigation',
    entryType: 'navigation',
    startTime: 0,
    duration: 1000,
    loadEventEnd: 1000,
    domContentLoadedEventEnd: 800
  }
];

// Mock performance API
Object.defineProperty(window, 'performance', {
  writable: true,
  value: {
    mark: jest.fn(),
    measure: jest.fn(),
    clearMarks: jest.fn(),
    clearMeasures: jest.fn(),
    getEntriesByType: jest.fn(() => mockPerformanceEntries),
    getEntriesByName: jest.fn(() => [mockPerformanceEntries[0]]),
    now: jest.fn(() => 1000),
    observer: {
      observe: jest.fn(),
      disconnect: jest.fn()
    }
  }
});

// Mock PerformanceObserver
global.PerformanceObserver = class MockPerformanceObserver {
  callback: PerformanceObserverCallback;
  
  constructor(callback: PerformanceObserverCallback) {
    this.callback = callback;
  }
  
  observe = jest.fn();
  disconnect = jest.fn();
  takeRecords = jest.fn(() => []);
} as any;

describe('usePerformanceMonitoring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Functionality', () => {
    it('initializes with default values', () => {
      const { result } = renderHook(() => usePerformanceMonitoring());

      expect(result.current.isMonitoring).toBe(false);
      expect(result.current.metrics).toEqual({});
      expect(result.current.marks).toEqual([]);
      expect(result.current.measures).toEqual([]);
    });

    it('starts monitoring when startMonitoring is called', () => {
      const { result } = renderHook(() => usePerformanceMonitoring());

      act(() => {
        result.current.startMonitoring();
      });

      expect(result.current.isMonitoring).toBe(true);
    });

    it('stops monitoring when stopMonitoring is called', () => {
      const { result } = renderHook(() => usePerformanceMonitoring());

      act(() => {
        result.current.startMonitoring();
      });

      expect(result.current.isMonitoring).toBe(true);

      act(() => {
        result.current.stopMonitoring();
      });

      expect(result.current.isMonitoring).toBe(false);
    });
  });

  describe('Performance Marking', () => {
    it('creates performance marks', () => {
      const { result } = renderHook(() => usePerformanceMonitoring());

      act(() => {
        result.current.mark('test-mark');
      });

      expect(window.performance.mark).toHaveBeenCalledWith('test-mark');
    });

    it('creates performance measures between marks', () => {
      const { result } = renderHook(() => usePerformanceMonitoring());

      act(() => {
        result.current.measure('test-measure', 'start-mark', 'end-mark');
      });

      expect(window.performance.measure).toHaveBeenCalledWith(
        'test-measure',
        'start-mark',
        'end-mark'
      );
    });

    it('handles measure creation without end mark', () => {
      const { result } = renderHook(() => usePerformanceMonitoring());

      act(() => {
        result.current.measure('test-measure', 'start-mark');
      });

      expect(window.performance.measure).toHaveBeenCalledWith(
        'test-measure',
        'start-mark',
        undefined
      );
    });
  });

  describe('Metrics Collection', () => {
    it('collects performance metrics', async () => {
      const { result } = renderHook(() => usePerformanceMonitoring());

      act(() => {
        result.current.startMonitoring();
      });

      await waitFor(() => {
        expect(result.current.metrics).toBeDefined();
      });

      // Should collect navigation timing metrics
      expect(result.current.metrics.navigation).toBeDefined();
    });

    it('collects custom marks and measures', () => {
      const { result } = renderHook(() => usePerformanceMonitoring());

      act(() => {
        result.current.startMonitoring();
        result.current.collectMetrics();
      });

      expect(result.current.marks).toBeDefined();
      expect(result.current.measures).toBeDefined();
    });

    it('calculates performance statistics', () => {
      const { result } = renderHook(() => usePerformanceMonitoring());

      act(() => {
        result.current.startMonitoring();
        result.current.collectMetrics();
      });

      const stats = result.current.getStats();

      expect(stats).toMatchObject({
        totalMarks: expect.any(Number),
        totalMeasures: expect.any(Number),
        averageMeasureDuration: expect.any(Number)
      });
    });
  });

  describe('Performance Observer Integration', () => {
    it('sets up PerformanceObserver when monitoring starts', () => {
      const { result } = renderHook(() => usePerformanceMonitoring({
        observeTypes: ['measure', 'navigation']
      }));

      act(() => {
        result.current.startMonitoring();
      });

      expect(global.PerformanceObserver).toHaveBeenCalled();
    });

    it('observes specified entry types', () => {
      const observerInstance = {
        observe: jest.fn(),
        disconnect: jest.fn()
      };

      (global.PerformanceObserver as jest.Mock).mockImplementation(() => observerInstance);

      const { result } = renderHook(() => usePerformanceMonitoring({
        observeTypes: ['measure', 'navigation', 'resource']
      }));

      act(() => {
        result.current.startMonitoring();
      });

      expect(observerInstance.observe).toHaveBeenCalledWith({
        entryTypes: ['measure', 'navigation', 'resource']
      });
    });

    it('handles PerformanceObserver entries', () => {
      let observerCallback: PerformanceObserverCallback;

      (global.PerformanceObserver as jest.Mock).mockImplementation((callback) => {
        observerCallback = callback;
        return {
          observe: jest.fn(),
          disconnect: jest.fn()
        };
      });

      const { result } = renderHook(() => usePerformanceMonitoring());

      act(() => {
        result.current.startMonitoring();
      });

      // Simulate PerformanceObserver callback
      const mockEntries = [
        {
          name: 'new-measure',
          entryType: 'measure',
          startTime: 200,
          duration: 75
        }
      ];

      const mockList = {
        getEntries: () => mockEntries,
        getEntriesByName: () => mockEntries,
        getEntriesByType: () => mockEntries
      };

      act(() => {
        if (observerCallback) {
          observerCallback(mockList as any, {} as any);
        }
      });

      // Should update measures with new entries
      expect(result.current.measures).toContain(
        expect.objectContaining({ name: 'new-measure' })
      );
    });
  });

  describe('Component Lifecycle Monitoring', () => {
    it('tracks component render times', () => {
      const { result } = renderHook(() => usePerformanceMonitoring());

      act(() => {
        result.current.trackRender('TestComponent', 'start');
      });

      act(() => {
        result.current.trackRender('TestComponent', 'end');
      });

      expect(window.performance.mark).toHaveBeenCalledWith('TestComponent-render-start');
      expect(window.performance.mark).toHaveBeenCalledWith('TestComponent-render-end');
      expect(window.performance.measure).toHaveBeenCalledWith(
        'TestComponent-render',
        'TestComponent-render-start',
        'TestComponent-render-end'
      );
    });

    it('tracks effect execution times', () => {
      const { result } = renderHook(() => usePerformanceMonitoring());

      act(() => {
        result.current.trackEffect('useDataFetch', 'start');
      });

      act(() => {
        result.current.trackEffect('useDataFetch', 'end');
      });

      expect(window.performance.mark).toHaveBeenCalledWith('useDataFetch-effect-start');
      expect(window.performance.mark).toHaveBeenCalledWith('useDataFetch-effect-end');
    });

    it('provides helper for timing async operations', async () => {
      const { result } = renderHook(() => usePerformanceMonitoring());

      const asyncOperation = jest.fn().mockResolvedValue('success');

      await act(async () => {
        const resultValue = await result.current.timeAsync('async-op', asyncOperation);
        expect(resultValue).toBe('success');
      });

      expect(window.performance.mark).toHaveBeenCalledWith('async-op-start');
      expect(window.performance.mark).toHaveBeenCalledWith('async-op-end');
      expect(window.performance.measure).toHaveBeenCalledWith(
        'async-op',
        'async-op-start',
        'async-op-end'
      );
    });
  });

  describe('Resource Monitoring', () => {
    it('tracks resource loading performance', () => {
      const { result } = renderHook(() => usePerformanceMonitoring({
        observeTypes: ['resource']
      }));

      act(() => {
        result.current.startMonitoring();
      });

      const resourceMetrics = result.current.getResourceMetrics();

      expect(resourceMetrics).toBeDefined();
      expect(typeof resourceMetrics.totalResources).toBe('number');
    });

    it('categorizes resource types', () => {
      // Mock resource entries
      const mockResourceEntries = [
        { name: 'style.css', initiatorType: 'link' },
        { name: 'script.js', initiatorType: 'script' },
        { name: 'image.png', initiatorType: 'img' }
      ];

      window.performance.getEntriesByType = jest.fn((type) => 
        type === 'resource' ? mockResourceEntries : []
      );

      const { result } = renderHook(() => usePerformanceMonitoring());

      act(() => {
        result.current.startMonitoring();
      });

      const resourceMetrics = result.current.getResourceMetrics();

      expect(resourceMetrics.byType).toMatchObject({
        css: expect.any(Number),
        script: expect.any(Number),
        image: expect.any(Number)
      });
    });
  });

  describe('Memory Monitoring', () => {
    it('tracks memory usage when available', () => {
      // Mock memory info
      Object.defineProperty(window.performance, 'memory', {
        value: {
          totalJSHeapSize: 50000000,
          usedJSHeapSize: 30000000,
          jsHeapSizeLimit: 100000000
        },
        configurable: true
      });

      const { result } = renderHook(() => usePerformanceMonitoring());

      act(() => {
        result.current.startMonitoring();
      });

      const memoryMetrics = result.current.getMemoryMetrics();

      expect(memoryMetrics).toMatchObject({
        totalJSHeapSize: 50000000,
        usedJSHeapSize: 30000000,
        jsHeapSizeLimit: 100000000,
        memoryUsagePercentage: expect.any(Number)
      });
    });

    it('handles missing memory API gracefully', () => {
      Object.defineProperty(window.performance, 'memory', {
        value: undefined,
        configurable: true
      });

      const { result } = renderHook(() => usePerformanceMonitoring());

      act(() => {
        result.current.startMonitoring();
      });

      const memoryMetrics = result.current.getMemoryMetrics();

      expect(memoryMetrics).toEqual({
        available: false,
        message: 'Memory API not available'
      });
    });
  });

  describe('Configuration Options', () => {
    it('respects custom buffer size', () => {
      const { result } = renderHook(() => usePerformanceMonitoring({
        bufferSize: 100
      }));

      // Add many entries
      for (let i = 0; i < 150; i++) {
        act(() => {
          result.current.mark(`mark-${i}`);
        });
      }

      // Should respect buffer size limit
      expect(result.current.marks.length).toBeLessThanOrEqual(100);
    });

    it('supports custom sampling rate', () => {
      const { result } = renderHook(() => usePerformanceMonitoring({
        sampleRate: 0.5 // 50% sampling
      }));

      const originalRandom = Math.random;
      Math.random = jest.fn(() => 0.3); // Below threshold

      act(() => {
        result.current.startMonitoring();
      });

      expect(result.current.isMonitoring).toBe(true);

      Math.random = jest.fn(() => 0.7); // Above threshold

      const { result: result2 } = renderHook(() => usePerformanceMonitoring({
        sampleRate: 0.5
      }));

      act(() => {
        result2.current.startMonitoring();
      });

      Math.random = originalRandom;
    });
  });

  describe('Cleanup', () => {
    it('cleans up PerformanceObserver on unmount', () => {
      const observerInstance = {
        observe: jest.fn(),
        disconnect: jest.fn()
      };

      (global.PerformanceObserver as jest.Mock).mockImplementation(() => observerInstance);

      const { result, unmount } = renderHook(() => usePerformanceMonitoring());

      act(() => {
        result.current.startMonitoring();
      });

      unmount();

      expect(observerInstance.disconnect).toHaveBeenCalled();
    });

    it('clears performance marks and measures on cleanup', () => {
      const { result } = renderHook(() => usePerformanceMonitoring());

      act(() => {
        result.current.startMonitoring();
        result.current.clearAll();
      });

      expect(window.performance.clearMarks).toHaveBeenCalled();
      expect(window.performance.clearMeasures).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('handles PerformanceObserver errors gracefully', () => {
      (global.PerformanceObserver as jest.Mock).mockImplementation(() => {
        throw new Error('PerformanceObserver not supported');
      });

      const { result } = renderHook(() => usePerformanceMonitoring());

      expect(() => {
        act(() => {
          result.current.startMonitoring();
        });
      }).not.toThrow();

      expect(result.current.isMonitoring).toBe(false);
    });

    it('handles performance API errors', () => {
      window.performance.mark = jest.fn(() => {
        throw new Error('Mark failed');
      });

      const { result } = renderHook(() => usePerformanceMonitoring());

      expect(() => {
        act(() => {
          result.current.mark('test-mark');
        });
      }).not.toThrow();
    });
  });
});