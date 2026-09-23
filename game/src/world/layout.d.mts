export type Point = [number, number];
export interface Road { name:string; width:number; points:Point[]; kind:string }
export interface RoadSegment extends Road { id:string; a:Point; b:Point; length:number; yaw:number }
export interface RoadHit {x:number; z:number; t:number; distance:number; segment:RoadSegment}
export interface ChunkRequest {key:string;x:number;z:number;priority:number}
export const CHUNK_SIZE:number;
export const SPAWN:Readonly<{x:number;z:number;yaw:number}>;
export const WORLD_BOUNDS:Readonly<{minX:number;maxX:number;minZ:number;maxZ:number}>;
export const LAND:Point[][];
export const ROADS:Road[];
export const SEGMENTS:RoadSegment[];
export function nearestRoad(x:number,z:number):RoadHit|null;
export function isLand(x:number,z:number):boolean;
export function terrainHeight(x:number,z:number):number;
export function surfaceHeight(x:number,z:number):number;
export function districtAt(x:number,z:number):string;
export function chunkKey(x:number,z:number):string;
export function wantedChunks(x:number,z:number,radius:number):ChunkRequest[];
export function clampToWorld(x:number,z:number):{x:number;z:number};
