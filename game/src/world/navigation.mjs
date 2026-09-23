import { SEGMENTS } from './layout.mjs';
import { buildRoadGraph as buildGraph, nearestNode as findNode, routeBetween as findRoute } from './road-graph.mjs';
export { splitRoadSegments, projectToSegment, nearestEdge } from './road-graph.mjs';

export function buildRoadGraph(segments = SEGMENTS) { return buildGraph(segments); }
export const ROAD_GRAPH = buildRoadGraph();
export function nearestNode(x, z, nodes = ROAD_GRAPH) { return findNode(x, z, nodes); }
export function routeBetween(start, end, nodes = ROAD_GRAPH) { return findRoute(start, end, nodes); }
