import { discoveryIdentity } from './unifiedCollection';
export const DECORATIONS = [
 {id:'plain',name:'Charcoal',reputation:0},
 {id:'stars',name:'Starfield',reputation:3},
 {id:'leaves',name:'Garden Glow',reputation:9},
 {id:'orbits',name:'Orbital Rings',reputation:18},
] as const;
export type Decoration = typeof DECORATIONS[number]['id'];
export interface OrderProgress {version:1;cycles:[number,number,number];delivered:Record<string,number>;decoration:Decoration}
export const emptyOrderProgress=():OrderProgress=>({version:1,cycles:[0,0,0],delivered:{},decoration:'plain'});
export const orderReputation=(p:OrderProgress)=>p.cycles.reduce((n,count,i)=>n+count*(i+1),0);
export function validOrderProgress(value:unknown):value is OrderProgress {
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const p=value as OrderProgress;
 if(p.version!==1||!Array.isArray(p.cycles)||p.cycles.length!==3||!p.cycles.every(n=>Number.isSafeInteger(n)&&n>=0&&n<=1_000_000_000))return false;
 if(!p.delivered||typeof p.delivered!=='object'||Array.isArray(p.delivered)||!Object.entries(p.delivered).every(([name,count])=>name.length>0&&name.length<=160&&discoveryIdentity(name)===name&&Number.isSafeInteger(count)&&count>=0))return false;
 return DECORATIONS.some(d=>d.id===p.decoration&&orderReputation(p)>=d.reputation);
}
