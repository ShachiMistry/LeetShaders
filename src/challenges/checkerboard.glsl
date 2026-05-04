#version 300 es
precision highp float;

uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_mouse;

out vec4 fragColor;

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    
    // Create 8x8 grid
    vec2 grid = floor(uv * 8.0);
    
    // If the sum of coordinates is even, it's one color, otherwise another
    float check = mod(grid.x + grid.y, 2.0);
    
    // 0.0 (black) or 1.0 (white)
    vec3 color = vec3(check);
    
    fragColor = vec4(color, 1.0);
}
