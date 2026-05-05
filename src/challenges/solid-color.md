# Challenge: Sky Blue

## Intended Solution
The user should assign a `vec4` to the output `fragColor`. The RGB values for "Sky Blue" (135, 206, 235) must be normalized to the `[0, 1]` range.

```glsl
fragColor = vec4(135.0/255.0, 206.0/255.0, 235.0/255.0, 1.0);
// or roughly
fragColor = vec4(0.53, 0.81, 0.92, 1.0);
```

## Calibration Notes
- **Tolerance:** Set to `5.0`. This is tight because it's a solid color challenge. Any significant deviation in color should be caught easily by MAE.
- **Blur:** Not needed (`useBlur: false`) as there are no edges or gradients.
- **MAE Expectations:** 
    - Perfect match: 0.0 MAE -> 100 Score.
    - Slight shift (e.g. `0.54` instead of `0.53`): ~0.003 MAE -> ~94 Score.
    - Wrong color (e.g. solid white): ~0.3 MAE -> 0 Score.
