/** One Durable Object shared by all Boop image requests, including Cron. */
export type ImageBudgetStub = { fetch(request: Request): Promise<Response> };
export type ImageBudgetNamespace = {
  idFromName(name: string): any;
  get(id: any): ImageBudgetStub;
};
let binding: ImageBudgetNamespace | undefined;
export function setImageBudgetBinding(value?: ImageBudgetNamespace): void { binding = value; }
export function getImageBudgetBinding(): ImageBudgetNamespace | undefined { return binding; }
