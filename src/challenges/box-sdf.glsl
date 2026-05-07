#version 300 es
precision highp float;
uniform vec2 u_resolution;
out vec4 fragColor;

// Rounded box SDF. p = point, b = half-extents, r = corner radius.
float sdRoundedBox(vec2 p, vec2 b, float r) {
  vec2 d = abs(p) - b + r;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r;
}

void main() {
  // Remap to [-1, 1] in both axes
  vec2 uv = (gl_FragCoord.xy / u_resolution) * 2.0 - 1.0;

  float d = sdRoundedBox(uv, vec2(0.5, 0.3), 0.08);

  // Smooth anti-aliased edge
  float box = smoothstep(0.005, -0.005, d);

  fragColor = vec4(vec3(box), 1.0);
}
