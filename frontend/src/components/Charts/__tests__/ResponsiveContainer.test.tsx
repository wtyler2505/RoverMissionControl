/**
 * ResponsiveContainer Component Tests
 * Tests for responsive chart container functionality
 */

import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { jest } from '@jest/globals';
import { ResponsiveContainer } from '../base/ResponsiveContainer';
import { ChartDimensions } from '../types';

// Mock ResizeObserver
class MockResizeObserver {
  callback: ResizeObserverCallback;
  entries: ResizeObserverEntry[] = [];
  
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }
  
  observe = jest.fn((target: Element) => {
    // Simulate initial size
    const mockEntry: ResizeObserverEntry = {
      target,
      contentRect: {
        width: 800,
        height: 400,
        top: 0,
        left: 0,
        bottom: 400,
        right: 800,
        x: 0,
        y: 0,
        toJSON: () => ({})
      },
      borderBoxSize: [] as any,
      contentBoxSize: [] as any,
      devicePixelContentBoxSize: [] as any
    };
    
    this.entries = [mockEntry];
    setTimeout(() => this.callback(this.entries, this), 0);
  });
  
  unobserve = jest.fn();
  disconnect = jest.fn();
  
  // Helper method to simulate resize
  simulateResize(width: number, height: number) {
    if (this.entries.length > 0) {
      const entry = this.entries[0];
      (entry.contentRect as any).width = width;
      (entry.contentRect as any).height = height;
      (entry.contentRect as any).right = width;
      (entry.contentRect as any).bottom = height;
      
      act(() => {
        this.callback(this.entries, this);
      });
    }
  }
}

let mockResizeObserver: MockResizeObserver;

global.ResizeObserver = jest.fn().mockImplementation((callback) => {
  mockResizeObserver = new MockResizeObserver(callback);
  return mockResizeObserver;
});

describe('ResponsiveContainer Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders children with initial dimensions', async () => {
      const childrenFn = jest.fn().mockReturnValue(<div data-testid="chart-content">Chart</div>);
      
      render(
        <ResponsiveContainer>
          {childrenFn}
        </ResponsiveContainer>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('chart-content')).toBeInTheDocument();
        expect(childrenFn).toHaveBeenCalledWith(
          expect.objectContaining({
            width: expect.any(Number),
            height: expect.any(Number),
            margin: expect.objectContaining({
              top: expect.any(Number),
              right: expect.any(Number),
              bottom: expect.any(Number),
              left: expect.any(Number)
            })
          })
        );
      });
    });

    it('applies custom className', () => {
      const customClass = 'custom-responsive-container';
      
      render(
        <ResponsiveContainer className={customClass}>
          {() => <div data-testid="chart-content">Chart</div>}
        </ResponsiveContainer>
      );
      
      const container = screen.getByTestId('chart-content').parentElement;
      expect(container).toHaveClass(customClass);
    });
  });

  describe('Aspect Ratio', () => {
    it('maintains aspect ratio when specified', async () => {
      const aspectRatio = 2; // width:height = 2:1
      const childrenFn = jest.fn().mockReturnValue(<div data-testid="chart-content">Chart</div>);
      
      render(
        <ResponsiveContainer aspectRatio={aspectRatio}>
          {childrenFn}
        </ResponsiveContainer>
      );
      
      await waitFor(() => {
        expect(childrenFn).toHaveBeenCalled();
        const dimensions = childrenFn.mock.calls[0][0] as ChartDimensions;
        const actualRatio = dimensions.width / dimensions.height;
        expect(Math.abs(actualRatio - aspectRatio)).toBeLessThan(0.1); // Allow small tolerance
      });
    });

    it('calculates height from width when aspect ratio is set', async () => {
      const aspectRatio = 1.5;
      const expectedWidth = 600;
      
      // Mock container width
      const mockObserver = global.ResizeObserver as jest.MockedClass<typeof ResizeObserver>;
      mockObserver.mockImplementation((callback) => {
        const observer = new MockResizeObserver(callback);
        // Override observe to provide custom width
        observer.observe = jest.fn((target) => {
          const mockEntry: ResizeObserverEntry = {
            target,
            contentRect: {
              width: expectedWidth,
              height: 300, // This should be ignored due to aspect ratio
              top: 0,
              left: 0,
              bottom: 300,
              right: expectedWidth,
              x: 0,
              y: 0,
              toJSON: () => ({})
            },
            borderBoxSize: [] as any,
            contentBoxSize: [] as any,
            devicePixelContentBoxSize: [] as any
          };
          
          setTimeout(() => callback([mockEntry], observer), 0);
        });
        return observer;
      });
      
      const childrenFn = jest.fn().mockReturnValue(<div data-testid="chart-content">Chart</div>);
      
      render(
        <ResponsiveContainer aspectRatio={aspectRatio}>
          {childrenFn}
        </ResponsiveContainer>
      );
      
      await waitFor(() => {
        expect(childrenFn).toHaveBeenCalled();
        const dimensions = childrenFn.mock.calls[0][0] as ChartDimensions;
        expect(dimensions.width).toBe(expectedWidth);
        expect(dimensions.height).toBe(expectedWidth / aspectRatio);
      });
    });
  });

  describe('Height Constraints', () => {
    it('respects minimum height constraint', async () => {
      const minHeight = 200;
      const childrenFn = jest.fn().mockReturnValue(<div data-testid="chart-content">Chart</div>);
      
      render(
        <ResponsiveContainer minHeight={minHeight}>
          {childrenFn}
        </ResponsiveContainer>
      );
      
      await waitFor(() => {
        expect(childrenFn).toHaveBeenCalled();
        const dimensions = childrenFn.mock.calls[0][0] as ChartDimensions;
        expect(dimensions.height).toBeGreaterThanOrEqual(minHeight);
      });
    });

    it('respects maximum height constraint', async () => {
      const maxHeight = 300;
      
      // Mock a very tall container
      const mockObserver = global.ResizeObserver as jest.MockedClass<typeof ResizeObserver>;
      mockObserver.mockImplementation((callback) => {
        const observer = new MockResizeObserver(callback);
        observer.observe = jest.fn((target) => {
          const mockEntry: ResizeObserverEntry = {
            target,
            contentRect: {
              width: 800,
              height: 1000, // Very tall
              top: 0,
              left: 0,
              bottom: 1000,
              right: 800,
              x: 0,
              y: 0,
              toJSON: () => ({})
            },
            borderBoxSize: [] as any,
            contentBoxSize: [] as any,
            devicePixelContentBoxSize: [] as any
          };
          
          setTimeout(() => callback([mockEntry], observer), 0);
        });
        return observer;
      });
      
      const childrenFn = jest.fn().mockReturnValue(<div data-testid="chart-content">Chart</div>);
      
      render(
        <ResponsiveContainer maxHeight={maxHeight}>
          {childrenFn}
        </ResponsiveContainer>
      );
      
      await waitFor(() => {
        expect(childrenFn).toHaveBeenCalled();
        const dimensions = childrenFn.mock.calls[0][0] as ChartDimensions;
        expect(dimensions.height).toBeLessThanOrEqual(maxHeight);
      });
    });
  });

  describe('Resize Behavior', () => {
    it('updates dimensions on container resize', async () => {
      const childrenFn = jest.fn().mockReturnValue(<div data-testid="chart-content">Chart</div>);
      
      render(
        <ResponsiveContainer>
          {childrenFn}
        </ResponsiveContainer>
      );
      
      // Wait for initial render
      await waitFor(() => {
        expect(childrenFn).toHaveBeenCalled();
      });
      
      const initialCallCount = childrenFn.mock.calls.length;
      
      // Simulate resize
      act(() => {
        mockResizeObserver.simulateResize(1200, 600);
      });
      
      await waitFor(() => {
        expect(childrenFn.mock.calls.length).toBeGreaterThan(initialCallCount);
        const latestDimensions = childrenFn.mock.calls[childrenFn.mock.calls.length - 1][0] as ChartDimensions;
        expect(latestDimensions.width).toBe(1200);
        expect(latestDimensions.height).toBe(600);
      });
    });

    it('debounces rapid resize events', async () => {
      const debounceTime = 100;
      const childrenFn = jest.fn().mockReturnValue(<div data-testid="chart-content">Chart</div>);
      
      render(
        <ResponsiveContainer debounceTime={debounceTime}>
          {childrenFn}
        </ResponsiveContainer>
      );
      
      // Wait for initial render
      await waitFor(() => {
        expect(childrenFn).toHaveBeenCalled();
      });
      
      const initialCallCount = childrenFn.mock.calls.length;
      
      // Simulate rapid resize events
      act(() => {
        mockResizeObserver.simulateResize(1000, 500);
        mockResizeObserver.simulateResize(1100, 550);
        mockResizeObserver.simulateResize(1200, 600);
      });
      
      // Should not update immediately due to debouncing
      expect(childrenFn.mock.calls.length).toBe(initialCallCount);
      
      // Wait for debounce period
      await new Promise(resolve => setTimeout(resolve, debounceTime + 50));
      
      await waitFor(() => {
        expect(childrenFn.mock.calls.length).toBeGreaterThan(initialCallCount);
        const latestDimensions = childrenFn.mock.calls[childrenFn.mock.calls.length - 1][0] as ChartDimensions;
        expect(latestDimensions.width).toBe(1200);
        expect(latestDimensions.height).toBe(600);
      });
    });
  });

  describe('Error Handling', () => {
    it('handles ResizeObserver errors gracefully', async () => {
      // Mock ResizeObserver to throw an error
      const errorObserver = {
        observe: jest.fn(() => { throw new Error('ResizeObserver error'); }),
        unobserve: jest.fn(),
        disconnect: jest.fn()
      };
      
      (global.ResizeObserver as jest.Mock).mockImplementation(() => errorObserver);
      
      const childrenFn = jest.fn().mockReturnValue(<div data-testid="chart-content">Chart</div>);
      
      expect(() => {
        render(
          <ResponsiveContainer>
            {childrenFn}
          </ResponsiveContainer>
        );
      }).not.toThrow();
      
      // Should still render with default dimensions
      await waitFor(() => {
        expect(screen.getByTestId('chart-content')).toBeInTheDocument();
      });
    });

    it('handles missing ResizeObserver', async () => {
      // Temporarily remove ResizeObserver
      const originalResizeObserver = global.ResizeObserver;
      (global as any).ResizeObserver = undefined;
      
      const childrenFn = jest.fn().mockReturnValue(<div data-testid="chart-content">Chart</div>);
      
      expect(() => {
        render(
          <ResponsiveContainer>
            {childrenFn}
          </ResponsiveContainer>
        );
      }).not.toThrow();
      
      // Should still render with default dimensions
      await waitFor(() => {
        expect(screen.getByTestId('chart-content')).toBeInTheDocument();
      });
      
      // Restore ResizeObserver
      global.ResizeObserver = originalResizeObserver;
    });
  });

  describe('Performance', () => {
    it('efficiently handles multiple resize events', async () => {
      const childrenFn = jest.fn().mockReturnValue(<div data-testid="chart-content">Chart</div>);
      
      render(
        <ResponsiveContainer debounceTime={50}>
          {childrenFn}
        </ResponsiveContainer>
      );
      
      // Wait for initial render
      await waitFor(() => {
        expect(childrenFn).toHaveBeenCalled();
      });
      
      const startTime = performance.now();
      const initialCallCount = childrenFn.mock.calls.length;
      
      // Simulate many rapid resize events
      for (let i = 0; i < 100; i++) {
        act(() => {
          mockResizeObserver.simulateResize(800 + i, 400 + i);
        });
      }
      
      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const endTime = performance.now();
      
      // Should handle efficiently (less than 100ms for processing)
      expect(endTime - startTime).toBeLessThan(100);
      
      // Should not call children function for every resize due to debouncing
      await waitFor(() => {
        expect(childrenFn.mock.calls.length - initialCallCount).toBeLessThan(10);
      });
    });
  });

  describe('Memory Management', () => {
    it('cleans up ResizeObserver on unmount', () => {
      const { unmount } = render(
        <ResponsiveContainer>
          {() => <div data-testid="chart-content">Chart</div>}
        </ResponsiveContainer>
      );
      
      expect(mockResizeObserver.observe).toHaveBeenCalled();
      
      unmount();
      
      expect(mockResizeObserver.disconnect).toHaveBeenCalled();
    });

    it('cleans up debounce timers on unmount', async () => {
      const { unmount } = render(
        <ResponsiveContainer debounceTime={200}>
          {() => <div data-testid="chart-content">Chart</div>}
        </ResponsiveContainer>
      );
      
      // Trigger resize to start debounce timer
      act(() => {
        mockResizeObserver.simulateResize(1000, 500);
      });
      
      // Unmount before debounce completes
      unmount();
      
      // Wait longer than debounce time
      await new Promise(resolve => setTimeout(resolve, 250));
      
      // No errors should occur from cleanup
      expect(true).toBe(true); // Test passes if no errors thrown
    });
  });

  describe('Default Dimensions', () => {
    it('provides sensible default dimensions when container size is unknown', async () => {
      // Mock zero-size container
      const mockObserver = global.ResizeObserver as jest.MockedClass<typeof ResizeObserver>;
      mockObserver.mockImplementation((callback) => {
        const observer = new MockResizeObserver(callback);
        observer.observe = jest.fn((target) => {
          const mockEntry: ResizeObserverEntry = {
            target,
            contentRect: {
              width: 0,
              height: 0,
              top: 0,
              left: 0,
              bottom: 0,
              right: 0,
              x: 0,
              y: 0,
              toJSON: () => ({})
            },
            borderBoxSize: [] as any,
            contentBoxSize: [] as any,
            devicePixelContentBoxSize: [] as any
          };
          
          setTimeout(() => callback([mockEntry], observer), 0);
        });
        return observer;
      });
      
      const childrenFn = jest.fn().mockReturnValue(<div data-testid="chart-content">Chart</div>);
      
      render(
        <ResponsiveContainer>
          {childrenFn}
        </ResponsiveContainer>
      );
      
      await waitFor(() => {
        expect(childrenFn).toHaveBeenCalled();
        const dimensions = childrenFn.mock.calls[0][0] as ChartDimensions;
        expect(dimensions.width).toBeGreaterThan(0);
        expect(dimensions.height).toBeGreaterThan(0);
        expect(dimensions.margin).toBeDefined();
      });
    });
  });

  describe('Edge Cases', () => {
    it('handles extremely small container sizes', async () => {
      const mockObserver = global.ResizeObserver as jest.MockedClass<typeof ResizeObserver>;
      mockObserver.mockImplementation((callback) => {
        const observer = new MockResizeObserver(callback);
        observer.observe = jest.fn((target) => {
          const mockEntry: ResizeObserverEntry = {
            target,
            contentRect: {
              width: 1,
              height: 1,
              top: 0,
              left: 0,
              bottom: 1,
              right: 1,
              x: 0,
              y: 0,
              toJSON: () => ({})
            },
            borderBoxSize: [] as any,
            contentBoxSize: [] as any,
            devicePixelContentBoxSize: [] as any
          };
          
          setTimeout(() => callback([mockEntry], observer), 0);
        });
        return observer;
      });
      
      const childrenFn = jest.fn().mockReturnValue(<div data-testid="chart-content">Chart</div>);
      
      render(
        <ResponsiveContainer>
          {childrenFn}
        </ResponsiveContainer>
      );
      
      await waitFor(() => {
        expect(childrenFn).toHaveBeenCalled();
        const dimensions = childrenFn.mock.calls[0][0] as ChartDimensions;
        expect(dimensions.width).toBeGreaterThan(0);
        expect(dimensions.height).toBeGreaterThan(0);
      });
    });

    it('handles extremely large container sizes', async () => {
      const mockObserver = global.ResizeObserver as jest.MockedClass<typeof ResizeObserver>;
      mockObserver.mockImplementation((callback) => {
        const observer = new MockResizeObserver(callback);
        observer.observe = jest.fn((target) => {
          const mockEntry: ResizeObserverEntry = {
            target,
            contentRect: {
              width: 10000,
              height: 10000,
              top: 0,
              left: 0,
              bottom: 10000,
              right: 10000,
              x: 0,
              y: 0,
              toJSON: () => ({})
            },
            borderBoxSize: [] as any,
            contentBoxSize: [] as any,
            devicePixelContentBoxSize: [] as any
          };
          
          setTimeout(() => callback([mockEntry], observer), 0);
        });
        return observer;
      });
      
      const childrenFn = jest.fn().mockReturnValue(<div data-testid="chart-content">Chart</div>);
      
      render(
        <ResponsiveContainer>
          {childrenFn}
        </ResponsiveContainer>
      );
      
      await waitFor(() => {
        expect(childrenFn).toHaveBeenCalled();
        const dimensions = childrenFn.mock.calls[0][0] as ChartDimensions;
        expect(dimensions.width).toBe(10000);
        expect(dimensions.height).toBe(10000);
      });
    });
  });
});
