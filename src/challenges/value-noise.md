# Challenge: Static Mist

## Intended Solution
The user must implement a hash function and a 2D value noise function that uses bilinear interpolation.

```glsl
float hash(vec2 p) { ... }
float noise(vec2 p) { ... }
void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    float n = noise(uv * 10.0);
    fragColor = vec4(vec3(n), 1.0);
}
```

## Calibration Notes
- **Tolerance:** `15.0`. Noise is highly sensitive to the specific hash function used. While the visual *texture* might look correct, the exact pixel values will differ if the hash constants are different. This high tolerance allows for different "brands" of noise as long as they are value-noise-like.
- **Blur:** Enabled (`useBlur: true`). Essential to average out high-frequency differences in the noise pattern.
- **MAE Expectations:**
    - Correct value noise (even with different hash): 5.0-12.0 MAE.
    - Pure white noise (no interpolation): High MAE (>20.0), fails.
    - Solid color: Very high MAE, fails.
