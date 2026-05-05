# Challenge: Cosmic Core

## Intended Solution
The user should center the UVs, calculate distance from center, and use `mix` to interpolate between white and deep purple.

```glsl
vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / min(u_resolution.y, u_resolution.x);
float dist = length(uv);
vec3 color = mix(vec3(1.0), vec3(0.2, 0.0, 0.4), smoothstep(0.0, 1.2, dist));
fragColor = vec4(color, 1.0);
```

## Calibration Notes
- **Tolerance:** `10.0`. Radial gradients are visually smooth, so small variations in the `smoothstep` bounds (`1.2` vs `1.0`) shouldn't cause immediate failure but should be penalized.
- **Blur:** Enabled (`useBlur: true`) to ensure hardware-level precision differences don't affect the score.
- **MAE Expectations:**
    - Correct centering and colors: 0.0-3.0 MAE.
    - Elliptical gradient (no aspect ratio fix): High MAE (~10-12), borderline or fail.
    - Linear instead of radial: Very high MAE, fail.
