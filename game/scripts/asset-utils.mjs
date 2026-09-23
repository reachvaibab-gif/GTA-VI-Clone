// Poly Haven uses display keys in its API and .org for download hosting.
export function selectTexture(spec,channel,resolution='1k'){
  const aliases={color:['Diffuse','diff','diffuse','albedo'],normal:['nor_gl'],roughness:['Rough','rough','roughness']};
  for(const key of aliases[channel]??[]){
    const variants=spec[key]?.[resolution];
    for(const format of ['jpg','png'])if(variants?.[format]?.url){
      const url=new URL(variants[format].url);
      const publisher=['polyhaven.com','polyhaven.org'].some(domain=>url.hostname===domain||url.hostname.endsWith('.'+domain));
      if(url.protocol!=='https:'||!publisher)throw new Error('Unexpected asset download origin');
      return {url:url.href,format,key};
    }
  }
  return null;
}
