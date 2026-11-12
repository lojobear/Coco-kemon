import type { DurableObjectNamespace, DurableObjectState } from '@cloudflare/workers-types/index.ts';
import { DurableObject } from 'cloudflare:workers';
import type { ArenaCard, ArenaPlayer, ArenaView } from '../src/lib/arena';
import { botCards, BOT_NAMES } from '../src/lib/arena';
interface ArenaEnv { BOOP_ARENA: DurableObjectNamespace<BoopArena> }
type Ticket = { player: ArenaPlayer; category: string; at: number; room?: string; players?: ArenaPlayer[] };
type Match = { category: string; players: ArenaPlayer[]; deadline: number; picks: Record<string,string>; forfeits: string[] };
const randomIndex = (size: number) => crypto.getRandomValues(new Uint32Array(1))[0] % size;
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
  async resume(user: string, category: string): Promise<ArenaView|null> {
    const ticket=this.read<Ticket>(`ticket:${user}`);
    if(!ticket || ticket.at<Date.now()-10*60_000)return null;
    return this.queue(ticket.player,category);
  }
  async queue(player: ArenaPlayer, category: string, cancel = false): Promise<ArenaView> {
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
      ticket = { player, category, at:now };
      if (waiting.length) {
        const other = waiting[randomIndex(waiting.length)];
        const room = `match:${crypto.randomUUID()}`;
        const players = [other.ticket.player, player];
        this.write(other.key, { ...other.ticket, room, players });
        ticket = { ...ticket, room, players };
      }
      this.write(key,ticket);
    }
    if (!ticket.room && now-ticket.at >= 12_000) {
      const pool = botCards(category);
      const cards = pool.length ? pool : ticket.player.cards;
      const bot: ArenaPlayer = { id:'bot', name:BOT_NAMES[randomIndex(BOT_NAMES.length)], bot:true, cards };
      ticket = { ...ticket, room:`match:${crypto.randomUUID()}`, players:[ticket.player,bot] };
      this.write(key,ticket);
    }
    await this.ctx.storage.setAlarm(now+11*60_000);
    if (ticket.room) {
      const room = this.env.BOOP_ARENA.getByName(ticket.room);
      await room.setup(category,ticket.players!);
      return { ...await room.view(player.id), room:ticket.room };
    }
    return { phase:'waiting',category,botAt:ticket.at+12_000,waiting:this.ctx.storage.sql.exec<{value:string}>("SELECT value FROM arena_state WHERE key LIKE 'ticket:%'").toArray().filter(row=>!(JSON.parse(row.value) as Ticket).room).length };
  }
  async setup(category: string, players: ArenaPlayer[]): Promise<void> {
    if (this.read<Match>('match')) return;
    const picks: Record<string,string> = {};
    for (const player of players) if (player.bot) picks[player.id] = player.cards[randomIndex(player.cards.length)].key;
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
      cards:you.cards,locked:!!match.picks[user],opponent:{name:opponent.name,bot:opponent.bot,locked:!!match.picks[opponent.id]}};
    if (finished) {
      const a=match.forfeits.includes(user)?null:you.cards.find(card=>card.key===match.picks[user])||null;
      const b=match.forfeits.includes(opponent.id)?null:opponent.cards.find(card=>card.key===match.picks[opponent.id])||null;
      view.picks={you:a,opponent:b};
      const aScore=match.forfeits.includes(user)?0:a?.coins||0;
      const bScore=match.forfeits.includes(opponent.id)?0:b?.coins||0;
      view.result=match.forfeits.includes(user)?'loss':match.forfeits.includes(opponent.id)?'win':aScore===bScore?'draw':aScore>bScore?'win':'loss';
      view.reason=match.forfeits.length?'A player left the match.':Date.now()>=match.deadline?'Time is up. Unsubmitted picks score zero.':'Both picks are revealed.';
    }
    return view;
  }
  async alarm() { this.ctx.storage.sql.exec('DELETE FROM arena_state'); }
}
