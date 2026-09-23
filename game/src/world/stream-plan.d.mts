import type { ChunkRequest } from './layout.mjs';
export function planStreaming(loaded:Map<string,{detail:boolean}>,needed:ChunkRequest[],detail:boolean):{remove:string[];pending:ChunkRequest[]};
