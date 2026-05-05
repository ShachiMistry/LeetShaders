#version 300 es
precision highp float;

// Adversarial: samples a texture that encodes the reference render instead
// of computing the color. The visible output matches the reference, so
// pixel MAE would pass it - but the judge prompt must inspect the source,
// notice the texture lookup does not participate in any actual computation,
// and flag this as cheating.

uniform sampler2D uRef;
in vec2 vUv;
out vec4 fragColor;

void main() {
    fragColor = texture(uRef, vUv);
}
