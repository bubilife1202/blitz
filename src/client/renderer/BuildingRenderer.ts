// ==========================================
// BuildingRenderer - 건물 렌더링 (스프라이트 기반)
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
  sprite: Phaser.GameObjects.Sprite;
  selectionRect: Phaser.GameObjects.Graphics;
  hpBar: Phaser.GameObjects.Graphics;
  progressBar: Phaser.GameObjects.Graphics;
  productionLabel: Phaser.GameObjects.Text;
  constructionOverlay: Phaser.GameObjects.Graphics;
}

// 플레이어별 틴트 색상
const PLAYER_TINTS: Record<PlayerId, number> = {
  1: 0x8888ff, // 파랑 (플레이어)
  2: 0xff8866, // 주황-빨강 (적/AI)
};

// 건물 타입별 스프라이트 매핑
const BUILDING_SPRITES: Record<BuildingType, { frame: string; scale: number }> = {
  [BuildingType.HQ]: { frame: 'scifiStructure_01.png', scale: 1.0 },
  [BuildingType.DEPOT]: { frame: 'scifiStructure_08.png', scale: 1.2 },
  [BuildingType.REFINERY]: { frame: 'scifiStructure_06.png', scale: 1.0 },
  [BuildingType.BARRACKS]: { frame: 'scifiStructure_07.png', scale: 1.0 },
  [BuildingType.FACTORY]: { frame: 'scifiStructure_03.png', scale: 1.0 },
  [BuildingType.TECH_LAB]: { frame: 'scifiStructure_04.png', scale: 1.0 },
  [BuildingType.ARMORY]: { frame: 'scifiStructure_05.png', scale: 1.0 },
  [BuildingType.BUNKER]: { frame: 'scifiStructure_11.png', scale: 1.2 },
  [BuildingType.TURRET]: { frame: 'scifiStructure_09.png', scale: 1.0 },
};

export class BuildingRenderer {
  private scene: Phaser.Scene;
  private visuals: Map<number, BuildingVisual> = new Map();
  private localPlayerId: PlayerId;
  private visionSystem?: VisionSystem;
  private useSprites: boolean = false;

  constructor(scene: Phaser.Scene, localPlayerId: PlayerId = 1, visionSystem?: VisionSystem) {
    this.scene = scene;
    this.localPlayerId = localPlayerId;
    this.visionSystem = visionSystem;
    
    // 스프라이트시트 로드 여부 확인
    this.useSprites = this.scene.textures.exists('scifi');
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

      // 안개 전쟁: 적 건물이 탐색 안 됐으면 숨김
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
        visual = this.createVisual(entity);
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
    visual.sprite.setVisible(visible);
    visual.selectionRect.setVisible(visible);
    visual.hpBar.setVisible(visible);
    visual.progressBar.setVisible(visible);
    visual.productionLabel.setVisible(visible);
    visual.constructionOverlay.setVisible(visible);
  }

  private createVisual(entity: Entity): BuildingVisual {
    const building = entity.getComponent<Building>(Building);
    const owner = entity.getComponent<Owner>(Owner);
    const playerId = owner?.playerId ?? 1;
    
    let sprite: Phaser.GameObjects.Sprite;
    
    if (this.useSprites && building) {
      const spriteConfig = BUILDING_SPRITES[building.buildingType];
      sprite = this.scene.add.sprite(0, 0, 'scifi', spriteConfig.frame);
      sprite.setScale(spriteConfig.scale);
      sprite.setTint(PLAYER_TINTS[playerId] || 0xffffff);
    } else {
      sprite = this.scene.add.sprite(0, 0, 'building_placeholder');
      sprite.setTint(PLAYER_TINTS[playerId] || 0xffffff);
    }
    
    sprite.setDepth(5);

    const selectionRect = this.scene.add.graphics();
    selectionRect.setDepth(4);

    const hpBar = this.scene.add.graphics();
    hpBar.setDepth(6);

    const progressBar = this.scene.add.graphics();
    progressBar.setDepth(7);

    const productionLabel = this.scene.add.text(0, 0, '', {
      fontSize: '9px',
      color: '#00ffff',
      stroke: '#000000',
      strokeThickness: 2,
    });
    productionLabel.setOrigin(0.5, 0.5);
    productionLabel.setDepth(9);
    
    const constructionOverlay = this.scene.add.graphics();
    constructionOverlay.setDepth(6);

    return { sprite, selectionRect, hpBar, progressBar, productionLabel, constructionOverlay };
  }

  private updateVisual(visual: BuildingVisual, entity: Entity): void {
    const position = entity.getComponent<Position>(Position)!;
    const building = entity.getComponent<Building>(Building)!;
    const owner = entity.getComponent<Owner>(Owner);
    const selectable = entity.getComponent<Selectable>(Selectable);
    const queue = entity.getComponent<ProductionQueue>(ProductionQueue);

    const playerId = owner?.playerId ?? 1;
    
    // 건물 크기 계산
    const width = building.width * 32;
    const height = building.height * 32;

    // 위치
    visual.sprite.setPosition(position.x, position.y);
    visual.selectionRect.setPosition(position.x, position.y);
    visual.hpBar.setPosition(position.x, position.y);
    visual.progressBar.setPosition(position.x, position.y);
    visual.constructionOverlay.setPosition(position.x, position.y);
    
    // 건설 중 알파 조정
    const alpha = building.isConstructing ? 0.6 : 1;
    visual.sprite.setAlpha(alpha);
    
    // 건설 중 오버레이
    visual.constructionOverlay.clear();
    if (building.isConstructing) {
      visual.constructionOverlay.lineStyle(1, 0xffaa00, 0.5);
      // 대각선 패턴
      for (let i = -width; i < width + height; i += 10) {
        visual.constructionOverlay.lineBetween(
          Math.max(-width / 2, i - height / 2),
          Math.max(-height / 2, -i + width / 2),
          Math.min(width / 2, i + height / 2),
          Math.min(height / 2, -i + width / 2 + height)
        );
      }
    }

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
        const unitName = current.unitType === 'engineer' ? 'Engineer' : current.unitType === 'trooper' ? 'Trooper' : current.unitType;
        const queueLen = queue.getQueueLength();
        const queueText = queueLen > 1 ? ` (${queueLen})` : '';
        visual.productionLabel.setText(`▶ ${unitName}${queueText}`);
        visual.productionLabel.setPosition(position.x, position.y + height / 2 + 12);
        visual.productionLabel.setColor('#00ffff');
        visual.productionLabel.setAlpha(pulse);
        visual.productionLabel.setVisible(true);
      }
    }
  }

  private destroyVisual(visual: BuildingVisual): void {
    visual.sprite.destroy();
    visual.selectionRect.destroy();
    visual.hpBar.destroy();
    visual.progressBar.destroy();
    visual.productionLabel.destroy();
    visual.constructionOverlay.destroy();
  }

  destroy(): void {
    for (const visual of this.visuals.values()) {
      this.destroyVisual(visual);
    }
    this.visuals.clear();
  }
}
