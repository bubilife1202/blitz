// ==========================================
// BuildingRenderer - 건물 렌더링 (타입별 구분)
// ==========================================

import Phaser from 'phaser';
import type { Entity } from '@core/ecs/Entity';
import { Position } from '@core/components/Position';
import { Selectable } from '@core/components/Selectable';
import { Owner } from '@core/components/Owner';
import { Building } from '@core/components/Building';
import { ProductionQueue } from '@core/components/ProductionQueue';
import { BuildingType, type PlayerId } from '@shared/types';
import type { VisionSystem } from '@core/systems/VisionSystem';

interface BuildingVisual {
  graphics: Phaser.GameObjects.Graphics;
  selectionRect: Phaser.GameObjects.Graphics;
  hpBar: Phaser.GameObjects.Graphics;
  progressBar: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  productionLabel: Phaser.GameObjects.Text; // 생산 중인 유닛 표시
}

// 플레이어별 색상
const PLAYER_COLORS: Record<PlayerId, { main: number; dark: number; light: number }> = {
  1: { main: 0x0066cc, dark: 0x003366, light: 0x66aaff }, // 파랑 (플레이어)
  2: { main: 0xcc3300, dark: 0x661a00, light: 0xff6633 }, // 주황-빨강 (적/AI)
};

// 건물 타입별 설정
const BUILDING_VISUALS: Record<BuildingType, { label: string; accent: number }> = {
  [BuildingType.COMMAND_CENTER]: { label: 'CC', accent: 0xffcc00 },
  [BuildingType.SUPPLY_DEPOT]: { label: 'SUP', accent: 0x66ff66 },
  [BuildingType.REFINERY]: { label: 'REF', accent: 0x00ff88 },
  [BuildingType.BARRACKS]: { label: 'BAR', accent: 0xff6600 },
  [BuildingType.FACTORY]: { label: 'FAC', accent: 0x888888 },
  [BuildingType.ENGINEERING_BAY]: { label: 'ENG', accent: 0x00aaff },
  [BuildingType.ARMORY]: { label: 'ARM', accent: 0xaa6600 },
  [BuildingType.BUNKER]: { label: 'BUN', accent: 0x666666 },
  [BuildingType.MISSILE_TURRET]: { label: 'TUR', accent: 0xff4444 },
};

export class BuildingRenderer {
  private scene: Phaser.Scene;
  private visuals: Map<number, BuildingVisual> = new Map();
  private localPlayerId: PlayerId;
  private visionSystem?: VisionSystem;

  constructor(scene: Phaser.Scene, localPlayerId: PlayerId = 1, visionSystem?: VisionSystem) {
    this.scene = scene;
    this.localPlayerId = localPlayerId;
    this.visionSystem = visionSystem;
  }

  setVisionSystem(visionSystem: VisionSystem): void {
    this.visionSystem = visionSystem;
  }

  updateEntities(entities: Entity[]): void {
    const activeIds = new Set<number>();

    for (const entity of entities) {
      const position = entity.getComponent<Position>(Position);
      const building = entity.getComponent<Building>(Building);
      const owner = entity.getComponent<Owner>(Owner);

      if (!position || !building) continue;

      // 안개 전쟁: 적 건물이 탐색 안 됐으면 숨김 (건물은 탐색되면 안개 속에서도 보임)
      const isEnemyBuilding = owner && owner.playerId !== this.localPlayerId;
      const isExplored = !this.visionSystem || 
        this.visionSystem.getVisibilityAtPosition(this.localPlayerId, position.x, position.y) >= 1;

      if (isEnemyBuilding && !isExplored) {
        const existingVisual = this.visuals.get(entity.id);
        if (existingVisual) {
          this.setVisualVisible(existingVisual, false);
        }
        continue;
      }

      activeIds.add(entity.id);

      let visual = this.visuals.get(entity.id);

      if (!visual) {
        visual = this.createVisual();
        this.visuals.set(entity.id, visual);
      }

      this.setVisualVisible(visual, true);
      this.updateVisual(visual, entity);
    }

    for (const [id, visual] of this.visuals) {
      if (!activeIds.has(id)) {
        this.destroyVisual(visual);
        this.visuals.delete(id);
      }
    }
  }

  private setVisualVisible(visual: BuildingVisual, visible: boolean): void {
    visual.graphics.setVisible(visible);
    visual.selectionRect.setVisible(visible);
    visual.hpBar.setVisible(visible);
    visual.progressBar.setVisible(visible);
    visual.label.setVisible(visible);
    visual.productionLabel.setVisible(visible);
  }

  private createVisual(): BuildingVisual {
    const graphics = this.scene.add.graphics();
    graphics.setDepth(5);

    const selectionRect = this.scene.add.graphics();
    selectionRect.setDepth(4);

    const hpBar = this.scene.add.graphics();
    hpBar.setDepth(6);

    const progressBar = this.scene.add.graphics();
    progressBar.setDepth(7);

    const label = this.scene.add.text(0, 0, '', {
      fontSize: '10px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
      fontStyle: 'bold',
    });
    label.setOrigin(0.5, 0.5);
    label.setDepth(8);

    const productionLabel = this.scene.add.text(0, 0, '', {
      fontSize: '9px',
      color: '#00ffff',
      stroke: '#000000',
      strokeThickness: 2,
    });
    productionLabel.setOrigin(0.5, 0.5);
    productionLabel.setDepth(9);

    return { graphics, selectionRect, hpBar, progressBar, label, productionLabel };
  }

  private updateVisual(visual: BuildingVisual, entity: Entity): void {
    const position = entity.getComponent<Position>(Position)!;
    const building = entity.getComponent<Building>(Building)!;
    const owner = entity.getComponent<Owner>(Owner);
    const selectable = entity.getComponent<Selectable>(Selectable);
    const queue = entity.getComponent<ProductionQueue>(ProductionQueue);

    const playerId = owner?.playerId ?? 0;
    const colors = PLAYER_COLORS[playerId] || { main: 0x666666, dark: 0x333333, light: 0x999999 };
    const buildingConfig = BUILDING_VISUALS[building.buildingType] || { label: '?', accent: 0xffffff };

    const width = building.width * 32;
    const height = building.height * 32;

    // 위치
    visual.graphics.setPosition(position.x, position.y);
    visual.selectionRect.setPosition(position.x, position.y);
    visual.hpBar.setPosition(position.x, position.y);
    visual.progressBar.setPosition(position.x, position.y);
    visual.label.setPosition(position.x, position.y);

    // 건물 그리기
    visual.graphics.clear();
    
    const alpha = building.isConstructing ? 0.6 : 1;
    
    // 메인 건물 (외곽선 두껍게)
    visual.graphics.fillStyle(colors.main, alpha);
    visual.graphics.fillRect(-width / 2, -height / 2, width, height);
    
    // 테두리
    visual.graphics.lineStyle(3, colors.dark, alpha);
    visual.graphics.strokeRect(-width / 2, -height / 2, width, height);
    
    // 내부 악센트 라인 (건물 타입 구분)
    visual.graphics.lineStyle(2, buildingConfig.accent, alpha * 0.8);
    visual.graphics.strokeRect(-width / 2 + 4, -height / 2 + 4, width - 8, height - 8);

    // 건설 중 표시 (대각선 패턴)
    if (building.isConstructing) {
      visual.graphics.lineStyle(1, 0xffaa00, 0.5);
      for (let i = -width; i < width + height; i += 10) {
        visual.graphics.lineBetween(
          Math.max(-width / 2, i - height / 2),
          Math.max(-height / 2, -i + width / 2),
          Math.min(width / 2, i + height / 2),
          Math.min(height / 2, -i + width / 2 + height)
        );
      }
    }

    // 라벨
    visual.label.setText(buildingConfig.label);
    visual.label.setAlpha(alpha);

    // 선택 표시
    visual.selectionRect.clear();
    if (selectable?.isSelected) {
      const selColor = playerId === this.localPlayerId ? 0x00ff00 : 0xff0000;
      visual.selectionRect.lineStyle(3, selColor, 1);
      visual.selectionRect.strokeRect(-width / 2 - 2, -height / 2 - 2, width + 4, height + 4);
      
      // 코너 강조
      const cornerSize = 8;
      visual.selectionRect.lineStyle(3, 0xffffff, 1);
      // 좌상
      visual.selectionRect.lineBetween(-width / 2 - 2, -height / 2 - 2, -width / 2 - 2 + cornerSize, -height / 2 - 2);
      visual.selectionRect.lineBetween(-width / 2 - 2, -height / 2 - 2, -width / 2 - 2, -height / 2 - 2 + cornerSize);
      // 우상
      visual.selectionRect.lineBetween(width / 2 + 2 - cornerSize, -height / 2 - 2, width / 2 + 2, -height / 2 - 2);
      visual.selectionRect.lineBetween(width / 2 + 2, -height / 2 - 2, width / 2 + 2, -height / 2 - 2 + cornerSize);
      // 좌하
      visual.selectionRect.lineBetween(-width / 2 - 2, height / 2 + 2 - cornerSize, -width / 2 - 2, height / 2 + 2);
      visual.selectionRect.lineBetween(-width / 2 - 2, height / 2 + 2, -width / 2 - 2 + cornerSize, height / 2 + 2);
      // 우하
      visual.selectionRect.lineBetween(width / 2 + 2, height / 2 + 2 - cornerSize, width / 2 + 2, height / 2 + 2);
      visual.selectionRect.lineBetween(width / 2 + 2 - cornerSize, height / 2 + 2, width / 2 + 2, height / 2 + 2);
    }

    // HP 바
    const barWidth = width;
    const barHeight = 5;
    const yOffset = -height / 2 - 12;

    visual.hpBar.clear();
    const hpPercent = building.hp / building.maxHp;

    if (selectable?.isSelected || hpPercent < 1 || building.isConstructing) {
      visual.hpBar.fillStyle(0x000000, 0.8);
      visual.hpBar.fillRect(-barWidth / 2, yOffset, barWidth, barHeight);

      let hpColor = 0x00ff00;
      if (hpPercent < 0.3) hpColor = 0xff0000;
      else if (hpPercent < 0.6) hpColor = 0xffff00;

      visual.hpBar.fillStyle(hpColor, 1);
      visual.hpBar.fillRect(-barWidth / 2, yOffset, barWidth * hpPercent, barHeight);
    }

    // 진행 바 (건설 또는 생산)
    visual.progressBar.clear();
    visual.productionLabel.setVisible(false);

    if (building.isConstructing) {
      const progress = building.constructionProgress / 100;
      visual.progressBar.fillStyle(0x000000, 0.8);
      visual.progressBar.fillRect(-barWidth / 2, yOffset + barHeight + 2, barWidth, barHeight);
      visual.progressBar.fillStyle(0xffaa00, 1);
      visual.progressBar.fillRect(-barWidth / 2, yOffset + barHeight + 2, barWidth * progress, barHeight);
      
      // 건설 중 텍스트
      visual.productionLabel.setText('건설 중...');
      visual.productionLabel.setPosition(position.x, position.y + height / 2 + 12);
      visual.productionLabel.setColor('#ffaa00');
      visual.productionLabel.setVisible(true);
    } else if (queue && !queue.isEmpty()) {
      const current = queue.getCurrentProduction();
      if (current) {
        const progress = current.progress / 100;
        visual.progressBar.fillStyle(0x000000, 0.8);
        visual.progressBar.fillRect(-barWidth / 2, yOffset + barHeight + 2, barWidth, barHeight);
        visual.progressBar.fillStyle(0x00aaff, 1);
        visual.progressBar.fillRect(-barWidth / 2, yOffset + barHeight + 2, barWidth * progress, barHeight);
        
        // 생산 중인 유닛 표시 (펄스 효과)
        const time = Date.now() / 500;
        const pulse = 0.7 + Math.sin(time) * 0.3;
        const unitName = current.unitType === 'scv' ? 'SCV' : current.unitType === 'marine' ? 'Marine' : current.unitType;
        const queueLen = queue.getQueueLength();
        const queueText = queueLen > 1 ? ` (${queueLen})` : '';
        visual.productionLabel.setText(`▶ ${unitName}${queueText}`);
        visual.productionLabel.setPosition(position.x, position.y + height / 2 + 12);
        visual.productionLabel.setColor('#00ffff');
        visual.productionLabel.setAlpha(pulse);
        visual.productionLabel.setVisible(true);
        
        // 생산 중 아이콘 효과 (빌딩 내부에 깜빡임)
        visual.graphics.fillStyle(0x00ffff, 0.2 + Math.sin(time * 2) * 0.1);
        visual.graphics.fillCircle(0, 0, Math.min(width, height) / 4);
      }
    }
  }

  private destroyVisual(visual: BuildingVisual): void {
    visual.graphics.destroy();
    visual.selectionRect.destroy();
    visual.hpBar.destroy();
    visual.progressBar.destroy();
    visual.label.destroy();
    visual.productionLabel.destroy();
  }

  destroy(): void {
    for (const visual of this.visuals.values()) {
      this.destroyVisual(visual);
    }
    this.visuals.clear();
  }
}
