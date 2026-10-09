type KvBinding = {
  get(key: string, type?: 'text' | 'json'): Promise<any>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
};

let kv: KvBinding | undefined;

export function setPersistentCacheBinding(binding?: KvBinding) {
  kv = binding;
}

export function getPersistentCacheBinding(): KvBinding | undefined {
  return kv;
}
