import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Check, ChefHat, CirclePause, Play, Plus, RotateCcw, Sparkles } from 'lucide-react';
import { COOKING_ACTIONS, PRESET_IDEAS, STARTING_INGREDIENTS } from '../lib/kitchen/catalog';
import { createCraftingPlan } from '../lib/kitchen/originalPlanner';
import { collectKitchenStep, runKitchenStep, sourceInventory, validKitchenPlan, validKitchenRecipe, type KitchenRecipe } from '../lib/kitchen/engine';
import { readCraftElements, saveCraftElements, SAVE_IMPORTED_EVENT, getSaveError } from '../lib/saveData';
import { requestJson } from '../lib/api';
import { useGame } from '../lib/gameStore';
import { ElementSprite } from './ElementSprite';

const DRAFT = 'oddkin-kitchen-draft-v1';
function restoreDraft(): { recipe: KitchenRecipe | null; completed: number } {
  try {
    const draft = JSON.parse(localStorage.getItem(DRAFT) || 'null');
    if (validKitchenRecipe(draft?.recipe) && Number.isInteger(draft.completed) && draft.completed >= 0 && draft.completed <= draft.recipe.steps.length) return draft;
  } catch { /* A bad draft must never touch the user's discovery save. */ }
  return { recipe: null, completed: 0 };
}
export function KitchenView({ visible }: { visible: boolean }) {
  const { setActiveTab } = useGame();
  const [initial] = useState(restoreDraft);
  const [goal, setGoal] = useState(initial.recipe?.goal || 'Laser Sword');
  const [mode, setMode] = useState<'local' | 'ai'>('local');
  const [recipe, setRecipe] = useState<KitchenRecipe | null>(initial.recipe);
  const [completed, setCompleted] = useState(initial.completed);
  const [elements, setElements] = useState(readCraftElements);
  const [planning, setPlanning] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [toolCategory, setToolCategory] = useState('all');
  const [customName, setCustomName] = useState('');
  const lock = useRef(false);
  const stop = useRef(false);
  const alive = useRef(true);
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    alive.current = true;
    const reload = () => { setElements(readCraftElements()); stop.current = true; };
    window.addEventListener(SAVE_IMPORTED_EVENT, reload);
    return () => { alive.current = false; stop.current = true; request.current?.abort(); window.removeEventListener(SAVE_IMPORTED_EVENT, reload); };
  }, []);
  useEffect(() => {
    if (!visible) stop.current = true;
    else setElements(readCraftElements());
  }, [visible]);
  const saveDraft = (next: KitchenRecipe, count: number) => {
    try { localStorage.setItem(DRAFT, JSON.stringify({ recipe: next, completed: count })); }
    catch { setError('This recipe cannot be saved for later. Free browser storage before leaving.'); }
  };
  const recipes = useMemo(() => elements.filter(el => el.kitchenRecipe), [elements]);
  const toolCategories = useMemo(() => [...new Set(COOKING_ACTIONS.map(t => t.category))], []);
  const tools = useMemo(() => COOKING_ACTIONS.filter(t => toolCategory === 'all' || t.category === toolCategory), [toolCategory]);
  const active = recipe?.steps[completed];
  const done = !!recipe && completed === recipe.steps.length;
  const finalElement = done ? elements.find(el => el.name.toLowerCase() === recipe.steps.at(-1)!.outputName.toLowerCase()) : undefined;
  const makePlan = async (requestedGoal = goal) => {
    if (lock.current || !requestedGoal.trim()) return;
    lock.current = true; setPlanning(true); setError(''); stop.current = false;
    try {
      const clean = requestedGoal.trim();
      const cached = readCraftElements().find(el => el.kitchenRecipe?.goal.toLowerCase() === clean.toLowerCase() && el.kitchenRecipe.source === mode)?.kitchenRecipe;
      request.current = new AbortController();
      const plan = cached || (mode === 'local' ? createCraftingPlan(clean) : (await requestJson<{ plan: unknown }>('/api/kitchen/plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ goal: clean }), signal: request.current.signal })).plan);
      if (!validKitchenPlan(plan)) throw new Error('This plan has an unresolved ingredient. Try an AI plan or another creation.');
      const next: KitchenRecipe = { ...plan, goal: clean, source: mode, createdAt: cached?.createdAt || Date.now() };
      if (!alive.current) return;
      setRecipe(next); setCompleted(0); setGoal(clean); saveDraft(next, 0);
    } catch (e) { if (alive.current) setError(e instanceof Error ? e.message : 'Could not plan this creation.'); }
    finally { lock.current = false; if (alive.current) setPlanning(false); }
  };
  const execute = async (all: boolean) => {
    if (lock.current || !recipe || done) return;
    lock.current = true; stop.current = false; setRunning(true); setError('');
    let count = completed;
    try {
      let inventory = sourceInventory(recipe);
      for (const step of recipe.steps.slice(0, completed)) inventory = runKitchenStep(step, inventory);
      do {
        if (stop.current || !alive.current) break;
        const step = recipe.steps[count];
        inventory = runKitchenStep(step, inventory);
        const next = collectKitchenStep(readCraftElements(), step, count === recipe.steps.length - 1 ? recipe : undefined);
        saveCraftElements(next); setElements(next);
        if (getSaveError()) throw new Error(getSaveError()!);
        count++; setCompleted(count); saveDraft(recipe, count);
        // Let the completed step paint before the next real local state transition.
        if (all && count < recipe.steps.length) await new Promise(resolve => setTimeout(resolve, 350));
      } while (all && count < recipe.steps.length);
    } catch (e) { if (alive.current) setError(e instanceof Error ? e.message : 'Crafting stopped.'); }
    finally { lock.current = false; if (alive.current) setRunning(false); }
  };
  const addIngredient = () => {
    const name = customName.trim(); if (!name || lock.current) return;
    const next = collectKitchenStep(readCraftElements(), { toolName: 'add', inputs: ['Custom creation'], outputName: name, outputEmoji: '🧩', category: 'Custom ingredient', explanation: 'An ingredient added by you in the Kitchen.' });
    saveCraftElements(next); setElements(next); setCustomName(''); if (getSaveError()) setError(getSaveError()!);
  };
  return <section className="kitchen-view" aria-label="Function Kitchen">
    <header className="kitchen-intro"><span className="kitchen-eyebrow"><ChefHat size={16} /> FUNCTION KITCHEN × ODDKIN</span><h1>A little kitchen.<br />For anything.</h1><p>Start with an idea. Make the parts. Collect every discovery.</p></header>
    <form className="kitchen-creator" onSubmit={e => { e.preventDefault(); void makePlan(); }}>
      <label htmlFor="kitchen-goal">What would you like to make?</label>
      <div className="kitchen-goal-row"><input id="kitchen-goal" value={goal} maxLength={120} onChange={e => setGoal(e.target.value)} placeholder="A robot, ramen, a crystal wand…" disabled={planning || running} /><button disabled={planning || running || !goal.trim()}><Sparkles size={18} />{planning ? 'Planning…' : 'Plan creation'}</button></div>
      <div className="kitchen-options"><label><input type="radio" name="kitchen-mode" checked={mode === 'local'} onChange={() => setMode('local')} disabled={planning || running} /> Local recipe</label><label><input type="radio" name="kitchen-mode" checked={mode === 'ai'} onChange={() => setMode('ai')} disabled={planning || running} /> AI recipe</label><span>{mode === 'local' ? 'Function-kitchen templates · no AI call' : 'A custom plan from Gemini'}</span></div>
    </form>
    <div className="kitchen-ideas" aria-label="Creation ideas">{PRESET_IDEAS.slice(0,6).map(idea => <button key={idea.name} disabled={planning || running} onClick={() => void makePlan(idea.name)}>{idea.emoji} {idea.name}</button>)}</div>
    {error && <div className="kitchen-error" role="alert">{error}</div>}
    <div className="kitchen-layout"><div>
      {recipe ? <section className="kitchen-panel kitchen-recipe">
        <div className="kitchen-panel-heading"><div><span className="kitchen-eyebrow">{recipe.source === 'ai' ? 'AI-GENERATED RECIPE' : 'LOCAL TEMPLATE RECIPE'}</span><h2>{recipe.goal}</h2></div><span className="kitchen-count">{completed}/{recipe.steps.length}</span></div>
        <p>{recipe.summary}</p><p className="kitchen-note">Virtual crafting simulation. Source materials below are supplied by this recipe; steps are game actions, not real-world instructions.</p>
        <div className="kitchen-supplies">{recipe.sourceMaterials.map(name => <span key={name}>{name}</span>)}</div>
        <progress aria-label="Recipe completion" max={recipe.steps.length} value={completed} />
        <div className="kitchen-run-controls">{running ? <button onClick={() => { stop.current = true; }}> <CirclePause size={17} /> Pause</button> : <><button disabled={done || planning} onClick={() => void execute(true)}><Play size={17} />{completed ? 'Continue recipe' : 'Run recipe'}</button><button disabled={done || planning} className="kitchen-secondary" onClick={() => void execute(false)}>Next step <ArrowRight size={16} /></button></>}</div>
        <ol className="kitchen-timeline">{recipe.steps.map((step,index) => <li key={`${index}:${step.outputName}`} className={index < completed ? 'complete' : index === completed ? 'current' : ''}>
          <span className="kitchen-step-number">{index < completed ? <Check size={16} /> : index+1}</span><div><span className="kitchen-tool-name">{step.toolName.replaceAll('_',' ')}</span><h3>{step.outputName}</h3><p className="kitchen-inputs">{step.inputs.join(' + ')}</p><p>{step.explanation}</p></div>
          {index < completed && <ElementSprite name={step.outputName} custom={elements.find(el => el.name.toLowerCase() === step.outputName.toLowerCase())?.customSpriteUrl} fallback={step.outputEmoji} className="kitchen-step-art" />}
        </li>)}</ol>
      </section> : <section className="kitchen-panel kitchen-empty"><ChefHat size={40} /><h2>Anything starts somewhere.</h2><p>Choose an idea above to see its materials, tools, and step-by-step recipe.</p><span>Powered by your Function-kitchen recipe planner</span></section>}
      {done && <section className="kitchen-panel kitchen-finished"><span className="kitchen-eyebrow">CREATION COMPLETE</span><ElementSprite name={recipe.goal} custom={finalElement?.customSpriteUrl} fallback={recipe.steps.at(-1)?.outputEmoji} className="kitchen-result-art" /><h2>{recipe.goal}</h2><p>{recipe.finalDescription}</p><p className="kitchen-note">Saved to your shared discoveries. Use it in Foundry or Craft.</p><button onClick={() => setActiveTab('foundry')}>Use in Foundry <ArrowRight size={17} /></button><button className="kitchen-secondary" onClick={() => setActiveTab('sprite-lab')}>Customize sprite</button></section>}
    </div><aside>
      <section className="kitchen-panel"><div className="kitchen-panel-heading"><h2>Tool shelf</h2><span>{COOKING_ACTIONS.length} tools</span></div><label className="kitchen-select-label">Filter tools<select value={toolCategory} onChange={e => setToolCategory(e.target.value)}>{['all',...toolCategories].map(c => <option key={c} value={c}>{c === 'all' ? 'All disciplines' : c}</option>)}</select></label><div className="kitchen-tools">{tools.map(tool => <div key={tool.name} className={active?.toolName === tool.name ? 'active' : ''}><span>{tool.emoji}</span><span>{tool.displayName.replaceAll('_',' ')}</span></div>)}</div></section>
      <section className="kitchen-panel"><h2>Your ingredients</h2><p className="kitchen-note">{elements.length} shared discoveries · {STARTING_INGREDIENTS.length} source inventory items from Function-kitchen</p><form onSubmit={e => { e.preventDefault(); addIngredient(); }} className="kitchen-add"><input aria-label="Custom ingredient name" maxLength={120} value={customName} onChange={e => setCustomName(e.target.value)} placeholder="Add a custom ingredient" /><button aria-label="Add ingredient" disabled={running || planning || !customName.trim()}><Plus size={18} /></button></form><div className="kitchen-supplies">{elements.slice(-12).reverse().map(el => <button key={el.id} disabled={planning || running} onClick={() => setGoal(el.name)}>{el.emoji} {el.name}</button>)}</div></section>
    </aside></div>
    <section className="kitchen-panel"><div className="kitchen-panel-heading"><h2>Recipe collection</h2><span>{recipes.length} creations</span></div>{!recipes.length ? <p className="kitchen-note">Finish a recipe to save it here. Completed recipes travel with your ODDKIN backups.</p> : <div className="kitchen-gallery">{recipes.map(el => <button key={el.id} disabled={running || planning} onClick={() => { const saved = el.kitchenRecipe!; setRecipe(saved); setGoal(saved.goal); setCompleted(saved.steps.length); saveDraft(saved, saved.steps.length); }}><ElementSprite name={el.name} custom={el.customSpriteUrl} fallback={el.emoji} className="kitchen-step-art" /><strong>{el.name}</strong><span>{el.kitchenRecipe!.steps.length} steps · {el.kitchenRecipe!.source === 'ai' ? 'AI recipe' : 'Local template'}</span></button>)}</div>}</section>
  </section>;
}
