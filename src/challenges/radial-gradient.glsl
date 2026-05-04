#version 300 es
precision highp float;

uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_mouse;

out vec4 fragColor;

void main() {
    // Center-adjusted UVs
    vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / min(u_resolution.y, u_resolution.x);
    
    // Distance from center
    float dist = length(uv);
    
    // Radial gradient: white in center, fading to dark purple at edges
    // Color A: vec3(1.0, 1.0, 1.0) - White
    // Color B: vec3(0.2, 0.0, 0.4) - Dark Purple
    vec3 color = mix(vec3(1.0), vec3(0.2, 0.0, 0.4), smoothstep(0.0, 1.2, dist));
    
    fragColor = vec4(color, 1.0);
}
