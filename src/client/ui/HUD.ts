// ==========================================
// HUD - 게임 UI 관리
// ==========================================

import Phaser from 'phaser';
import type { GameState } from '@core/GameState';
import type { SelectionManager } from '../input/SelectionManager';
import type { Entity } from '@core/ecs/Entity';
import { Unit } from '@core/components/Unit';
import { Building } from '@core/components/Building';
import { ProductionQueue } from '@core/components/ProductionQueue';
import { ResearchQueue } from '@core/components/ResearchQueue';
import { Gatherer } from '@core/components/Gatherer';
import { Owner } from '@core/components/Owner';
import { UnitType, BuildingType, UpgradeType } from '@shared/types';
import { UNIT_STATS, BUILDING_STATS, UPGRADE_STATS, canBuildBuilding, canTrainUnit, canResearchUpgrade } from '@shared/constants';

export class HUD {
  private scene: Phaser.Scene;
  private gameState: GameState;
  private selectionManager: SelectionManager;
  private localPlayerId: number = 1;

  // UI 컨테이너
  private container!: Phaser.GameObjects.Container;
  private resourcePanel!: Phaser.GameObjects.Container;
  private selectionPanel!: Phaser.GameObjects.Container;
  private commandPanel!: Phaser.GameObjects.Container;

  // 텍스트 요소
  private mineralText!: Phaser.GameObjects.Text;
  private gasText!: Phaser.GameObjects.Text;
  private supplyText!: Phaser.GameObjects.Text;
  private selectionInfo!: Phaser.GameObjects.Text;

  // 동적 버튼들
  private dynamicButtons: Phaser.GameObjects.GameObject[] = [];
  
  // 캐시 (버튼 재생성 최적화용)
  private lastSelectionIds: string = '';
  private lastResourceHash: string = '';

  // 콜백
  public onBuildCommand?: (buildingType: BuildingType) => void;
  public onTrainCommand?: (unitType: UnitType) => void;
  public onResearchCommand?: (upgradeType: UpgradeType) => void;
  public onSiegeCommand?: () => void;
  public onStimCommand?: () => void;

  constructor(scene: Phaser.Scene, gameState: GameState, selectionManager: SelectionManager) {
    this.scene = scene;
    this.gameState = gameState;
    this.selectionManager = selectionManager;

    this.createUI();
  }

  setLocalPlayerId(playerId: number): void {
    this.localPlayerId = playerId;
  }

  private createUI(): void {
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;

    this.container = this.scene.add.container(0, 0);
    this.container.setScrollFactor(0);
    this.container.setDepth(3000);

    // 리소스 패널 (상단)
    this.createResourcePanel(width);

    // 선택 패널 (하단 중앙-좌측, 미니맵 옆)
    // 미니맵이 200x200이므로 x=220은 적절, 높이를 조금 키움
    this.createSelectionPanel(height);

    // 커맨드 패널 (하단 우측)
    this.createCommandPanel(width, height);
  }

  private createResourcePanel(width: number): void {
    this.resourcePanel = this.scene.add.container(0, 0);

    // 베벨 배경 (3D 효과)
    const bgHeight = 44; // 36 -> 44
    const bg = this.scene.add.rectangle(width / 2, bgHeight / 2, width, bgHeight, 0x1a1a2e, 0.95);
    const topEdge = this.scene.add.rectangle(width / 2, 1, width, 2, 0x3a3a5e);
    const bottomEdge = this.scene.add.rectangle(width / 2, bgHeight - 1, width, 2, 0x0a0a1a);
    this.resourcePanel.add([bg, topEdge, bottomEdge]);

    const startX = 140; // 시작 위치 조정
    const gap = 140;    // 간격 넓힘

    // 미네랄 (다이아몬드 아이콘)
    const mineralGfx = this.scene.add.graphics();
    mineralGfx.fillStyle(0x00ffff, 1);
    mineralGfx.fillTriangle(startX, 14, startX - 10, 24, startX, 34); // 왼쪽
    mineralGfx.fillStyle(0x00cccc, 1);
    mineralGfx.fillTriangle(startX, 14, startX + 10, 24, startX, 34); // 오른쪽
    mineralGfx.fillStyle(0x00eeee, 1);
    mineralGfx.fillTriangle(startX, 14, startX - 5, 24, startX + 5, 24); // 상단
    this.mineralText = this.scene.add.text(startX + 20, 14, '50', {
      fontSize: '18px', // 16px -> 18px
      color: '#00ffff',
      fontStyle: 'bold',
      shadow: { offsetX: 1, offsetY: 1, color: '#003333', blur: 2, fill: true }
    });
    this.resourcePanel.add([mineralGfx, this.mineralText]);

    // 가스 (원형 + 연기 효과)
    const gasX = startX + gap;
    const gasGfx = this.scene.add.graphics();
    gasGfx.fillStyle(0x00aa00, 1);
    gasGfx.fillCircle(gasX, 24, 12);
    gasGfx.fillStyle(0x00ff00, 0.6);
    gasGfx.fillCircle(gasX, 24, 8);
    gasGfx.fillStyle(0x88ff88, 0.4);
    gasGfx.fillCircle(gasX - 2, 21, 4);
    this.gasText = this.scene.add.text(gasX + 20, 14, '0', {
      fontSize: '18px', // 16px -> 18px
      color: '#00ff00',
      fontStyle: 'bold',
      shadow: { offsetX: 1, offsetY: 1, color: '#003300', blur: 2, fill: true }
    });
    this.resourcePanel.add([gasGfx, this.gasText]);

    // 서플라이 (사람 아이콘)
    const supplyX = gasX + gap;
    const supplyGfx = this.scene.add.graphics();
    supplyGfx.fillStyle(0xffcc00, 1);
    supplyGfx.fillCircle(supplyX, 18, 6); // 머리
    supplyGfx.fillRect(supplyX - 3, 23, 7, 12); // 몸통
    supplyGfx.fillStyle(0xffaa00, 1);
    supplyGfx.fillRect(supplyX - 7, 25, 4, 8); // 왼팔
    supplyGfx.fillRect(supplyX + 4, 25, 4, 8); // 오른팔
    this.supplyText = this.scene.add.text(supplyX + 20, 14, '0/10', {
      fontSize: '18px', // 16px -> 18px
      color: '#ffcc00',
      fontStyle: 'bold',
      shadow: { offsetX: 1, offsetY: 1, color: '#333300', blur: 2, fill: true }
    });
    this.resourcePanel.add([supplyGfx, this.supplyText]);

    this.container.add(this.resourcePanel);
  }

  private createSelectionPanel(height: number): void {
    // 미니맵(200x200) 오른쪽에 배치
    const panelH = 160; // 140 -> 160
    this.selectionPanel = this.scene.add.container(220, height - panelH - 10);

    const w = 320, h = panelH; // 280 -> 320
    
    // 베벨 프레임 배경
    const bg = this.scene.add.rectangle(0, 0, w, h, 0x0d1117, 0.95);
    bg.setOrigin(0, 0);
    
    // 3D 베벨 효과 (밝은 상단/좌측, 어두운 하단/우측)
    const bevelGfx = this.scene.add.graphics();
    bevelGfx.lineStyle(2, 0x3a4a5a); // 밝은 테두리
    bevelGfx.moveTo(0, h);
    bevelGfx.lineTo(0, 0);
    bevelGfx.lineTo(w, 0);
    bevelGfx.strokePath();
    bevelGfx.lineStyle(2, 0x0a0a0f); // 어두운 테두리
    bevelGfx.moveTo(w, 0);
    bevelGfx.lineTo(w, h);
    bevelGfx.lineTo(0, h);
    bevelGfx.strokePath();
    
    // 내부 테두리
    bevelGfx.lineStyle(1, 0x2a3a4a);
    bevelGfx.strokeRect(4, 4, w - 8, h - 8);
    
    this.selectionPanel.add([bg, bevelGfx]);

    // 선택 정보
    this.selectionInfo = this.scene.add.text(12, 12, 'No selection', {
      fontSize: '16px', // 14px -> 16px
      color: '#c0c0c0',
      wordWrap: { width: w - 24 },
      shadow: { offsetX: 1, offsetY: 1, color: '#000000', blur: 1, fill: true },
      lineSpacing: 4 // 줄 간격 추가
    });
    this.selectionPanel.add(this.selectionInfo);

    this.container.add(this.selectionPanel);
  }

  private createCommandPanel(width: number, height: number): void {
    const w = 260, h = 160; // 240, 140 -> 260, 160
    this.commandPanel = this.scene.add.container(width - w - 10, height - h - 10);

    // 베벨 프레임 배경
    const bg = this.scene.add.rectangle(0, 0, w, h, 0x0d1117, 0.95);
    bg.setOrigin(0, 0);
    
    // 3D 베벨 효과
    const bevelGfx = this.scene.add.graphics();
    bevelGfx.lineStyle(2, 0x3a4a5a);
    bevelGfx.moveTo(0, h);
    bevelGfx.lineTo(0, 0);
    bevelGfx.lineTo(w, 0);
    bevelGfx.strokePath();
    bevelGfx.lineStyle(2, 0x0a0a0f);
    bevelGfx.moveTo(w, 0);
    bevelGfx.lineTo(w, h);
    bevelGfx.lineTo(0, h);
    bevelGfx.strokePath();
    
    // 내부 테두리
    bevelGfx.lineStyle(1, 0x2a3a4a);
    bevelGfx.strokeRect(4, 4, w - 8, h - 8);
    
    this.commandPanel.add([bg, bevelGfx]);

    this.container.add(this.commandPanel);
  }

  update(): void {
    // 자원 업데이트
    const resources = this.gameState.getPlayerResources(1);
    if (resources) {
      this.mineralText.setText(resources.minerals.toString());
      this.gasText.setText(resources.gas.toString());
      this.supplyText.setText(`${resources.supply}/${resources.supplyMax}`);
    }

    // 선택 정보 업데이트 (캐시 기반 최적화)
    this.updateSelectionInfo(resources);
  }

  private updateSelectionInfo(resources: { minerals: number; gas: number; supply: number; supplyMax: number } | undefined): void {
    const selected = this.selectionManager.getSelectedEntities();
    
    // 선택 변경 체크 (선택된 엔티티 ID 기반)
    const currentSelectionIds = selected.map(e => e.id).sort().join(',');
    
    // 자원 변경 체크 (버튼 활성화 상태에 영향)
    const currentResourceHash = resources 
      ? `${resources.minerals}_${resources.gas}_${resources.supply}_${resources.supplyMax}`
      : '';
    
    // 변경 없으면 버튼 재생성 스킵 (텍스트 업데이트만)
    const selectionChanged = currentSelectionIds !== this.lastSelectionIds;
    const resourcesChanged = currentResourceHash !== this.lastResourceHash;
    
    if (!selectionChanged && !resourcesChanged) {
      // 버튼은 그대로, 정보 텍스트만 업데이트할 수 있지만
      // 생산 큐 진행률 등 동적 정보가 있으므로 텍스트는 매번 업데이트
      this.updateSelectionText(selected);
      return;
    }
    
    // 캐시 업데이트
    this.lastSelectionIds = currentSelectionIds;
    this.lastResourceHash = currentResourceHash;

    // 이전 동적 버튼 제거 (변경시에만)
    this.clearDynamicButtons();

    if (selected.length === 0) {
      this.selectionInfo.setText('No selection');
      return;
    }

    if (selected.length === 1) {
      const entity = selected[0];
      const unit = entity.getComponent<Unit>(Unit);
      const building = entity.getComponent<Building>(Building);
      const queue = entity.getComponent<ProductionQueue>(ProductionQueue);
      const gatherer = entity.getComponent<Gatherer>(Gatherer);

      let info = '';

      if (unit) {
        info = `${unit.unitType.toUpperCase()}\nHP: ${Math.floor(unit.hp)}/${unit.maxHp}\nDamage: ${unit.damage} | Range: ${unit.range}`;
        
        if (unit.isSieged) info += '\n[SIEGE MODE]';
        if (unit.isStimmed) info += '\n[STIMMED]';
        
        // SCV면 건물 건설 버튼
        if (gatherer) {
          this.showBuildButtons();
        }
        
        // Siege Tank 시즈 버튼
        if (unit.unitType === UnitType.ARTILLERY) {
          this.showSiegeButton(unit.isSieged);
        }
        
        // Marine/Firebat Stim 버튼
        if (unit.unitType === UnitType.TROOPER || unit.unitType === UnitType.PYRO) {
          this.showStimButton();
        }
      } else if (building) {
        info = `${building.buildingType.toUpperCase()}\nHP: ${Math.floor(building.hp)}/${building.maxHp}`;
        if (building.isConstructing) {
          info += `\nBuilding: ${Math.floor(building.constructionProgress)}%`;
        } else {
          // 생산 가능 건물이면 유닛 버튼
          this.showProductionButtons(building.buildingType);
          // 연구 가능 건물이면 연구 버튼
          this.showResearchButtons(building.buildingType);
        }
      }

      // 생산 큐 표시
      if (queue && queue.getQueueLength() > 0) {
        const current = queue.getCurrentProduction();
        if (current) {
          info += `\n\nTraining: ${current.unitType} (${Math.floor(current.progress)}%)`;
        }
      }

      // 연구 큐 표시
      const researchQueue = entity.getComponent<ResearchQueue>(ResearchQueue);
      if (researchQueue && researchQueue.isResearching()) {
        const current = researchQueue.getCurrentResearch();
        if (current) {
          info += `\n\nResearch: ${current.upgradeType} (${Math.floor(current.progress)}%)`;
        }
      }

      this.selectionInfo.setText(info);
    } else {
      // 다중 선택 (멀티 선택 그리드 구현)
      const unitCount = selected.filter(e => e.getComponent<Unit>(Unit)).length;
      const buildingCount = selected.filter(e => e.getComponent<Building>(Building)).length;
      
      let info = `Selected: ${selected.length}`;
      if (unitCount > 0) info += `\nUnits: ${unitCount}`;
      if (buildingCount > 0) info += `\nBuildings: ${buildingCount}`;
      
      this.selectionInfo.setText(info);
      this.selectionInfo.setPosition(10, 10);

      // 개별 유닛 상태 그리드 표시
      this.createSelectionGrid(selected);
      
      // 다중 SCV면 건물 버튼
      const hasGatherer = selected.some(e => e.getComponent<Gatherer>(Gatherer));
      if (hasGatherer) {
        this.showBuildButtons();
      }
    }
  }

  // 멀티 선택 유닛 그리드 생성
  private createSelectionGrid(entities: Entity[]): void {
    const startX = 12;
    const startY = 60; // 텍스트 영역 확보
    const boxSize = 16; // 12 -> 16
    const padding = 4;
    const cols = 14;    // 12 -> 14

    entities.forEach((entity, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = startX + col * (boxSize + padding);
      const y = startY + row * (boxSize + padding);

      const unit = entity.getComponent<Unit>(Unit);
      const building = entity.getComponent<Building>(Building);
      
      let hpPercent = 1;
      if (unit) hpPercent = unit.hp / unit.maxHp;
      else if (building) hpPercent = building.hp / building.maxHp;

      // 체력 색상
      let color = 0x00ff00;
      if (hpPercent < 0.3) color = 0xff0000;
      else if (hpPercent < 0.6) color = 0xffff00;

      // 배경 박스
      const bg = this.scene.add.rectangle(x, y, boxSize, boxSize, 0x333333);
      bg.setOrigin(0, 0);
      bg.setStrokeStyle(1, 0x666666);
      
      // 체력 바 (내부)
      const healthHeight = boxSize * hpPercent;
      const hpBar = this.scene.add.rectangle(x + 1, y + boxSize - 1, boxSize - 2, healthHeight - 2, color);
      hpBar.setOrigin(0, 1);

      this.selectionPanel.add([bg, hpBar]);
      this.dynamicButtons.push(bg, hpBar);
    });
  }

  // 선택 정보 텍스트만 업데이트 (버튼 재생성 없이)
  private updateSelectionText(selected: Entity[]): void {
    if (selected.length === 0) {
      this.selectionInfo.setText('No selection');
      return;
    }

    if (selected.length === 1) {
      const entity = selected[0];
      const unit = entity.getComponent<Unit>(Unit);
      const building = entity.getComponent<Building>(Building);
      const queue = entity.getComponent<ProductionQueue>(ProductionQueue);

      let info = '';

      if (unit) {
        info = `${unit.unitType.toUpperCase()}\nHP: ${Math.floor(unit.hp)}/${unit.maxHp}\nDamage: ${unit.damage} | Range: ${unit.range}`;
        if (unit.isSieged) info += '\n[SIEGE MODE]';
        if (unit.isStimmed) info += '\n[STIMMED]';
      } else if (building) {
        info = `${building.buildingType.toUpperCase()}\nHP: ${Math.floor(building.hp)}/${building.maxHp}`;
        if (building.isConstructing) {
          info += `\nBuilding: ${Math.floor(building.constructionProgress)}%`;
        }
      }

      // 생산 큐 표시
      if (queue && queue.getQueueLength() > 0) {
        const current = queue.getCurrentProduction();
        if (current) {
          info += `\n\nTraining: ${current.unitType} (${Math.floor(current.progress)}%)`;
        }
      }

      // 연구 큐 표시
      const researchQueue = entity.getComponent<ResearchQueue>(ResearchQueue);
      if (researchQueue && researchQueue.isResearching()) {
        const current = researchQueue.getCurrentResearch();
        if (current) {
          info += `\n\nResearch: ${current.upgradeType} (${Math.floor(current.progress)}%)`;
        }
      }

      this.selectionInfo.setText(info);
    } else {
      // 다중 선택
      const unitCount = selected.filter(e => e.getComponent<Unit>(Unit)).length;
      const buildingCount = selected.filter(e => e.getComponent<Building>(Building)).length;
      
      let info = `Selected: ${selected.length}`;
      if (unitCount > 0) info += `\nUnits: ${unitCount}`;
      if (buildingCount > 0) info += `\nBuildings: ${buildingCount}`;
      
      this.selectionInfo.setText(info);
    }
  }

  private clearDynamicButtons(): void {
    for (const btn of this.dynamicButtons) {
      btn.destroy();
    }
    this.dynamicButtons = [];
  }

  private getPlayerBuildingTypes(): BuildingType[] {
    const types: BuildingType[] = [];
    for (const entity of this.gameState.getAllEntities()) {
      const owner = entity.getComponent<Owner>(Owner);
      const building = entity.getComponent<Building>(Building);
      if (owner?.playerId === this.localPlayerId && building && !building.isConstructing) {
        if (!types.includes(building.buildingType)) {
          types.push(building.buildingType);
        }
      }
    }
    return types;
  }

  // SCV 건물 건설 버튼
  private showBuildButtons(): void {
    const resources = this.gameState.getPlayerResources(1);
    if (!resources) return;

    const playerBuildings = this.getPlayerBuildingTypes();

    const buildOptions = [
      { type: BuildingType.DEPOT, key: 'D', label: 'Supply' },
      { type: BuildingType.BARRACKS, key: 'B', label: 'Barracks' },
      { type: BuildingType.REFINERY, key: 'G', label: 'Refinery' },
      { type: BuildingType.TECH_LAB, key: 'E', label: 'Eng Bay' },
      { type: BuildingType.FACTORY, key: 'F', label: 'Factory' },
      { type: BuildingType.ARMORY, key: 'R', label: 'Armory' },
    ];

    this.createButtonGrid(buildOptions, resources, playerBuildings, 'build');
  }

  // 건물 유닛 생산 버튼
  private showProductionButtons(buildingType: BuildingType): void {
    const resources = this.gameState.getPlayerResources(1);
    if (!resources) return;

    const playerBuildings = this.getPlayerBuildingTypes();
    const buildingStats = BUILDING_STATS[buildingType];
    
    if (!buildingStats.canProduce || buildingStats.canProduce.length === 0) return;

    const unitConfig: Record<UnitType, { label: string; key: string }> = {
      [UnitType.ENGINEER]: { label: 'SCV', key: 'S' },
      [UnitType.TROOPER]: { label: 'Marine', key: 'M' },
      [UnitType.PYRO]: { label: 'Firebat', key: 'I' },
      [UnitType.MEDIC]: { label: 'Medic', key: 'H' },
      [UnitType.SPEEDER]: { label: 'Vulture', key: 'V' },
      [UnitType.ARTILLERY]: { label: 'Tank', key: 'K' },
      [UnitType.WALKER]: { label: 'Goliath', key: 'G' },
    };

    const trainOptions = buildingStats.canProduce.map(unitType => ({
      type: unitType,
      key: unitConfig[unitType]?.key || unitType[0].toUpperCase(),
      label: unitConfig[unitType]?.label || unitType,
    }));

    this.createButtonGrid(trainOptions, resources, playerBuildings, 'train');
  }

  // 연구 버튼 표시 (Engineering Bay, Armory 선택시)
  private showResearchButtons(buildingType: BuildingType): void {
    const resources = this.gameState.getPlayerResources(1);
    if (!resources) return;

    const buildingStats = BUILDING_STATS[buildingType];
    if (!buildingStats.canResearch || buildingStats.canResearch.length === 0) return;

    // 플레이어의 완료된 업그레이드 목록
    const player = this.gameState.getPlayer(this.localPlayerId);
    const completedUpgrades = player?.upgrades || [];

    const upgradeConfig: Partial<Record<UpgradeType, { label: string; key: string }>> = {
      [UpgradeType.INFANTRY_WEAPONS_1]: { label: 'Inf Wpn 1', key: '1' },
      [UpgradeType.INFANTRY_WEAPONS_2]: { label: 'Inf Wpn 2', key: '2' },
      [UpgradeType.INFANTRY_WEAPONS_3]: { label: 'Inf Wpn 3', key: '3' },
      [UpgradeType.INFANTRY_ARMOR_1]: { label: 'Inf Arm 1', key: '4' },
      [UpgradeType.INFANTRY_ARMOR_2]: { label: 'Inf Arm 2', key: '5' },
      [UpgradeType.INFANTRY_ARMOR_3]: { label: 'Inf Arm 3', key: '6' },
      [UpgradeType.STIM_PACK]: { label: 'Stim', key: 'T' },
      [UpgradeType.EXTENDED_RANGE]: { label: 'U238', key: 'U' },
      [UpgradeType.VEHICLE_WEAPONS_1]: { label: 'Veh Wpn 1', key: '1' },
      [UpgradeType.VEHICLE_WEAPONS_2]: { label: 'Veh Wpn 2', key: '2' },
      [UpgradeType.VEHICLE_WEAPONS_3]: { label: 'Veh Wpn 3', key: '3' },
      [UpgradeType.VEHICLE_ARMOR_1]: { label: 'Veh Arm 1', key: '4' },
      [UpgradeType.VEHICLE_ARMOR_2]: { label: 'Veh Arm 2', key: '5' },
      [UpgradeType.VEHICLE_ARMOR_3]: { label: 'Veh Arm 3', key: '6' },
      [UpgradeType.BOMBARDMENT_MODE]: { label: 'Siege', key: 'S' },
      [UpgradeType.BOOSTERS]: { label: 'Thrusters', key: 'I' },
    };

    this.createResearchButtonGrid(
      buildingStats.canResearch,
      resources,
      completedUpgrades,
      upgradeConfig
    );
  }

  // 연구 버튼 그리드 생성
  private createResearchButtonGrid(
    upgrades: UpgradeType[],
    resources: { minerals: number; gas: number },
    completedUpgrades: UpgradeType[],
    config: Partial<Record<UpgradeType, { label: string; key: string }>>
  ): void {
    const buttonW = 74; // 70 -> 74
    const buttonH = 34; // 32 -> 34
    const padding = 6;  // 4 -> 6
    const startX = 10;  // 8 -> 10
    const startY = 10;  // 8 -> 10
    const cols = 3;

    upgrades.forEach((upgradeType, index) => {
      // 이미 연구 완료된 건 스킵
      if (completedUpgrades.includes(upgradeType)) return;

      const stats = UPGRADE_STATS[upgradeType];
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = startX + col * (buttonW + padding);
      const y = startY + row * (buttonH + padding);

      const canResearch = canResearchUpgrade(upgradeType, completedUpgrades);
      const canAfford = resources.minerals >= stats.mineralCost && resources.gas >= stats.gasCost;
      const available = canResearch && canAfford;

      const bgColor = available ? 0x225588 : (canResearch ? 0x552222 : 0x333333);
      const borderColor = available ? 0x44aaff : (canResearch ? 0xaa4444 : 0x555555);

      const button = this.scene.add.rectangle(x, y, buttonW, buttonH, bgColor);
      button.setOrigin(0, 0);
      button.setStrokeStyle(1, borderColor);
      if (available) button.setInteractive({ useHandCursor: true });

      const label = config[upgradeType]?.label || upgradeType;
      const key = config[upgradeType]?.key || '';

      const labelText = this.scene.add.text(x + 4, y + 4, `[${key}] ${label}`, {
        fontSize: '10px', // 8px -> 10px
        color: available ? '#ffffff' : '#666666',
      });

      const costStr = stats.gasCost > 0 ? `${stats.mineralCost}/${stats.gasCost}` : `${stats.mineralCost}`;
      const costText = this.scene.add.text(x + buttonW - 4, y + buttonH - 4, costStr, {
        fontSize: '10px', // 8px -> 10px
        color: canAfford ? '#88ccff' : '#ff6666',
      });
      costText.setOrigin(1, 1);

      if (available) {
        button.on('pointerover', () => button.setFillStyle(0x3377aa));
        button.on('pointerout', () => button.setFillStyle(bgColor));
        button.on('pointerdown', (pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
          // Stop event propagation to prevent deselection
          event.stopPropagation();
          pointer.event.stopPropagation();
          
          this.onResearchCommand?.(upgradeType);
        });
      }

      this.commandPanel.add([button, labelText, costText]);
      this.dynamicButtons.push(button, labelText, costText);
    });
  }

  // 버튼 그리드 생성 (공통)
  private createButtonGrid(
    options: Array<{ type: BuildingType | UnitType; key: string; label: string }>,
    resources: { minerals: number; gas: number; supply: number; supplyMax: number },
    playerBuildings: BuildingType[],
    mode: 'build' | 'train'
  ): void {
    const buttonW = 74; // 70 -> 74
    const buttonH = 34; // 32 -> 34
    const padding = 6;  // 4 -> 6
    const startX = 10;  // 8 -> 10
    const startY = 10;  // 8 -> 10
    const cols = 3;

    options.forEach((opt, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = startX + col * (buttonW + padding);
      const y = startY + row * (buttonH + padding);

      let canDo = false;
      let canAfford = false;
      let cost = { minerals: 0, gas: 0 };

      if (mode === 'build') {
        const stats = BUILDING_STATS[opt.type as BuildingType];
        canDo = canBuildBuilding(opt.type as BuildingType, playerBuildings);
        cost = { minerals: stats.mineralCost, gas: stats.gasCost };
        canAfford = resources.minerals >= cost.minerals && resources.gas >= cost.gas;
      } else {
        const stats = UNIT_STATS[opt.type as UnitType];
        canDo = canTrainUnit(opt.type as UnitType, playerBuildings);
        cost = { minerals: stats.mineralCost, gas: stats.gasCost };
        canAfford = resources.minerals >= cost.minerals && 
                    resources.gas >= cost.gas &&
                    resources.supply + stats.supplyCost <= resources.supplyMax;
      }

      const available = canDo && canAfford;
      const bgColor = available ? 0x225522 : (canDo ? 0x552222 : 0x333333);
      const borderColor = available ? 0x44aa44 : (canDo ? 0xaa4444 : 0x555555);

      const button = this.scene.add.rectangle(x, y, buttonW, buttonH, bgColor);
      button.setOrigin(0, 0);
      button.setStrokeStyle(1, borderColor);
      if (available) button.setInteractive({ useHandCursor: true });

      const labelText = this.scene.add.text(x + 4, y + 4, `[${opt.key}] ${opt.label}`, {
        fontSize: '11px', // 9px -> 11px
        color: available ? '#ffffff' : '#666666',
      });

      const costStr = cost.gas > 0 ? `${cost.minerals}/${cost.gas}` : `${cost.minerals}`;
      const costText = this.scene.add.text(x + buttonW - 4, y + buttonH - 4, costStr, {
        fontSize: '10px', // 8px -> 10px
        color: canAfford ? '#00ffff' : '#ff6666',
      });
      costText.setOrigin(1, 1);

      if (available) {
        button.on('pointerover', () => button.setFillStyle(0x337733));
        button.on('pointerout', () => button.setFillStyle(bgColor));
        button.on('pointerdown', (pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
          // Stop event propagation to prevent deselection
          event.stopPropagation();
          pointer.event.stopPropagation();
          
          console.log('Button clicked:', mode, opt.type);
          if (mode === 'build') {
            this.onBuildCommand?.(opt.type as BuildingType);
          } else {
            this.onTrainCommand?.(opt.type as UnitType);
          }
        });
      }

      this.commandPanel.add([button, labelText, costText]);
      this.dynamicButtons.push(button, labelText, costText);
    });
  }

  // Siege 버튼
  private showSiegeButton(isSieged: boolean): void {
    const x = 166; // 160 -> 166
    const y = 110; // 100 -> 110
    const buttonW = 74; // 70 -> 74
    const buttonH = 34; // 28 -> 34

    const button = this.scene.add.rectangle(x, y, buttonW, buttonH, 0x664400);
    button.setOrigin(0, 0);
    button.setStrokeStyle(2, 0xff8800);
    button.setInteractive({ useHandCursor: true });

    const text = this.scene.add.text(x + buttonW / 2, y + buttonH / 2, isSieged ? '[O] Unsiege' : '[O] Siege', {
      fontSize: '12px', // 10px -> 12px
      color: '#ffffff',
    });
    text.setOrigin(0.5);

    button.on('pointerover', () => button.setFillStyle(0x885500));
    button.on('pointerout', () => button.setFillStyle(0x664400));
    button.on('pointerdown', (pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      pointer.event.stopPropagation();
      this.onSiegeCommand?.();
    });

    this.commandPanel.add([button, text]);
    this.dynamicButtons.push(button, text);
  }

  // Stim 버튼
  private showStimButton(): void {
    const x = 166;
    const y = 110;
    const buttonW = 74;
    const buttonH = 34;

    const button = this.scene.add.rectangle(x, y, buttonW, buttonH, 0x660044);
    button.setOrigin(0, 0);
    button.setStrokeStyle(2, 0xff0088);
    button.setInteractive({ useHandCursor: true });

    const text = this.scene.add.text(x + buttonW / 2, y + buttonH / 2, '[T] Stim', {
      fontSize: '12px',
      color: '#ffffff',
    });
    text.setOrigin(0.5);

    button.on('pointerover', () => button.setFillStyle(0x880066));
    button.on('pointerout', () => button.setFillStyle(0x660044));
    button.on('pointerdown', (pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      pointer.event.stopPropagation();
      this.onStimCommand?.();
    });

    this.commandPanel.add([button, text]);
    this.dynamicButtons.push(button, text);
  }

  destroy(): void {
    this.container.destroy();
  }
}
