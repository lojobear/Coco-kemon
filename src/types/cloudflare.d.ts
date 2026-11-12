declare module 'cloudflare:node' {
  export interface HttpServerHandlerOptions {
    port: number;
  }
  export function httpServerHandler(options: HttpServerHandlerOptions | number): {
    fetch: (request: Request, env?: unknown, ctx?: unknown) => Promise<Response>;
  };
}

declare module 'cloudflare:workers' {
  export const env: Record<string, string | undefined>;
  export const DurableObject: typeof import('@cloudflare/workers-types/index.ts').CloudflareWorkersModule.DurableObject;
}
