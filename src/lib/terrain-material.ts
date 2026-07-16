// TODO(M5): 评估是否替换 cobe-globe-weather.tsx 的内联 globe shader。
// 当前已实现完整 ShaderMaterial（biome 分带、卫星外观、地形位移、夜面城市灯光、大气边缘），
// 但未被任何组件导入。M5 高级记忆与分享阶段评估接入或替换内联实现。
import * as THREE from "three"

export type TerrainStyle = "atlas-q" | "satellite"

/**
 * Premium globe terrain:
 * - atlas-q: refined cartographic / soft 3D Q look with biome bands + ridge shading
 * - satellite: photoreal base maps with clearer local contrast & terrain relief
 */
export function createTerrainMaterial(options: {
  colorMap: THREE.Texture
  normalMap: THREE.Texture
  specularMap: THREE.Texture
  lightsMap: THREE.Texture
  style: TerrainStyle
  highResMap?: THREE.Texture | null
}) {
  const { colorMap, normalMap, specularMap, lightsMap, style, highResMap } = options

  const uniforms = {
    uColorMap: { value: colorMap },
    uHighResMap: { value: highResMap || colorMap },
    uNormalMap: { value: normalMap },
    uSpecularMap: { value: specularMap },
    uLightsMap: { value: lightsMap },
    uUseHighRes: { value: 0 },
    uStyle: { value: style === "satellite" ? 1 : 0 },
    uRelief: { value: 0.45 },
    uDetail: { value: 0.0 },
    uSunDir: { value: new THREE.Vector3(-0.55, 0.35, 0.65).normalize() },
    uTime: { value: 0 },
  }

  const material = new THREE.ShaderMaterial({
    uniforms,
    lights: false,
    transparent: false,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vNormalW;
      varying vec3 vPosW;
      varying vec3 vPosL;

      uniform sampler2D uSpecularMap;
      uniform float uRelief;
      uniform float uDetail;

      void main() {
        vUv = uv;
        // Soft height from specular/ocean mask (land brighter relief)
        float heightSample = texture2D(uSpecularMap, uv).r;
        float land = 1.0 - smoothstep(0.15, 0.55, heightSample);
        float elev = land * (0.012 + uRelief * 0.028 + uDetail * 0.02);
        vec3 displaced = position + normal * elev;
        vec4 world = modelMatrix * vec4(displaced, 1.0);
        vPosW = world.xyz;
        vPosL = normalize(displaced);
        vNormalW = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vNormalW;
      varying vec3 vPosW;
      varying vec3 vPosL;

      uniform sampler2D uColorMap;
      uniform sampler2D uHighResMap;
      uniform sampler2D uNormalMap;
      uniform sampler2D uSpecularMap;
      uniform sampler2D uLightsMap;
      uniform float uUseHighRes;
      uniform float uStyle;
      uniform float uRelief;
      uniform float uDetail;
      uniform vec3 uSunDir;
      uniform float uTime;

      vec3 atlasBiome(vec3 base, float lat, float land, float elevHint, float moisture) {
        // Soft Q-cartography palette by latitude bands
        vec3 polar = vec3(0.93, 0.96, 0.98);
        vec3 tundra = vec3(0.62, 0.74, 0.68);
        vec3 forest = vec3(0.28, 0.58, 0.42);
        vec3 grass = vec3(0.55, 0.72, 0.38);
        vec3 desert = vec3(0.86, 0.72, 0.48);
        vec3 rock = vec3(0.55, 0.50, 0.46);
        vec3 tropic = vec3(0.18, 0.52, 0.36);
        vec3 oceanDeep = vec3(0.06, 0.22, 0.34);
        vec3 oceanShallow = vec3(0.12, 0.48, 0.58);

        float absLat = abs(lat);
        vec3 landCol = mix(tropic, forest, smoothstep(0.05, 0.35, absLat));
        landCol = mix(landCol, grass, smoothstep(0.25, 0.5, absLat) * (1.0 - elevHint));
        landCol = mix(landCol, desert, smoothstep(0.12, 0.42, absLat) * (1.0 - moisture) * 0.85);
        landCol = mix(landCol, tundra, smoothstep(0.55, 0.72, absLat));
        landCol = mix(landCol, polar, smoothstep(0.7, 0.88, absLat));
        landCol = mix(landCol, rock, elevHint * 0.55);
        landCol = mix(landCol, polar, elevHint * elevHint * 0.65);

        // Blend photographic base for identity, then recolor softly
        vec3 photo = mix(base, landCol, 0.72);
        photo = mix(photo, landCol * 1.05, 0.28 + uDetail * 0.2);

        vec3 water = mix(oceanDeep, oceanShallow, smoothstep(0.35, 0.7, base.b));
        // Gentle stylized wave sheen
        float sheen = pow(max(dot(normalize(vNormalW), normalize(uSunDir + vec3(0.0, 0.2, 0.1))), 0.0), 28.0);
        water += vec3(0.25, 0.45, 0.5) * sheen * 0.35;

        return mix(water, photo, land);
      }

      vec3 satelliteLook(vec3 base, float land, float nDotL, float elevHint) {
        // Cleaner satellite: lift midtones, punch vegetation/desert, crisp relief
        vec3 col = pow(base, vec3(0.92));
        col = mix(col, col * vec3(0.95, 1.06, 0.95), land * 0.25);
        col *= 0.55 + nDotL * 0.65;
        // Ridge darken / peak lighten
        col *= 1.0 - elevHint * 0.18;
        col += vec3(0.08, 0.07, 0.05) * elevHint * elevHint;
        // Ocean clarity
        vec3 ocean = mix(vec3(0.04, 0.16, 0.28), vec3(0.1, 0.42, 0.52), base.b);
        float oceanSpec = pow(max(nDotL, 0.0), 40.0) * (1.0 - land);
        ocean += vec3(0.4, 0.55, 0.6) * oceanSpec;
        return mix(ocean, col, land);
      }

      void main() {
        vec3 low = texture2D(uColorMap, vUv).rgb;
        vec3 high = texture2D(uHighResMap, vUv).rgb;
        vec3 base = mix(low, high, clamp(uUseHighRes, 0.0, 1.0));
        vec3 nTex = texture2D(uNormalMap, vUv).xyz * 2.0 - 1.0;
        float spec = texture2D(uSpecularMap, vUv).r;
        float lights = texture2D(uLightsMap, vUv).r;
        float land = 1.0 - smoothstep(0.18, 0.52, spec);

        // Terrain normal blend
        vec3 N = normalize(vNormalW);
        N = normalize(N + nTex * (0.35 + uRelief * 0.55 + uDetail * 0.45));
        float nDotL = max(dot(N, normalize(uSunDir)), 0.0);
        float wrap = nDotL * 0.7 + 0.3;

        float lat = asin(clamp(vPosL.y, -1.0, 1.0)); // radians
        float elevHint = land * (length(nTex.xy) * 0.65 + (1.0 - spec) * 0.35);
        float moisture = clamp(base.g - base.r * 0.35 + 0.25, 0.0, 1.0);

        vec3 atlas = atlasBiome(base, lat, land, elevHint, moisture);
        vec3 sat = satelliteLook(base, land, wrap, elevHint);
        vec3 color = mix(atlas, sat, clamp(uStyle, 0.0, 1.0));

        // Soft ambient + key light
        color *= mix(0.72, 1.18, wrap);
        // Night city lights only on dark limb
        float night = smoothstep(0.35, -0.05, nDotL);
        color += vec3(1.0, 0.85, 0.55) * lights * night * 0.55 * land;

        // Detail sharpening when zoomed
        color = mix(color, color * color * 1.15, uDetail * 0.18);

        // Gentle rim (atmosphere contact)
        float rim = pow(1.0 - max(dot(N, normalize(cameraPosition - vPosW)), 0.0), 2.8);
        color += vec3(0.25, 0.55, 0.65) * rim * 0.2;

        gl_FragColor = vec4(color, 1.0);
      }
    `,
  })

  return { material, uniforms }
}

export function setTerrainLevel(
  uniforms: ReturnType<typeof createTerrainMaterial>["uniforms"],
  level: "world" | "continent" | "country" | "region",
  highResReady: boolean,
) {
  const detail =
    level === "world" ? 0 :
    level === "continent" ? 0.45 :
    level === "country" ? 0.75 :
    0.95
  const relief =
    level === "world" ? 0.4 :
    level === "continent" ? 0.7 :
    level === "country" ? 0.95 :
    1.15
  uniforms.uDetail.value = detail
  uniforms.uRelief.value = relief
  uniforms.uUseHighRes.value = level === "world" || !highResReady ? 0 : 1
}
