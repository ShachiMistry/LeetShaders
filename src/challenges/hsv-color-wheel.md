# Spectrum Ring

## Objective

Render a circular HSV color wheel using polar coordinates and a hand-written HSV → RGB conversion.

## Specification

- Canvas is in normalized **[-1, 1]** space on both axes
- **Hue** → angle around center, mapped to [0, 1]
- **Saturation** → distance from center (0 at center, 1 at edge)
- **Value** → always `1.0`
- Hard clip at **radius 0.9** — outside is black

## Key Concepts

### Polar Coordinates

```glsl
float radius = length(uv);
float angle  = atan(uv.y, uv.x);  // returns [-PI, PI]
float hue    = angle / (2.0 * PI) + 0.5;  // remap to [0, 1]
```

### HSV → RGB Conversion

The compact single-expression form used in GLSL:

```glsl
vec3 hsv2rgb(float h, float s, float v) {
  vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  return v * mix(vec3(1.0), rgb, s);
}
```

`h * 6.0` maps hue to a 0–6 range. Each integer step is a primary or secondary color. The `mod` and `abs` create the triangular interpolation waveform across all three channels simultaneously.

### Clipping

```glsl
float mask = step(radius, 0.9);  // 1.0 inside, 0.0 outside
fragColor = vec4(col * mask, 1.0);
```
