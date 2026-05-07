# The Rectangle Theorem

## Objective

Render a centered white rounded rectangle on a black background using a Signed Distance Function (SDF).

## Specification

- Canvas is in normalized **[-1, 1]** space on both axes
- Box **half-extents**: `(0.5, 0.3)`
- **Corner radius**: `0.08`
- Fill: **white** inside, **black** outside
- Edges must be **anti-aliased** using `smoothstep`

## Key Concepts

### Box SDF

The signed distance to an axis-aligned box centered at the origin:

```glsl
vec2 d = abs(p) - halfExtents;
float dist = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
```

- `d.x, d.y < 0` → inside the box (negative distance)
- One component positive → on a face
- Both components positive → near a corner

### Rounded Corners

Inset the box by the corner radius, apply the SDF, then subtract the radius:

```glsl
vec2 d = abs(p) - halfExtents + cornerRadius;
float dist = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - cornerRadius;
```

### Anti-aliasing

```glsl
float shape = smoothstep(0.005, -0.005, dist);
```
