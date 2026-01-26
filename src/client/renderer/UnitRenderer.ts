// ==========================================
// UnitRenderer - 유닛 렌더링 (스프라이트 기반)
// ==========================================

import Phaser from 'phaser';
import type { Entity } from '@core/ecs/Entity';
import { Position } from '@core/components/Position';
import { Selectable } from '@core/components/Selectable';
import { Owner } from '@core/components/Owner';
import { Unit } from '@core/components/Unit';
import { Movement } from '@core/components/Movement';
import { Gatherer, GathererState } from '@core/components/Gatherer';
import { Combat, CombatState } from '@core/components/Combat';
import { UnitType, type PlayerId } from '@shared/types';
import type { VisionSystem } from '@core/systems/VisionSystem';

interface UnitVisual {
  sprite: Phaser.GameObjects.Sprite;
  selectionCircle: Phaser.GameObjects.Graphics;
  hpBar: Phaser.GameObjects.Graphics;
  effectsGraphics: Phaser.GameObjects.Graphics;
}

// 플레이어별 색상 (틴트용)
const PLAYER_TINTS: Record<PlayerId, number> = {
  1: 0x88ff88, // 초록 (플레이어)
  2: 0xff8888, // 빨강 (적/AI)
};

// 유닛 타입별 스프라이트 매핑 (플레이어 1 / 플레이어 2)
const UNIT_SPRITES: Record<UnitType, { p1: string; p2: string; scale: number }> = {
  [UnitType.ENGINEER]: { 
    p1: 'scifiUnit_01.png', 
    p2: 'scifiUnit_12.png',
    scale: 1.2
  },
  [UnitType.TROOPER]: { 
    p1: 'scifiUnit_02.png', 
    p2: 'scifiUnit_13.png',
    scale: 1.2
  },
  [UnitType.PYRO]: { 
    p1: 'scifiUnit_03.png', 
    p2: 'scifiUnit_14.png',
    scale: 1.2
  },
  [UnitType.MEDIC]: { 
    p1: 'scifiUnit_04.png', 
    p2: 'scifiUnit_15.png',
    scale: 1.2
  },
  [UnitType.SPEEDER]: { 
    p1: 'scifiUnit_07.png', 
    p2: 'scifiUnit_19.png',
    scale: 1.0
  },
  [UnitType.ARTILLERY]: { 
    p1: 'scifiUnit_09.png', 
    p2: 'scifiUnit_21.png',
    scale: 0.9
  },
  [UnitType.WALKER]: { 
    p1: 'scifiUnit_08.png', 
    p2: 'scifiUnit_20.png',
    scale: 1.0
  },
};

export class UnitRenderer {
  private scene: Phaser.Scene;
  private visuals: Map<number, UnitVisual> = new Map();
  private localPlayerId: PlayerId;
  private visionSystem?: VisionSystem;
  private hoveredEntityId: number | null = null;
  private hoverGraphics: Phaser.GameObjects.Graphics | null = null;
  private useSprites: boolean = false;

  constructor(scene: Phaser.Scene, localPlayerId: PlayerId = 1, visionSystem?: VisionSystem) {
    this.scene = scene;
    this.localPlayerId = localPlayerId;
    this.visionSystem = visionSystem;
    this.hoverGraphics = this.scene.add.graphics();
    this.hoverGraphics.setDepth(95);
    
    // 스프라이트시트 로드 여부 확인
    this.useSprites = this.scene.textures.exists('scifi');
  }

  setVisionSystem(visionSystem: VisionSystem): void {
    this.visionSystem = visionSystem;
  }
  
  setHoveredEntity(entityId: number | null): void {
    this.hoveredEntityId = entityId;
  }

  updateEntities(entities: Entity[]): void {
    const activeIds = new Set<number>();

    for (const entity of entities) {
      const position = entity.getComponent<Position>(Position);
      const unit = entity.getComponent<Unit>(Unit);
      const owner = entity.getComponent<Owner>(Owner);

      if (!position || !unit) continue;

      // 안개 전쟁: 적 유닛이 시야 밖이면 숨김
      const isEnemyUnit = owner && owner.playerId !== this.localPlayerId;
      const isVisible = !this.visionSystem || 
        this.visionSystem.getVisibilityAtPosition(this.localPlayerId, position.x, position.y) === 2;

      if (isEnemyUnit && !isVisible) {
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

    // 삭제된 엔티티 정리
    for (const [id, visual] of this.visuals) {
      if (!activeIds.has(id)) {
        this.destroyVisual(visual);
        this.visuals.delete(id);
      }
    }
    
    // 호버 인디케이터 업데이트
    this.updateHoverIndicator(entities);
  }
  
  private updateHoverIndicator(entities: Entity[]): void {
    if (!this.hoverGraphics) return;
    this.hoverGraphics.clear();
    
    if (this.hoveredEntityId === null) return;
    
    const entity = entities.find(e => e.id === this.hoveredEntityId);
    if (!entity) return;
    
    const position = entity.getComponent<Position>(Position);
    const unit = entity.getComponent<Unit>(Unit);
    const owner = entity.getComponent<Owner>(Owner);
    
    if (!position || !unit) return;
    
    const radius = 20;
    
    // 호버 링 (점선 효과 - 시간 기반 회전)
    const time = this.scene.time.now / 500;
    const segments = 16;
    const dashRatio = 0.6;
    
    // 적/아군 색상 구분
    const isEnemy = owner && owner.playerId !== this.localPlayerId;
    const hoverColor = isEnemy ? 0xff4444 : 0x44ff44;
    
    this.hoverGraphics.lineStyle(2, hoverColor, 0.8);
    
    for (let i = 0; i < segments; i++) {
      const startAngle = (i / segments) * Math.PI * 2 + time;
      const endAngle = startAngle + (Math.PI * 2 / segments) * dashRatio;
      
      this.hoverGraphics.beginPath();
      this.hoverGraphics.arc(position.x, position.y, radius, startAngle, endAngle, false);
      this.hoverGraphics.strokePath();
    }
  }

  private createVisual(entity: Entity): UnitVisual {
    const unit = entity.getComponent<Unit>(Unit);
    const owner = entity.getComponent<Owner>(Owner);
    const playerId = owner?.playerId ?? 1;
    
    let sprite: Phaser.GameObjects.Sprite;
    
    if (this.useSprites && unit) {
      // 스프라이트 사용
      const spriteConfig = UNIT_SPRITES[unit.unitType];
      const frameName = playerId === 1 ? spriteConfig.p1 : spriteConfig.p2;
      sprite = this.scene.add.sprite(0, 0, 'scifi', frameName);
      sprite.setScale(spriteConfig.scale);
    } else {
      // 폴백: 플레이스홀더 사용
      sprite = this.scene.add.sprite(0, 0, 'unit_placeholder');
      sprite.setTint(PLAYER_TINTS[playerId] || 0xffffff);
    }
    
    sprite.setDepth(10);

    const selectionCircle = this.scene.add.graphics();
    selectionCircle.setDepth(9);

    const hpBar = this.scene.add.graphics();
    hpBar.setDepth(11);
    
    const effectsGraphics = this.scene.add.graphics();
    effectsGraphics.setDepth(12);

    return { sprite, selectionCircle, hpBar, effectsGraphics };
  }

  private updateVisual(visual: UnitVisual, entity: Entity): void {
    const position = entity.getComponent<Position>(Position)!;
    const unit = entity.getComponent<Unit>(Unit)!;
    const owner = entity.getComponent<Owner>(Owner);
    const selectable = entity.getComponent<Selectable>(Selectable);
    const movement = entity.getComponent<Movement>(Movement);
    const gatherer = entity.getComponent<Gatherer>(Gatherer);
    const combat = entity.getComponent<Combat>(Combat);

    const playerId = owner?.playerId ?? 1;
    
    // 스프라이트 프레임 업데이트 (시즈 탱크 모드 전환 등)
    if (this.useSprites) {
      const spriteConfig = UNIT_SPRITES[unit.unitType];
      
      // 시즈 모드일 때 다른 스프라이트 사용
      if (unit.unitType === UnitType.ARTILLERY && unit.isSieged) {
        const siegeFrame = playerId === 1 ? 'scifiUnit_10.png' : 'scifiUnit_22.png';
        visual.sprite.setFrame(siegeFrame);
      } else {
        const normalFrame = playerId === 1 ? spriteConfig.p1 : spriteConfig.p2;
        visual.sprite.setFrame(normalFrame);
      }
    }

    // 위치 업데이트
    visual.sprite.setPosition(position.x, position.y);
    visual.selectionCircle.setPosition(position.x, position.y);
    visual.hpBar.setPosition(position.x, position.y);
    visual.effectsGraphics.setPosition(position.x, position.y);
    
    // 자원 운반 중인 SCV는 다르게 표시
    const isCarrying = gatherer?.isCarryingResources();
    if (isCarrying) {
      visual.sprite.setTint(0x00ffff);
    } else if (!this.useSprites) {
      visual.sprite.setTint(PLAYER_TINTS[playerId] || 0xffffff);
    } else {
      visual.sprite.clearTint();
    }
    
    // 이펙트 그래픽 클리어
    visual.effectsGraphics.clear();
    const time = this.scene.time.now / 1000;
    
    // 채굴 효과 (GATHERING 상태일 때)
    if (gatherer?.state === GathererState.GATHERING) {
      const pulseSize = Math.sin(time * 10) * 2;
      visual.effectsGraphics.lineStyle(2, 0x00ffff, 0.6);
      visual.effectsGraphics.strokeCircle(0, 0, 18 + pulseSize);
      
      // 채굴 스파크
      visual.effectsGraphics.fillStyle(0x00ffff, 0.8);
      for (let i = 0; i < 3; i++) {
        const sparkAngle = time * 2 + i * 2.1;
        const sparkDist = 22 + Math.sin(time * 3 + i) * 4;
        const sx = Math.cos(sparkAngle) * sparkDist;
        const sy = Math.sin(sparkAngle) * sparkDist;
        visual.effectsGraphics.fillCircle(sx, sy, 2);
      }
      
      // 채굴 진행도 표시
      const progress = gatherer.gatherTimer / gatherer.gatherTime;
      const progWidth = 30;
      const progY = 20;
      visual.effectsGraphics.fillStyle(0x000000, 0.7);
      visual.effectsGraphics.fillRect(-progWidth / 2, progY, progWidth, 3);
      visual.effectsGraphics.fillStyle(0x00ffff, 1);
      visual.effectsGraphics.fillRect(-progWidth / 2, progY, progWidth * progress, 3);
    }
    
    // 공격 효과
    if (combat && (combat.state === CombatState.ATTACKING || combat.state === CombatState.CHASING)) {
      const attackPulse = 0.5 + Math.sin(time * 3) * 0.3;
      visual.effectsGraphics.lineStyle(2, 0xff4400, attackPulse);
      visual.effectsGraphics.strokeCircle(0, 0, 18);
      
      // 공격 쿨다운 시 머즐 플래시 효과
      if (combat.attackCooldown > 0 && combat.attackCooldown > 10) {
        const flashIntensity = combat.attackCooldown / 15;
        visual.effectsGraphics.fillStyle(0xffff00, Math.min(0.8, flashIntensity));
        visual.effectsGraphics.fillCircle(8, 0, 4);
      }
    }
    
    // A-Move 표시
    if (combat?.state === CombatState.ATTACK_MOVING) {
      visual.effectsGraphics.lineStyle(2, 0xff8800, 0.6);
      visual.effectsGraphics.beginPath();
      visual.effectsGraphics.moveTo(16, 0);
      visual.effectsGraphics.lineTo(12, -4);
      visual.effectsGraphics.lineTo(12, 4);
      visual.effectsGraphics.closePath();
      visual.effectsGraphics.fillStyle(0xff8800, 0.5 + Math.sin(time * 5) * 0.3);
      visual.effectsGraphics.fillPath();
    }
    
    // 이동 방향 표시
    if (movement?.isMoving && movement.targetX !== null && movement.targetY !== null) {
      const angle = Math.atan2(movement.targetY - position.y, movement.targetX - position.x);
      visual.sprite.setRotation(angle + Math.PI / 2); // 스프라이트 방향 조정
    } else {
      visual.sprite.setRotation(0);
    }
    
    // 시즈 모드 효과
    if (unit.unitType === UnitType.ARTILLERY && unit.isSieged) {
      const siegePulse = 0.3 + Math.sin(time * 2) * 0.15;
      visual.effectsGraphics.lineStyle(2, 0xff4400, siegePulse);
      visual.effectsGraphics.strokeCircle(0, 0, 25);
    }

    // 선택 원
    visual.selectionCircle.clear();
    if (selectable?.isSelected) {
      const selColor = playerId === this.localPlayerId ? 0x00ff00 : 0xff0000;
      visual.selectionCircle.lineStyle(2, selColor, 1);
      visual.selectionCircle.strokeCircle(0, 0, 18);
      
      // 선택 시 깜빡임 효과
      visual.selectionCircle.lineStyle(1, 0xffffff, 0.5);
      visual.selectionCircle.strokeCircle(0, 0, 20);
    }

    // HP 바
    visual.hpBar.clear();
    const hpPercent = unit.getHpPercent();
    const barWidth = 30;
    const barHeight = 3;
    const yOffset = -22;

    const showHp = selectable?.isSelected || hpPercent < 1;
    const alpha = showHp ? 1 : 0.5;

    // 배경
    visual.hpBar.fillStyle(0x000000, 0.7 * alpha);
    visual.hpBar.fillRect(-barWidth / 2, yOffset, barWidth, barHeight);

    // HP
    let hpColor = 0x00ff00;
    if (hpPercent < 0.3) hpColor = 0xff0000;
    else if (hpPercent < 0.6) hpColor = 0xffff00;

    visual.hpBar.fillStyle(hpColor, alpha);
    visual.hpBar.fillRect(-barWidth / 2, yOffset, barWidth * hpPercent, barHeight);
  }

  private setVisualVisible(visual: UnitVisual, visible: boolean): void {
    visual.sprite.setVisible(visible);
    visual.selectionCircle.setVisible(visible);
    visual.hpBar.setVisible(visible);
    visual.effectsGraphics.setVisible(visible);
  }

  private destroyVisual(visual: UnitVisual): void {
    visual.sprite.destroy();
    visual.selectionCircle.destroy();
    visual.hpBar.destroy();
    visual.effectsGraphics.destroy();
  }

  destroy(): void {
    for (const visual of this.visuals.values()) {
      this.destroyVisual(visual);
    }
    this.visuals.clear();
    this.hoverGraphics?.destroy();
  }

  getSprite(entityId: number): Phaser.GameObjects.Sprite | undefined {
    return this.visuals.get(entityId)?.sprite;
  }
}
