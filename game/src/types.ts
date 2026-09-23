export interface Landmark { id:string;name:string;region:string;district:string;x:number;z:number;tags:string;reference:string;confidence:string }
export interface Region { name:string;x:number;z:number;count:number }
export interface WorldData { version:number;landmarks:Landmark[];regions:Region[];bounds:{minX:number;maxX:number;minZ:number;maxZ:number};geometryStatus:string;attribution:string }
export interface AssetData { characters:string[];textures:Record<string,Record<string,string>> }
export interface Settings { quality:'low'|'balanced'|'high';audio:boolean;traffic:boolean;time:number;sensitivity:number }
export interface ActorState { x:number;y:number;z:number;yaw:number;speed:number;driving:boolean;health:number;grounded:boolean }
export const DEFAULT_SETTINGS:Settings={quality:'balanced',audio:true,traffic:true,time:17.2,sensitivity:1};
