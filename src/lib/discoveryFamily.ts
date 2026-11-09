/** Read-only two-generation ancestry and descendants from saved recipe facts. */
import { discoveryIdentity } from './unifiedCollection';
import type { InfiniteElement } from './infiniteCraftData';

export interface FamilyNode {name:string;depth:number;emoji:string;relation:'ancestor'|'descendant';owned:boolean}
export interface FamilyTree {ancestors:FamilyNode[];descendants:FamilyNode[];recipes:Array<{first:string;second:string;count:number}>}
export function buildDiscoveryFamily(
  selected:string,
  elements:readonly InfiniteElement[],
  maxDepth=2,
): FamilyTree {
  const byName=new Map(elements.filter(e=>e?.name).map(e=>[discoveryIdentity(e.name),e]));
  const index=new Map<string,Set<string>>();
  const recipeMap=new Map<string,Array<{first:string;second:string;count:number}>>();
  for(const element of elements) {
    if(!element?.name)continue;
    const key=discoveryIdentity(element.name);
    const history=Array.isArray(element.recipeHistory)&&element.recipeHistory.length
      ? element.recipeHistory : element.recipe ? [element.recipe] : [];
    const deduped=new Map<string,{first:string;second:string;count:number}>();
    for(const record of history){
      if(!record?.first || !record?.second)continue;
      const pair=[discoveryIdentity(record.first),discoveryIdentity(record.second)].sort().join(':::');
      if(!deduped.has(pair))deduped.set(pair,{first:record.first,second:record.second,
        count:'count' in record && typeof record.count==='number'?record.count:1});
      for(const parent of [record.first,record.second]){
        const parentKey=discoveryIdentity(parent);
        if(parentKey===key)continue;
        const children=index.get(parentKey)||new Set<string>();
        children.add(key);index.set(parentKey,children);
      }
    }
    recipeMap.set(key,[...deduped.values()]);
  }
  const root=discoveryIdentity(selected);
  const ancestors:FamilyNode[]=[],descendants:FamilyNode[]=[];
  const walkParents=(name:string,depth:number,seen:Set<string>)=>{
    if(depth>maxDepth)return;
    const recipes=recipeMap.get(name)||[];
    for(const recipe of recipes.slice(0,4)){
      for(const parent of [recipe.first,recipe.second]){
        const key=discoveryIdentity(parent);
        if(seen.has(key))continue;
        const owned=byName.get(key);
        ancestors.push({name:owned?.name||parent,depth,emoji:owned?.emoji||'?',owned:!!owned,relation:'ancestor'});
        walkParents(key,depth+1,new Set([...seen,key]));
      }
    }
  };
  const walkChildren=(name:string,depth:number,seen:Set<string>)=>{
    if(depth>maxDepth)return;
    for(const key of [...(index.get(name)||[])].slice(0,20)){
      if(seen.has(key))continue;
      const owned=byName.get(key);
      if(owned)descendants.push({name:owned.name,depth,emoji:owned.emoji,owned:true,relation:'descendant'});
      walkChildren(key,depth+1,new Set([...seen,key]));
    }
  };
  walkParents(root,1,new Set([root]));
  walkChildren(root,1,new Set([root]));
  const unique=(nodes:FamilyNode[])=>{
    const seen=new Set<string>();
    return nodes.filter(item=>{
      const id=discoveryIdentity(item.name)+':'+item.depth;
      if(seen.has(id))return false;seen.add(id);return true;
    }).slice(0,28);
  };
  return {ancestors:unique(ancestors),descendants:unique(descendants),recipes:recipeMap.get(root)||[]};
}
