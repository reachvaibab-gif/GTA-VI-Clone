// Poly Haven API display keys differ from its lowercase filename suffixes.
export function selectTexture(spec, channel, resolution='1k') {
  const aliases={color:['Diffuse','diff','diffuse','albedo'],normal:['nor_gl'],roughness:['Rough','rough','roughness']};
  for(const key of aliases[channel]??[]){
    const variants=spec[key]?.[resolution];
    for(const format of ['jpg','png'])if(variants?.[format]?.url){
      const url=new URL(variants[format].url);
      if(url.protocol!=='https:'||!(url.hostname==='polyhaven.com'||url.hostname.endsWith('.polyhaven.com')))throw new Error('Unexpected asset download origin');
      return {url:url.href,format,key};
    }
  }
  return null;
}
