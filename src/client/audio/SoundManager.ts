// ==========================================
// SoundManager - Web Audio API 절차적 사운드
// ==========================================

export type SoundType = 
  | 'attack_bullet'
  | 'attack_flame'
  | 'attack_missile'
  | 'explosion_small'
  | 'explosion_large'
  | 'heal'
  | 'death'
  | 'hit'
  | 'building_complete'
  | 'unit_complete'
  | 'select_unit'
  | 'select_building'
  | 'command_move'
  | 'command_attack'
  | 'error'
  | 'siege_on'
  | 'siege_off'
  | 'stim';

export class SoundManager {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private enabled: boolean = true;
  private volume: number = 0.3;

  constructor() {
    this.initAudioContext();
  }

  private initAudioContext(): void {
    try {
      this.audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      this.masterGain = this.audioContext.createGain();
      this.masterGain.connect(this.audioContext.destination);
      this.masterGain.gain.value = this.volume;
    } catch (e) {
      console.warn('Web Audio API not supported:', e);
      this.audioContext = null;
    }
  }

  // 유저 인터랙션 후 호출 필요 (autoplay policy)
  resume(): void {
    if (this.audioContext?.state === 'suspended') {
      this.audioContext.resume();
    }
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.masterGain) {
      this.masterGain.gain.value = this.volume;
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  play(type: SoundType): void {
    if (!this.enabled || !this.audioContext || !this.masterGain) return;
    this.resume();

    switch (type) {
      case 'attack_bullet':
        this.playBulletSound();
        break;
      case 'attack_flame':
        this.playFlameSound();
        break;
      case 'attack_missile':
        this.playMissileSound();
        break;
      case 'explosion_small':
        this.playExplosion(0.2, 0.1);
        break;
      case 'explosion_large':
        this.playExplosion(0.5, 0.3);
        break;
      case 'heal':
        this.playHealSound();
        break;
      case 'death':
        this.playDeathSound();
        break;
      case 'hit':
        this.playHitSound();
        break;
      case 'building_complete':
        this.playBuildingComplete();
        break;
      case 'unit_complete':
        this.playUnitComplete();
        break;
      case 'select_unit':
        this.playSelectUnit();
        break;
      case 'select_building':
        this.playSelectBuilding();
        break;
      case 'command_move':
        this.playMoveCommand();
        break;
      case 'command_attack':
        this.playAttackCommand();
        break;
      case 'error':
        this.playError();
        break;
      case 'siege_on':
        this.playSiegeOn();
        break;
      case 'siege_off':
        this.playSiegeOff();
        break;
      case 'stim':
        this.playStim();
        break;
    }
  }

  // 총알 발사 (짧은 노이즈 + 클릭)
  private playBulletSound(): void {
    const ctx = this.audioContext!;
    const gain = ctx.createGain();
    gain.connect(this.masterGain!);

    // 노이즈 버스트
    const noise = this.createNoiseBuffer(0.05);
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noise;
    
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 2000;
    
    noiseSource.connect(filter);
    filter.connect(gain);
    
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialDecayTo(0.01, ctx.currentTime + 0.05);
    
    noiseSource.start(ctx.currentTime);
    noiseSource.stop(ctx.currentTime + 0.05);
  }

  // 화염 공격 (긴 노이즈 + 저주파)
  private playFlameSound(): void {
    const ctx = this.audioContext!;
    const gain = ctx.createGain();
    gain.connect(this.masterGain!);

    // 노이즈
    const noise = this.createNoiseBuffer(0.2);
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noise;
    
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 500;
    filter.Q.value = 2;
    
    noiseSource.connect(filter);
    filter.connect(gain);
    
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 0.05);
    gain.gain.exponentialDecayTo(0.01, ctx.currentTime + 0.2);
    
    noiseSource.start(ctx.currentTime);
    noiseSource.stop(ctx.currentTime + 0.2);
  }

  // 미사일 발사 (우웅 + 폭발)
  private playMissileSound(): void {
    const ctx = this.audioContext!;
    const gain = ctx.createGain();
    gain.connect(this.masterGain!);

    // 오실레이터 (우웅)
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.2);
    
    osc.connect(gain);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialDecayTo(0.01, ctx.currentTime + 0.15);
    
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
  }

  // 폭발
  private playExplosion(duration: number, volume: number): void {
    const ctx = this.audioContext!;
    const gain = ctx.createGain();
    gain.connect(this.masterGain!);

    // 노이즈
    const noise = this.createNoiseBuffer(duration);
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noise;
    
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2000, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + duration);
    
    noiseSource.connect(filter);
    filter.connect(gain);
    
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialDecayTo(0.01, ctx.currentTime + duration);
    
    noiseSource.start(ctx.currentTime);
    noiseSource.stop(ctx.currentTime + duration);
  }

  // 치유 (부드러운 고음)
  private playHealSound(): void {
    const ctx = this.audioContext!;
    const gain = ctx.createGain();
    gain.connect(this.masterGain!);

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.1);
    
    osc.connect(gain);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialDecayTo(0.01, ctx.currentTime + 0.15);
    
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
  }

  // 히트 (짧은 금속 타격음)
  private playHitSound(): void {
    const ctx = this.audioContext!;
    const gain = ctx.createGain();
    gain.connect(this.masterGain!);

    // 짧은 금속성 타격
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.03);
    
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 800;
    
    osc.connect(filter);
    filter.connect(gain);
    
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialDecayTo(0.01, ctx.currentTime + 0.04);
    
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.04);
  }

  // 유닛 죽음
  private playDeathSound(): void {
    const ctx = this.audioContext!;
    const gain = ctx.createGain();
    gain.connect(this.masterGain!);

    // 낮은 둔탁한 소리
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.2);
    
    osc.connect(gain);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialDecayTo(0.01, ctx.currentTime + 0.2);
    
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
  }

  // 건물 완성
  private playBuildingComplete(): void {
    const ctx = this.audioContext!;
    const gain = ctx.createGain();
    gain.connect(this.masterGain!);

    // 2음 멜로디
    [440, 660].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = freq;
      osc.connect(gain);
      const start = ctx.currentTime + i * 0.15;
      osc.start(start);
      osc.stop(start + 0.12);
    });

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.setValueAtTime(0.15, ctx.currentTime + 0.15);
    gain.gain.exponentialDecayTo(0.01, ctx.currentTime + 0.35);
  }

  // 유닛 생산 완료
  private playUnitComplete(): void {
    const ctx = this.audioContext!;
    const gain = ctx.createGain();
    gain.connect(this.masterGain!);

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 523; // C5
    osc.connect(gain);
    
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialDecayTo(0.01, ctx.currentTime + 0.1);
    
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.1);
  }

  // 유닛 선택
  private playSelectUnit(): void {
    const ctx = this.audioContext!;
    const gain = ctx.createGain();
    gain.connect(this.masterGain!);

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 800;
    osc.connect(gain);
    
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialDecayTo(0.01, ctx.currentTime + 0.05);
    
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.05);
  }

  // 건물 선택
  private playSelectBuilding(): void {
    const ctx = this.audioContext!;
    const gain = ctx.createGain();
    gain.connect(this.masterGain!);

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = 400;
    osc.connect(gain);
    
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialDecayTo(0.01, ctx.currentTime + 0.08);
    
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.08);
  }

  // 이동 명령
  private playMoveCommand(): void {
    const ctx = this.audioContext!;
    const gain = ctx.createGain();
    gain.connect(this.masterGain!);

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.05);
    osc.connect(gain);
    
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialDecayTo(0.01, ctx.currentTime + 0.06);
    
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.06);
  }

  // 공격 명령
  private playAttackCommand(): void {
    const ctx = this.audioContext!;
    const gain = ctx.createGain();
    gain.connect(this.masterGain!);

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.06);
    osc.connect(gain);
    
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialDecayTo(0.01, ctx.currentTime + 0.08);
    
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.08);
  }

  // 에러
  private playError(): void {
    const ctx = this.audioContext!;
    const gain = ctx.createGain();
    gain.connect(this.masterGain!);

    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = 200;
    osc.connect(gain);
    
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialDecayTo(0.01, ctx.currentTime + 0.15);
    
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
  }

  // 시즈 모드 켜기
  private playSiegeOn(): void {
    const ctx = this.audioContext!;
    const gain = ctx.createGain();
    gain.connect(this.masterGain!);

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(200, ctx.currentTime + 0.3);
    osc.connect(gain);
    
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.3);
    gain.gain.exponentialDecayTo(0.01, ctx.currentTime + 0.4);
    
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  }

  // 시즈 모드 끄기
  private playSiegeOff(): void {
    const ctx = this.audioContext!;
    const gain = ctx.createGain();
    gain.connect(this.masterGain!);

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(100, ctx.currentTime + 0.3);
    osc.connect(gain);
    
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.3);
    gain.gain.exponentialDecayTo(0.01, ctx.currentTime + 0.4);
    
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  }

  // 스팀팩
  private playStim(): void {
    const ctx = this.audioContext!;
    const gain = ctx.createGain();
    gain.connect(this.masterGain!);

    // 주사기 느낌
    const noise = this.createNoiseBuffer(0.15);
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noise;
    
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 3000;
    
    noiseSource.connect(filter);
    filter.connect(gain);
    
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialDecayTo(0.01, ctx.currentTime + 0.15);
    
    noiseSource.start(ctx.currentTime);
    noiseSource.stop(ctx.currentTime + 0.15);

    // 하트비트
    setTimeout(() => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 80;
      osc.connect(g);
      g.connect(this.masterGain!);
      g.gain.setValueAtTime(0.2, ctx.currentTime);
      g.gain.exponentialDecayTo(0.01, ctx.currentTime + 0.1);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.1);
    }, 100);
  }

  // 노이즈 버퍼 생성
  private createNoiseBuffer(duration: number): AudioBuffer {
    const ctx = this.audioContext!;
    const sampleRate = ctx.sampleRate;
    const bufferSize = sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    return buffer;
  }

  destroy(): void {
    this.audioContext?.close();
  }
}

// AudioParam exponentialDecayTo 헬퍼
declare global {
  interface AudioParam {
    exponentialDecayTo(value: number, endTime: number): void;
  }
}

AudioParam.prototype.exponentialDecayTo = function(value: number, endTime: number) {
  this.exponentialRampToValueAtTime(Math.max(0.0001, value), endTime);
};

// 싱글턴 인스턴스
export const soundManager = new SoundManager();
