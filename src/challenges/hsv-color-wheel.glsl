#version 300 es
precision highp float;
uniform vec2 u_resolution;
out vec4 fragColor;

const float PI = 3.14159265358979;

// HSV to RGB — compact single-expression form
vec3 hsv2rgb(float h, float s, float v) {
  vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  return v * mix(vec3(1.0), rgb, s);
}

void main() {
  vec2 uv = (gl_FragCoord.xy / u_resolution) * 2.0 - 1.0;

  float radius = length(uv);
  float angle  = atan(uv.y, uv.x);

  // Hue from angle (0..1), saturation from radius, full brightness
  float hue = angle / (2.0 * PI) + 0.5;
  vec3  col = hsv2rgb(hue, radius, 1.0);

  // Hard clip at radius 0.9 — outside is black
  float mask = step(radius, 0.9);

  fragColor = vec4(col * mask, 1.0);
}
