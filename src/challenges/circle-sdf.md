# Challenge: Zen Dot

## Intended Solution
The user should center the UV coordinates, use `length(uv)` to calculate distance from center, and use `smoothstep` to create a filled circle.

```glsl
vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / min(u_resolution.y, u_resolution.x);
float d = length(uv) - 0.5;
float mask = 1.0 - smoothstep(-0.01, 0.01, d);
fragColor = vec4(vec3(mask), 1.0);
```

## Calibration Notes
- **Tolerance:** `10.0`. SDFs and `smoothstep` can vary slightly across different hardware and precision settings. A higher tolerance avoids false-fails on visually correct circles.
- **Blur:** Enabled (`useBlur: true`). This is vital for SDF challenges to smooth out sub-pixel differences in the edge anti-aliasing.
- **MAE Expectations:**
    - Correct radius/centering: 0.0-3.0 MAE.
    - Ellipse instead of circle (not correcting aspect ratio): High MAE (~10-15), should fail.
    - Wrong radius: High MAE, should fail.
