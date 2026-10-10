import test from 'node:test';
import assert from 'node:assert/strict';
import { registerEmojiRoute } from '../server/emoji';
import { clientId, resetAiBudgets, takeAiBudget } from '../server/rateLimit';

const image = { data: 'A'.repeat(200), mimeType: 'image/png', model: 'test-model' };

function mountEmoji(generate: () => Promise<typeof image>) {
  let handler: any;
  registerEmojiRoute({ post: (_path: string, fn: unknown) => { handler = fn; } } as any, generate as any);
  return async (body: unknown, ip = '5.5.5.5') => {
    const out: { status?: number; body?: any } = {};
    const res: any = {
      status(code: number) { out.status = code; return res; },
      json(payload: unknown) { out.body = payload; out.status ??= 200; return res; },
    };
    await handler({ body, headers: {}, socket: { remoteAddress: ip } }, res);
    return out;
  };
}

test('AI budget is per client, resets each minute, and rejects with 429', () => {
  const previous = process.env.AI_BUDGET_PER_MINUTE;
  process.env.AI_BUDGET_PER_MINUTE = '10';
  try {
    resetAiBudgets();
    takeAiBudget('a', 5, 1000);
    takeAiBudget('a', 5, 1000);
    assert.throws(() => takeAiBudget('a', 1, 1000), (error: any) => error.status === 429);
    takeAiBudget('b', 5, 1000);
    takeAiBudget('a', 5, 1000 + 60_001);
  } finally {
    if (previous === undefined) delete process.env.AI_BUDGET_PER_MINUTE; else process.env.AI_BUDGET_PER_MINUTE = previous;
  }
});

test('client identity prefers Cloudflare, then proxy headers, then the socket', () => {
  assert.equal(clientId({ headers: { 'cf-connecting-ip': '9.9.9.9', 'x-forwarded-for': '1.1.1.1' } }), '9.9.9.9');
  assert.equal(clientId({ headers: { 'x-forwarded-for': '2.2.2.2, 3.3.3.3' } }), '2.2.2.2');
  assert.equal(clientId({ headers: {}, socket: { remoteAddress: '4.4.4.4' } }), '4.4.4.4');
});

test('sprite generation is capped at 6 concurrent calls even for uncached names', async () => {
  const previous = process.env.AI_BUDGET_PER_MINUTE;
  process.env.AI_BUDGET_PER_MINUTE = '1000';
  resetAiBudgets();
  let inFlight = 0, peak = 0;
  const post = mountEmoji(async () => {
    inFlight++; peak = Math.max(peak, inFlight);
    await new Promise(resolve => setTimeout(resolve, 40));
    inFlight--;
    return image;
  });
  try {
    const results = await Promise.all(Array.from({ length: 8 }, (_, i) => post({ name: `concurrency probe ${i}` })));
    assert.equal(peak, 6);
    assert.equal(results.filter(r => r.status === 429).length, 2);
  } finally {
    if (previous === undefined) delete process.env.AI_BUDGET_PER_MINUTE; else process.env.AI_BUDGET_PER_MINUTE = previous;
  }
});

test('sprite generation spends budget but cache hits are free', async () => {
  const previous = process.env.AI_BUDGET_PER_MINUTE;
  process.env.AI_BUDGET_PER_MINUTE = '10'; // a sprite costs 5
  resetAiBudgets();
  const post = mountEmoji(async () => image);
  try {
    assert.equal((await post({ name: 'budget probe one' })).status, 200);
    assert.equal((await post({ name: 'budget probe two' })).status, 200);
    assert.equal((await post({ name: 'budget probe three' })).status, 429);
    assert.equal((await post({ name: 'budget probe one' })).status, 200, 'cached sprite costs nothing');
    assert.equal((await post({ name: 'budget probe four' }, '6.6.6.6')).status, 200, 'other clients are unaffected');
  } finally {
    if (previous === undefined) delete process.env.AI_BUDGET_PER_MINUTE; else process.env.AI_BUDGET_PER_MINUTE = previous;
  }
});
