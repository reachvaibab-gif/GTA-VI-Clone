/** Shared metre-space placement for the lamp fixture and its actual light source. */
export function lampPlacement(road, index, side) {
  if(!road||!Number.isFinite(road.length)||road.length<=0||![-1,1].includes(side))return null;
  const count=Math.ceil(road.length/16);
  if(!Number.isInteger(index)||index<0||index>=count)return null;
  const t=(index+.5)/count,rx=road.a[0]+(road.b[0]-road.a[0])*t,rz=road.a[1]+(road.b[1]-road.a[1])*t;
  const dx=Math.cos(road.yaw),dz=-Math.sin(road.yaw),off=road.width/2+3.4,yaw=road.yaw-side*Math.PI/2;
  const x=rx+dx*side*off,z=rz+dz*side*off;
  return {id:`${road.id}:${index}:${side}`,x,z,yaw,roadX:rx,roadZ:rz,
    walkX:rx+dx*side*(off-1.1),walkZ:rz+dz*side*(off-1.1),
    lightX:x+Math.sin(yaw)*1.5,lightZ:z+Math.cos(yaw)*1.5};
}
export function buildStreetLights(roads,heightAt,nearestRoad){
  const result=[];
  for(const road of roads){
    if(road.kind!=='urban')continue;
    for(let i=0;i<Math.ceil(road.length/16);i+=4)for(const side of [-1,1]){
      const p=lampPlacement(road,i,side);if(!p)continue;
      const hit=nearestRoad(p.walkX,p.walkZ);
      if(hit&&hit.segment.id!==road.id&&hit.distance<hit.segment.width*.6)continue;
      result.push({...p,y:Math.max(3.1,heightAt(p.roadX,p.roadZ)+.7)+7.4});
    }
  }
  return result;
}
/** A modest retention bias prevents slot churn between two equally close lamp posts. */
export function selectStreetLights(lights,focus,previous=[],count=4,range=140){
  if(!Number.isFinite(focus.x)||!Number.isFinite(focus.z)||count<=0||range<=0)return [];
  const kept=new Set(previous);
  return lights.map(light=>({light,d2:(light.x-focus.x)**2+(light.z-focus.z)**2}))
    .filter(entry=>entry.d2<range*range)
    .sort((a,b)=>a.d2*(kept.has(a.light.id)?.82:1)-b.d2*(kept.has(b.light.id)?.82:1)||a.light.id.localeCompare(b.light.id))
    .slice(0,Math.floor(count)).map(entry=>entry.light);
}
