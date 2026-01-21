// ==========================================
// DirectorPanel - 감독 모드 좌측 전략 패널
// ==========================================

import Phaser from 'phaser';
import { DirectorStance, type DirectorSettings, type PlanSnapshot, type Strategy } from '@core/PlayerDirector';

export class DirectorPanel {
  private scene: Phaser.Scene;
  private container!: Phaser.GameObjects.Container;
  
  // UI 요소
  private enableToggle!: Phaser.GameObjects.Rectangle;
  private enableText!: Phaser.GameObjects.Text;
  private strategyContainer!: Phaser.GameObjects.Container;
  private currentStrategyText!: Phaser.GameObjects.Text;
  private statsText!: Phaser.GameObjects.Text;
  
  // 드롭다운 상태
  private isDropdownOpen = false;
  private dropdownItems: Phaser.GameObjects.Container[] = [];
  
  // 상태
  private currentSettings: DirectorSettings = {
    enabled: false,
    stance: DirectorStance.BALANCED,
    strategyId: 'balanced',
    autoWorkers: true,
    autoProduction: true,
    autoSupply: true,
  };
  private availableStrategies: Strategy[] = [];
  private selectedStrategy: Strategy | null = null;
  
  // 콜백
  public onSettingsChange?: (settings: Partial<DirectorSettings>) => void;
  public onStrategySelect?: (strategyId: string) => void;
  public onEditStrategy?: () => void;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.createUI();
  }

  private createUI(): void {
    const height = this.scene.scale.height;
    
    // 미니맵 위에 배치
    this.container = this.scene.add.container(10, height - 400);
    this.container.setScrollFactor(0);
    this.container.setDepth(3100);
    
    const panelW = 180;
    const panelH = 190;
    
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
    
    // 전략 선택 드롭다운
    this.createStrategyDropdown(10, 62);
    
    // 편집 버튼
    this.createEditButton(140, 62);
    
    // 통계
    this.statsText = this.scene.add.text(10, 160, '', {
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

  private createStrategyDropdown(x: number, y: number): void {
    const w = 120;
    const h = 26;
    
    this.strategyContainer = this.scene.add.container(x, y);
    this.container.add(this.strategyContainer);
    
    // 드롭다운 버튼 배경
    const dropdownBg = this.scene.add.rectangle(0, 0, w, h, 0x1a2a3a);
    dropdownBg.setOrigin(0, 0);
    dropdownBg.setStrokeStyle(1, 0x3a5a7a);
    dropdownBg.setInteractive({ useHandCursor: true });
    this.strategyContainer.add(dropdownBg);
    
    // 현재 전략 이름
    this.currentStrategyText = this.scene.add.text(8, h / 2, '균형', {
      fontSize: '11px',
      color: '#ffffff',
    });
    this.currentStrategyText.setOrigin(0, 0.5);
    this.strategyContainer.add(this.currentStrategyText);
    
    // 화살표
    const arrow = this.scene.add.text(w - 16, h / 2, '▼', {
      fontSize: '10px',
      color: '#888888',
    });
    arrow.setOrigin(0.5);
    this.strategyContainer.add(arrow);
    
    // 클릭 이벤트
    dropdownBg.on('pointerdown', () => {
      if (!this.currentSettings.enabled) return;
      this.toggleDropdown();
    });
    
    dropdownBg.on('pointerover', () => {
      if (this.currentSettings.enabled) {
        dropdownBg.setStrokeStyle(2, 0x4a9eff);
      }
    });
    
    dropdownBg.on('pointerout', () => {
      dropdownBg.setStrokeStyle(1, 0x3a5a7a);
    });
    
    // 라벨
    const label = this.scene.add.text(x, y + h + 4, '전략 선택', {
      fontSize: '9px',
      color: '#555555',
    });
    this.container.add(label);
    
    // 전략 설명
    const descLabel = this.scene.add.text(x, y + h + 20, '', {
      fontSize: '9px',
      color: '#666666',
      wordWrap: { width: 160 },
    });
    descLabel.setName('strategyDesc');
    this.container.add(descLabel);
  }

  private createEditButton(x: number, y: number): void {
    const size = 26;
    
    const btn = this.scene.add.rectangle(x, y, size, size, 0x2a3a4a);
    btn.setOrigin(0, 0);
    btn.setStrokeStyle(1, 0x4a5a6a);
    btn.setInteractive({ useHandCursor: true });
    
    const icon = this.scene.add.text(x + size / 2, y + size / 2, '⚙', {
      fontSize: '14px',
      color: '#888888',
    });
    icon.setOrigin(0.5);
    
    btn.on('pointerdown', () => {
      if (!this.currentSettings.enabled) return;
      this.closeDropdown();
      this.onEditStrategy?.();
    });
    
    btn.on('pointerover', () => {
      if (this.currentSettings.enabled) {
        btn.setStrokeStyle(2, 0x4a9eff);
        icon.setColor('#ffffff');
      }
    });
    
    btn.on('pointerout', () => {
      btn.setStrokeStyle(1, 0x4a5a6a);
      icon.setColor('#888888');
    });
    
    this.container.add([btn, icon]);
  }

  private toggleDropdown(): void {
    if (this.isDropdownOpen) {
      this.closeDropdown();
    } else {
      this.openDropdown();
    }
  }

  private openDropdown(): void {
    if (this.availableStrategies.length === 0) return;
    
    this.isDropdownOpen = true;
    const itemH = 28;
    const w = 120;
    
    // 드롭다운 아이템들 생성
    this.availableStrategies.forEach((strategy, i) => {
      const itemY = 26 + i * itemH;
      
      const itemContainer = this.scene.add.container(0, itemY);
      
      const itemBg = this.scene.add.rectangle(0, 0, w, itemH, 0x1a2a3a);
      itemBg.setOrigin(0, 0);
      itemBg.setStrokeStyle(1, 0x2a3a4a);
      itemBg.setInteractive({ useHandCursor: true });
      itemContainer.add(itemBg);
      
      const isSelected = strategy.id === this.selectedStrategy?.id;
      const itemText = this.scene.add.text(8, itemH / 2, strategy.name, {
        fontSize: '10px',
        color: isSelected ? '#4a9eff' : '#cccccc',
      });
      itemText.setOrigin(0, 0.5);
      itemContainer.add(itemText);
      
      // 커스텀 표시
      if (strategy.isCustom) {
        const customBadge = this.scene.add.text(w - 8, itemH / 2, '★', {
          fontSize: '10px',
          color: '#ffaa00',
        });
        customBadge.setOrigin(1, 0.5);
        itemContainer.add(customBadge);
      }
      
      itemBg.on('pointerdown', () => {
        this.selectStrategy(strategy);
        this.closeDropdown();
      });
      
      itemBg.on('pointerover', () => {
        itemBg.setFillStyle(0x2a4a6a);
      });
      
      itemBg.on('pointerout', () => {
        itemBg.setFillStyle(0x1a2a3a);
      });
      
      this.strategyContainer.add(itemContainer);
      this.dropdownItems.push(itemContainer);
    });
  }

  private closeDropdown(): void {
    this.isDropdownOpen = false;
    for (const item of this.dropdownItems) {
      item.destroy();
    }
    this.dropdownItems = [];
  }

  private selectStrategy(strategy: Strategy): void {
    this.selectedStrategy = strategy;
    this.currentSettings.strategyId = strategy.id;
    this.currentStrategyText.setText(strategy.name);
    
    // 설명 업데이트
    const descLabel = this.container.getByName('strategyDesc') as Phaser.GameObjects.Text;
    if (descLabel) {
      descLabel.setText(strategy.description);
    }
    
    this.onStrategySelect?.(strategy.id);
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
      this.closeDropdown();
    }
  }

  // 외부에서 계획 스냅샷으로 업데이트
  update(snapshot: PlanSnapshot): void {
    // 설정 동기화
    if (this.currentSettings.enabled !== snapshot.enabled) {
      this.setEnabled(snapshot.enabled);
    }
    
    // 전략 목록 업데이트
    this.availableStrategies = snapshot.availableStrategies;
    
    // 현재 전략 업데이트
    if (snapshot.currentStrategy && snapshot.currentStrategy.id !== this.selectedStrategy?.id) {
      this.selectedStrategy = snapshot.currentStrategy;
      this.currentStrategyText.setText(snapshot.currentStrategy.name);
      
      const descLabel = this.container.getByName('strategyDesc') as Phaser.GameObjects.Text;
      if (descLabel) {
        descLabel.setText(snapshot.currentStrategy.description);
      }
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
    this.closeDropdown();
    this.container.destroy();
  }
}
