import * as T from 'three';
/** Rigid environment materials repeat in world metres, not once across an entire building or road. */
export function worldUV(material:T.MeshStandardMaterial,metresPerTile:number){
  if(!Number.isFinite(metresPerTile)||metresPerTile<=0)throw new Error('Invalid material scale');
  const vary='varying vec3 vMetricPosition;\nvarying vec3 vMetricNormal;\n';
  material.onBeforeCompile=shader=>{
    shader.uniforms.metricTileSize={value:metresPerTile};
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\n'+vary)
      .replace('#include <project_vertex>',`#include <project_vertex>
      vec4 metricPosition = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        metricPosition = instanceMatrix * metricPosition;
      #endif
      vMetricPosition = (modelMatrix * metricPosition).xyz;
      vMetricNormal = inverseTransformDirection(transformedNormal, viewMatrix);`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
      ${vary}
      uniform float metricTileSize;
      vec2 metricUV(){
        vec3 n = abs(normalize(vMetricNormal));
        vec2 uv = n.y > max(n.x,n.z) ? vMetricPosition.xz : (n.x > n.z ? vMetricPosition.zy : vMetricPosition.xy);
        return uv / metricTileSize;
      }`);
    const chunks=['map_fragment','roughnessmap_fragment','normal_fragment_begin','normal_fragment_maps'] as const;
    for(const name of chunks){
      const code=T.ShaderChunk[name].replaceAll('vMapUv','metricUV()').replaceAll('vRoughnessMapUv','metricUV()').replaceAll('vNormalMapUv','metricUV()');
      shader.fragmentShader=shader.fragmentShader.replace(`#include <${name}>`,code);
    }
  };
  material.customProgramCacheKey=()=>`metric-r180-${metresPerTile}`;
  return material;
}
