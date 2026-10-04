import React, { createContext, useContext } from 'react';
import { ElementSprite } from './ElementSprite';
export const CraftSprites = createContext<ReadonlyMap<string, string>>(new Map());
export function CraftSprite({ name, emoji }: { name: string; emoji: string }) {
  const custom = useContext(CraftSprites).get(name.trim().toLowerCase());
  return <ElementSprite name={name} custom={custom} fallback={emoji} className="craft-emoji" />;
}
