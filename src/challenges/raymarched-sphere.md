# Challenge: Orbital Geometry

## Intended Solution
The user must implement a raymarching loop that iterates along the ray direction until it hits the sphere surface (defined by a distance less than a small epsilon). They must also calculate surface normals to implement lighting.

```glsl
float sceneSDF(vec3 p) { return length(p) - 1.0; }
vec3 getNormal(vec3 p) { ... }
void main() {
    // ... camera setup ...
    // ... raymarching loop ...
    // ... lighting ...
}
```

## Calibration Notes
- **Tolerance:** `20.0`. Raymarching implementations can vary widely in lighting models, camera FOV, and iteration counts. A generous tolerance is necessary to allow for different but visually correct 3D shading.
- **Blur:** Enabled (`useBlur: true`). Very important to smooth out any aliasing at the sphere's silhouette.
- **MAE Expectations:**
    - Correct 3D sphere with shading: 0.0-8.0 MAE.
    - Flat 2D circle: High MAE (~25+), fails.
    - Missing highlight or wrong light position: Borderline (15.0-20.0 MAE), depending on the visual delta.
