export interface GameSettings {
  audio: {
    masterVolume: number;
    musicVolume: number;
    sfxVolume: number;
    muted: boolean;
  };
  graphics: {
    showFps: boolean;
    showGrid: boolean;
    particleQuality: 'low' | 'medium' | 'high';
    uiScale: number;
  };
  controls: {
    scrollSpeed: number;
    edgeScrollEnabled: boolean;
    keyBindings: Record<string, string>;
  };
  gameplay: {
    showDamageNumbers: boolean;
    showHealthBars: 'always' | 'damaged' | 'selected';
    confirmAttack: boolean;
  };
}

const DEFAULT_SETTINGS: GameSettings = {
  audio: {
    masterVolume: 0.8,
    musicVolume: 0.6,
    sfxVolume: 0.8,
    muted: false,
  },
  graphics: {
    showFps: false,
    showGrid: false,
    particleQuality: 'medium',
    uiScale: 1.0,
  },
  controls: {
    scrollSpeed: 10,
    edgeScrollEnabled: true,
    keyBindings: {
      stop: 'S',
      holdPosition: 'H',
      attackMove: 'A',
      patrol: 'P',
      buildBasic: 'B',
      buildAdvanced: 'V',
      selectAll: 'Ctrl+A',
      controlGroup1: '1',
      controlGroup2: '2',
      controlGroup3: '3',
      controlGroup4: '4',
      controlGroup5: '5',
    },
  },
  gameplay: {
    showDamageNumbers: true,
    showHealthBars: 'damaged',
    confirmAttack: false,
  },
};

const STORAGE_KEY = 'blitz_settings';

class SettingsManager {
  private settings: GameSettings;
  private listeners: Set<(settings: GameSettings) => void> = new Set();

  constructor() {
    this.settings = this.load();
  }

  private load(): GameSettings {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return this.mergeWithDefaults(parsed);
      }
    } catch (e) {
      console.error('Failed to load settings:', e);
    }
    return { ...DEFAULT_SETTINGS };
  }

  private mergeWithDefaults(partial: Partial<GameSettings>): GameSettings {
    return {
      audio: { ...DEFAULT_SETTINGS.audio, ...partial.audio },
      graphics: { ...DEFAULT_SETTINGS.graphics, ...partial.graphics },
      controls: {
        ...DEFAULT_SETTINGS.controls,
        ...partial.controls,
        keyBindings: {
          ...DEFAULT_SETTINGS.controls.keyBindings,
          ...partial.controls?.keyBindings,
        },
      },
      gameplay: { ...DEFAULT_SETTINGS.gameplay, ...partial.gameplay },
    };
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch (e) {
      console.error('Failed to save settings:', e);
    }
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.settings);
    }
  }

  get(): GameSettings {
    return this.settings;
  }

  getAudio(): GameSettings['audio'] {
    return this.settings.audio;
  }

  getGraphics(): GameSettings['graphics'] {
    return this.settings.graphics;
  }

  getControls(): GameSettings['controls'] {
    return this.settings.controls;
  }

  getGameplay(): GameSettings['gameplay'] {
    return this.settings.gameplay;
  }

  setAudio(audio: Partial<GameSettings['audio']>): void {
    this.settings.audio = { ...this.settings.audio, ...audio };
    this.save();
    this.notifyListeners();
  }

  setGraphics(graphics: Partial<GameSettings['graphics']>): void {
    this.settings.graphics = { ...this.settings.graphics, ...graphics };
    this.save();
    this.notifyListeners();
  }

  setControls(controls: Partial<GameSettings['controls']>): void {
    this.settings.controls = { ...this.settings.controls, ...controls };
    this.save();
    this.notifyListeners();
  }

  setKeyBinding(action: string, key: string): void {
    this.settings.controls.keyBindings[action] = key;
    this.save();
    this.notifyListeners();
  }

  setGameplay(gameplay: Partial<GameSettings['gameplay']>): void {
    this.settings.gameplay = { ...this.settings.gameplay, ...gameplay };
    this.save();
    this.notifyListeners();
  }

  reset(): void {
    this.settings = { ...DEFAULT_SETTINGS };
    this.save();
    this.notifyListeners();
  }

  onChange(listener: (settings: GameSettings) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export const settingsManager = new SettingsManager();
