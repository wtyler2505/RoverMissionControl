/**
 * WheelPhysicsConfig
 * 
 * Configuration parameters for advanced wheel physics simulation
 * Based on NASA Mars rover specifications and real-world physics
 * 
 * @author Mission Control Team
 * @version 1.0.0
 */

export type TerrainType = 'rock' | 'sand' | 'regolith' | 'ice';

export interface WheelPhysicsConfig {
  /** Wheel physical dimensions */
  dimensions: {
    /** Wheel radius in meters (Perseverance: 0.525m) */
    radius: number;
    /** Wheel width in meters (Perseverance: 0.4m) */
    width: number;
    /** Wheel mass in kg */
    mass: number;
    /** Moment of inertia for wheel rotation */
    inertia: number;
  };
  
  /** Suspension system configuration */
  suspension: {
    /** Spring stiffness in N/m */
    stiffness: number;
    /** Damping coefficient in N·s/m */
    damping: number;
    /** Maximum compression distance in meters */
    maxCompression: number;
    /** Maximum extension distance in meters */
    maxExtension: number;
    /** Rest length of suspension in meters */
    restLength: number;
    /** Progressive spring rate (0-1, higher = more progressive) */
    progressiveRate: number;
    /** Suspension arm length for rocker-bogie */
    armLength: number;
  };
  
  /** Friction coefficients for different terrains */
  friction: {
    /** Static friction coefficients */
    static: {
      rock: number;
      sand: number;
      regolith: number;
      ice: number;
    };
    /** Dynamic (sliding) friction coefficients */
    dynamic: {
      rock: number;
      sand: number;
      regolith: number;
      ice: number;
    };
  };
  
  /** Motor and drivetrain properties */
  motor: {
    /** Maximum torque in N·m */
    maxTorque: number;
    /** Maximum RPM */
    maxRPM: number;
    /** Torque curve coefficients [a, b, c] for T = a + b*rpm + c*rpm² */
    torqueCurve: [number, number, number];
    /** Internal resistance/friction */
    internalResistance: number;
    /** Gear ratio from motor to wheel */
    gearRatio: number;
  };
  
  /** Steering configuration */
  steering: {
    /** Maximum steering angle in radians */
    maxAngle: number;
    /** Steering speed in rad/s */
    steeringSpeed: number;
    /** Ackermann geometry coefficient (0-1) */
    ackermannCoeff: number;
  };
  
  /** Slip detection and control */
  slipThreshold: number;
  /** Traction control system */
  tractionControl: {
    /** Enable traction control */
    enabled: boolean;
    /** Slip ratio threshold for intervention */
    slipThreshold: number;
    /** Torque reduction factor (0-1) */
    reductionFactor: number;
    /** Response time in seconds */
    responseTime: number;
  };
  
  /** Terrain interaction properties */
  terrainProperties: {
    [key in TerrainType]: {
      /** Rolling resistance coefficient */
      rollingResistance: number;
      /** Maximum sink depth in meters */
      sinkDepth: number;
      /** Compaction resistance */
      compactionResistance: number;
      /** Surface deformation elasticity (0-1) */
      elasticity: number;
    };
  };
  
  /** Wheel deformation on soft terrain */
  deformation: {
    /** Enable wheel deformation */
    enabled: boolean;
    /** Deformation factor (0-1) */
    factor: number;
    /** Recovery speed when leaving soft terrain */
    recoverySpeed: number;
  };
  
  /** Rocker-bogie specific configuration */
  rockerBogie: {
    /** Rocker arm length in meters */
    rockerLength: number;
    /** Bogie arm length in meters */
    bogieLength: number;
    /** Differential bar length */
    differentialLength: number;
    /** Joint friction/damping */
    jointDamping: number;
    /** Maximum rocker angle in radians */
    maxRockerAngle: number;
    /** Maximum bogie angle in radians */
    maxBogieAngle: number;
  };
}

/** Default configuration based on Mars Perseverance rover */
export const defaultWheelPhysicsConfig: WheelPhysicsConfig = {
  dimensions: {
    radius: 0.525,      // Perseverance wheel radius
    width: 0.4,         // Wheel width
    mass: 10,           // Individual wheel mass
    inertia: 0.5        // Moment of inertia (simplified as 0.5 * m * r²)
  },
  
  suspension: {
    stiffness: 35000,        // N/m - tuned for Mars gravity
    damping: 3500,           // N·s/m
    maxCompression: 0.3,     // 30cm compression
    maxExtension: 0.3,       // 30cm extension
    restLength: 0.8,         // 80cm rest length
    progressiveRate: 0.3,    // Progressive spring behavior
    armLength: 1.2           // Suspension arm length
  },
  
  friction: {
    static: {
      rock: 1.2,        // High friction on solid rock
      sand: 0.6,        // Lower friction on loose sand
      regolith: 0.8,    // Mars regolith (soil)
      ice: 0.3          // Very low friction on ice
    },
    dynamic: {
      rock: 1.0,        // Sliding friction on rock
      sand: 0.5,        // Sliding in sand
      regolith: 0.7,    // Sliding on regolith
      ice: 0.2          // Sliding on ice
    }
  },
  
  motor: {
    maxTorque: 500,          // N·m per wheel
    maxRPM: 180,             // Maximum wheel RPM
    torqueCurve: [500, -0.5, -0.001],  // Decreasing torque with RPM
    internalResistance: 0.05,
    gearRatio: 50            // High gear ratio for torque multiplication
  },
  
  steering: {
    maxAngle: Math.PI / 6,   // 30 degrees max steering
    steeringSpeed: 0.5,      // rad/s steering speed
    ackermannCoeff: 0.8      // Ackermann steering geometry
  },
  
  slipThreshold: 0.15,       // 15% slip threshold
  
  tractionControl: {
    enabled: true,
    slipThreshold: 0.2,      // 20% slip for TC intervention
    reductionFactor: 0.5,    // Reduce torque by 50% max
    responseTime: 0.1        // 100ms response time
  },
  
  terrainProperties: {
    rock: {
      rollingResistance: 0.02,
      sinkDepth: 0,
      compactionResistance: 1000,
      elasticity: 0.9
    },
    sand: {
      rollingResistance: 0.15,
      sinkDepth: 0.05,         // 5cm sink in sand
      compactionResistance: 100,
      elasticity: 0.3
    },
    regolith: {
      rollingResistance: 0.08,
      sinkDepth: 0.02,         // 2cm sink
      compactionResistance: 300,
      elasticity: 0.5
    },
    ice: {
      rollingResistance: 0.01,
      sinkDepth: 0,
      compactionResistance: 2000,
      elasticity: 0.95
    }
  },
  
  deformation: {
    enabled: true,
    factor: 0.8,             // 80% of sink depth as deformation
    recoverySpeed: 2.0       // 2 seconds to recover shape
  },
  
  rockerBogie: {
    rockerLength: 1.2,       // Length of rocker arm
    bogieLength: 0.8,        // Length of bogie arm
    differentialLength: 2.7, // Width of differential bar
    jointDamping: 50,        // Joint friction/damping
    maxRockerAngle: Math.PI / 4,  // 45 degrees max
    maxBogieAngle: Math.PI / 6     // 30 degrees max
  }
};

/** Preset configurations for different rover models */
export const wheelPhysicsPresets = {
  perseverance: defaultWheelPhysicsConfig,
  
  curiosity: {
    ...defaultWheelPhysicsConfig,
    dimensions: {
      ...defaultWheelPhysicsConfig.dimensions,
      radius: 0.5,
      width: 0.4
    }
  },
  
  opportunity: {
    ...defaultWheelPhysicsConfig,
    dimensions: {
      radius: 0.13,
      width: 0.16,
      mass: 2,
      inertia: 0.02
    },
    motor: {
      ...defaultWheelPhysicsConfig.motor,
      maxTorque: 150,
      maxRPM: 300
    },
    suspension: {
      ...defaultWheelPhysicsConfig.suspension,
      stiffness: 10000,
      damping: 1000,
      maxCompression: 0.15,
      maxExtension: 0.15,
      restLength: 0.4
    }
  },
  
  // Racing mode - unrealistic but fun
  racing: {
    ...defaultWheelPhysicsConfig,
    motor: {
      maxTorque: 2000,
      maxRPM: 600,
      torqueCurve: [2000, -1, -0.002],
      internalResistance: 0.02,
      gearRatio: 20
    },
    friction: {
      static: {
        rock: 1.5,
        sand: 0.8,
        regolith: 1.0,
        ice: 0.4
      },
      dynamic: {
        rock: 1.3,
        sand: 0.7,
        regolith: 0.9,
        ice: 0.3
      }
    },
    suspension: {
      ...defaultWheelPhysicsConfig.suspension,
      stiffness: 50000,
      damping: 5000
    }
  }
};

/** Helper function to interpolate between wheel physics configs */
export function interpolateWheelPhysicsConfig(
  configA: WheelPhysicsConfig,
  configB: WheelPhysicsConfig,
  factor: number
): WheelPhysicsConfig {
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  
  return {
    dimensions: {
      radius: lerp(configA.dimensions.radius, configB.dimensions.radius, factor),
      width: lerp(configA.dimensions.width, configB.dimensions.width, factor),
      mass: lerp(configA.dimensions.mass, configB.dimensions.mass, factor),
      inertia: lerp(configA.dimensions.inertia, configB.dimensions.inertia, factor)
    },
    suspension: {
      stiffness: lerp(configA.suspension.stiffness, configB.suspension.stiffness, factor),
      damping: lerp(configA.suspension.damping, configB.suspension.damping, factor),
      maxCompression: lerp(configA.suspension.maxCompression, configB.suspension.maxCompression, factor),
      maxExtension: lerp(configA.suspension.maxExtension, configB.suspension.maxExtension, factor),
      restLength: lerp(configA.suspension.restLength, configB.suspension.restLength, factor),
      progressiveRate: lerp(configA.suspension.progressiveRate, configB.suspension.progressiveRate, factor),
      armLength: lerp(configA.suspension.armLength, configB.suspension.armLength, factor)
    },
    friction: {
      static: {
        rock: lerp(configA.friction.static.rock, configB.friction.static.rock, factor),
        sand: lerp(configA.friction.static.sand, configB.friction.static.sand, factor),
        regolith: lerp(configA.friction.static.regolith, configB.friction.static.regolith, factor),
        ice: lerp(configA.friction.static.ice, configB.friction.static.ice, factor)
      },
      dynamic: {
        rock: lerp(configA.friction.dynamic.rock, configB.friction.dynamic.rock, factor),
        sand: lerp(configA.friction.dynamic.sand, configB.friction.dynamic.sand, factor),
        regolith: lerp(configA.friction.dynamic.regolith, configB.friction.dynamic.regolith, factor),
        ice: lerp(configA.friction.dynamic.ice, configB.friction.dynamic.ice, factor)
      }
    },
    motor: {
      maxTorque: lerp(configA.motor.maxTorque, configB.motor.maxTorque, factor),
      maxRPM: lerp(configA.motor.maxRPM, configB.motor.maxRPM, factor),
      torqueCurve: [
        lerp(configA.motor.torqueCurve[0], configB.motor.torqueCurve[0], factor),
        lerp(configA.motor.torqueCurve[1], configB.motor.torqueCurve[1], factor),
        lerp(configA.motor.torqueCurve[2], configB.motor.torqueCurve[2], factor)
      ],
      internalResistance: lerp(configA.motor.internalResistance, configB.motor.internalResistance, factor),
      gearRatio: lerp(configA.motor.gearRatio, configB.motor.gearRatio, factor)
    },
    steering: {
      maxAngle: lerp(configA.steering.maxAngle, configB.steering.maxAngle, factor),
      steeringSpeed: lerp(configA.steering.steeringSpeed, configB.steering.steeringSpeed, factor),
      ackermannCoeff: lerp(configA.steering.ackermannCoeff, configB.steering.ackermannCoeff, factor)
    },
    slipThreshold: lerp(configA.slipThreshold, configB.slipThreshold, factor),
    tractionControl: {
      enabled: factor < 0.5 ? configA.tractionControl.enabled : configB.tractionControl.enabled,
      slipThreshold: lerp(configA.tractionControl.slipThreshold, configB.tractionControl.slipThreshold, factor),
      reductionFactor: lerp(configA.tractionControl.reductionFactor, configB.tractionControl.reductionFactor, factor),
      responseTime: lerp(configA.tractionControl.responseTime, configB.tractionControl.responseTime, factor)
    },
    terrainProperties: configA.terrainProperties, // Don't interpolate terrain properties
    deformation: {
      enabled: factor < 0.5 ? configA.deformation.enabled : configB.deformation.enabled,
      factor: lerp(configA.deformation.factor, configB.deformation.factor, factor),
      recoverySpeed: lerp(configA.deformation.recoverySpeed, configB.deformation.recoverySpeed, factor)
    },
    rockerBogie: {
      rockerLength: lerp(configA.rockerBogie.rockerLength, configB.rockerBogie.rockerLength, factor),
      bogieLength: lerp(configA.rockerBogie.bogieLength, configB.rockerBogie.bogieLength, factor),
      differentialLength: lerp(configA.rockerBogie.differentialLength, configB.rockerBogie.differentialLength, factor),
      jointDamping: lerp(configA.rockerBogie.jointDamping, configB.rockerBogie.jointDamping, factor),
      maxRockerAngle: lerp(configA.rockerBogie.maxRockerAngle, configB.rockerBogie.maxRockerAngle, factor),
      maxBogieAngle: lerp(configA.rockerBogie.maxBogieAngle, configB.rockerBogie.maxBogieAngle, factor)
    }
  };
}

/** Calculate wheel physics parameters based on rover mass and wheel count */
export function calculateWheelParameters(
  roverMass: number,
  wheelCount: number,
  gravityMagnitude: number = 3.72 // Mars gravity
): Partial<WheelPhysicsConfig> {
  const weightPerWheel = (roverMass * gravityMagnitude) / wheelCount;
  
  // Calculate suspension stiffness to support weight with 50% compression at rest
  const targetCompression = 0.5;
  const suspensionStiffness = weightPerWheel / (targetCompression * 0.3); // 0.3m max compression
  
  // Damping ratio of 0.7 for critical damping
  const dampingRatio = 0.7;
  const suspensionDamping = 2 * dampingRatio * Math.sqrt(suspensionStiffness * (roverMass / wheelCount));
  
  // Motor torque based on ability to climb 30° slope
  const slopeAngle = Math.PI / 6; // 30 degrees
  const requiredForce = roverMass * gravityMagnitude * Math.sin(slopeAngle);
  const motorTorque = (requiredForce * 0.525) / wheelCount; // 0.525m wheel radius
  
  return {
    suspension: {
      stiffness: suspensionStiffness,
      damping: suspensionDamping,
      maxCompression: 0.3,
      maxExtension: 0.3,
      restLength: 0.8,
      progressiveRate: 0.3,
      armLength: 1.2
    },
    motor: {
      maxTorque: motorTorque,
      maxRPM: 180,
      torqueCurve: [motorTorque, -0.5, -0.001],
      internalResistance: 0.05,
      gearRatio: 50
    }
  };
}