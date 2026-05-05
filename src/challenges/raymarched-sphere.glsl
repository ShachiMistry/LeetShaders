#version 300 es
precision highp float;

uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_mouse;

out vec4 fragColor;

// Signed Distance Function for a sphere
float sphereSDF(vec3 p, float r) {
    return length(p) - r;
}

// Scene description
float sceneSDF(vec3 p) {
    return sphereSDF(p, 1.0);
}

// Calculate normal using finite difference
vec3 getNormal(vec3 p) {
    const float eps = 0.001;
    return normalize(vec3(
        sceneSDF(vec3(p.x + eps, p.y, p.z)) - sceneSDF(vec3(p.x - eps, p.y, p.z)),
        sceneSDF(vec3(p.x, p.y + eps, p.z)) - sceneSDF(vec3(p.x, p.y - eps, p.z)),
        sceneSDF(vec3(p.x, p.y, p.z + eps)) - sceneSDF(vec3(p.x, p.y, p.z - eps))
    ));
}

void main() {
    // Aspect-ratio corrected UVs
    vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / min(u_resolution.y, u_resolution.x);
    
    // Ray origin and direction
    vec3 ro = vec3(0.0, 0.0, 3.0);
    vec3 rd = normalize(vec3(uv, -1.0));
    
    // Raymarching loop
    float t = 0.0;
    bool hit = false;
    vec3 p;
    
    for (int i = 0; i < 80; i++) {
        p = ro + rd * t;
        float d = sceneSDF(p);
        if (d < 0.001) {
            hit = true;
            break;
        }
        t += d;
        if (t > 10.0) break;
    }
    
    vec3 color = vec3(0.05, 0.05, 0.1); // Background color
    
    if (hit) {
        vec3 n = getNormal(p);
        vec3 lightPos = vec3(2.0, 4.0, 5.0);
        vec3 l = normalize(lightPos - p);
        
        // Simple Diffuse lighting
        float diff = max(dot(n, l), 0.0);
        
        // Soft blue color for the sphere
        color = vec3(0.4, 0.6, 0.9) * (diff + 0.1);
        
        // Specular highlight
        vec3 r = reflect(-l, n);
        vec3 v = normalize(ro - p);
        float spec = pow(max(dot(r, v), 0.0), 32.0);
        color += vec3(1.0) * spec * 0.5;
    }
    
    fragColor = vec4(color, 1.0);
}
