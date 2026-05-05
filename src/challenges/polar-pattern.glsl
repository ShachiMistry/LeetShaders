#version 300 es
precision highp float;

uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_mouse;

out vec4 fragColor;

void main() {
    vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / min(u_resolution.y, u_resolution.x);
    
    // Polar coordinates
    float r = length(uv);
    float a = atan(uv.y, uv.x);
    
    // 6-petaled flower pattern
    // The radius of the boundary varies with the angle
    float f = abs(cos(a * 3.0));
    
    // Step function to create a sharp edge
    float mask = step(r, f * 0.8);
    
    // Magenta color for the flower
    vec3 color = mask * vec3(1.0, 0.0, 1.0);
    
    fragColor = vec4(color, 1.0);
}
