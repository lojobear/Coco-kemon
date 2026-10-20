import React, { createContext, useContext } from 'react';
import { ElementSprite } from './ElementSprite';
export const CraftSprites = createContext<ReadonlyMap<string, string>>(new Map());
export function CraftSprite({ name, emoji, className = '', idle = true, isShiny = false }: { name: string; emoji: string; className?: string; idle?: boolean; isShiny?: boolean }) {
  const custom = useContext(CraftSprites).get(name.trim().toLowerCase());
  return <ElementSprite name={name} custom={custom} fallback={emoji} className={`craft-emoji ${className}`} idle={idle} isShiny={isShiny} />;
}
