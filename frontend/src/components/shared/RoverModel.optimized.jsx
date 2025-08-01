import React, { useRef, useEffect, useMemo, useCallback } from 'react';
import { Box, Text } from '@react-three/drei';

/**
 * Optimized 3D Rover Model with comprehensive memoization
 * Performance optimizations:
 * - Memoized geometry and materials to prevent recreation
 * - Efficient wheel animation using RAF batching
 * - Fault indication optimization
 * - Selective re-rendering based on props changes
 */
const RoverModelOptimized = React.memo(({ position, rotation, wheelSpeeds }) => {
  const wheelsRef = useRef([]);
  const animationFrameRef = useRef(null);
  
  // Memoize wheel positions to prevent recalculation
  const wheelPositions = useMemo(() => [
    [-0.8, -0.2, 0.4, 'fl'],  // Front Left
    [0.8, -0.2, 0.4, 'fr'],   // Front Right
    [-0.8, -0.2, -0.4, 'rl'], // Rear Left
    [0.8, -0.2, -0.4, 'rr']   // Rear Right
  ], []);
  
  // Memoize body geometry to prevent recreation
  const bodyGeometry = useMemo(() => ({ args: [2, 0.3, 1] }), []);
  const wheelGeometry = useMemo(() => ({ args: [0.1, 0.3, 0.3] }), []);
  const faultIndicatorGeometry = useMemo(() => ({ args: [0.05, 0.05, 0.05] }), []);
  const directionGeometry = useMemo(() => ({ args: [0.3, 0.1, 0.1] }), []);
  
  // Memoize materials to prevent recreation
  const materials = useMemo(() => ({
    body: <meshStandardMaterial color="#333333" />,
    wheelNormal: <meshStandardMaterial color="#222222" />,
    wheelFaulted: <meshStandardMaterial color="#ff4444" />,
    faultIndicator: <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={0.3} />,
    direction: <meshStandardMaterial color="#00ff00" />
  }), []);
  
  // Memoize text properties
  const statusTextProps = useMemo(() => ({
    position: [0, 0.5, 0],
    fontSize: 0.1,
    anchorX: "center",
    anchorY: "middle"
  }), []);
  
  // Memoize fault states to prevent unnecessary recalculations
  const faultStates = useMemo(() => {
    if (!wheelSpeeds) return {};
    
    return {
      fl: wheelSpeeds.fl_fault || false,
      fr: wheelSpeeds.fr_fault || false,
      rl: wheelSpeeds.rl_fault || false,
      rr: wheelSpeeds.rr_fault || false
    };
  }, [wheelSpeeds?.fl_fault, wheelSpeeds?.fr_fault, wheelSpeeds?.rl_fault, wheelSpeeds?.rr_fault]);
  
  // Memoize emergency stop status
  const emergencyStop = useMemo(() => 
    wheelSpeeds?.emergency_stop || false, 
    [wheelSpeeds?.emergency_stop]
  );
  
  // Memoize status text content
  const statusText = useMemo(() => 
    emergencyStop ? "EMERGENCY STOP" : "OPERATIONAL",
    [emergencyStop]
  );
  
  // Memoize status text color
  const statusColor = useMemo(() => 
    emergencyStop ? "#ff0000" : "#00ff00",
    [emergencyStop]
  );
  
  // Optimized wheel animation with RAF batching
  const animateWheels = useCallback(() => {
    if (!wheelsRef.current || !wheelSpeeds) return;
    
    let hasChanges = false;
    wheelPositions.forEach(([, , , wheel], index) => {
      const wheelRef = wheelsRef.current[index];
      const rpm = wheelSpeeds[wheel] || 0;
      
      if (wheelRef && rpm !== 0) {
        wheelRef.rotation.x += rpm * 0.01;
        hasChanges = true;
      }
    });
    
    // Only continue animation if there are actual changes
    if (hasChanges) {
      animationFrameRef.current = requestAnimationFrame(animateWheels);
    }
  }, [wheelSpeeds, wheelPositions]);
  
  // Effect for wheel animation with cleanup
  useEffect(() => {
    // Only start animation if there are non-zero wheel speeds
    const hasMovement = wheelSpeeds && Object.values(wheelSpeeds).some(speed => 
      typeof speed === 'number' && speed !== 0
    );
    
    if (hasMovement) {
      animationFrameRef.current = requestAnimationFrame(animateWheels);
    }
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [animateWheels, wheelSpeeds]);
  
  // Memoized wheel components to prevent unnecessary renders
  const wheelComponents = useMemo(() => {
    return wheelPositions.map(([x, y, z, wheel], index) => {
      const isFaulted = faultStates[wheel];
      const wheelKey = `wheel-${wheel}`;
      
      return (
        <group key={wheelKey} position={[x, y, z]}>
          <Box 
            {...wheelGeometry}
            ref={el => wheelsRef.current[index] = el}
          >
            {isFaulted ? materials.wheelFaulted : materials.wheelNormal}
          </Box>
          {/* Fault indicator - only render when needed */}
          {isFaulted && (
            <Box {...faultIndicatorGeometry} position={[0, 0.2, 0]}>
              {materials.faultIndicator}
            </Box>
          )}
        </group>
      );
    });
  }, [wheelPositions, faultStates, wheelGeometry, faultIndicatorGeometry, materials]);
  
  return (
    <group position={position} rotation={rotation}>
      {/* Rover Body - memoized geometry and material */}
      <Box {...bodyGeometry} position={[0, 0, 0]}>
        {materials.body}
      </Box>
      
      {/* Wheels with optimized rendering */}
      {wheelComponents}
      
      {/* Direction indicator */}
      <Box {...directionGeometry} position={[1, 0.2, 0]}>
        {materials.direction}
      </Box>
      
      {/* Status text with memoized properties */}
      <Text
        {...statusTextProps}
        color={statusColor}
      >
        {statusText}
      </Text>
    </group>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for optimal re-rendering
  // Only re-render if essential props have changed
  
  // Check position changes (with tolerance for floating point)
  if (prevProps.position && nextProps.position) {
    const positionChanged = prevProps.position.some((val, index) => 
      Math.abs(val - nextProps.position[index]) > 0.001
    );
    if (positionChanged) return false;
  } else if (prevProps.position !== nextProps.position) {
    return false;
  }
  
  // Check rotation changes (with tolerance)
  if (prevProps.rotation && nextProps.rotation) {
    const rotationChanged = prevProps.rotation.some((val, index) => 
      Math.abs(val - nextProps.rotation[index]) > 0.001
    );
    if (rotationChanged) return false;
  } else if (prevProps.rotation !== nextProps.rotation) {
    return false;
  }
  
  // Check wheel speeds - only significant changes
  const prevSpeeds = prevProps.wheelSpeeds || {};
  const nextSpeeds = nextProps.wheelSpeeds || {};
  
  const wheelKeys = ['fl', 'fr', 'rl', 'rr'];
  const speedChanged = wheelKeys.some(key => 
    Math.abs((prevSpeeds[key] || 0) - (nextSpeeds[key] || 0)) > 0.1
  );
  
  // Check fault states
  const faultKeys = ['fl_fault', 'fr_fault', 'rl_fault', 'rr_fault'];
  const faultChanged = faultKeys.some(key => 
    prevSpeeds[key] !== nextSpeeds[key]
  );
  
  // Check emergency stop
  const emergencyChanged = prevSpeeds.emergency_stop !== nextSpeeds.emergency_stop;
  
  // Return true if nothing significant changed (prevents re-render)
  return !speedChanged && !faultChanged && !emergencyChanged;
});

// Display name for debugging
RoverModelOptimized.displayName = 'RoverModelOptimized';

export default RoverModelOptimized;