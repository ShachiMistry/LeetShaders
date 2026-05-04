# Challenge: Grandmaster's Grid

## Intended Solution
The user should scale the UV coordinates to the `[0, 8]` range, use `floor` to create discrete cells, and then use the `mod` of the sum of coordinates to alternate between 0 and 1.

```glsl
vec2 uv = gl_FragCoord.xy / u_resolution.xy;
vec2 grid = floor(uv * 8.0);
float check = mod(grid.x + grid.y, 2.0);
fragColor = vec4(vec3(check), 1.0);
```

## Calibration Notes
- **Tolerance:** `4.0`. This is a sharp pattern challenge. Small offsets in the grid size or alignment will result in very high MAE because pixels at the boundaries will flip from black to white.
- **Blur:** Disabled (`useBlur: false`). We want to enforce clean, sharp grid lines.
- **MAE Expectations:**
    - Correct 8x8 grid: 0.0 MAE.
    - 7x7 or 9x9 grid: Very high MAE, fails.
    - Inverted colors (white bottom-left): 100% MAE (0 score).
