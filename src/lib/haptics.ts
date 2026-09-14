/**
 * ODDKIN FOUNDRY - Tactile Android & Google Pixel Haptics Engine
 * Provides specialized linear-resonant vibrational feedback patterns
 * tuned for Google Pixel and Android actuators (tap, drag-proximity, fusion, discovery).
 */

class HapticsEngine {
  private enabled: boolean = true;

  constructor() {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('oddkin_haptics_enabled');
      this.enabled = saved !== 'false';
    }
  }

  public isSupported(): boolean {
    return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
  }

  public isEnabled(): boolean {
    return this.enabled && this.isSupported();
  }

  public setEnabled(val: boolean) {
    this.enabled = val;
    if (typeof window !== 'undefined') {
      localStorage.setItem('oddkin_haptics_enabled', String(val));
    }
    if (val) {
      this.lightTap();
    }
  }

  public toggle(): boolean {
    this.setEnabled(!this.enabled);
    return this.enabled;
  }

  // Micro-tactile click for tab buttons, small switches, search bar
  public lightTap() {
    if (!this.isEnabled()) return;
    try {
      navigator.vibrate(8);
    } catch {}
  }

  // Firm tactile response for element spawn, item duplicate, modal opening
  public mediumTap() {
    if (!this.isEnabled()) return;
    try {
      navigator.vibrate(16);
    } catch {}
  }

  // Heavy mechanical clunk for resetting, clearing canvas, or critical action
  public heavyTap() {
    if (!this.isEnabled()) return;
    try {
      navigator.vibrate(32);
    } catch {}
  }

  // Micro-tick when dragging near another element (magnetic snap sensation)
  public proximityTick() {
    if (!this.isEnabled()) return;
    try {
      navigator.vibrate(6);
    } catch {}
  }

  // Synthesis matter fusion pulse
  public fusionPulse() {
    if (!this.isEnabled()) return;
    try {
      navigator.vibrate([14, 30, 22]);
    } catch {}
  }

  // Rare discovery chime vibration
  public discovery() {
    if (!this.isEnabled()) return;
    try {
      navigator.vibrate([24, 40, 18, 40, 36]);
    } catch {}
  }

  // First Discovery ever milestone celebration
  public firstDiscovery() {
    if (!this.isEnabled()) return;
    try {
      navigator.vibrate([35, 45, 20, 45, 60]);
    } catch {}
  }

  // Pokémon-style Shiny Sparkle celebration vibration
  public shinySparkle() {
    if (!this.isEnabled()) return;
    try {
      navigator.vibrate([16, 32, 16, 32, 28, 48, 40]);
    } catch {}
  }

  // Error or invalid attempt warning
  public warning() {
    if (!this.isEnabled()) return;
    try {
      navigator.vibrate([40, 50, 40]);
    } catch {}
  }
}

export const haptics = new HapticsEngine();
