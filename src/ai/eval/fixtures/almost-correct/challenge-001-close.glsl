#version 300 es
precision highp float;

out vec4 fragColor;

// Marginal: the red channel is slightly below 1.0, producing a subtly
// darker magenta. Should score high but not 100; whether that counts as
// pass or fail is exactly the band-logic judgment call we're calibrating.
void main() {
    fragColor = vec4(0.96, 0.02, 1.0, 1.0);
}
