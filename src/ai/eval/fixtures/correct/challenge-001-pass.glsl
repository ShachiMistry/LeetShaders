#version 300 es
precision highp float;

out vec4 fragColor;

// Identical to the reference. Should score near 100 and not be flagged.
void main() {
    fragColor = vec4(1.0, 0.0, 1.0, 1.0);
}
