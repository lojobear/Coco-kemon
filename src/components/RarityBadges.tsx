import React from 'react';
import type { InfiniteElement } from '../lib/infiniteCraftData';
import { rarityChanceLabel, rarityInfo, SHINY_ODDS, CELESTIAL_ODDS, HOLO_ODDS, GLITCH_ODDS } from '../lib/rarity';
import { getElementMastery } from '../lib/elementStats';

/** Cosmetic collector distinctions. A tier is rolled at every combination;
 * the rarest tier encountered remains on the saved collectible. */
export const RarityBadges = React.memo(function RarityBadges({
  item, compact=false, showProgress=true,
}: {item: InfiniteElement; compact?: boolean; showProgress?: boolean}) {
  const tier=rarityInfo(item.rarityTier);
  const specialties = [
    item.unlockedShiny || item.isShiny ? {name:'Shiny',symbol:'✦',odds:SHINY_ODDS,code:'shiny'} : null,
    item.unlockedCelestial ? {name:'Celestial',symbol:'✶',odds:CELESTIAL_ODDS,code:'celestial'} : null,
    item.unlockedHolo ? {name:'Holo',symbol:'◈',odds:HOLO_ODDS,code:'holo'} : null,
    item.unlockedGlitch ? {name:'Glitch',symbol:'⟡',odds:GLITCH_ODDS,code:'glitch'} : null,
  ].filter((special): special is {name:string;symbol:string;odds:number;code:string} => Boolean(special));
  const mastery=getElementMastery(item.craftCount||0);
  return <span className={`boop-rarity-badges${compact?' is-compact':''}`} aria-label="Collector badges">
    <span className={`boop-rarity-badge tier-${tier.id}`} title={`${tier.label} — ${rarityChanceLabel(tier.id)} chance per craft`}>
      <span aria-hidden="true">{tier.symbol}</span>{compact && tier.id==='common' ? 'Common' : tier.label}
    </span>
    {(compact?specialties.slice(0,2):specialties).map(special=>
      <span key={special.code} className={`boop-rarity-badge finish-${special.code}`}
        title={`${special.name} — 1 in ${special.odds.toLocaleString('en-CA')} independent roll`}>
        <span aria-hidden="true">{special.symbol}</span>{special.name}
      </span>)}
    {!compact && showProgress && item.isNew && <span className="boop-rarity-badge badge-new">✧ New find</span>}
    {!compact && showProgress && mastery.level>=4 && <span className="boop-rarity-badge badge-master">★ Mastered</span>}
  </span>;
});
