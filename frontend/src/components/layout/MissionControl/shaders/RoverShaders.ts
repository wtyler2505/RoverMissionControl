/**
 * Custom shaders for rover visualization
 * 
 * Provides GLSL shaders for advanced visual effects including:
 * - Energy shield effect
 * - Terrain scanning pulse
 * - Signal strength visualization
 * 
 * @author Mission Control Team
 * @version 1.0.0
 */

import * as THREE from 'three';

/**
 * Energy shield shader - creates a sci-fi shield effect around the rover
 */
export const energyShieldShader = {
  vertexShader: `
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec2 vUv;
    
    void main() {
      vNormal = normalize(normalMatrix * normal);
      vPosition = position;
      vUv = uv;
      
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  
  fragmentShader: `
    uniform float time;
    uniform float opacity;
    uniform vec3 color;
    uniform float pulseSpeed;
    
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec2 vUv;
    
    void main() {
      // Calculate fresnel effect for edge glow
      vec3 viewDirection = normalize(cameraPosition - vPosition);
      float fresnel = 1.0 - dot(viewDirection, vNormal);
      fresnel = pow(fresnel, 2.0);
      
      // Add pulsing effect
      float pulse = sin(time * pulseSpeed) * 0.5 + 0.5;
      
      // Create hexagonal pattern
      float hexPattern = sin(vUv.x * 30.0) * sin(vUv.y * 30.0);
      hexPattern = smoothstep(0.0, 0.1, hexPattern);
      
      // Combine effects
      float alpha = fresnel * opacity * pulse;
      alpha += hexPattern * 0.2 * pulse;
      
      gl_FragColor = vec4(color, alpha);
    }
  `,
  
  uniforms: {
    time: { value: 0 },
    opacity: { value: 0.5 },
    color: { value: { r: 0.2, g: 0.8, b: 1.0 } },
    pulseSpeed: { value: 2.0 }
  }
};

/**
 * Terrain scanning shader - creates a scanning pulse effect
 */
export const terrainScanShader = {
  vertexShader: `
    varying vec3 vWorldPosition;
    varying vec2 vUv;
    
    void main() {
      vUv = uv;
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  
  fragmentShader: `
    uniform float time;
    uniform vec3 scanOrigin;
    uniform float scanRadius;
    uniform vec3 scanColor;
    uniform float scanSpeed;
    uniform float scanWidth;
    
    varying vec3 vWorldPosition;
    varying vec2 vUv;
    
    void main() {
      // Calculate distance from scan origin
      float distance = length(vWorldPosition - scanOrigin);
      
      // Create expanding ring
      float scanPosition = mod(time * scanSpeed, scanRadius);
      float scanIntensity = 1.0 - smoothstep(0.0, scanWidth, abs(distance - scanPosition));
      
      // Add grid pattern
      float grid = step(0.98, fract(vUv.x * 50.0)) + step(0.98, fract(vUv.y * 50.0));
      grid *= 0.3;
      
      // Base terrain color
      vec3 baseColor = vec3(0.5, 0.4, 0.3);
      
      // Mix scan effect with base color
      vec3 finalColor = mix(baseColor, scanColor, scanIntensity * 0.8);
      finalColor += vec3(grid * scanIntensity);
      
      gl_FragColor = vec4(finalColor, 1.0);
    }
  `,
  
  uniforms: {
    time: { value: 0 },
    scanOrigin: { value: { x: 0, y: 0, z: 0 } },
    scanRadius: { value: 50 },
    scanColor: { value: { r: 0.0, g: 1.0, b: 0.5 } },
    scanSpeed: { value: 10 },
    scanWidth: { value: 2 }
  }
};

/**
 * Signal strength visualization shader
 */
export const signalStrengthShader = {
  vertexShader: `
    varying vec2 vUv;
    varying vec3 vPosition;
    
    void main() {
      vUv = uv;
      vPosition = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  
  fragmentShader: `
    uniform float time;
    uniform float signalStrength; // 0.0 to 1.0
    uniform vec3 strongColor;
    uniform vec3 weakColor;
    
    varying vec2 vUv;
    varying vec3 vPosition;
    
    void main() {
      // Create concentric circles representing signal waves
      float dist = length(vUv - vec2(0.5));
      float wave = sin(dist * 20.0 - time * 3.0) * 0.5 + 0.5;
      
      // Modulate wave intensity by signal strength
      wave *= signalStrength;
      
      // Interpolate between weak and strong colors
      vec3 color = mix(weakColor, strongColor, signalStrength);
      
      // Add noise for realistic effect
      float noise = fract(sin(dot(vUv, vec2(12.9898, 78.233))) * 43758.5453);
      wave += noise * 0.1 * (1.0 - signalStrength);
      
      // Create fade out from center
      float centerFade = 1.0 - smoothstep(0.0, 0.5, dist);
      
      gl_FragColor = vec4(color, wave * centerFade);
    }
  `,
  
  uniforms: {
    time: { value: 0 },
    signalStrength: { value: 0.8 },
    strongColor: { value: { r: 0.0, g: 1.0, b: 0.0 } },
    weakColor: { value: { r: 1.0, g: 0.0, b: 0.0 } }
  }
};

/**
 * Holographic material shader for UI elements in 3D space
 */
export const holographicShader = {
  vertexShader: `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    
    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      vViewPosition = -mvPosition.xyz;
      
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  
  fragmentShader: `
    uniform float time;
    uniform vec3 color;
    uniform float scanlineCount;
    uniform float glitchIntensity;
    
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    
    float random(vec2 st) {
      return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
    }
    
    void main() {
      // Scanlines
      float scanline = sin(vUv.y * scanlineCount + time * 2.0) * 0.04;
      
      // Glitch effect
      float glitch = random(vec2(time * 0.00001, vUv.y)) * glitchIntensity;
      vec2 glitchedUv = vUv + vec2(glitch * 0.1, 0.0);
      
      // Holographic edge glow
      vec3 viewDir = normalize(vViewPosition);
      float rim = 1.0 - max(0.0, dot(viewDir, vNormal));
      rim = pow(rim, 2.0);
      
      // Color with effects
      vec3 finalColor = color;
      finalColor += vec3(scanline);
      finalColor += vec3(rim * 0.5);
      
      // Alpha based on viewing angle
      float alpha = 0.8 + rim * 0.2;
      
      gl_FragColor = vec4(finalColor, alpha);
    }
  `,
  
  uniforms: {
    time: { value: 0 },
    color: { value: { r: 0.0, g: 0.8, b: 1.0 } },
    scanlineCount: { value: 100 },
    glitchIntensity: { value: 0.02 }
  }
};

/**
 * Helper function to update shader uniforms
 */
export function updateShaderUniforms(material: THREE.ShaderMaterial, deltaTime: number) {
  if (material.uniforms.time) {
    material.uniforms.time.value += deltaTime;
  }
}

/**
 * Create a shader material from shader definition
 */
export function createShaderMaterial(shaderDef: any, options?: any): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: shaderDef.vertexShader,
    fragmentShader: shaderDef.fragmentShader,
    uniforms: THREE.UniformsUtils.clone(shaderDef.uniforms),
    transparent: true,
    side: THREE.DoubleSide,
    ...options
  });
}

export default {
  energyShieldShader,
  terrainScanShader,
  signalStrengthShader,
  holographicShader,
  updateShaderUniforms,
  createShaderMaterial
};