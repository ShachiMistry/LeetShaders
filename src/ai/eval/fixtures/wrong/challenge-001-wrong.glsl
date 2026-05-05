#version 300 es
precision highp float;

out vec4 fragColor;

// Returns solid green instead of magenta. Should score low and NOT be
// flagged (it's wrong, not cheating).
void main() {
    fragColor = vec4(0.0, 1.0, 0.0, 1.0);
}
