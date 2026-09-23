import type { RoadSegment } from '../world/layout.mjs';
export interface DirectedRoad { segment:number; direction:number }
export interface TrafficNetwork { segments:RoadSegment[]; junctions:Map<string,DirectedRoad[]> }
export interface TrafficGuidance { x:number;z:number;remaining:number;targetSpeed:number;advance:boolean }
export function createTrafficNetwork(source:RoadSegment[]):TrafficNetwork;
export function lanePoint(road:RoadSegment,t:number,direction:number):{x:number;z:number};
export function outgoingRoads(network:TrafficNetwork,route:DirectedRoad):DirectedRoad[];
export function chooseNextRoad(network:TrafficNetwork,route:DirectedRoad,random:number):DirectedRoad|null;
export function trafficGuidance(network:TrafficNetwork,route:DirectedRoad,next:DirectedRoad|null,position:{x:number;z:number},speed:number):TrafficGuidance|null;
export function followControls(speed:number,targetSpeed:number,headingError:number):{throttle:number;steering:number;handbrake:boolean};
