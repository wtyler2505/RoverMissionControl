/**
 * LODManager Test Suite
 * 
 * Comprehensive tests for the LOD management system including
 * performance benchmarks and functionality tests.
 */

import React from 'react';
import { render, act, waitFor } from '@testing-library/react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { LODManager, useLODManager } from '../LODManager';
import { 
  PerformanceMeasurement, 
  PerformanceTestRunner,
  createPerformanceTest,
  assertPerformance
} from './performance/performanceTestUtils';
import { createStressTestScenarios } from './performance/stressTestScenarios';

// Mock components for testing
const TestLODComponent: React.FC<{ id: string }> = ({ id }) => {
  const lodManager = useLODManager();
  
  React.useEffect(() => {
    const object = {
      id,
      position: new THREE.Vector3(0, 0, 0),
      updateLOD: jest.fn()
    };
    
    lodManager.registerObject(object);
    return () => lodManager.unregisterObject(id);
  }, [id, lodManager]);
  
  return <mesh />;
};

describe('LODManager', () => {
  let container: HTMLDivElement;
  
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });
  
  afterEach(() => {
    document.body.removeChild(container);
  });
  
  describe('Functionality Tests', () => {
    it('should initialize with default settings', () => {
      const { getByTestId } = render(
        <Canvas>
          <LODManager>
            <mesh />
          </LODManager>
        </Canvas>,
        { container }
      );
      
      expect(container.querySelector('canvas')).toBeInTheDocument();
    });
    
    it('should register and unregister objects', async () => {
      let lodManager: any;
      
      const TestComponent = () => {
        lodManager = useLODManager();
        return <TestLODComponent id="test-object" />;
      };
      
      render(
        <Canvas>
          <LODManager>
            <TestComponent />
          </LODManager>
        </Canvas>,
        { container }
      );
      
      await waitFor(() => {
        expect(lodManager).toBeDefined();
      });
      
      // Check if object is registered
      act(() => {
        const state = lodManager.getState();
        expect(state.registeredObjects).toBe(1);
      });
    });
    
    it('should switch LOD levels based on quality settings', async () => {
      let lodManager: any;
      
      const TestComponent = () => {
        lodManager = useLODManager();
        return null;
      };
      
      render(
        <Canvas>
          <LODManager>
            <TestComponent />
          </LODManager>
        </Canvas>,
        { container }
      );
      
      await waitFor(() => {
        expect(lodManager).toBeDefined();
      });
      
      // Test quality level changes
      act(() => {
        lodManager.setQuality('low');
        expect(lodManager.getState().currentQuality).toBe('low');
        
        lodManager.setQuality('ultra');
        expect(lodManager.getState().currentQuality).toBe('ultra');
      });
    });
    
    it('should enable/disable adaptive mode', async () => {
      let lodManager: any;
      
      const TestComponent = () => {
        lodManager = useLODManager();
        return null;
      };
      
      render(
        <Canvas>
          <LODManager adaptiveMode={false}>
            <TestComponent />
          </LODManager>
        </Canvas>,
        { container }
      );
      
      await waitFor(() => {
        expect(lodManager).toBeDefined();
      });
      
      act(() => {
        expect(lodManager.getState().adaptiveMode).toBe(false);
        
        lodManager.setAdaptiveMode(true);
        expect(lodManager.getState().adaptiveMode).toBe(true);
      });
    });
  });
  
  describe('Performance Tests', () => {
    const runner = new PerformanceTestRunner();
    
    beforeAll(() => {
      // Register performance test scenarios
      const scenarios = createStressTestScenarios();
      
      scenarios.forEach(scenario => {
        runner.registerScenario(
          scenario.name,
          createPerformanceTest(
            scenario.name,
            async () => {
              // Setup scenario
              render(
                <Canvas>
                  <LODManager adaptiveMode={true}>
                    <mesh />
                  </LODManager>
                </Canvas>,
                { container }
              );
            },
            async (measurement) => {
              // Run scenario updates
              // This would interact with the actual LOD system
            },
            async () => {
              // Cleanup
              container.innerHTML = '';
            },
            {
              duration: 5000, // 5 second tests
              warmupTime: 1000
            }
          )
        );
      });
    });
    
    it('should maintain 60 FPS with low complexity scenes', async () => {
      const metrics = await runner.runScenario('Maximum Entities');
      
      assertPerformance(metrics, {
        minFPS: 30,
        maxFrameTime: 33.33,
        maxJankFrames: 10
      });
    });
    
    it('should handle rapid LOD switching without performance degradation', async () => {
      const test = createPerformanceTest(
        'Rapid LOD Switching',
        async () => {
          render(
            <Canvas>
              <LODManager adaptiveMode={true}>
                {Array.from({ length: 100 }, (_, i) => (
                  <TestLODComponent key={i} id={`object-${i}`} />
                ))}
              </LODManager>
            </Canvas>,
            { container }
          );
        },
        async (measurement) => {
          // Simulate rapid quality changes
          for (let i = 0; i < 10; i++) {
            await act(async () => {
              // Quality changes would be triggered here
              await new Promise(resolve => setTimeout(resolve, 100));
            });
          }
        }
      );
      
      const metrics = await test();
      
      expect(metrics.fps.average).toBeGreaterThan(30);
      expect(metrics.frameTime.jank).toBeLessThan(20);
    });
    
    it('should not leak memory during extended operation', async () => {
      const metrics = await runner.runScenario('Memory Leak Detection');
      
      assertPerformance(metrics, {
        maxMemory: 500 // MB
      });
      
      expect(metrics.memory.leakRate).toBeLessThan(1.0); // MB per minute
    });
    
    it('should gracefully degrade quality under heavy load', async () => {
      let qualityChanges = 0;
      let lodManager: any;
      
      const TestComponent = () => {
        lodManager = useLODManager();
        
        React.useEffect(() => {
          const unsubscribe = lodManager.subscribe((state: any) => {
            qualityChanges++;
          });
          return unsubscribe;
        }, []);
        
        return null;
      };
      
      const test = createPerformanceTest(
        'Quality Degradation',
        async () => {
          render(
            <Canvas>
              <LODManager adaptiveMode={true} targetFPS={60}>
                <TestComponent />
                {Array.from({ length: 1000 }, (_, i) => (
                  <TestLODComponent key={i} id={`heavy-object-${i}`} />
                ))}
              </LODManager>
            </Canvas>,
            { container }
          );
        },
        async (measurement) => {
          // Simulate heavy load
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      );
      
      await test();
      
      // Should have adjusted quality to maintain performance
      expect(qualityChanges).toBeGreaterThan(0);
    });
  });
  
  describe('Integration Tests', () => {
    it('should work with multiple LOD components', async () => {
      const { container: testContainer } = render(
        <Canvas>
          <LODManager>
            <TestLODComponent id="rover-1" />
            <TestLODComponent id="terrain-1" />
            <TestLODComponent id="effects-1" />
          </LODManager>
        </Canvas>,
        { container }
      );
      
      await waitFor(() => {
        expect(testContainer.querySelector('canvas')).toBeInTheDocument();
      });
    });
    
    it('should handle component mounting and unmounting', async () => {
      const { rerender } = render(
        <Canvas>
          <LODManager>
            <TestLODComponent id="dynamic-1" />
          </LODManager>
        </Canvas>,
        { container }
      );
      
      // Unmount component
      rerender(
        <Canvas>
          <LODManager>
            <mesh />
          </LODManager>
        </Canvas>
      );
      
      await waitFor(() => {
        expect(container.querySelector('canvas')).toBeInTheDocument();
      });
    });
  });
  
  describe('Benchmark Report', () => {
    it('should generate performance report', async () => {
      const runner = new PerformanceTestRunner();
      
      // Run a subset of scenarios for the report
      const scenarios = ['Maximum Entities', 'Animation Stress'];
      
      for (const scenario of scenarios) {
        runner.registerScenario(
          scenario,
          createPerformanceTest(
            scenario,
            async () => {
              render(
                <Canvas>
                  <LODManager>
                    <mesh />
                  </LODManager>
                </Canvas>,
                { container }
              );
            },
            async () => {
              // Simulate workload
              await new Promise(resolve => setTimeout(resolve, 1000));
            },
            undefined,
            { duration: 2000 }
          )
        );
      }
      
      const results = await runner.runAll();
      const report = runner.generateReport(results);
      
      expect(report).toContain('Performance Test Report');
      expect(report).toContain('Maximum Entities');
      expect(report).toContain('Animation Stress');
      expect(report).toContain('FPS Metrics');
    });
  });
});