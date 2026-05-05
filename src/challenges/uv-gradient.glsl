#version 300 es
precision highp float;

uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_mouse;

out vec4 fragColor;

void main() {
    // Standard UV mapping: 0.0 to 1.0 across the canvas
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    
    // Linear gradient from left (black) to right (cyan)
    // Red channel is 0, Green and Blue are mapped to x-coordinate
    vec3 color = vec3(0.0, uv.x, uv.x);
    
    fragColor = vec4(color, 1.0);
}
