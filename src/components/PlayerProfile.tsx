import React, { useEffect, useMemo, useState } from 'react';
import { useGame } from '../lib/gameStore';
import { cloud } from '../lib/cloudSave';
import { SAVE_CHANGED_EVENT, SAVE_IMPORTED_EVENT, readCraftElements } from '../lib/saveData';
import { playerCraftStats } from '../lib/playerStats';
import { CraftSprite, CraftSprites } from './CraftSprite';
import type { User } from '@supabase/supabase-js';
import { UserRound, Cloud, Sparkles, Trophy, History, Medal, Pencil, Check, Flame, Layers } from 'lucide-react';

export function PlayerProfile({ onOpenCloud }: { onOpenCloud: () => void }) {
  const { progression, oddkinCollection, materials, experiments } = useGame();
  const [elements, setElements] = useState(readCraftElements);
  const [user, setUser] = useState<User | null>(null);
  const [guestName, setGuestName] = useState(() => localStorage.getItem('boop-guest-display-name') || 'Explorer');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const refresh = () => setElements([...readCraftElements()]);
    window.addEventListener(SAVE_CHANGED_EVENT, refresh);
    window.addEventListener(SAVE_IMPORTED_EVENT, refresh);
    return () => { window.removeEventListener(SAVE_CHANGED_EVENT, refresh); window.removeEventListener(SAVE_IMPORTED_EVENT, refresh); };
  }, []);
  useEffect(() => {
    if (!cloud) return;
    let active = true;
    void cloud.auth.getUser().then(({ data }) => { if (active) setUser(data.user); }).catch(() => undefined);
    const { data: { subscription } } = cloud.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => { active = false; subscription.unsubscribe(); };
  }, []);
  const stats = useMemo(() => playerCraftStats(elements), [elements]);
  const nickname = (user?.user_metadata?.display_name as string | undefined)?.trim()
    || user?.email?.split('@')[0] || guestName;
  const spriteOverrides = useMemo(() => new Map(elements.flatMap(e => e.customSpriteUrl
    ? [[e.name.toLowerCase(), e.customSpriteUrl] as const] : [])), [elements]);

  const saveName = async () => {
    const trimmed = draft.trim().slice(0, 32);
    if (!trimmed) { setMessage('Choose a name to save.'); return; }
    setBusy(true);
    try {
      if (user && cloud) {
        const { error } = await cloud.auth.updateUser({ data: { display_name: trimmed } });
        if (error) throw error;
        const { data } = await cloud.auth.getUser();
        setUser(data.user);
        setMessage('Profile name saved to your account.');
      } else {
        localStorage.setItem('boop-guest-display-name', trimmed);
        setGuestName(trimmed);
        setMessage('Guest nickname saved on this device. Sign in to keep a name with your account.');
      }
      setEditing(false);
    } catch { setMessage('Could not save the profile name. Please try again.'); }
    finally { setBusy(false); }
  };
  const cards = [
    { label:'Discovered',value:stats.uniqueDiscoveries,icon:'✦' },
    { label:'Total crafts',value:stats.totalCrafts,icon:'⚗' },
    { label:'Shiny variants',value:stats.shinyVariants,icon:'✨' },
    { label:'Unique recipes',value:stats.uniqueRecipes,icon:'♾' },
    { label:'First finds',value:stats.firstFinds,icon:'★' },
    { label:'Mastered items',value:stats.masteredElements,icon:'🏆' },
  ];
  const maxActivity = Math.max(1, ...stats.activity.map(x => x.count));
  return <CraftSprites.Provider value={spriteOverrides}>
    <section className="boop-player-profile">
      <div className="boop-profile-hero">
        <div className="boop-profile-avatar"><UserRound size={36}/></div>
        <div className="boop-profile-hero-text">
          <div className="boop-profile-eyebrow">{user ? 'CONNECTED EXPLORER' : 'GUEST EXPLORER'}</div>
          <h1>{nickname}</h1>
          <p>{user?.email || 'Your progress is currently saved on this device'}</p>
          <div className="boop-profile-inline">
            <span><Medal size={15}/> Level {progression.level}</span>
            <span><Sparkles size={15}/> {stats.highestMastery} mastery</span>
          </div>
        </div>
        <button className="boop-profile-icon-button" aria-label="Edit profile name" onClick={() => {setDraft(nickname);setEditing(true);}}><Pencil size={18}/></button>
      </div>
      {editing && <div className="boop-profile-edit">
        <label htmlFor="boop-display-name">Display name</label>
        <input id="boop-display-name" maxLength={32} value={draft} onChange={e=>setDraft(e.target.value)} />
        <button disabled={busy} onClick={()=>void saveName()}><Check size={17}/>Save</button>
        <button onClick={()=>setEditing(false)}>Cancel</button>
      </div>}
      {message && <p role="status" className="boop-profile-note">{message}</p>}
      <div className="boop-profile-progress">
        <div><strong>Level {progression.level}</strong><span>{progression.levelCurrent.toLocaleString()} / {progression.levelRequired.toLocaleString()} XP to next level</span></div>
        <div role="progressbar" aria-label="Progress to next level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progression.levelRequired ? progression.levelCurrent / progression.levelRequired * 100 : 100)} className="boop-profile-progress-track"><i style={{width:`${Math.max(0,Math.min(100,progression.levelRequired?progression.levelCurrent / progression.levelRequired*100:100))}%`}}/></div>
      </div>
      <div className="boop-profile-stat-grid">{cards.map(card=><div key={card.label} className="boop-profile-stat-card"><span>{card.icon}</span><strong>{card.value.toLocaleString()}</strong><small>{card.label}</small></div>)}</div>
      <div className="boop-profile-columns">
        <div className="boop-profile-panel">
          <h2><History size={20}/> Discoveries over 7 days</h2>
          <p>New elements unlocked each day, based on saved discovery dates.</p>
          <div className="boop-profile-activity">{stats.activity.map((day,i)=><div className="boop-profile-day" key={i}><strong>{day.count}</strong><div className="boop-profile-bar"><span style={{height:`${Math.max(5,day.count/maxActivity*100)}%`}}/></div><small>{day.day}</small></div>)}</div>
        </div>
        <div className="boop-profile-panel">
          <h2><Trophy size={20}/> Most crafted</h2>
          {stats.mostCrafted.length ? <div className="boop-profile-top-list">{stats.mostCrafted.map((item,i)=><div key={item.id}><b>{i+1}</b><CraftSprite name={item.name} emoji={item.emoji} isShiny={item.isShiny}/><span>{item.name}</span><strong>{item.craftCount || 0}×</strong></div>)}</div> : <p>Make your first discovery to begin your rankings.</p>}
        </div>
        <div className="boop-profile-panel">
          <h2><Flame size={20}/> Recent discoveries</h2>
          {stats.recent.length ? <div className="boop-profile-top-list">{stats.recent.map(item=><div key={item.id}><CraftSprite name={item.name} emoji={item.emoji} isShiny={item.isShiny}/><span>{item.name}</span><small>{item.discoveredAt?new Date(item.discoveredAt).toLocaleDateString():''}</small></div>)}</div> : <p>New recipes will appear here.</p>}
        </div>
        <div className="boop-profile-panel">
          <h2><Layers size={20}/> Foundry & collection</h2>
          <div className="boop-profile-facts"><span>Materials collected <b>{materials.length}</b></span><span>Oddkin collected <b>{oddkinCollection.length}</b></span><span>Experiments recorded <b>{experiments.length}</b></span><span>Shiny crafting events <b>{stats.shinyCrafts}</b></span><span>All known elements <b>{stats.totalElements}</b></span></div>
        </div>
      </div>
      <div className="boop-profile-account"><Cloud size={20}/><div><strong>{user ? 'Cloud account connected' : 'Connect your profile'}</strong><p>{user ? 'Stats reflect this device’s current collection. Use cloud saves to move progress between devices.' : 'Sign in with Google to save a profile nickname and back up discoveries.'}</p></div><button onClick={onOpenCloud}>{user?'Cloud saves':'Sign in'}</button></div>
    </section>
  </CraftSprites.Provider>;
}
