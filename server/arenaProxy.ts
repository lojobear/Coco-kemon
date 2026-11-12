import type { Express } from 'express';
/** Node/Vercel entry points share the same authoritative Cloudflare lobby. */
export function registerArenaProxy(app: Express) {
 app.all('/api/arena/:action',async(req,res)=>{
  const action=req.params.action;
  if(!['collection','queue','pick','match','leave','cancel'].includes(action))return res.status(404).json({error:'Arena route not found.'});
  const authorization=req.get('Authorization');
  if(!authorization?.startsWith('Bearer '))return res.status(401).json({error:'Sign in to enter the public lobby.'});
  if((action==='collection'&&req.method!=='GET')||(action!=='collection'&&req.method!=='POST'))return res.status(405).json({error:'Method not allowed.'});
  const body=req.method==='POST'?JSON.stringify(req.body||{}):undefined;
  if(body&&body.length>4096)return res.status(413).json({error:'Arena request is too large.'});
  try {
   const response=await fetch(`https://coco-kemon.logaandavid.workers.dev/api/arena/${action}`,{method:req.method,headers:{Authorization:authorization,...(body?{'Content-Type':'application/json'}:{})},body,signal:AbortSignal.timeout(20000)});
   res.set('Cache-Control','no-store');return res.status(response.status).json(await response.json());
  }catch{return res.status(503).json({error:'Arena connection interrupted. Retry shortly.'});}
 });
}
