import './infiniteCraftData';

declare module './infiniteCraftData' {
  interface InfiniteElement {
    craftCount?: number;
    shinyCraftCount?: number;
    firstCraftedAt?: number;
    lastCraftedAt?: number;
    recipeHistory?: Array<{
      first: string;
      second: string;
      count: number;
      firstSeenAt: number;
      lastSeenAt: number;
    }>;
  }
}

export {};
