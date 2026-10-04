/**
 * ODDKIN FOUNDRY - Central Game State & Persistence Store
 * Manages materials, Oddkin species, processes, experiments, habitats,
 * procedural sprite generation, and real latency discovery pipeline.
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Material, Oddkin, Process, ExperimentLog, Habitat, SynthesisResult, PhotoSeedResult, SketchSeedResult } from '../types';
import { STARTER_MATERIALS, ALL_PROCESSES, INITIAL_HABITATS, mergeProcesses } from './starterData';
import { generateMaterialSprite, generateOddkinSprite, MATERIAL_SPRITE_RENDERER_VERSION } from './pixelRenderer';
import { requestJson } from './api';
import { validMaterial, validOddkin } from './validation';
import { readFoundrySave, saveFoundry, exportCompleteSave, importCompleteSave } from './saveData';
import { sound } from './audio';
import { matchesFoundryRecipe, validSynthesisResult, resolveMaterialDiscovery } from './foundryRecipes';

const STORAGE_KEY = 'oddkin_foundry_save_v1';

export type SynthesisStage =
  | 'ANALYZING MATERIALS'
  | 'APPLYING PROCESS'
  | 'CHECKING LINEAGE'
  | 'RESOLVING RESULT'
  | 'CATALOGUING DISCOVERY'
  | 'RENDERING SPRITE'
  | null;

interface GameState {
  materials: Material[];
  oddkinCollection: Oddkin[];
  processes: Process[];
  experiments: ExperimentLog[];
  habitats: Habitat[];
  activeHabitatId: string;
  slotA: Material | null;
  slotB: Material | null;
  selectedProcess: Process | null;
  isSynthesizing: boolean;
  synthesisError: string | null;
  synthesisStage: SynthesisStage;
  recentDiscovery: {
    material?: Material;
    oddkin?: Oddkin;
    isNew: boolean;
    isChroma?: boolean;
    explanation: string;
  } | null;
  activeTab: 'infinite-craft' | 'foundry' | 'archive' | 'sprite-lab' | 'notebook' | 'seeds';
  inspectedItem: { type: 'material' | 'oddkin'; item: Material | Oddkin } | null;
  isMuted: boolean;
  
  // Actions
  setSlotA: (m: Material | null) => void;
  setSlotB: (m: Material | null) => void;
  setSelectedProcess: (p: Process | null) => void;
  clearSlots: () => void;
  setActiveTab: (tab: 'infinite-craft' | 'foundry' | 'archive' | 'sprite-lab' | 'notebook' | 'seeds') => void;
  setInspectedItem: (item: { type: 'material' | 'oddkin'; item: Material | Oddkin } | null) => void;
  closeDiscoveryModal: () => void;
  toggleMute: () => void;
  runSynthesis: () => Promise<void>;
  assignOddkinToHabitat: (oddkinId: string, habitatId: string) => void;
  harvestHabitat: (habitatId: string) => void;
  addPhotoSeedMaterial: (data: PhotoSeedResult) => Material;
  applySketchSeedBonus: (data: SketchSeedResult) => void;
  transformOddkinWithCatalyst: (oddkinId: string, catalystMat: Material) => boolean;
  resetGame: () => void;
  exportSaveData: () => string;
  importSaveData: (jsonStr: string) => boolean;
}

const GameContext = createContext<GameState | null>(null);

function deduplicateMaterials(list: Material[]): Material[] {
  const seen = new Set<string>();
  return list.filter(m => {
    if (!m || !m.id) return false;
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });
}

function deduplicateOddkins(list: Oddkin[]): Oddkin[] {
  const seen = new Set<string>();
  return list.filter(o => {
    if (!o || !o.speciesId) return false;
    if (seen.has(o.speciesId)) return false;
    seen.add(o.speciesId);
    return true;
  });
}

export function GameProvider({ children }: { children: React.ReactNode }) {
  // Initialize with starters hydrated with sprites
  const [materials, setMaterials] = useState<Material[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = readFoundrySave();
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.materials && Array.isArray(parsed.materials) && parsed.materials.length > 0) {
            return deduplicateMaterials(parsed.materials);
          }
        }
      } catch (e) {
        console.error('Error loading save:', e);
      }
    }
    return STARTER_MATERIALS.map(m => ({
      ...m,
      customSpriteUrl: generateMaterialSprite(m),
      spriteRendererVersion: MATERIAL_SPRITE_RENDERER_VERSION
    }));
  });

  const [oddkinCollection, setOddkinCollection] = useState<Oddkin[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = readFoundrySave();
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.oddkinCollection && Array.isArray(parsed.oddkinCollection)) {
            return deduplicateOddkins(parsed.oddkinCollection);
          }
        }
      } catch (e) {
        console.error('Error loading oddkin save:', e);
      }
    }
    return [];
  });

  const [processes, setProcesses] = useState<Process[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = readFoundrySave();
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.processes && Array.isArray(parsed.processes)) {
            return mergeProcesses(parsed.processes);
          }
        }
      } catch (e) {
        console.error('Error loading processes save:', e);
      }
    }
    return ALL_PROCESSES;
  });

  const [experiments, setExperiments] = useState<ExperimentLog[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = readFoundrySave();
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.experiments && Array.isArray(parsed.experiments)) {
            return parsed.experiments;
          }
        }
      } catch (e) {
        console.error('Error loading experiments save:', e);
      }
    }
    return [];
  });

  const [habitats, setHabitats] = useState<Habitat[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = readFoundrySave();
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.habitats && Array.isArray(parsed.habitats)) {
            return parsed.habitats;
          }
        }
      } catch (e) {
        console.error('Error loading habitats save:', e);
      }
    }
    return INITIAL_HABITATS;
  });

  const [activeHabitatId, setActiveHabitatId] = useState<string>('hab_woodland');
  const [slotA, setSlotA] = useState<Material | null>(null);
  const [slotB, setSlotB] = useState<Material | null>(null);
  const [selectedProcess, setSelectedProcess] = useState<Process | null>(null);
  const [isSynthesizing, setIsSynthesizing] = useState<boolean>(false);
  const synthesisInFlight = useRef(false);
  const [synthesisError, setSynthesisError] = useState<string | null>(null);
  const [synthesisStage, setSynthesisStage] = useState<SynthesisStage>(null);
  const [recentDiscovery, setRecentDiscovery] = useState<GameState['recentDiscovery']>(null);
  const [activeTab, setActiveTab] = useState<'infinite-craft' | 'foundry' | 'archive' | 'sprite-lab' | 'notebook' | 'seeds'>('foundry');
  const [inspectedItem, setInspectedItem] = useState<GameState['inspectedItem']>(null);
  const [isMuted, setIsMuted] = useState<boolean>(() => sound.isMuted());

  // Save to localStorage on state changes
  useEffect(() => {
    try {
      const payload = {
        version: 1,
        savedAt: Date.now(),
        materials,
        oddkinCollection,
        processes,
        experiments,
        habitats,
      };
      saveFoundry(payload);
    } catch (err) {
      console.warn('LocalStorage save error:', err);
    }
  }, [materials, oddkinCollection, processes, experiments, habitats]);

  // Ensure starter materials have generated sprites
  useEffect(() => {
    setMaterials(prev => prev.map(m => m.customSpriteUrl && m.spriteRendererVersion === MATERIAL_SPRITE_RENDERER_VERSION ? m : {
      ...m,
      customSpriteUrl: generateMaterialSprite(m),
      spriteRendererVersion: MATERIAL_SPRITE_RENDERER_VERSION,
    }));
  }, []);

  const clearSlots = useCallback(() => {
    sound.playClick();
    setSlotA(null);
    setSlotB(null);
    setSelectedProcess(null);
  }, []);

  const toggleMute = useCallback(() => {
    const nextMute = sound.toggleMute();
    setIsMuted(nextMute);
  }, []);

  const closeDiscoveryModal = useCallback(() => {
    sound.playClick();
    setRecentDiscovery(null);
  }, []);

  // Main synthesis orchestration pipeline
  const runSynthesis = useCallback(async () => {
    if (!slotA || !selectedProcess || synthesisInFlight.current) return;
    synthesisInFlight.current = true;

    setSynthesisError(null);
    setIsSynthesizing(true);
    sound.playClunk();
    sound.startMachineHum();

    // Preserve both ingredient multiplicity and process identity.
    const existingMatch = materials.find(m => matchesFoundryRecipe(m, slotA, slotB, selectedProcess.id));

    try {
      // 1. ANALYZING MATERIALS
      setSynthesisStage('ANALYZING MATERIALS');
      sound.playGlassTap();
      await new Promise(r => setTimeout(r, 450));

      // 2. APPLYING PROCESS
      setSynthesisStage('APPLYING PROCESS');
      if (selectedProcess.id === 'CHARGE' || selectedProcess.id === 'HEAT') {
        sound.playSpark();
      } else if (selectedProcess.id === 'MIX' || selectedProcess.id === 'SOAK') {
        sound.playBubble();
      } else {
        sound.playClunk();
      }
      await new Promise(r => setTimeout(r, 550));

      // 3. CHECKING LINEAGE
      setSynthesisStage('CHECKING LINEAGE');
      await new Promise(r => setTimeout(r, 400));

      // If already discovered in memory, resolve quickly without synonym explosion!
      if (existingMatch) {
        setSynthesisStage('RESOLVING RESULT');
        await new Promise(r => setTimeout(r, 300));
        sound.stopMachineHum();
        sound.playDiscoveryChime(existingMatch.rarity);

        // Record experiment in notebook
        const log: ExperimentLog = {
          id: `exp_${Date.now()}`,
          timestamp: Date.now(),
          inputNames: [slotA.displayName, ...(slotB ? [slotB.displayName] : [])],
          processName: selectedProcess.name,
          success: true,
          resultName: existingMatch.displayName,
          observation: `Reproduced canonical ${existingMatch.displayName}. ${existingMatch.discoveryExplanation}`,
        };
        setExperiments(prev => [log, ...prev]);

        setRecentDiscovery({
          material: existingMatch,
          isNew: false,
          explanation: `Already in Archive: ${existingMatch.discoveryExplanation}`
        });

        setIsSynthesizing(false);
        setSynthesisStage(null);
        return;
      }

      // 4. RESOLVING RESULT via API
      setSynthesisStage('RESOLVING RESULT');

      const data = await requestJson<SynthesisResult>('/api/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputMaterialA: slotA,
          inputMaterialB: slotB || undefined,
          process: selectedProcess,
          existingMaterialNames: materials.map(m => m.canonicalName),
          knownOddkinNames: oddkinCollection.map(o => o.speciesName),
        }),
      });

      if (!validSynthesisResult(data)) {
        throw new Error('The server returned an invalid discovery. Please retry.');
      }

      // 5. CATALOGUING & RENDERING SPRITE
      setSynthesisStage('CATALOGUING DISCOVERY');
      await new Promise(r => setTimeout(r, 350));

      setSynthesisStage('RENDERING SPRITE');

      sound.stopMachineHum();

      if (data.status === 'life_emergence' && data.oddkin) {
        // RARE CHROMA CHECK (approx 1 in 16 chance)
        const isChromaRoll = Math.random() < 0.12;
        const newOddkin: Oddkin = {
          ...data.oddkin,
          isChromaActive: isChromaRoll,
          variantFormsDiscovered: isChromaRoll ? ['standard', 'chroma'] : ['standard'],
        };
        newOddkin.customSpriteUrl = generateOddkinSprite(newOddkin, { isChroma: isChromaRoll });

        // Dramatic Oddkin awakening sound & visuals
        sound.playOddkinAwakening();
        setTimeout(() => sound.playOddkinChirp(newOddkin.chirpToneHz, newOddkin.temperament), 1200);

        setOddkinCollection(prev => [newOddkin, ...prev]);

        // Auto assign to first matching habitat
        if (habitats.length > 0) {
          setHabitats(prev => prev.map((h, i) => i === 0 ? {
            ...h,
            residentOddkinIds: [...h.residentOddkinIds, newOddkin.speciesId]
          } : h));
        }

        // Unlock biological processes if not unlocked
        setProcesses(prev => prev.map(p => p.id === 'INCUBATE' || p.id === 'GROW' ? { ...p, unlocked: true } : p));

        // Notebook entry
        const log: ExperimentLog = {
          id: `exp_${Date.now()}`,
          timestamp: Date.now(),
          inputNames: [slotA.displayName, ...(slotB ? [slotB.displayName] : [])],
          processName: selectedProcess.name,
          success: true,
          resultName: newOddkin.speciesName,
          isOddkinEmergence: true,
          observation: `LIFE AWAKENED! Created ${newOddkin.speciesName} (${newOddkin.titleOrClassification}). ${data.explanation}`,
        };
        setExperiments(prev => [log, ...prev]);

        setRecentDiscovery({
          oddkin: newOddkin,
          isNew: true,
          isChroma: isChromaRoll,
          explanation: data.explanation || newOddkin.description,
        });

      } else if ((data.status === 'new_material' || data.status === 'existing_material') && data.material) {
        const discovery = resolveMaterialDiscovery(data.material, materials, data.status);
        const newMat: Material = {
          ...discovery.material,
          customSpriteUrl: discovery.material.customSpriteUrl || generateMaterialSprite(discovery.material),
          spriteRendererVersion: MATERIAL_SPRITE_RENDERER_VERSION,
        };

        sound.playDiscoveryChime(newMat.rarity);
        setMaterials(prev => deduplicateMaterials([newMat, ...prev]));

        // Unlock processes based on discoveries (e.g. Glass unlocks POLISH, Spark unlocks CHARGE, etc.)
        if (newMat.canonicalName.includes('GLASS') || newMat.canonicalName.includes('CERAMIC')) {
          setProcesses(prev => prev.map(p => p.id === 'POLISH' ? { ...p, unlocked: true } : p));
        }
        if (newMat.canonicalName.includes('RUST') || newMat.properties?.metallic) {
          setProcesses(prev => prev.map(p => p.id === 'MAGNETIZE' ? { ...p, unlocked: true } : p));
        }
        if (newMat.properties?.liquid) {
          setProcesses(prev => prev.map(p => p.id === 'DISTILL' || p.id === 'FILTER' ? { ...p, unlocked: true } : p));
        }

        // Notebook entry
        const log: ExperimentLog = {
          id: `exp_${Date.now()}`,
          timestamp: Date.now(),
          inputNames: [slotA.displayName, ...(slotB ? [slotB.displayName] : [])],
          processName: selectedProcess.name,
          success: true,
          resultName: newMat.displayName,
          observation: `${discovery.isNew ? 'Discovered' : 'Rediscovered'} ${newMat.displayName} (${newMat.rarity}). ${data.explanation}`,
        };
        setExperiments(prev => [log, ...prev]);

        setRecentDiscovery({
          material: newMat,
          isNew: discovery.isNew,
          explanation: data.explanation || newMat.discoveryExplanation,
        });

      } else {
        // No transformation / resisted change
        sound.playGlassTap();
        const log: ExperimentLog = {
          id: `exp_${Date.now()}`,
          timestamp: Date.now(),
          inputNames: [slotA.displayName, ...(slotB ? [slotB.displayName] : [])],
          processName: selectedProcess.name,
          success: false,
          observation: data.observationIfFailed || `The material resisted ${selectedProcess.name.toLowerCase()} processing with no structural change.`,
          hint: data.hintIfFailed || `Try combining with a reactive solvent or applying thermal excitation first.`
        };
        setExperiments(prev => [log, ...prev]);

        setRecentDiscovery({
          isNew: false,
          explanation: log.observation
        });
      }

    } catch (error) {
      setSynthesisError(error instanceof Error ? error.message : 'Synthesis failed. Please retry.');
      sound.stopMachineHum();
      sound.playSpark();
    } finally {
      synthesisInFlight.current = false;
      setIsSynthesizing(false);
      setSynthesisStage(null);
    }
  }, [slotA, slotB, selectedProcess, isSynthesizing, materials, oddkinCollection, habitats]);

  // Habitat oddkin assignment
  const assignOddkinToHabitat = useCallback((oddkinId: string, habitatId: string) => {
    sound.playClick();
    setHabitats(prev => prev.map(h => {
      if (h.id === habitatId) {
        if (h.residentOddkinIds.includes(oddkinId)) return h;
        return { ...h, residentOddkinIds: [...h.residentOddkinIds, oddkinId] };
      }
      return { ...h, residentOddkinIds: h.residentOddkinIds.filter(id => id !== oddkinId) };
    }));
  }, []);

  // Passive discovery harvest in habitat
  const harvestHabitat = useCallback((habitatId: string) => {
    const target = habitats.find(h => h.id === habitatId);
    if (!target || target.residentOddkinIds.length === 0) return;

    sound.playDiscoveryChime('UNCOMMON');
    const resident = oddkinCollection.find(o => o.speciesId === target.residentOddkinIds[0]);
    const speciesName = resident ? resident.speciesName : 'Oddkin';

    // Generate a contextual forage sample
    const forageName = `${target.type === 'woodland' ? 'Amber Resin' : target.type === 'bog' ? 'Phosphor Slime' : target.type === 'garden' ? 'Prismatic Nectar' : 'Forged Shard'}`;
    const forageMat: Material = {
      id: `mat_forage_${Date.now()}`,
      canonicalName: forageName.toUpperCase().replace(/\s+/g, '_'),
      displayName: forageName,
      description: `Discovered and retrieved by ${speciesName} while foraging in ${target.name}.`,
      category: 'Composite',
      subcategory: 'Passive Forage',
      stateOfMatter: 'amorphous',
      properties: { organic: true, mineral: false, liquid: false, fragile: true, living: false, edible: false, metallic: false, gaseous: false, crystalline: false, synthetic: false, conductive: false, magnetic: false, flammable: true, toxic: false, elastic: true, porous: false },
      temperatureClass: 'ambient',
      semanticTags: ['foraged', 'organic', 'rare', 'curio'],
      lineage: {
        parentIds: [],
        depth: 3,
        generation: 1,
        recipeDesc: `Found in ${target.name} by ${speciesName}`
      },
      rarity: 'RARE',
      discoveredAt: Date.now(),
      possibleProcessAffinities: ['HEAT', 'MIX', 'DISTILL', 'INCUBATE'],
      lifePotential: 65,
      spriteDescriptor: {
        palette: ['#b45309', '#f59e0b', '#fef08a'],
        baseShape: 'curio',
        primaryColor: '#f59e0b',
        secondaryColor: '#b45309',
        accentColor: '#fef08a',
        glow: true,
      },
      discoveryExplanation: `${speciesName} brought this back to the foundry.`,
    };
    forageMat.customSpriteUrl = generateMaterialSprite(forageMat);
    forageMat.spriteRendererVersion = MATERIAL_SPRITE_RENDERER_VERSION;

    setMaterials(prev => [forageMat, ...prev]);
    setHabitats(prev => prev.map(h => h.id === habitatId ? { ...h, lastHarvestTimestamp: Date.now() } : h));

    setRecentDiscovery({
      material: forageMat,
      isNew: true,
      explanation: `${speciesName} scavenged this curious specimen from ${target.name}!`
    });
  }, [habitats, oddkinCollection]);

  // Add material created via Photo Seed
  const addPhotoSeedMaterial = useCallback((data: PhotoSeedResult): Material => {
    sound.playDiscoveryChime('UNCOMMON');
    const newMat: Material = {
      id: `mat_photo_${Date.now()}`,
      canonicalName: data.canonicalName,
      displayName: data.displayName,
      description: data.description,
      category: data.category,
      subcategory: 'Optical Seed',
      stateOfMatter: data.stateOfMatter,
      properties: {
        organic: false, living: false, edible: false, metallic: false, mineral: false,
        liquid: false, gaseous: false, crystalline: false, synthetic: false, conductive: false,
        magnetic: false, flammable: false, toxic: false, fragile: false, elastic: false, porous: false,
        ...data.properties
      },
      temperatureClass: data.temperatureClass,
      semanticTags: data.semanticTags,
      lineage: {
        parentIds: [],
        depth: 1,
        generation: 0,
        recipeDesc: 'Real-world optical scan'
      },
      rarity: 'UNCOMMON',
      discoveredAt: Date.now(),
      possibleProcessAffinities: ['MIX', 'HEAT', 'CRUSH', 'INCUBATE'],
      lifePotential: 45,
      spriteDescriptor: data.spriteDescriptor,
      discoveryExplanation: data.discoveryExplanation,
    };
    newMat.customSpriteUrl = generateMaterialSprite(newMat);
    newMat.spriteRendererVersion = MATERIAL_SPRITE_RENDERER_VERSION;

    setMaterials(prev => deduplicateMaterials([newMat, ...prev]));
    setRecentDiscovery({
      material: newMat,
      isNew: true,
      explanation: `Digitized physical sample into gameplay material seed: ${newMat.displayName}!`
    });
    return newMat;
  }, []);

  // Sketch seed bonus
  const applySketchSeedBonus = useCallback((data: SketchSeedResult) => {
    sound.playSpark();
    // Creates a glyph seed material with morphology hints
    const glyphMat: Material = {
      id: `mat_glyph_${Date.now()}`,
      canonicalName: data.conceptName.toUpperCase().replace(/\s+/g, '_'),
      displayName: data.conceptName,
      description: `A latent morphology glyph: ${data.traits.join(', ')}. Imbues bio-reactions with distinctive physical shapes.`,
      category: 'Energy',
      subcategory: 'Morphological Glyph',
      stateOfMatter: 'amorphous',
      properties: {
        organic: true, living: false, edible: false, metallic: false, mineral: false,
        liquid: false, gaseous: false, crystalline: false, synthetic: false, conductive: true,
        magnetic: false, flammable: false, toxic: false, fragile: false, elastic: true, porous: false
      },
      temperatureClass: 'ambient',
      semanticTags: ['sketch', 'glyph', ...data.traits],
      lineage: {
        parentIds: [],
        depth: 2,
        generation: 0,
        recipeDesc: 'Hand-drawn morphological doodle'
      },
      rarity: 'RARE',
      discoveredAt: Date.now(),
      possibleProcessAffinities: ['INCUBATE', 'MIX', 'CHARGE'],
      lifePotential: 50 + data.lifePotentialBonus,
      spriteDescriptor: {
        palette: [data.morphologyHints.primaryColor, '#ffffff', '#4f46e5'],
        baseShape: 'sparks',
        primaryColor: data.morphologyHints.primaryColor,
        secondaryColor: '#4f46e5',
        accentColor: '#ffffff',
        glow: true,
      },
      discoveryExplanation: `Interpreted sketch into an active bio-morphology catalyst.`,
    };
    glyphMat.customSpriteUrl = generateMaterialSprite(glyphMat);
    glyphMat.spriteRendererVersion = MATERIAL_SPRITE_RENDERER_VERSION;

    setMaterials(prev => [glyphMat, ...prev]);
    setRecentDiscovery({
      material: glyphMat,
      isNew: true,
      explanation: `Doodle successfully synthesized into ${glyphMat.displayName}! Incorporate it into an incubation to manifest its anatomy.`
    });
  }, []);

  // Transform Oddkin with a catalyst material
  const transformOddkinWithCatalyst = useCallback((oddkinId: string, catalystMat: Material): boolean => {
    const target = oddkinCollection.find(o => o.speciesId === oddkinId);
    if (!target) return false;

    sound.playOddkinAwakening();

    const transformedName = `${catalystMat.displayName} ${target.speciesName}`;
    const updatedOddkin: Oddkin = {
      ...target,
      speciesName: transformedName,
      titleOrClassification: `Vitrified ${target.titleOrClassification}`,
      rarity: 'EXOTIC',
      description: `Underwent metamorphosis through resonant reaction with ${catalystMat.displayName}.`,
      inheritedMaterialTraits: [...target.inheritedMaterialTraits, `Catalyzed by ${catalystMat.displayName}`],
      spriteSpecification: {
        ...target.spriteSpecification,
        primaryColor: catalystMat.spriteDescriptor.primaryColor,
        secondaryColor: catalystMat.spriteDescriptor.secondaryColor,
        accentColor: catalystMat.spriteDescriptor.accentColor,
        isChroma: true,
      }
    };
    updatedOddkin.customSpriteUrl = generateOddkinSprite(updatedOddkin, { isChroma: true });

    setOddkinCollection(prev => prev.map(o => o.speciesId === oddkinId ? updatedOddkin : o));
    setRecentDiscovery({
      oddkin: updatedOddkin,
      isNew: true,
      isChroma: true,
      explanation: `${target.speciesName} transformed into ${transformedName}!`
    });
    return true;
  }, [oddkinCollection]);

  const resetGame = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    const freshStarters = STARTER_MATERIALS.map(m => ({
      ...m,
      customSpriteUrl: generateMaterialSprite(m),
      spriteRendererVersion: MATERIAL_SPRITE_RENDERER_VERSION
    }));
    setMaterials(freshStarters);
    setOddkinCollection([]);
    setProcesses(ALL_PROCESSES);
    setExperiments([]);
    setHabitats(INITIAL_HABITATS);
    setSlotA(null);
    setSlotB(null);
    setSelectedProcess(null);
    setRecentDiscovery(null);
    setInspectedItem(null);
  }, []);

  const exportSaveData = useCallback(() => {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      materials,
      oddkinCollection,
      processes,
      experiments,
      habitats,
    };
    return exportCompleteSave(payload);
  }, [materials, oddkinCollection, processes, experiments, habitats]);

  const importSaveData = useCallback((jsonStr: string): boolean => {
    try {
      if (isSynthesizing) return false;
      const parsed = importCompleteSave(jsonStr);
      setMaterials(parsed.materials);
      setOddkinCollection(parsed.oddkinCollection || []);
      setProcesses(mergeProcesses(parsed.processes));
      setExperiments(parsed.experiments || []);
      setHabitats(parsed.habitats || INITIAL_HABITATS);
      clearSlots();
      setRecentDiscovery(null);
      setInspectedItem(null);
      return true;
    } catch {
      return false;
    }
  }, [isSynthesizing, clearSlots]);

  const value = useMemo<GameState>(() => ({
    materials,
    oddkinCollection,
    processes,
    experiments,
    habitats,
    activeHabitatId,
    slotA,
    slotB,
    selectedProcess,
    isSynthesizing,
    synthesisStage,
    synthesisError,
    recentDiscovery,
    activeTab,
    inspectedItem,
    isMuted,
    setSlotA,
    setSlotB,
    setSelectedProcess,
    clearSlots,
    setActiveTab,
    setInspectedItem,
    closeDiscoveryModal,
    toggleMute,
    runSynthesis,
    assignOddkinToHabitat,
    harvestHabitat,
    addPhotoSeedMaterial,
    applySketchSeedBonus,
    transformOddkinWithCatalyst,
    resetGame,
    exportSaveData,
    importSaveData,
  }), [
    materials,
    oddkinCollection,
    processes,
    experiments,
    habitats,
    activeHabitatId,
    slotA,
    slotB,
    selectedProcess,
    isSynthesizing,
    synthesisStage,
    synthesisError,
    recentDiscovery,
    activeTab,
    inspectedItem,
    isMuted,
    clearSlots,
    closeDiscoveryModal,
    toggleMute,
    runSynthesis,
    assignOddkinToHabitat,
    harvestHabitat,
    addPhotoSeedMaterial,
    applySketchSeedBonus,
    transformOddkinWithCatalyst,
    resetGame,
    exportSaveData,
    importSaveData,
  ]);

  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}

