// ==========================================
// StrategyEditor - 전략 수정/추가 모달
// ==========================================

import Phaser from 'phaser';
import type { Strategy, UnitProductionConfig } from '@core/PlayerDirector';
import { UnitType } from '@shared/types';

// 유닛 이름 매핑
const UNIT_NAMES: Record<UnitType, string> = {
  [UnitType.ENGINEER]: 'SCV',
  [UnitType.TROOPER]: '마린',
  [UnitType.PYRO]: '파이어뱃',
  [UnitType.MEDIC]: '메딕',
  [UnitType.SPEEDER]: '벌처',
  [UnitType.ARTILLERY]: '시즈탱크',
  [UnitType.WALKER]: '골리앗',
};

export class StrategyEditor {
  private scene: Phaser.Scene;
  private overlay!: Phaser.GameObjects.Rectangle;
  private container!: Phaser.GameObjects.Container;
  private isVisible = false;
  
  // 편집 중인 전략 (복사본)
  private editingStrategy: Strategy | null = null;
  private originalStrategyId: string | null = null;
  
  // UI 요소
  private nameInput!: Phaser.GameObjects.Text;
  private unitToggles: Map<UnitType, { toggle: Phaser.GameObjects.Rectangle; countText: Phaser.GameObjects.Text }> = new Map();
  private paramInputs: Map<string, Phaser.GameObjects.Text> = new Map();
  
  // 콜백
  public onSave?: (strategy: Strategy, isNew: boolean) => void;
  public onDelete?: (strategyId: string) => void;
  public onClose?: () => void;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.createUI();
    this.hide();
  }

  private createUI(): void {
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;
    
    // 오버레이
    this.overlay = this.scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7);
    this.overlay.setScrollFactor(0);
    this.overlay.setDepth(4000);
    this.overlay.setInteractive();
    this.overlay.on('pointerdown', () => this.hide());
    
    // 메인 컨테이너
    const panelW = 400;
    const panelH = 480;
    this.container = this.scene.add.container(width / 2 - panelW / 2, height / 2 - panelH / 2);
    this.container.setScrollFactor(0);
    this.container.setDepth(4100);
    
    // 배경
    const bg = this.scene.add.rectangle(0, 0, panelW, panelH, 0x0a1628, 0.98);
    bg.setOrigin(0, 0);
    bg.setStrokeStyle(2, 0x2a5a8a);
    bg.setInteractive(); // 클릭 이벤트 버블링 방지
    this.container.add(bg);
    
    // 헤더
    const header = this.scene.add.rectangle(0, 0, panelW, 40, 0x1a3a5a);
    header.setOrigin(0, 0);
    this.container.add(header);
    
    const title = this.scene.add.text(panelW / 2, 20, '전략 편집', {
      fontSize: '16px',
      color: '#ffffff',
      fontStyle: 'bold',
    });
    title.setOrigin(0.5);
    this.container.add(title);
    
    // 닫기 버튼
    const closeBtn = this.scene.add.text(panelW - 15, 20, '✕', {
      fontSize: '18px',
      color: '#888888',
    });
    closeBtn.setOrigin(0.5);
    closeBtn.setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.hide());
    closeBtn.on('pointerover', () => closeBtn.setColor('#ffffff'));
    closeBtn.on('pointerout', () => closeBtn.setColor('#888888'));
    this.container.add(closeBtn);
    
    // 전략 이름
    this.createNameSection(20, 55);
    
    // 유닛 생산 섹션
    this.createUnitProductionSection(20, 100);
    
    // 파라미터 섹션
    this.createParameterSection(20, 320);
    
    // 하단 버튼들
    this.createBottomButtons(panelW, panelH);
  }

  private createNameSection(x: number, y: number): void {
    const label = this.scene.add.text(x, y, '전략 이름:', {
      fontSize: '12px',
      color: '#888888',
    });
    this.container.add(label);
    
    const nameBg = this.scene.add.rectangle(x + 80, y - 2, 200, 24, 0x1a2a3a);
    nameBg.setOrigin(0, 0);
    nameBg.setStrokeStyle(1, 0x3a5a7a);
    this.container.add(nameBg);
    
    this.nameInput = this.scene.add.text(x + 88, y + 10, '', {
      fontSize: '12px',
      color: '#ffffff',
    });
    this.nameInput.setOrigin(0, 0.5);
    this.container.add(this.nameInput);
    
    // 클릭하면 이름 변경 프롬프트 (간단히 처리)
    nameBg.setInteractive({ useHandCursor: true });
    nameBg.on('pointerdown', () => {
      if (!this.editingStrategy?.isCustom) return;
      const newName = prompt('새 전략 이름:', this.editingStrategy?.name || '');
      if (newName && this.editingStrategy) {
        this.editingStrategy.name = newName;
        this.nameInput.setText(newName);
      }
    });
  }

  private createUnitProductionSection(x: number, y: number): void {
    const sectionLabel = this.scene.add.text(x, y, '[ 유닛 자동생산 ]', {
      fontSize: '12px',
      color: '#4a9eff',
      fontStyle: 'bold',
    });
    this.container.add(sectionLabel);
    
    // SCV 제외한 유닛들
    const units = [
      UnitType.TROOPER, UnitType.PYRO, UnitType.MEDIC,
      UnitType.SPEEDER, UnitType.ARTILLERY, UnitType.WALKER,
    ];
    
    const colW = 175;
    units.forEach((unitType, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const itemX = x + col * colW;
      const itemY = y + 25 + row * 55;
      
      this.createUnitToggle(unitType, itemX, itemY);
    });
  }

  private createUnitToggle(unitType: UnitType, x: number, y: number): void {
    const name = UNIT_NAMES[unitType];
    
    // 유닛 이름
    const nameText = this.scene.add.text(x, y, name, {
      fontSize: '11px',
      color: '#cccccc',
    });
    this.container.add(nameText);
    
    // ON/OFF 토글
    const toggle = this.scene.add.rectangle(x + 70, y - 2, 36, 18, 0x333333);
    toggle.setOrigin(0, 0);
    toggle.setStrokeStyle(1, 0x555555);
    toggle.setInteractive({ useHandCursor: true });
    this.container.add(toggle);
    
    const toggleText = this.scene.add.text(x + 88, y + 7, 'OFF', {
      fontSize: '9px',
      color: '#888888',
    });
    toggleText.setOrigin(0.5);
    this.container.add(toggleText);
    
    toggle.on('pointerdown', () => {
      const config = this.getUnitConfig(unitType);
      if (config) {
        config.enabled = !config.enabled;
        this.updateUnitToggleUI(unitType);
      }
    });
    
    // 목표 수 라벨
    const countLabel = this.scene.add.text(x, y + 22, '목표:', {
      fontSize: '10px',
      color: '#666666',
    });
    this.container.add(countLabel);
    
    // 목표 수 배경
    const countBg = this.scene.add.rectangle(x + 35, y + 20, 40, 18, 0x1a2a3a);
    countBg.setOrigin(0, 0);
    countBg.setStrokeStyle(1, 0x3a5a7a);
    countBg.setInteractive({ useHandCursor: true });
    this.container.add(countBg);
    
    // 목표 수 텍스트
    const countText = this.scene.add.text(x + 55, y + 29, '0', {
      fontSize: '10px',
      color: '#ffffff',
    });
    countText.setOrigin(0.5);
    this.container.add(countText);
    
    // +/- 버튼
    const minusBtn = this.scene.add.text(x + 80, y + 29, '-', {
      fontSize: '14px',
      color: '#888888',
    });
    minusBtn.setOrigin(0.5);
    minusBtn.setInteractive({ useHandCursor: true });
    minusBtn.on('pointerdown', () => {
      const config = this.getUnitConfig(unitType);
      if (config && config.targetCount > 0) {
        config.targetCount--;
        this.updateUnitToggleUI(unitType);
      }
    });
    this.container.add(minusBtn);
    
    const plusBtn = this.scene.add.text(x + 100, y + 29, '+', {
      fontSize: '14px',
      color: '#888888',
    });
    plusBtn.setOrigin(0.5);
    plusBtn.setInteractive({ useHandCursor: true });
    plusBtn.on('pointerdown', () => {
      const config = this.getUnitConfig(unitType);
      if (config) {
        config.targetCount++;
        this.updateUnitToggleUI(unitType);
      }
    });
    this.container.add(plusBtn);
    
    this.unitToggles.set(unitType, { toggle, countText });
  }

  private createParameterSection(x: number, y: number): void {
    const sectionLabel = this.scene.add.text(x, y, '[ 전략 파라미터 ]', {
      fontSize: '12px',
      color: '#4a9eff',
      fontStyle: 'bold',
    });
    this.container.add(sectionLabel);
    
    const params = [
      { key: 'workerTarget', label: '목표 일꾼 수', min: 5, max: 30 },
      { key: 'attackThreshold', label: '공격 유닛 수', min: 2, max: 20 },
      { key: 'expandMineralThreshold', label: '확장 미네랄', min: 200, max: 800 },
    ];
    
    params.forEach((param, i) => {
      const itemY = y + 25 + i * 35;
      this.createParamInput(param.key, param.label, x, itemY, param.min, param.max);
    });
  }

  private createParamInput(key: string, label: string, x: number, y: number, min: number, max: number): void {
    // 라벨
    const labelText = this.scene.add.text(x, y, label + ':', {
      fontSize: '11px',
      color: '#888888',
    });
    this.container.add(labelText);
    
    // 값 배경
    const valueBg = this.scene.add.rectangle(x + 120, y - 2, 60, 22, 0x1a2a3a);
    valueBg.setOrigin(0, 0);
    valueBg.setStrokeStyle(1, 0x3a5a7a);
    this.container.add(valueBg);
    
    // 값 텍스트
    const valueText = this.scene.add.text(x + 150, y + 9, '0', {
      fontSize: '11px',
      color: '#ffffff',
    });
    valueText.setOrigin(0.5);
    this.container.add(valueText);
    
    // +/- 버튼
    const minusBtn = this.scene.add.text(x + 190, y + 9, '◀', {
      fontSize: '12px',
      color: '#888888',
    });
    minusBtn.setOrigin(0.5);
    minusBtn.setInteractive({ useHandCursor: true });
    minusBtn.on('pointerdown', () => {
      if (!this.editingStrategy) return;
      const current = (this.editingStrategy as unknown as Record<string, number>)[key] || 0;
      const step = key === 'expandMineralThreshold' ? 50 : 1;
      if (current > min) {
        (this.editingStrategy as unknown as Record<string, number>)[key] = current - step;
        this.updateParamUI(key);
      }
    });
    this.container.add(minusBtn);
    
    const plusBtn = this.scene.add.text(x + 210, y + 9, '▶', {
      fontSize: '12px',
      color: '#888888',
    });
    plusBtn.setOrigin(0.5);
    plusBtn.setInteractive({ useHandCursor: true });
    plusBtn.on('pointerdown', () => {
      if (!this.editingStrategy) return;
      const current = (this.editingStrategy as unknown as Record<string, number>)[key] || 0;
      const step = key === 'expandMineralThreshold' ? 50 : 1;
      if (current < max) {
        (this.editingStrategy as unknown as Record<string, number>)[key] = current + step;
        this.updateParamUI(key);
      }
    });
    this.container.add(plusBtn);
    
    this.paramInputs.set(key, valueText);
  }

  private createBottomButtons(panelW: number, panelH: number): void {
    const btnY = panelH - 45;
    const btnH = 30;
    
    // 새 전략으로 저장 (복제)
    const duplicateBtn = this.scene.add.rectangle(20, btnY, 90, btnH, 0x2a4a2a);
    duplicateBtn.setOrigin(0, 0);
    duplicateBtn.setStrokeStyle(1, 0x4a8a4a);
    duplicateBtn.setInteractive({ useHandCursor: true });
    this.container.add(duplicateBtn);
    
    const duplicateText = this.scene.add.text(65, btnY + btnH / 2, '+ 새 전략', {
      fontSize: '11px',
      color: '#88cc88',
    });
    duplicateText.setOrigin(0.5);
    this.container.add(duplicateText);
    
    duplicateBtn.on('pointerdown', () => this.duplicateStrategy());
    duplicateBtn.on('pointerover', () => duplicateBtn.setFillStyle(0x3a6a3a));
    duplicateBtn.on('pointerout', () => duplicateBtn.setFillStyle(0x2a4a2a));
    
    // 삭제 (커스텀만)
    const deleteBtn = this.scene.add.rectangle(120, btnY, 70, btnH, 0x4a2a2a);
    deleteBtn.setOrigin(0, 0);
    deleteBtn.setStrokeStyle(1, 0x8a4a4a);
    deleteBtn.setInteractive({ useHandCursor: true });
    deleteBtn.setName('deleteBtn');
    this.container.add(deleteBtn);
    
    const deleteText = this.scene.add.text(155, btnY + btnH / 2, '삭제', {
      fontSize: '11px',
      color: '#cc8888',
    });
    deleteText.setOrigin(0.5);
    deleteText.setName('deleteText');
    this.container.add(deleteText);
    
    deleteBtn.on('pointerdown', () => this.deleteStrategy());
    deleteBtn.on('pointerover', () => deleteBtn.setFillStyle(0x6a3a3a));
    deleteBtn.on('pointerout', () => deleteBtn.setFillStyle(0x4a2a2a));
    
    // 저장
    const saveBtn = this.scene.add.rectangle(panelW - 150, btnY, 60, btnH, 0x2a4a6a);
    saveBtn.setOrigin(0, 0);
    saveBtn.setStrokeStyle(1, 0x4a8aaa);
    saveBtn.setInteractive({ useHandCursor: true });
    this.container.add(saveBtn);
    
    const saveText = this.scene.add.text(panelW - 120, btnY + btnH / 2, '저장', {
      fontSize: '11px',
      color: '#88ccff',
    });
    saveText.setOrigin(0.5);
    this.container.add(saveText);
    
    saveBtn.on('pointerdown', () => this.save());
    saveBtn.on('pointerover', () => saveBtn.setFillStyle(0x3a6a8a));
    saveBtn.on('pointerout', () => saveBtn.setFillStyle(0x2a4a6a));
    
    // 취소
    const cancelBtn = this.scene.add.rectangle(panelW - 80, btnY, 60, btnH, 0x3a3a3a);
    cancelBtn.setOrigin(0, 0);
    cancelBtn.setStrokeStyle(1, 0x5a5a5a);
    cancelBtn.setInteractive({ useHandCursor: true });
    this.container.add(cancelBtn);
    
    const cancelText = this.scene.add.text(panelW - 50, btnY + btnH / 2, '취소', {
      fontSize: '11px',
      color: '#aaaaaa',
    });
    cancelText.setOrigin(0.5);
    this.container.add(cancelText);
    
    cancelBtn.on('pointerdown', () => this.hide());
    cancelBtn.on('pointerover', () => cancelBtn.setFillStyle(0x4a4a4a));
    cancelBtn.on('pointerout', () => cancelBtn.setFillStyle(0x3a3a3a));
  }

  // 전략 편집 시작
  show(strategy: Strategy): void {
    // 깊은 복사
    this.editingStrategy = JSON.parse(JSON.stringify(strategy));
    this.originalStrategyId = strategy.id;
    
    this.updateAllUI();
    
    // 삭제 버튼 표시/숨김 (커스텀만 삭제 가능)
    const deleteBtn = this.container.getByName('deleteBtn') as Phaser.GameObjects.Rectangle;
    const deleteText = this.container.getByName('deleteText') as Phaser.GameObjects.Text;
    if (deleteBtn && deleteText) {
      deleteBtn.setVisible(strategy.isCustom);
      deleteText.setVisible(strategy.isCustom);
    }
    
    this.overlay.setVisible(true);
    this.container.setVisible(true);
    this.isVisible = true;
  }

  hide(): void {
    this.overlay.setVisible(false);
    this.container.setVisible(false);
    this.isVisible = false;
    this.editingStrategy = null;
    this.onClose?.();
  }

  getIsVisible(): boolean {
    return this.isVisible;
  }

  private updateAllUI(): void {
    if (!this.editingStrategy) return;
    
    // 이름
    this.nameInput.setText(this.editingStrategy.name);
    
    // 유닛 토글들
    for (const unitType of this.unitToggles.keys()) {
      this.updateUnitToggleUI(unitType);
    }
    
    // 파라미터들
    for (const key of this.paramInputs.keys()) {
      this.updateParamUI(key);
    }
  }

  private updateUnitToggleUI(unitType: UnitType): void {
    const ui = this.unitToggles.get(unitType);
    if (!ui) return;
    
    const config = this.getUnitConfig(unitType);
    if (!config) return;
    
    // 토글 상태
    if (config.enabled) {
      ui.toggle.setFillStyle(0x1a5a1a);
      ui.toggle.setStrokeStyle(1, 0x44ff44);
      (ui.toggle.getData('text') as Phaser.GameObjects.Text)?.setText('ON');
    } else {
      ui.toggle.setFillStyle(0x333333);
      ui.toggle.setStrokeStyle(1, 0x555555);
    }
    
    // 목표 수
    ui.countText.setText(config.targetCount === 0 ? '∞' : config.targetCount.toString());
  }

  private updateParamUI(key: string): void {
    const text = this.paramInputs.get(key);
    if (!text || !this.editingStrategy) return;
    
    const value = (this.editingStrategy as unknown as Record<string, number>)[key] || 0;
    text.setText(value.toString());
  }

  private getUnitConfig(unitType: UnitType): UnitProductionConfig | undefined {
    return this.editingStrategy?.unitProduction.find(p => p.unitType === unitType);
  }

  private duplicateStrategy(): void {
    if (!this.editingStrategy) return;
    
    const newName = prompt('새 전략 이름:', this.editingStrategy.name + ' (복사)');
    if (!newName) return;
    
    const newStrategy: Strategy = {
      ...JSON.parse(JSON.stringify(this.editingStrategy)),
      id: `custom_${Date.now()}`,
      name: newName,
      isCustom: true,
    };
    
    this.onSave?.(newStrategy, true);
    this.hide();
  }

  private deleteStrategy(): void {
    if (!this.editingStrategy?.isCustom || !this.originalStrategyId) return;
    
    if (confirm(`'${this.editingStrategy.name}' 전략을 삭제하시겠습니까?`)) {
      this.onDelete?.(this.originalStrategyId);
      this.hide();
    }
  }

  private save(): void {
    if (!this.editingStrategy) return;
    
    this.onSave?.(this.editingStrategy, false);
    this.hide();
  }

  destroy(): void {
    this.overlay.destroy();
    this.container.destroy();
  }
}
