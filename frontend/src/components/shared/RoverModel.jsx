import React, { useRef, useEffect } from 'react';
import { Box, Text } from '@react-three/drei';

/**
 * Enhanced 3D Rover Model with realistic animations
 * Used in the Dashboard module for 3D visualization
 */
const RoverModel = ({ position, rotation, wheelSpeeds }) => {
  const wheelsRef = useRef([]);
  
  useEffect(() => {
    // Animate wheels based on RPM
    const animateWheels = () => {
      if (wheelsRef.current) {
        Object.entries(wheelSpeeds).forEach(([wheel, rpm], index) => {
          if (wheelsRef.current[index]) {
            wheelsRef.current[index].rotation.x += (rpm || 0) * 0.01;
          }
        });
      }
      requestAnimationFrame(animateWheels);
    };
    animateWheels();
  }, [wheelSpeeds]);

  return (
    <group position={position} rotation={rotation}>
      {/* Rover Body */}
      <Box args={[2, 0.3, 1]} position={[0, 0, 0]}>
        <meshStandardMaterial color="#333333" />
      </Box>
      
      {/* Wheels with fault indication */}
      {[
        [-0.8, -0.2, 0.4, 'fl'],  // Front Left
        [0.8, -0.2, 0.4, 'fr'],   // Front Right
        [-0.8, -0.2, -0.4, 'rl'], // Rear Left
        [0.8, -0.2, -0.4, 'rr']   // Rear Right
      ].map(([x, y, z, wheel], index) => {
        const isFaulted = wheelSpeeds[wheel + '_fault'] || false;
        return (
          <group key={wheel} position={[x, y, z]}>
            <Box 
              args={[0.1, 0.3, 0.3]} 
              ref={el => wheelsRef.current[index] = el}
            >
              <meshStandardMaterial color={isFaulted ? "#ff4444" : "#222222"} />
            </Box>
            {/* Fault indicator */}
            {isFaulted && (
              <Box args={[0.05, 0.05, 0.05]} position={[0, 0.2, 0]}>
                <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={0.3} />
              </Box>
            )}
          </group>
        );
      })}
      
      {/* Direction indicator */}
      <Box args={[0.3, 0.1, 0.1]} position={[1, 0.2, 0]}>
        <meshStandardMaterial color="#00ff00" />
      </Box>
      
      {/* Status indicators */}
      <Text
        position={[0, 0.5, 0]}
        fontSize={0.1}
        color={wheelSpeeds.emergency_stop ? "#ff0000" : "#00ff00"}
        anchorX="center"
        anchorY="middle"
      >
        {wheelSpeeds.emergency_stop ? "EMERGENCY STOP" : "OPERATIONAL"}
      </Text>
    </group>
  );
};

export default RoverModel;