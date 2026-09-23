import type {RoadSegment} from './layout.mjs';
export interface LampPlacement {id:string;x:number;z:number;yaw:number;roadX:number;roadZ:number;walkX:number;walkZ:number;lightX:number;lightZ:number}
export interface StreetLight extends LampPlacement {y:number}
export function lampPlacement(road:RoadSegment,index:number,side:number):LampPlacement|null;
export function buildStreetLights(roads:RoadSegment[],heightAt:(x:number,z:number)=>number,nearestRoad:(x:number,z:number)=>{segment:RoadSegment;distance:number}|null):StreetLight[];
export function selectStreetLights(lights:StreetLight[],focus:{x:number;z:number},previous?:string[],count?:number,range?:number):StreetLight[];
