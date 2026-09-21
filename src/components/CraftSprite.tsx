import { createContext, useContext } from 'react';

export const CraftSprites = createContext<ReadonlyMap<string, string>>(new Map());

/** Resolve by discovery name so existing canvas instances and combine slots stay in sync. */
export function CraftSprite({ name, emoji }: { name: string; emoji: string }) {
  const sprite = useContext(CraftSprites).get(name.trim().toLowerCase());
  return sprite
    ? <img src={sprite} alt="" draggable={false} className="inline-block w-[1.4em] h-[1.4em] object-contain pixelated align-middle pointer-events-none" />
    : <>{emoji}</>;
}
