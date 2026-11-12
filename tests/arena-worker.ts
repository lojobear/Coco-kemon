// Local runtime fixture only. Never used by the production Worker entry point.
export { BoopArena } from '../server/arenaObjects';
import type { ArenaEnv } from '../server/arenaApi';
export default {
 async fetch(request:Request,env:ArenaEnv) {
  try {
   const body=await request.json() as any;
   const stub=env.BOOP_ARENA.getByName(body.room||`queue:${body.category}`);
   const action=new URL(request.url).pathname;
   const data=action==='/queue'?await stub.queue(body.player,body.category):action==='/pick'?await stub.pick(body.user,body.key):action==='/setup'?await stub.setup(body.category,body.players):action==='/leave'?await stub.forfeit(body.user):await stub.view(body.user);
   return Response.json(data||{ok:true});
  }catch(error){return Response.json({error:String(error)},{status:400});}
 }
};
