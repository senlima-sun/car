// Track surface shader for temperature/wetness visualization

export const trackSurfaceVertexShader = /* glsl */ `
varying vec2 vWorldPos;
varying vec2 vUv;

void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPos = worldPosition.xz;
  vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`

export const trackSurfaceFragmentShader = /* glsl */ `
uniform sampler2D temperatureMap;
uniform vec2 worldBoundsMin;
uniform vec2 worldBoundsMax;
uniform int weatherType; // 0=dry, 1=hot, 2=rain, 3=cold

varying vec2 vWorldPos;
varying vec2 vUv;

void main() {
  // Map world position to texture UV
  vec2 worldRange = worldBoundsMax - worldBoundsMin;
  vec2 uv = (vWorldPos - worldBoundsMin) / worldRange;

  // Clamp UV to valid range
  uv = clamp(uv, 0.0, 1.0);

  // Sample temperature data
  vec4 tempData = texture2D(temperatureMap, uv);
  float temperature = tempData.r;  // Heat from car (0-1)
  float wetness = tempData.g;      // Rain wetness (0-1)

  // Base transparent - only show where there's effect
  vec4 color = vec4(0.0, 0.0, 0.0, 0.0);

  if (weatherType == 3) {
    // Cold weather: show ice/frost where car has NOT driven
    // Only show effect where there's tracked data (temperature > 0 means car was there)
    if (temperature > 0.01) {
      // Car has driven here - show tire tracks (dark through ice)
      vec3 iceColor = vec3(0.7, 0.75, 0.8);         // Light ice tint
      vec3 clearedColor = vec3(0.15, 0.15, 0.17);   // Dark asphalt showing through

      vec3 surfaceColor = mix(iceColor, clearedColor, temperature);
      float effectStrength = 0.3 + temperature * 0.4;
      color = vec4(surfaceColor, effectStrength);
    }
    // Otherwise fully transparent - let the normal track show

  } else if (weatherType == 2) {
    // Rain weather: gray/wet -> dark/dry (car dries the surface)
    vec3 wetColor = vec3(0.3, 0.33, 0.38);       // Gray wet surface
    vec3 dryColor = vec3(0.15, 0.15, 0.17);      // Darker dry asphalt

    // Mix based on wetness (higher wetness = more wet = grayer)
    vec3 surfaceColor = mix(dryColor, wetColor, wetness);

    // Show wet areas with some transparency
    float effectStrength = wetness * 0.5 + temperature * 0.2;
    color = vec4(surfaceColor, effectStrength * 0.7);

  } else if (weatherType == 1) {
    // Hot weather: dark rubber marks with warm tint
    vec3 normalColor = vec3(0.2, 0.2, 0.2);      // Normal road
    vec3 hotColor = vec3(0.08, 0.06, 0.05);      // Dark with warm tint

    vec3 surfaceColor = mix(normalColor, hotColor, temperature);

    // Strong visibility for hot weather skids
    float effectStrength = temperature * 0.65;
    color = vec4(surfaceColor, effectStrength);

  } else {
    // Dry weather: dark rubber skid marks
    vec3 normalColor = vec3(0.2, 0.2, 0.2);
    vec3 markColor = vec3(0.05, 0.05, 0.05);     // Dark black rubber marks

    vec3 surfaceColor = mix(normalColor, markColor, temperature);

    // Stronger visibility for skid marks
    float effectStrength = temperature * 0.7;
    color = vec4(surfaceColor, effectStrength);
  }

  gl_FragColor = color;
}
`

// Weather type enum for shader uniform
export const WEATHER_TYPE_MAP = {
  dry: 0,
  hot: 1,
  rain: 2,
  cold: 3,
} as const

export type ShaderWeatherType = keyof typeof WEATHER_TYPE_MAP
