// Cloudflare Workers supports this API at runtime; the installed workers-types package lacks its declaration.
// https://developers.cloudflare.com/workers/runtime-apis/nodejs/http/#handleasnoderequest
declare module 'cloudflare:node' {
  export function handleAsNodeRequest(port: number, request: Request): Promise<Response>;
}
