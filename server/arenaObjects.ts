import type { DurableObjectNamespace, DurableObjectState } from '@cloudflare/workers-types/index.ts';
import { DurableObject } from 'cloudflare:workers';
import type { ArenaCard, ArenaPlayer, ArenaView } from '../src/lib/arena';
import { BOT_DEFINITIONS, BOT_REGISTRY, BOT_SLOT_MS, botDefinition, botDue, seedBot, botProfile, botOpponent, selectKnownBotRecipe, botCacheCandidates, cachedBotRecipe, applyBotRecipe, chooseBotCard, type BotState } from '../src/lib/botCollectors';
import { uniformRandomIndex } from '../src/lib/rarity';
interface ArenaEnv { BOOP_ARENA: DurableObjectNamespace<BoopArena>; QUARKPOP_CACHE?: {get(key:string,type:'json'):Promise<unknown>} }
type Ticket = { player: ArenaPlayer; category: string; at: number; nonce?:string; room?: string; players?: ArenaPlayer[] };
type Match = { category: string; players: ArenaPlayer[]; deadline: number; picks: Record<string,string>; forfeits: string[]; botStatsRecorded?:boolean };
const randomIndex = uniformRandomIndex;
/** One instance per category queue, and a different instance per individual match. */
export class BoopArena extends DurableObject<ArenaEnv> {
  constructor(ctx: DurableObjectState, env: ArenaEnv) {
    super(ctx, env);
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS arena_state (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
  }
  private read<T>(key: string): T | undefined {
    const row = this.ctx.storage.sql.exec<{value:string}>('SELECT value FROM arena_state WHERE key = ?', key).toArray()[0];
    return row ? JSON.parse(row.value) : undefined;
  }
  private write(key: string, value: unknown) { this.ctx.storage.sql.exec('INSERT OR REPLACE INTO arena_state (key,value) VALUES (?,?)', key, JSON.stringify(value)); }
  private remove(key: string) { this.ctx.storage.sql.exec('DELETE FROM arena_state WHERE key = ?', key); }
  // The named registry is a permanent Durable Object, not an expiring match.
  private collector(id:string):BotState {
    const existing=this.read<BotState>('collector:'+id);
    if(existing)return existing;
    const def=botDefinition(id);if(!def)throw new Error('Unknown collector.');
    const state=seedBot(def,Date.now());this.write('collector:'+id,state);return state;
  }
  async botProfiles() {return BOT_DEFINITIONS.map(def=>botProfile(def,this.collector(def.id)));}
  async selectBot(category:string,preferred?:string):Promise<ArenaPlayer|null>{
    const bots=BOT_DEFINITIONS.filter(def=>!preferred||def.id===preferred)
      .flatMap(def=>{const player=botOpponent(def,this.collector(def.id),category);return player?[player]:[];});
    return bots.length?bots[randomIndex(bots.length)]:null;
  }
  async tickBots(now=Date.now()){
    const slot=Math.floor(now/BOT_SLOT_MS);let crafted=0,cached=0;
    for(const def of BOT_DEFINITIONS){
      const initial=this.collector(def.id);
      if(!botDue(def,initial,slot))continue;
      let recipe=selectKnownBotRecipe(def,initial);
      // Only a few existing KV results, no API resolver or paid generation.
      let usedCache=false;
      if(this.env.QUARKPOP_CACHE&&randomIndex(3)===0){
        for(const pair of botCacheCandidates(initial)){
          try {
            const value=await this.env.QUARKPOP_CACHE.get('infinite-pair-v4:'+pair.key,'json');
            const hit=cachedBotRecipe(pair.first,pair.second,value);
            if(hit&&!initial.items.some(item=>item.name.toLowerCase()===hit.outcome.result.toLowerCase())){recipe=hit;usedCache=true;break;}
          }catch{break;}
        }
      }
      // An await may interleave another cron or a completed match: never overwrite newer state.
      const current=this.collector(def.id);
      if(!botDue(def,current,slot))continue;
      const next=recipe?applyBotRecipe(current,recipe,now):current;
      this.write('collector:'+def.id,{...next,lastSlot:slot});
      if(next.crafts>current.crafts){crafted++;if(usedCache)cached++;}
    }
    // Match rooms live eleven minutes. Keep receipts a full day for retry safety.
    for(const row of this.ctx.storage.sql.exec<{key:string;value:string}>("SELECT key,value FROM arena_state WHERE key LIKE 'botreceipt:%'").toArray()){
      if(JSON.parse(row.value)<now-86_400_000)this.remove(row.key);
    }
    return {slot,crafted,cached,paidAiCalls:0};
  }
  async recordBotResult(id:string,room:string,outcome:'win'|'loss'|'draw'){
    if(!botDefinition(id)||!room)return;
    this.ctx.storage.transactionSync(()=>{
      const receipt='botreceipt:'+room;
      if(this.read<number>(receipt)!==undefined)return;
      const state=this.collector(id);
      const field=outcome==='win'?'wins':outcome==='loss'?'losses':'draws';
      this.write('collector:'+id,{...state,[field]:state[field]+1});
      this.write(receipt,Date.now());
    });
  }
  async resume(user: string, category: string): Promise<ArenaView|null> {
    const ticket=this.read<Ticket>(`ticket:${user}`);
    if(!ticket || ticket.at<Date.now()-10*60_000)return null;
    return this.queue(ticket.player,category);
  }
  async queue(player: ArenaPlayer, category: string, cancel = false, challenge?:ArenaPlayer): Promise<ArenaView> {
    const now = Date.now();
    const key = `ticket:${player.id}`;
    const rows = this.ctx.storage.sql.exec<{key:string;value:string}>("SELECT key,value FROM arena_state WHERE key LIKE 'ticket:%'").toArray();
    for (const row of rows) if (JSON.parse(row.value).at < now - 10*60_000) this.remove(row.key);
    let ticket = this.read<Ticket>(key);
    if (cancel) {
      if (ticket?.room) { const room=this.env.BOOP_ARENA.getByName(ticket.room);await room.setup(category,ticket.players!);await room.forfeit(player.id); }
      this.remove(key);return { phase:'waiting', category, waiting:0 };
    }
    if (!ticket) {
      const waiting = rows.flatMap(row => { const value = JSON.parse(row.value) as Ticket; return value.at >= now-30_000 && !value.room && value.player.id !== player.id ? [{key:row.key,ticket:value}] : []; });
      if (rows.length >= 64) throw new Error('This category lobby is busy. Try again shortly.');
      ticket = { player, category, at:now, nonce:crypto.randomUUID() };
      if (challenge) {
        ticket={...ticket,room:`match:${crypto.randomUUID()}`,players:[player,challenge]};
      } else if (waiting.length) {
        const other = waiting[randomIndex(waiting.length)];
        const room = `match:${crypto.randomUUID()}`;
        const players = [other.ticket.player, player];
        this.write(other.key, { ...other.ticket, room, players });
        ticket = { ...ticket, room, players };
      }
      this.write(key,ticket);
    }
    let botUnavailable=false;
    if (!ticket.room && now-ticket.at >= 12_000) {
      const bot=await this.env.BOOP_ARENA.getByName(BOT_REGISTRY).selectBot(category);
      const latest=this.read<Ticket>(key);
      // A real player might have joined or the user might have cancelled during RPC.
      if(!latest||latest.at!==ticket.at||latest.nonce!==ticket.nonce)
        return {phase:'waiting',category,waiting:0,botUnavailable:!bot};
      ticket=latest;
      if(!ticket.room&&bot){
        ticket={...ticket,room:`match:${crypto.randomUUID()}`,players:[ticket.player,bot]};
        this.write(key,ticket);
      }else if(!ticket.room)botUnavailable=true;
    }
    await this.ctx.storage.setAlarm(now+11*60_000);
    if (ticket.room) {
      const room = this.env.BOOP_ARENA.getByName(ticket.room);
      await room.setup(category,ticket.players!);
      return { ...await room.view(player.id), room:ticket.room };
    }
    return { phase:'waiting',category,botAt:ticket.at+12_000,botUnavailable,waiting:this.ctx.storage.sql.exec<{value:string}>("SELECT value FROM arena_state WHERE key LIKE 'ticket:%'").toArray().filter(row=>!(JSON.parse(row.value) as Ticket).room).length };
  }
  async setup(category: string, players: ArenaPlayer[]): Promise<void> {
    if (this.read<Match>('match')) return;
    const picks: Record<string,string> = {};
    for (const player of players) if (player.bot) picks[player.id] = chooseBotCard(player.cards,player.difficulty).key;
    this.write('match',{category,players,deadline:Date.now()+45_000,picks,forfeits:[]} satisfies Match);
    await this.ctx.storage.setAlarm(Date.now()+11*60_000);
  }
  private requireMatch(user: string): Match {
    const match = this.read<Match>('match');
    if (!match || !match.players.some(player=>player.id===user&&!player.bot)) throw new Error('Match not available for this player.');
    return match;
  }
  async pick(user: string, key: string): Promise<ArenaView> {
    const match = this.requireMatch(user);
    if (match.deadline <= Date.now() || match.forfeits.length || Object.keys(match.picks).length === 2) return this.view(user);
    if (match.picks[user]) { if (match.picks[user]!==key) throw new Error('Your pick is already locked.'); return this.view(user); }
    if (!match.players.find(player=>player.id===user)!.cards.some(card=>card.key===key)) throw new Error('Choose an eligible element from your saved collection.');
    match.picks[user]=key;this.write('match',match);return this.view(user);
  }
  async forfeit(user: string): Promise<void> {
    const match=this.requireMatch(user);
    if (match.deadline>Date.now() && Object.keys(match.picks).length<2 && !match.forfeits.includes(user)) {
      match.forfeits.push(user);this.write('match',match);
    }
  }
  async view(user: string): Promise<ArenaView> {
    const match=this.requireMatch(user);
    const you=match.players.find(player=>player.id===user)!;
    const opponent=match.players.find(player=>player.id!==user)!;
    const finished=Object.keys(match.picks).length===2 || Date.now()>=match.deadline || !!match.forfeits.length;
    const view: ArenaView={phase:finished?'finished':'picking',category:match.category,deadline:match.deadline,
      cards:you.cards,locked:!!match.picks[user],opponent:{name:opponent.name,bot:opponent.bot,locked:!!match.picks[opponent.id],difficulty:opponent.difficulty,avatar:opponent.avatar,level:opponent.level}};
    if (finished) {
      const a=match.forfeits.includes(user)?null:you.cards.find(card=>card.key===match.picks[user])||null;
      const b=match.forfeits.includes(opponent.id)?null:opponent.cards.find(card=>card.key===match.picks[opponent.id])||null;
      view.picks={you:a,opponent:b};
      const aScore=match.forfeits.includes(user)?0:a?.coins||0;
      const bScore=match.forfeits.includes(opponent.id)?0:b?.coins||0;
      view.result=match.forfeits.includes(user)?'loss':match.forfeits.includes(opponent.id)?'win':aScore===bScore?'draw':aScore>bScore?'win':'loss';
      view.reason=match.forfeits.length?'A player left the match.':Date.now()>=match.deadline?'Time is up. Unsubmitted picks score zero.':'Both picks are revealed.';
      if(opponent.bot&&botDefinition(opponent.id)&&!match.botStatsRecorded){
        try{
          await this.env.BOOP_ARENA.getByName(BOT_REGISTRY).recordBotResult(opponent.id,this.ctx.id.toString(),view.result==='win'?'loss':view.result==='loss'?'win':'draw');
          match.botStatsRecorded=true;this.write('match',match);
        }catch(error){console.warn('Bot match statistics will retry:',String(error).slice(0,160));}
      }
    }
    return view;
  }
  async alarm() {
    const match=this.read<Match>('match');
    if(match?.players.some(player=>player.bot)&&!match.botStatsRecorded){
      const human=match.players.find(player=>!player.bot);
      if(human){await this.view(human.id);const latest=this.read<Match>('match');
        if(latest&&!latest.botStatsRecorded&&latest.players.some(player=>botDefinition(player.id))){
          await this.ctx.storage.setAlarm(Date.now()+60_000);return;
        }
      }
    }
    // Collector records never share the expiration policy of transient tickets.
    this.ctx.storage.sql.exec("DELETE FROM arena_state WHERE key='match' OR key LIKE 'ticket:%'");
  }
}
