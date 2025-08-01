/**
 * DetailedRoverModel Component
 * 
 * Procedurally generated 3D rover model based on Mars Perseverance specifications.
 * Features accurate proportions, articulated components, LOD system, and PBR materials.
 * 
 * @author Mission Control Team
 * @version 1.0.0
 */

import React, { useRef, useMemo, forwardRef, useImperativeHandle } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils';

// Types
export interface DetailedRoverModelProps {
  /** Position of the rover */
  position?: [number, number, number];
  /** Rotation of the rover */
  rotation?: [number, number, number];
  /** Scale of the rover */
  scale?: number;
  /** Level of detail (0 = high, 1 = medium, 2 = low) */
  lod?: number;
  /** Show debug markers */
  debug?: boolean;
  /** Animation state for moving parts */
  animationState?: RoverAnimationState;
  /** Enable shadow casting */
  castShadow?: boolean;
  /** Enable shadow receiving */
  receiveShadow?: boolean;
  /** Custom material overrides */
  materials?: RoverMaterials;
}

export interface RoverAnimationState {
  /** Wheel rotations in radians */
  wheelRotations?: number[];
  /** Steering angles for front wheels in radians */
  steeringAngles?: number[];
  /** Robotic arm joint angles */
  armJoints?: {
    shoulder: number;
    elbow: number;
    wrist: number;
    turret: number;
  };
  /** Mast camera pan/tilt */
  mastCamera?: {
    pan: number;
    tilt: number;
  };
  /** High gain antenna pan/tilt */
  antenna?: {
    pan: number;
    tilt: number;
  };
  /** Solar panel deployment (0-1) */
  solarPanelDeployment?: number;
}

export interface RoverMaterials {
  body?: THREE.Material;
  wheels?: THREE.Material;
  solar?: THREE.Material;
  instruments?: THREE.Material;
  antenna?: THREE.Material;
}

export interface DetailedRoverModelRef {
  /** Get attachment points for physics or other components */
  getAttachmentPoints: () => AttachmentPoints;
  /** Update animation state */
  updateAnimation: (state: RoverAnimationState) => void;
  /** Get current bounds */
  getBounds: () => THREE.Box3;
}

interface AttachmentPoints {
  wheels: THREE.Vector3[];
  centerOfMass: THREE.Vector3;
  instruments: THREE.Vector3[];
  antenna: THREE.Vector3;
  arm: THREE.Vector3;
  mast: THREE.Vector3;
}

// Constants based on Perseverance rover specifications
const ROVER_DIMENSIONS = {
  body: {
    length: 3.0,    // meters
    width: 2.7,     // meters
    height: 2.2,    // meters
  },
  wheelbase: {
    front: 2.4,
    rear: 2.4,
    width: 2.7,
  },
  wheel: {
    radius: 0.525,  // meters
    width: 0.4,     // meters
  },
  mast: {
    height: 2.2,    // meters from deck
  },
  arm: {
    length: 2.1,    // meters fully extended
  },
};

// LOD thresholds
const LOD_DISTANCES = {
  HIGH: 25,    // meters
  MEDIUM: 50,  // meters
  LOW: 100,    // meters
};

/**
 * Create default PBR materials for the rover
 */
function createDefaultMaterials(): RoverMaterials {
  return {
    body: new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x8B7355), // Tan/brown
      metalness: 0.7,
      roughness: 0.3,
    }),
    wheels: new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x2F2F2F),
      metalness: 0.8,
      roughness: 0.6,
    }),
    solar: new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x1A237E),
      metalness: 0.9,
      roughness: 0.1,
    }),
    instruments: new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x616161),
      metalness: 0.85,
      roughness: 0.2,
    }),
    antenna: new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xE0E0E0),
      metalness: 0.9,
      roughness: 0.1,
    }),
  };
}

/**
 * Create wheel geometry with tread pattern
 */
function createWheelGeometry(radius: number, width: number, detail: number): THREE.BufferGeometry {
  const geometry = new THREE.CylinderGeometry(radius, radius, width, detail === 0 ? 32 : 16, 1);
  
  if (detail === 0) {
    // Add tread pattern for high detail
    const treadCount = 24;
    const treadGeometries: THREE.BufferGeometry[] = [geometry];
    
    for (let i = 0; i < treadCount; i++) {
      const angle = (i / treadCount) * Math.PI * 2;
      const tread = new THREE.BoxGeometry(0.05, width * 0.8, 0.1);
      tread.translate(radius + 0.025, 0, 0);
      tread.rotateY(angle);
      treadGeometries.push(tread);
    }
    
    return mergeGeometries(treadGeometries);
  }
  
  return geometry;
}

/**
 * Create rover body with details
 */
function createBodyGeometry(lod: number): THREE.BufferGeometry {
  const { length, width, height } = ROVER_DIMENSIONS.body;
  
  if (lod === 2) {
    // Low detail - simple box
    return new THREE.BoxGeometry(width, height, length);
  }
  
  // Medium/High detail - complex shape
  const geometries: THREE.BufferGeometry[] = [];
  
  // Main chassis
  const chassis = new THREE.BoxGeometry(width * 0.9, height * 0.5, length);
  geometries.push(chassis);
  
  // Equipment deck
  const deck = new THREE.BoxGeometry(width * 0.85, height * 0.3, length * 0.8);
  deck.translate(0, height * 0.4, 0);
  geometries.push(deck);
  
  // Front slope
  const frontSlope = new THREE.BoxGeometry(width * 0.7, height * 0.4, length * 0.3);
  frontSlope.translate(0, 0, -length * 0.4);
  geometries.push(frontSlope);
  
  // Rear equipment box
  const rearBox = new THREE.BoxGeometry(width * 0.6, height * 0.35, length * 0.3);
  rearBox.translate(0, height * 0.3, length * 0.35);
  geometries.push(rearBox);
  
  if (lod === 0) {
    // High detail - add more components
    // RTG (Radioisotope Thermoelectric Generator)
    const rtg = new THREE.CylinderGeometry(0.3, 0.3, 1.0, 16);
    rtg.rotateZ(Math.PI / 2);
    rtg.translate(-width * 0.35, height * 0.2, length * 0.3);
    geometries.push(rtg);
    
    // Equipment panels
    for (let i = 0; i < 4; i++) {
      const panel = new THREE.BoxGeometry(0.3, 0.3, 0.05);
      panel.translate(
        (i % 2 === 0 ? -1 : 1) * width * 0.4,
        height * 0.6,
        (i < 2 ? -1 : 1) * length * 0.2
      );
      geometries.push(panel);
    }
  }
  
  return mergeGeometries(geometries);
}

/**
 * Create mast assembly with cameras
 */
function createMastAssembly(lod: number): THREE.Group {
  const group = new THREE.Group();
  
  // Mast pole
  const mastGeometry = new THREE.CylinderGeometry(0.08, 0.1, ROVER_DIMENSIONS.mast.height, lod === 0 ? 16 : 8);
  const mast = new THREE.Mesh(mastGeometry);
  mast.position.y = ROVER_DIMENSIONS.mast.height / 2;
  group.add(mast);
  
  if (lod < 2) {
    // Camera head
    const headGeometry = new THREE.BoxGeometry(0.4, 0.3, 0.3);
    const head = new THREE.Mesh(headGeometry);
    head.position.y = ROVER_DIMENSIONS.mast.height;
    group.add(head);
    
    if (lod === 0) {
      // Camera lenses
      const lensGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.1, 16);
      lensGeometry.rotateZ(Math.PI / 2);
      
      // Left camera
      const leftLens = new THREE.Mesh(lensGeometry);
      leftLens.position.set(-0.1, ROVER_DIMENSIONS.mast.height, -0.2);
      group.add(leftLens);
      
      // Right camera
      const rightLens = new THREE.Mesh(lensGeometry);
      rightLens.position.set(0.1, ROVER_DIMENSIONS.mast.height, -0.2);
      group.add(rightLens);
    }
  }
  
  return group;
}

/**
 * Create robotic arm assembly
 */
function createRoboticArm(lod: number): THREE.Group {
  const group = new THREE.Group();
  
  if (lod === 2) return group; // No arm in low detail
  
  // Turret base
  const turretGeometry = new THREE.CylinderGeometry(0.15, 0.2, 0.2, lod === 0 ? 16 : 8);
  const turret = new THREE.Mesh(turretGeometry);
  group.add(turret);
  
  // Upper arm
  const upperArmGeometry = new THREE.BoxGeometry(0.15, 0.15, 1.0);
  const upperArm = new THREE.Mesh(upperArmGeometry);
  upperArm.position.set(0, 0.1, 0.5);
  group.add(upperArm);
  
  // Lower arm
  const lowerArmGeometry = new THREE.BoxGeometry(0.12, 0.12, 0.8);
  const lowerArm = new THREE.Mesh(lowerArmGeometry);
  lowerArm.position.set(0, 0.1, 1.4);
  group.add(lowerArm);
  
  if (lod === 0) {
    // Wrist and tool head
    const wristGeometry = new THREE.SphereGeometry(0.08, 8, 8);
    const wrist = new THREE.Mesh(wristGeometry);
    wrist.position.set(0, 0.1, 1.8);
    group.add(wrist);
    
    // Drill/tool
    const toolGeometry = new THREE.ConeGeometry(0.05, 0.2, 8);
    const tool = new THREE.Mesh(toolGeometry);
    tool.position.set(0, 0.1, 2.0);
    tool.rotation.x = Math.PI;
    group.add(tool);
  }
  
  return group;
}

/**
 * Create antenna assembly
 */
function createAntennaAssembly(lod: number): THREE.Group {
  const group = new THREE.Group();
  
  if (lod === 2) {
    // Simple antenna for low detail
    const antennaGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.8, 8);
    const antenna = new THREE.Mesh(antennaGeometry);
    antenna.position.y = 0.4;
    group.add(antenna);
    return group;
  }
  
  // High gain antenna dish
  const dishGeometry = new THREE.ConeGeometry(0.3, 0.2, lod === 0 ? 32 : 16, 1, true);
  const dish = new THREE.Mesh(dishGeometry);
  dish.rotation.x = Math.PI;
  group.add(dish);
  
  // Support arm
  const armGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.5, 8);
  const arm = new THREE.Mesh(armGeometry);
  arm.position.y = -0.25;
  group.add(arm);
  
  if (lod === 0) {
    // Feed horn
    const hornGeometry = new THREE.ConeGeometry(0.05, 0.1, 8);
    const horn = new THREE.Mesh(hornGeometry);
    horn.position.y = -0.05;
    group.add(horn);
  }
  
  return group;
}

/**
 * Main DetailedRoverModel Component
 */
export const DetailedRoverModel = forwardRef<DetailedRoverModelRef, DetailedRoverModelProps>(({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  lod = 0,
  debug = false,
  animationState,
  castShadow = true,
  receiveShadow = true,
  materials: customMaterials,
}, ref) => {
  const groupRef = useRef<THREE.Group>(null);
  const wheelRefs = useRef<THREE.Mesh[]>([]);
  const mastRef = useRef<THREE.Group>(null);
  const armRef = useRef<THREE.Group>(null);
  const antennaRef = useRef<THREE.Group>(null);
  
  // Materials
  const materials = useMemo(() => {
    return customMaterials || createDefaultMaterials();
  }, [customMaterials]);
  
  // Create geometries based on LOD
  const bodyGeometry = useMemo(() => createBodyGeometry(lod), [lod]);
  const wheelGeometry = useMemo(() => createWheelGeometry(
    ROVER_DIMENSIONS.wheel.radius,
    ROVER_DIMENSIONS.wheel.width,
    lod
  ), [lod]);
  
  // Wheel positions
  const wheelPositions: [number, number, number][] = useMemo(() => [
    [-ROVER_DIMENSIONS.wheelbase.width / 2, 0, -ROVER_DIMENSIONS.wheelbase.front / 2], // Front left
    [ROVER_DIMENSIONS.wheelbase.width / 2, 0, -ROVER_DIMENSIONS.wheelbase.front / 2],  // Front right
    [-ROVER_DIMENSIONS.wheelbase.width / 2, 0, 0],                                     // Middle left
    [ROVER_DIMENSIONS.wheelbase.width / 2, 0, 0],                                      // Middle right
    [-ROVER_DIMENSIONS.wheelbase.width / 2, 0, ROVER_DIMENSIONS.wheelbase.rear / 2],   // Rear left
    [ROVER_DIMENSIONS.wheelbase.width / 2, 0, ROVER_DIMENSIONS.wheelbase.rear / 2],    // Rear right
  ], []);
  
  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    getAttachmentPoints: () => ({
      wheels: wheelPositions.map(pos => new THREE.Vector3(...pos)),
      centerOfMass: new THREE.Vector3(0, -0.2, 0),
      instruments: [
        new THREE.Vector3(0, ROVER_DIMENSIONS.body.height * 0.7, 0),
        new THREE.Vector3(0.3, ROVER_DIMENSIONS.body.height * 0.6, -0.5),
        new THREE.Vector3(-0.3, ROVER_DIMENSIONS.body.height * 0.6, -0.5),
      ],
      antenna: new THREE.Vector3(0.5, ROVER_DIMENSIONS.body.height * 0.8, 0.5),
      arm: new THREE.Vector3(0, ROVER_DIMENSIONS.body.height * 0.5, -ROVER_DIMENSIONS.body.length * 0.4),
      mast: new THREE.Vector3(0, ROVER_DIMENSIONS.body.height * 0.6, 0),
    }),
    updateAnimation: (state: RoverAnimationState) => {
      // Update wheel rotations
      if (state.wheelRotations && wheelRefs.current) {
        wheelRefs.current.forEach((wheel, i) => {
          if (wheel && state.wheelRotations![i] !== undefined) {
            wheel.rotation.x = state.wheelRotations![i];
          }
        });
      }
      
      // Update steering angles (front wheels only)
      if (state.steeringAngles && wheelRefs.current) {
        [0, 1].forEach(i => {
          const wheel = wheelRefs.current[i];
          if (wheel && wheel.parent && state.steeringAngles![i] !== undefined) {
            wheel.parent.rotation.y = state.steeringAngles![i];
          }
        });
      }
      
      // Update mast camera
      if (state.mastCamera && mastRef.current) {
        mastRef.current.rotation.y = state.mastCamera.pan || 0;
        // Tilt would be applied to camera head child
      }
      
      // Update antenna
      if (state.antenna && antennaRef.current) {
        antennaRef.current.rotation.y = state.antenna.pan || 0;
        antennaRef.current.rotation.x = state.antenna.tilt || 0;
      }
      
      // Update arm joints
      if (state.armJoints && armRef.current) {
        armRef.current.rotation.y = state.armJoints.turret || 0;
        // Additional joint rotations would be applied to arm segments
      }
    },
    getBounds: () => {
      if (groupRef.current) {
        const box = new THREE.Box3().setFromObject(groupRef.current);
        return box;
      }
      return new THREE.Box3();
    },
  }), [wheelPositions]);
  
  // Animation update
  useFrame(() => {
    if (animationState) {
      // Apply any continuous animations here
    }
  });
  
  return (
    <group ref={groupRef} position={position} rotation={rotation} scale={scale}>
      {/* Rover body */}
      <mesh 
        geometry={bodyGeometry} 
        material={materials.body}
        castShadow={castShadow}
        receiveShadow={receiveShadow}
        position={[0, ROVER_DIMENSIONS.wheel.radius + 0.3, 0]}
      />
      
      {/* Wheels */}
      {wheelPositions.map((pos, i) => (
        <group key={`wheel-${i}`} position={pos}>
          <mesh
            ref={(el) => {
              if (el) wheelRefs.current[i] = el;
            }}
            geometry={wheelGeometry}
            material={materials.wheels}
            rotation={[0, 0, Math.PI / 2]}
            castShadow={castShadow}
            receiveShadow={receiveShadow}
          />
        </group>
      ))}
      
      {/* Mast assembly */}
      {lod < 2 && (
        <group
          ref={mastRef}
          position={[0, ROVER_DIMENSIONS.wheel.radius + ROVER_DIMENSIONS.body.height * 0.6, 0]}
        >
          <primitive object={createMastAssembly(lod)} attach="children" />
        </group>
      )}
      
      {/* Robotic arm */}
      {lod < 2 && (
        <group
          ref={armRef}
          position={[
            0,
            ROVER_DIMENSIONS.wheel.radius + ROVER_DIMENSIONS.body.height * 0.5,
            -ROVER_DIMENSIONS.body.length * 0.4
          ]}
        >
          <primitive object={createRoboticArm(lod)} attach="children" />
        </group>
      )}
      
      {/* High gain antenna */}
      <group
        ref={antennaRef}
        position={[
          ROVER_DIMENSIONS.body.width * 0.3,
          ROVER_DIMENSIONS.wheel.radius + ROVER_DIMENSIONS.body.height * 0.8,
          ROVER_DIMENSIONS.body.length * 0.3
        ]}
      >
        <primitive object={createAntennaAssembly(lod)} attach="children" />
      </group>
      
      {/* Solar panels / RTG */}
      {lod === 0 && (
        <>
          {/* RTG cylinder */}
          <mesh
            position={[
              -ROVER_DIMENSIONS.body.width * 0.35,
              ROVER_DIMENSIONS.wheel.radius + ROVER_DIMENSIONS.body.height * 0.4,
              ROVER_DIMENSIONS.body.length * 0.3
            ]}
            rotation={[0, 0, Math.PI / 2]}
            castShadow={castShadow}
            receiveShadow={receiveShadow}
          >
            <cylinderGeometry args={[0.3, 0.3, 1.0, 16]} />
            <meshStandardMaterial color="#333333" metalness={0.9} roughness={0.1} />
          </mesh>
          
          {/* RTG fins */}
          {Array.from({ length: 8 }).map((_, i) => (
            <mesh
              key={`fin-${i}`}
              position={[
                -ROVER_DIMENSIONS.body.width * 0.35,
                ROVER_DIMENSIONS.wheel.radius + ROVER_DIMENSIONS.body.height * 0.4,
                ROVER_DIMENSIONS.body.length * 0.3
              ]}
              rotation={[0, (i / 8) * Math.PI * 2, Math.PI / 2]}
              castShadow={castShadow}
            >
              <boxGeometry args={[0.02, 0.4, 0.15]} />
              <meshStandardMaterial color="#222222" metalness={0.8} roughness={0.2} />
            </mesh>
          ))}
        </>
      )}
      
      {/* Debug markers */}
      {debug && (
        <>
          {/* Center of mass */}
          <mesh position={[0, -0.2, 0]}>
            <sphereGeometry args={[0.1, 8, 8]} />
            <meshBasicMaterial color="red" />
          </mesh>
          
          {/* Wheel attachment points */}
          {wheelPositions.map((pos, i) => (
            <mesh key={`debug-wheel-${i}`} position={pos}>
              <sphereGeometry args={[0.05, 8, 8]} />
              <meshBasicMaterial color="green" />
            </mesh>
          ))}
          
          {/* Bounds */}
          <box3Helper args={[new THREE.Box3().setFromObject(groupRef.current || new THREE.Group()), 'yellow']} />
        </>
      )}
    </group>
  );
});

DetailedRoverModel.displayName = 'DetailedRoverModel';

/**
 * LOD-aware wrapper that automatically switches detail levels based on distance
 */
export const LODRoverModel: React.FC<DetailedRoverModelProps & { cameraDistance?: number }> = ({
  cameraDistance = 0,
  ...props
}) => {
  // Determine LOD based on distance
  const lod = useMemo(() => {
    if (cameraDistance < LOD_DISTANCES.HIGH) return 0;
    if (cameraDistance < LOD_DISTANCES.MEDIUM) return 1;
    return 2;
  }, [cameraDistance]);
  
  return <DetailedRoverModel {...props} lod={lod} />;
};

export default DetailedRoverModel;