#version 300 es
precision highp float;

uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_mouse;

out vec4 fragColor;

void main() {
    // The goal is to output a solid pale blue color: rgb(135, 206, 235)
    // Normalized to 0.0-1.0 range: vec3(0.53, 0.81, 0.92)
    fragColor = vec4(0.53, 0.81, 0.92, 1.0);
}
