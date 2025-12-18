// Thermal view shaders for car components (tires, engine)
// Unified Celsius-based temperature-to-color mapping
// Uses absolute Celsius values for consistent visualization

export const thermalVertexShader = /* glsl */ `
varying vec2 vUv;
varying vec3 vNormal;

void main() {
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

export const thermalFragmentShader = /* glsl */ `
uniform float temperature;  // 0.0 to 1.0 normalized temperature
uniform float tempMin;      // Minimum temp in Celsius (e.g., 20.0 for tires)
uniform float tempRange;    // Temperature range in Celsius (e.g., 130.0 for tires)

varying vec2 vUv;
varying vec3 vNormal;

// Unified Celsius-to-color function (same breakpoints as TypeScript utility)
vec3 celsiusToColor(float celsius) {
  const float VERY_COLD = 10.0;
  const float COLD = 30.0;
  const float MODERATE = 60.0;
  const float WARM = 90.0;

  vec3 deepCold = vec3(0.102, 0.200, 0.600);   // #1a3399
  vec3 cold = vec3(0.200, 0.502, 0.902);       // #3380e6
  vec3 moderate = vec3(0.200, 0.800, 0.302);   // #33cc4d
  vec3 warm = vec3(1.0, 0.600, 0.102);         // #ff991a
  vec3 hot = vec3(1.0, 0.149, 0.102);          // #ff261a

  if (celsius < VERY_COLD) {
    return deepCold;
  } else if (celsius < COLD) {
    float t = (celsius - VERY_COLD) / (COLD - VERY_COLD);
    return mix(deepCold, cold, t);
  } else if (celsius < MODERATE) {
    float t = (celsius - COLD) / (MODERATE - COLD);
    return mix(cold, moderate, t);
  } else if (celsius < WARM) {
    float t = (celsius - MODERATE) / (WARM - MODERATE);
    return mix(moderate, warm, t);
  } else {
    float t = min((celsius - WARM) / 30.0, 1.0);
    return mix(warm, hot, t);
  }
}

void main() {
  // Convert normalized temperature to Celsius
  float celsius = temperature * tempRange + tempMin;
  vec3 baseColor = celsiusToColor(celsius);

  // Add subtle lighting based on normal
  float lighting = 0.7 + 0.3 * dot(vNormal, normalize(vec3(0.5, 1.0, 0.5)));

  // Add glow effect for hot temperatures (above 90C)
  float glow = celsius > 90.0 ? (celsius - 90.0) / 60.0 * 0.5 : 0.0;

  vec3 finalColor = baseColor * lighting + vec3(glow, 0.0, 0.0);

  gl_FragColor = vec4(finalColor, 1.0);
}
`

// Engine thermal shader - uses same Celsius-based color system
export const engineThermalFragmentShader = /* glsl */ `
uniform float temperature;  // 0.0 to 1.0 normalized temperature
uniform float tempMin;      // Minimum temp in Celsius (20.0 for engine)
uniform float tempRange;    // Temperature range in Celsius (100.0 for engine)

varying vec2 vUv;
varying vec3 vNormal;

// Unified Celsius-to-color function (same as tire shader)
vec3 celsiusToColor(float celsius) {
  const float VERY_COLD = 10.0;
  const float COLD = 30.0;
  const float MODERATE = 60.0;
  const float WARM = 90.0;

  vec3 deepCold = vec3(0.102, 0.200, 0.600);   // #1a3399
  vec3 cold = vec3(0.200, 0.502, 0.902);       // #3380e6
  vec3 moderate = vec3(0.200, 0.800, 0.302);   // #33cc4d
  vec3 warm = vec3(1.0, 0.600, 0.102);         // #ff991a
  vec3 hot = vec3(1.0, 0.149, 0.102);          // #ff261a

  if (celsius < VERY_COLD) {
    return deepCold;
  } else if (celsius < COLD) {
    float t = (celsius - VERY_COLD) / (COLD - VERY_COLD);
    return mix(deepCold, cold, t);
  } else if (celsius < MODERATE) {
    float t = (celsius - COLD) / (MODERATE - COLD);
    return mix(cold, moderate, t);
  } else if (celsius < WARM) {
    float t = (celsius - MODERATE) / (WARM - MODERATE);
    return mix(moderate, warm, t);
  } else {
    float t = min((celsius - WARM) / 30.0, 1.0);
    return mix(warm, hot, t);
  }
}

void main() {
  // Convert normalized temperature to Celsius
  float celsius = temperature * tempRange + tempMin;
  vec3 baseColor = celsiusToColor(celsius);

  float lighting = 0.6 + 0.4 * dot(vNormal, normalize(vec3(0.3, 1.0, 0.3)));

  // Stronger glow for overheating engine (above 90C)
  float glow = celsius > 90.0 ? (celsius - 90.0) / 30.0 * 0.8 : 0.0;

  vec3 finalColor = baseColor * lighting;
  finalColor.r += glow;
  finalColor.g += glow * 0.3; // Slight orange tint

  gl_FragColor = vec4(finalColor, 1.0);
}
`

// Temperature conversion constants for shader uniforms
export const TEMP_SCALES = {
  tire: {
    min: 20.0, // Minimum tire temp in Celsius
    range: 130.0, // 20C to 150C
  },
  engine: {
    min: 20.0, // Minimum engine temp in Celsius
    range: 100.0, // 20C to 120C
  },
} as const
