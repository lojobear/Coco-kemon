type KvBinding = {
  get(key: string, type?: 'text' | 'json'): Promise<any>;
  put(key: string, value: string, options?: { expirationTtl?: number; metadata?: Record<string, unknown> }): Promise<void>;
  list?(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{ keys: { name: string; metadata?: Record<string, unknown> }[]; list_complete?: boolean; cursor?: string }>;
  delete?(key:string):Promise<void>;
};

let kv: KvBinding | undefined;

export function setPersistentCacheBinding(binding?: KvBinding) {
  kv = binding;
}

export function getPersistentCacheBinding(): KvBinding | undefined {
  return kv;
}
