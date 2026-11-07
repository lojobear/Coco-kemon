import { BOOP_DAILY_IMAGE_NEURON_LIMIT } from './imageSpendingGuard.js';

type Transaction = {
  get<T>(key: string): Promise<T | undefined>;
  put(key: string, value: unknown): Promise<void>;
};
type State = {
  storage: {
    get<T>(key: string): Promise<T | undefined>;
    transaction<T>(operation: (txn: Transaction) => Promise<T>): Promise<T>;
  };
};
type Usage = { allowed: boolean; used: number; limit: number };
const validDay = (day: unknown): day is string =>
  typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day);
const positive = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;
const usedValue = (value: unknown): number =>
  typeof value === 'object' && value !== null &&
  typeof (value as { neurons?: unknown }).neurons === 'number' &&
  Number.isFinite((value as { neurons: number }).neurons)
    ? Math.max(0, (value as { neurons: number }).neurons) : 0;

/** Atomic budget reservations across simultaneous requests and Worker isolates. */
export class BoopImageBudgetLedger {
  constructor(private readonly state: State) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/reserve' && request.method === 'POST') {
      let input: { day?: unknown; neurons?: unknown; floor?: unknown };
      try { input = await request.json() as typeof input; }
      catch { return Response.json({ error: 'Invalid budget request' }, { status: 400 }); }
      if (!validDay(input.day) || !positive(input.neurons) ||
          input.neurons > BOOP_DAILY_IMAGE_NEURON_LIMIT) {
        return Response.json({ error: 'Invalid budget reservation' }, { status: 400 });
      }
      const amount = input.neurons;
      const floor = typeof input.floor === 'number' && Number.isFinite(input.floor)
        ? Math.max(0, input.floor) : 0;
      const key = 'neurons:' + input.day;
      const result = await this.state.storage.transaction<Usage>(async txn => {
        const current = usedValue(await txn.get(key));
        // Keep the old KV balance when migrating in the middle of a UTC day.
        const observed = Math.max(current, floor);
        if (observed + amount > BOOP_DAILY_IMAGE_NEURON_LIMIT) {
          if (observed > current) await txn.put(key, { neurons: observed });
          return { allowed: false, used: observed, limit: BOOP_DAILY_IMAGE_NEURON_LIMIT };
        }
        const used = observed + amount;
        await txn.put(key, { neurons: used });
        return { allowed: true, used, limit: BOOP_DAILY_IMAGE_NEURON_LIMIT };
      });
      return Response.json(result);
    }
    if (url.pathname === '/status' && request.method === 'GET') {
      const day = url.searchParams.get('day');
      if (!validDay(day)) return Response.json({ error: 'Invalid day' }, { status: 400 });
      const used = usedValue(await this.state.storage.get('neurons:' + day));
      return Response.json({ allowed: true, used, limit: BOOP_DAILY_IMAGE_NEURON_LIMIT });
    }
    return Response.json({ error: 'Not found' }, { status: 404 });
  }
}
