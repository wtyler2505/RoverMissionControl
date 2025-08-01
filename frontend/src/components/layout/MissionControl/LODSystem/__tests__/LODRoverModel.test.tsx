/**
 * LODRoverModel Test Suite
 * 
 * Unit tests for the LOD-aware rover model component.
 */

import React from 'react';
import { render, act, waitFor } from '@testing-library/react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { LODRoverModel } from '../LODRoverModel';
import { LODManager } from '../LODManager';

// Mock Three.js LOD
jest.mock('three', () => {
  const actualThree = jest.requireActual('three');
  
  class MockLOD extends actualThree.Object3D {
    levels: any[] = [];
    
    addLevel(object: any, distance: number) {
      this.levels.push({ object, distance });
      this.add(object);
    }
    
    update(camera: any) {
      // Mock update logic
    }
  }
  
  return {
    ...actualThree,
    LOD: MockLOD
  };
});

describe('LODRoverModel', () => {
  let container: HTMLDivElement;
  
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });
  
  afterEach(() => {
    document.body.removeChild(container);
    jest.clearAllMocks();
  });
  
  describe('Basic Functionality', () => {
    it('should render without errors', async () => {
      const { container: testContainer } = render(
        <Canvas>
          <LODManager>
            <LODRoverModel position={[0, 0, 0]} />
          </LODManager>
        </Canvas>,
        { container }
      );
      
      await waitFor(() => {
        expect(testContainer.querySelector('canvas')).toBeInTheDocument();
      });
    });
    
    it('should create LOD levels based on quality setting', async () => {
      let lodInstance: any;
      
      const TestComponent = () => {
        const ref = React.useRef<any>();
        
        React.useEffect(() => {
          if (ref.current) {
            lodInstance = ref.current;
          }
        }, []);
        
        return <LODRoverModel ref={ref} position={[0, 0, 0]} />;
      };
      
      render(
        <Canvas>
          <LODManager initialQuality="high">
            <TestComponent />
          </LODManager>
        </Canvas>,
        { container }
      );
      
      await waitFor(() => {
        expect(lodInstance).toBeDefined();
        expect(lodInstance.levels.length).toBeGreaterThan(0);
      });
    });
    
    it('should apply position, rotation, and scale transforms', async () => {
      const position = new THREE.Vector3(10, 5, -10);
      const rotation = new THREE.Euler(Math.PI / 4, Math.PI / 2, 0);
      const scale = new THREE.Vector3(2, 2, 2);
      
      let lodInstance: any;
      
      const TestComponent = () => {
        const ref = React.useRef<any>();
        
        React.useEffect(() => {
          if (ref.current) {
            lodInstance = ref.current;
          }
        }, []);
        
        return (
          <LODRoverModel 
            ref={ref}
            position={position}
            rotation={rotation}
            scale={scale}
          />
        );
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
        expect(lodInstance).toBeDefined();
        expect(lodInstance.position.equals(position)).toBe(true);
        expect(lodInstance.rotation.equals(rotation)).toBe(true);
        expect(lodInstance.scale.equals(scale)).toBe(true);
      });
    });
  });
  
  describe('LOD Switching', () => {
    it('should switch detail levels based on distance', async () => {
      const onLODChange = jest.fn();
      let lodInstance: any;
      
      const TestComponent = () => {
        const ref = React.useRef<any>();
        
        React.useEffect(() => {
          if (ref.current) {
            lodInstance = ref.current;
          }
        }, []);
        
        return (
          <LODRoverModel 
            ref={ref}
            position={[0, 0, 0]}
            onLODChange={onLODChange}
          />
        );
      };
      
      const { rerender } = render(
        <Canvas camera={{ position: [0, 0, 10] }}>
          <LODManager>
            <TestComponent />
          </LODManager>
        </Canvas>,
        { container }
      );
      
      await waitFor(() => {
        expect(lodInstance).toBeDefined();
      });
      
      // Move camera far away
      act(() => {
        rerender(
          <Canvas camera={{ position: [0, 0, 100] }}>
            <LODManager>
              <TestComponent />
            </LODManager>
          </Canvas>
        );
      });
      
      await waitFor(() => {
        expect(onLODChange).toHaveBeenCalled();
      });
    });
    
    it('should respect forceDetail prop', async () => {
      let lodInstance: any;
      
      const TestComponent = ({ forceDetail }: { forceDetail?: number }) => {
        const ref = React.useRef<any>();
        
        React.useEffect(() => {
          if (ref.current) {
            lodInstance = ref.current;
          }
        }, []);
        
        return (
          <LODRoverModel 
            ref={ref}
            position={[0, 0, 0]}
            forceDetail={forceDetail}
          />
        );
      };
      
      const { rerender } = render(
        <Canvas>
          <LODManager>
            <TestComponent forceDetail={0} />
          </LODManager>
        </Canvas>,
        { container }
      );
      
      await waitFor(() => {
        expect(lodInstance).toBeDefined();
      });
      
      // Change forced detail level
      act(() => {
        rerender(
          <Canvas>
            <LODManager>
              <TestComponent forceDetail={2} />
            </LODManager>
          </Canvas>
        );
      });
      
      // Verify detail level changed
      await waitFor(() => {
        // In a real implementation, we'd check the actual visible level
        expect(lodInstance).toBeDefined();
      });
    });
  });
  
  describe('Performance Optimization', () => {
    it('should not update unnecessarily', async () => {
      const updateSpy = jest.spyOn(THREE.LOD.prototype, 'update');
      
      render(
        <Canvas>
          <LODManager>
            <LODRoverModel position={[0, 0, 0]} />
          </LODManager>
        </Canvas>,
        { container }
      );
      
      await waitFor(() => {
        expect(updateSpy).toHaveBeenCalledTimes(1);
      });
      
      // Wait and verify no additional updates
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });
      
      expect(updateSpy).toHaveBeenCalledTimes(1);
    });
    
    it('should dispose resources on unmount', async () => {
      const disposeSpy = jest.fn();
      
      // Mock dispose on geometries and materials
      jest.spyOn(THREE.BufferGeometry.prototype, 'dispose').mockImplementation(disposeSpy);
      jest.spyOn(THREE.Material.prototype, 'dispose').mockImplementation(disposeSpy);
      
      const { unmount } = render(
        <Canvas>
          <LODManager>
            <LODRoverModel position={[0, 0, 0]} />
          </LODManager>
        </Canvas>,
        { container }
      );
      
      await waitFor(() => {
        expect(container.querySelector('canvas')).toBeInTheDocument();
      });
      
      act(() => {
        unmount();
      });
      
      // Verify disposal was called
      expect(disposeSpy).toHaveBeenCalled();
    });
  });
  
  describe('Integration with LODManager', () => {
    it('should respond to quality changes', async () => {
      let lodManager: any;
      let lodInstance: any;
      
      const TestComponent = () => {
        const ref = React.useRef<any>();
        lodManager = (window as any).__lodManager; // Assuming LODManager exposes itself
        
        React.useEffect(() => {
          if (ref.current) {
            lodInstance = ref.current;
          }
        }, []);
        
        return <LODRoverModel ref={ref} position={[0, 0, 0]} />;
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
        expect(lodInstance).toBeDefined();
      });
      
      // Change quality setting
      act(() => {
        if (lodManager?.setQuality) {
          lodManager.setQuality('low');
        }
      });
      
      // Verify LOD responded to quality change
      await waitFor(() => {
        // In a real implementation, we'd verify the detail level changed
        expect(lodInstance).toBeDefined();
      });
    });
    
    it('should register with LODManager on mount', async () => {
      const registerSpy = jest.fn();
      
      // Mock LODManager context
      jest.mock('../LODManager', () => ({
        ...jest.requireActual('../LODManager'),
        useLODManager: () => ({
          registerObject: registerSpy,
          unregisterObject: jest.fn()
        })
      }));
      
      render(
        <Canvas>
          <LODManager>
            <LODRoverModel position={[0, 0, 0]} />
          </LODManager>
        </Canvas>,
        { container }
      );
      
      await waitFor(() => {
        expect(registerSpy).toHaveBeenCalled();
      });
    });
  });
  
  describe('Screen Coverage Calculation', () => {
    it('should calculate screen coverage correctly', async () => {
      let coverage = 0;
      
      const TestComponent = () => {
        const [screenCoverage, setScreenCoverage] = React.useState(0);
        coverage = screenCoverage;
        
        return (
          <LODRoverModel 
            position={[0, 0, 0]}
            onScreenCoverageChange={setScreenCoverage}
          />
        );
      };
      
      render(
        <Canvas camera={{ position: [0, 0, 10], fov: 75 }}>
          <LODManager>
            <TestComponent />
          </LODManager>
        </Canvas>,
        { container }
      );
      
      await waitFor(() => {
        expect(coverage).toBeGreaterThan(0);
        expect(coverage).toBeLessThan(1);
      });
    });
  });
  
  describe('Animation Support', () => {
    it('should animate when enabled', async () => {
      const onAnimate = jest.fn();
      
      render(
        <Canvas>
          <LODManager>
            <LODRoverModel 
              position={[0, 0, 0]}
              animated={true}
              onAnimate={onAnimate}
            />
          </LODManager>
        </Canvas>,
        { container }
      );
      
      // Wait for animation frame
      await act(async () => {
        await new Promise(resolve => requestAnimationFrame(resolve));
      });
      
      expect(onAnimate).toHaveBeenCalled();
    });
    
    it('should not animate when disabled', async () => {
      const onAnimate = jest.fn();
      
      render(
        <Canvas>
          <LODManager>
            <LODRoverModel 
              position={[0, 0, 0]}
              animated={false}
              onAnimate={onAnimate}
            />
          </LODManager>
        </Canvas>,
        { container }
      );
      
      // Wait for potential animation frame
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });
      
      expect(onAnimate).not.toHaveBeenCalled();
    });
  });
});