// ==========================================
// DirectorPanel - 감독 모드 좌측 전략 패널
// ==========================================

import Phaser from 'phaser';
import { DirectorStance, type DirectorSettings, type PlanSnapshot } from '@core/PlayerDirector';

export class DirectorPanel {
  private scene: Phaser.Scene;
  private container!: Phaser.GameObjects.Container;
  
  // UI 요소
  private enableToggle!: Phaser.GameObjects.Rectangle;
  private enableText!: Phaser.GameObjects.Text;
  private stanceButtons: Map<DirectorStance, Phaser.GameObjects.Rectangle> = new Map();
  private stanceTexts: Map<DirectorStance, Phaser.GameObjects.Text> = new Map();
  private statsText!: Phaser.GameObjects.Text;
  
  // 상태
  private currentSettings: DirectorSettings = {
    enabled: false,
    stance: DirectorStance.BALANCED,
    autoWorkers: true,
    autoProduction: true,
    autoSupply: true,
  };
  
  // 콜백
  public onSettingsChange?: (settings: Partial<DirectorSettings>) => void;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.createUI();
  }

  private createUI(): void {
    const height = this.scene.scale.height;
    
    // 미니맵 위에 배치 (미니맵은 좌하단 0, height-200)
    this.container = this.scene.add.container(10, height - 360);
    this.container.setScrollFactor(0);
    this.container.setDepth(3100);
    
    const panelW = 180;
    const panelH = 150;
    
    // 배경
    const bg = this.scene.add.rectangle(0, 0, panelW, panelH, 0x0a1628, 0.95);
    bg.setOrigin(0, 0);
    bg.setStrokeStyle(2, 0x1a3a5a);
    this.container.add(bg);
    
    // 타이틀
    const title = this.scene.add.text(panelW / 2, 8, '[ 감독 모드 ]', {
      fontSize: '12px',
      color: '#4a9eff',
      fontStyle: 'bold',
    });
    title.setOrigin(0.5, 0);
    this.container.add(title);
    
    // On/Off 토글
    this.createEnableToggle(10, 30);
    
    // 전략 선택 버튼
    this.createStanceButtons(10, 60);
    
    // 통계
    this.statsText = this.scene.add.text(10, 120, '', {
      fontSize: '10px',
      color: '#888888',
    });
    this.container.add(this.statsText);
  }

  private createEnableToggle(x: number, y: number): void {
    const w = 160;
    const h = 24;
    
    this.enableToggle = this.scene.add.rectangle(x, y, w, h, 0x333333);
    this.enableToggle.setOrigin(0, 0);
    this.enableToggle.setStrokeStyle(1, 0x555555);
    this.enableToggle.setInteractive({ useHandCursor: true });
    
    this.enableText = this.scene.add.text(x + w / 2, y + h / 2, 'OFF', {
      fontSize: '12px',
      color: '#888888',
      fontStyle: 'bold',
    });
    this.enableText.setOrigin(0.5);
    
    this.enableToggle.on('pointerdown', () => {
      const newEnabled = !this.currentSettings.enabled;
      this.setEnabled(newEnabled);
      this.onSettingsChange?.({ enabled: newEnabled });
    });
    
    this.enableToggle.on('pointerover', () => {
      this.enableToggle.setStrokeStyle(2, 0x4a9eff);
    });
    
    this.enableToggle.on('pointerout', () => {
      this.enableToggle.setStrokeStyle(1, 0x555555);
    });
    
    this.container.add([this.enableToggle, this.enableText]);
  }

  private createStanceButtons(x: number, startY: number): void {
    const stances: Array<{ stance: DirectorStance; label: string; color: number }> = [
      { stance: DirectorStance.AGGRESSIVE, label: '공격적', color: 0xff4444 },
      { stance: DirectorStance.BALANCED, label: '균형', color: 0x44aaff },
      { stance: DirectorStance.DEFENSIVE, label: '방어적', color: 0x44ff44 },
    ];
    
    const buttonW = 50;
    const buttonH = 22;
    const gap = 5;
    
    stances.forEach((s, i) => {
      const bx = x + i * (buttonW + gap);
      const by = startY;
      
      const btn = this.scene.add.rectangle(bx, by, buttonW, buttonH, 0x222222);
      btn.setOrigin(0, 0);
      btn.setStrokeStyle(1, 0x444444);
      btn.setInteractive({ useHandCursor: true });
      
      const text = this.scene.add.text(bx + buttonW / 2, by + buttonH / 2, s.label, {
        fontSize: '10px',
        color: '#666666',
      });
      text.setOrigin(0.5);
      
      btn.on('pointerdown', () => {
        if (!this.currentSettings.enabled) return;
        this.setStance(s.stance);
        this.onSettingsChange?.({ stance: s.stance });
      });
      
      btn.on('pointerover', () => {
        if (this.currentSettings.enabled) {
          btn.setStrokeStyle(2, s.color);
        }
      });
      
      btn.on('pointerout', () => {
        if (this.currentSettings.stance !== s.stance) {
          btn.setStrokeStyle(1, 0x444444);
        }
      });
      
      this.stanceButtons.set(s.stance, btn);
      this.stanceTexts.set(s.stance, text);
      this.container.add([btn, text]);
    });
    
    // 라벨
    const label = this.scene.add.text(x, startY + buttonH + 4, '전략 선택', {
      fontSize: '9px',
      color: '#555555',
    });
    this.container.add(label);
  }

  private setEnabled(enabled: boolean): void {
    this.currentSettings.enabled = enabled;
    
    if (enabled) {
      this.enableToggle.setFillStyle(0x1a5a1a);
      this.enableToggle.setStrokeStyle(1, 0x44ff44);
      this.enableText.setText('ON');
      this.enableText.setColor('#44ff44');
    } else {
      this.enableToggle.setFillStyle(0x333333);
      this.enableToggle.setStrokeStyle(1, 0x555555);
      this.enableText.setText('OFF');
      this.enableText.setColor('#888888');
    }
    
    // 전략 버튼 상태 업데이트
    this.updateStanceButtons();
  }

  private setStance(stance: DirectorStance): void {
    this.currentSettings.stance = stance;
    this.updateStanceButtons();
  }

  private updateStanceButtons(): void {
    const colors: Record<DirectorStance, number> = {
      [DirectorStance.AGGRESSIVE]: 0xff4444,
      [DirectorStance.BALANCED]: 0x44aaff,
      [DirectorStance.DEFENSIVE]: 0x44ff44,
    };
    
    for (const [stance, btn] of this.stanceButtons) {
      const text = this.stanceTexts.get(stance)!;
      const isSelected = this.currentSettings.stance === stance;
      const isEnabled = this.currentSettings.enabled;
      
      if (isSelected && isEnabled) {
        btn.setFillStyle(colors[stance], 0.3);
        btn.setStrokeStyle(2, colors[stance]);
        text.setColor('#ffffff');
      } else {
        btn.setFillStyle(0x222222);
        btn.setStrokeStyle(1, 0x444444);
        text.setColor(isEnabled ? '#888888' : '#444444');
      }
    }
  }

  // 외부에서 계획 스냅샷으로 업데이트
  update(snapshot: PlanSnapshot): void {
    // 설정 동기화
    if (this.currentSettings.enabled !== snapshot.enabled) {
      this.setEnabled(snapshot.enabled);
    }
    if (this.currentSettings.stance !== snapshot.stance) {
      this.setStance(snapshot.stance);
    }
    
    // 통계 업데이트
    this.statsText.setText(
      `일꾼: ${snapshot.stats.workers}  병력: ${snapshot.stats.army}  건물: ${snapshot.stats.buildings}`
    );
  }

  setVisible(visible: boolean): void {
    this.container.setVisible(visible);
  }

  destroy(): void {
    this.container.destroy();
  }
}
