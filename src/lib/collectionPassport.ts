/** Pure collection progress; all stamps are derived from the existing save. */
import { ALBUM_SETS, availableVariants } from './collectorData';
import { discoveryIdentity } from './unifiedCollection';
import type { InfiniteElement } from './infiniteCraftData';

export type PassportMedal = 'Unstarted'|'Bronze'|'Silver'|'Gold'|'Platinum';
export interface PassportSet {
  id:string;title:string;subtitle:string;emoji:string;
  count:number;total:number;percent:number;complete:boolean;
  shinyCount:number;rareCount:number;medal:PassportMedal;
  nextMissing:string|null;
}
export function buildCollectionPassport(elements:readonly InfiniteElement[]): PassportSet[] {
  const byName=new Map(elements.filter(e=>e?.name).map(e=>[discoveryIdentity(e.name),e]));
  return ALBUM_SETS.map(set=>{
    const found=set.names.map(name=>byName.get(discoveryIdentity(name)));
    const count=found.filter(Boolean).length;
    const shinyCount=found.filter(e=>e && availableVariants(e).includes('shiny')).length;
    const rareCount=found.filter(e=>e && availableVariants(e).length>1).length;
    // Platinum is intentionally a collection mastery reward, never a new roll.
    const medal:PassportMedal=count===set.names.length
      ? shinyCount===set.names.length ? 'Platinum' : 'Gold'
      : count>=Math.ceil(set.names.length/2) ? 'Silver'
      : count>=Math.ceil(set.names.length/4) ? 'Bronze' : 'Unstarted';
    return {id:set.id,title:set.title,subtitle:set.subtitle,emoji:set.emoji,
      count,total:set.names.length,percent:Math.round(count/set.names.length*100),
      complete:count===set.names.length,shinyCount,rareCount,medal,
      nextMissing:set.names.find(name=>!byName.has(discoveryIdentity(name)))||null};
  });
}
export function passportTotals(sets:readonly PassportSet[]) {
  return {stamps:sets.filter(set=>set.medal!=='Unstarted').length,
    completed:sets.filter(set=>set.complete).length,
    platinum:sets.filter(set=>set.medal==='Platinum').length,
    total:sets.length};
}
