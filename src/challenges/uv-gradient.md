# Challenge: Cyan Horizon

## Intended Solution
The user must derive UV coordinates from `gl_FragCoord` and `u_resolution`. The horizontal gradient uses the `uv.x` component to drive the green and blue channels.

```glsl
vec2 uv = gl_FragCoord.xy / u_resolution.xy;
fragColor = vec4(0.0, uv.x, uv.x, 1.0);
```

## Calibration Notes
- **Tolerance:** `8.0`. Gradients are more forgiving than solid colors due to interpolation.
- **Blur:** Enabled (`useBlur: true`). This helps stabilize scores for gradients which can vary slightly depending on precision and resolution.
- **MAE Expectations:**
    - Correct logic: 0.0-2.0 MAE.
    - Swapping axes (vertical instead of horizontal): High MAE (>15.0), should fail.
    - Wrong color (e.g. black to red): High MAE, should fail.
