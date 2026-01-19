// ==========================================
// UnitRenderer - 유닛 렌더링 (타입별 구분)
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
  graphics: Phaser.GameObjects.Graphics;
  selectionCircle: Phaser.GameObjects.Graphics;
  hpBar: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
}

// 플레이어별 색상 (밝은 색: 유닛, 어두운 색: 테두리)
const PLAYER_COLORS: Record<PlayerId, { main: number; dark: number; light: number }> = {
  1: { main: 0x00cc00, dark: 0x006600, light: 0x66ff66 }, // 초록 (플레이어)
  2: { main: 0xcc0000, dark: 0x660000, light: 0xff6666 }, // 빨강 (적/AI)
};

// 유닛 타입별 설정
const UNIT_VISUALS: Record<UnitType, { 
  shape: 'circle' | 'square' | 'diamond' | 'hexagon' | 'tank'; 
  size: number; 
  label: string;
  secondaryColor?: number;
}> = {
  [UnitType.SCV]: { shape: 'square', size: 12, label: 'SCV' },
  [UnitType.MARINE]: { shape: 'circle', size: 10, label: 'M' },
  [UnitType.FIREBAT]: { shape: 'square', size: 11, label: 'F', secondaryColor: 0xff6600 },
  [UnitType.MEDIC]: { shape: 'diamond', size: 10, label: '+', secondaryColor: 0xffffff },
  [UnitType.VULTURE]: { shape: 'diamond', size: 14, label: 'V' },
  [UnitType.SIEGE_TANK]: { shape: 'tank', size: 16, label: 'T' },
  [UnitType.GOLIATH]: { shape: 'hexagon', size: 14, label: 'G' },
};

export class UnitRenderer {
  private scene: Phaser.Scene;
  private visuals: Map<number, UnitVisual> = new Map();
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
      const unit = entity.getComponent<Unit>(Unit);
      const owner = entity.getComponent<Owner>(Owner);

      if (!position || !unit) continue;

      // 안개 전쟁: 적 유닛이 시야 밖이면 숨김
      const isEnemyUnit = owner && owner.playerId !== this.localPlayerId;
      const isVisible = !this.visionSystem || 
        this.visionSystem.getVisibilityAtPosition(this.localPlayerId, position.x, position.y) === 2;

      if (isEnemyUnit && !isVisible) {
        // 적 유닛이 안 보이면 비주얼 제거/숨김
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
  }

  private createVisual(_entity: Entity): UnitVisual {
    const graphics = this.scene.add.graphics();
    graphics.setDepth(10);

    const selectionCircle = this.scene.add.graphics();
    selectionCircle.setDepth(9);

    const hpBar = this.scene.add.graphics();
    hpBar.setDepth(11);

    const label = this.scene.add.text(0, 0, '', {
      fontSize: '8px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    });
    label.setOrigin(0.5, 0.5);
    label.setDepth(12);

    return { graphics, selectionCircle, hpBar, label };
  }

  private updateVisual(visual: UnitVisual, entity: Entity): void {
    const position = entity.getComponent<Position>(Position)!;
    const unit = entity.getComponent<Unit>(Unit)!;
    const owner = entity.getComponent<Owner>(Owner);
    const selectable = entity.getComponent<Selectable>(Selectable);
    const movement = entity.getComponent<Movement>(Movement);
    const gatherer = entity.getComponent<Gatherer>(Gatherer);
    const combat = entity.getComponent<Combat>(Combat);

    const playerId = owner?.playerId ?? 0;
    const colors = PLAYER_COLORS[playerId] || { main: 0x888888, dark: 0x444444, light: 0xcccccc };
    const unitConfig = UNIT_VISUALS[unit.unitType] || { shape: 'circle', size: 10, label: '?' };

    // 위치 업데이트
    visual.graphics.setPosition(position.x, position.y);
    visual.selectionCircle.setPosition(position.x, position.y);
    visual.hpBar.setPosition(position.x, position.y);
    visual.label.setPosition(position.x, position.y + unitConfig.size + 8);

    // 유닛 그리기
    visual.graphics.clear();
    
    // 자원 운반 중인 SCV는 다르게 표시
    const isCarrying = gatherer?.isCarryingResources();
    const fillColor = isCarrying ? 0x00ffff : colors.main;
    
    visual.graphics.fillStyle(fillColor, 1);
    visual.graphics.lineStyle(2, colors.dark, 1);

    const time = Date.now() / 1000;
    
    // 그림자 효과
    visual.graphics.fillStyle(0x000000, 0.3);
    visual.graphics.fillEllipse(2, 4, unitConfig.size * 1.2, unitConfig.size * 0.6);
    
    switch (unitConfig.shape) {
      case 'circle': {
        // Marine - 외부 글로우
        visual.graphics.fillStyle(colors.light, 0.2);
        visual.graphics.fillCircle(0, 0, unitConfig.size + 3);
        // 메인 바디
        visual.graphics.fillStyle(fillColor, 1);
        visual.graphics.fillCircle(0, 0, unitConfig.size);
        // 하이라이트
        visual.graphics.fillStyle(0xffffff, 0.3);
        visual.graphics.fillCircle(-unitConfig.size * 0.3, -unitConfig.size * 0.3, unitConfig.size * 0.4);
        // 테두리
        visual.graphics.lineStyle(2, colors.dark, 1);
        visual.graphics.strokeCircle(0, 0, unitConfig.size);
        break;
      }
      case 'square': {
        const s = unitConfig.size;
        // 외부 글로우
        visual.graphics.fillStyle(colors.light, 0.15);
        visual.graphics.fillRect(-s - 2, -s - 2, s * 2 + 4, s * 2 + 4);
        // 메인 바디
        visual.graphics.fillStyle(fillColor, 1);
        visual.graphics.fillRect(-s, -s, s * 2, s * 2);
        // 테두리
        visual.graphics.lineStyle(2, colors.dark, 1);
        visual.graphics.strokeRect(-s, -s, s * 2, s * 2);
        // Firebat 화염 악센트
        if (unitConfig.secondaryColor) {
          visual.graphics.fillStyle(unitConfig.secondaryColor, 0.7);
          visual.graphics.fillRect(-s + 3, -s + 3, s - 3, s * 2 - 6);
          // 화염 이펙트
          const flameFlicker = Math.sin(time * 8) * 0.3;
          visual.graphics.fillStyle(0xffff00, 0.4 + flameFlicker);
          visual.graphics.fillCircle(s * 0.6, 0, 4);
        }
        // 하이라이트
        visual.graphics.fillStyle(0xffffff, 0.2);
        visual.graphics.fillRect(-s + 2, -s + 2, s * 0.6, s * 0.6);
        break;
      }
      case 'diamond': {
        const s = unitConfig.size;
        // 외부 글로우
        visual.graphics.fillStyle(colors.light, 0.2);
        visual.graphics.beginPath();
        visual.graphics.moveTo(0, -s - 3);
        visual.graphics.lineTo(s + 3, 0);
        visual.graphics.lineTo(0, s + 3);
        visual.graphics.lineTo(-s - 3, 0);
        visual.graphics.closePath();
        visual.graphics.fillPath();
        // 메인 바디
        visual.graphics.fillStyle(fillColor, 1);
        visual.graphics.beginPath();
        visual.graphics.moveTo(0, -s);
        visual.graphics.lineTo(s, 0);
        visual.graphics.lineTo(0, s);
        visual.graphics.lineTo(-s, 0);
        visual.graphics.closePath();
        visual.graphics.fillPath();
        visual.graphics.lineStyle(2, colors.dark, 1);
        visual.graphics.strokePath();
        // Medic 십자 마크 (펄스)
        if (unitConfig.secondaryColor) {
          const crossPulse = 0.8 + Math.sin(time * 3) * 0.2;
          visual.graphics.fillStyle(unitConfig.secondaryColor, crossPulse);
          visual.graphics.fillRect(-2, -s * 0.5, 4, s);
          visual.graphics.fillRect(-s * 0.5, -2, s, 4);
        }
        break;
      }
      case 'hexagon': {
        const s = unitConfig.size;
        // 외부 글로우
        visual.graphics.fillStyle(colors.light, 0.15);
        visual.graphics.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 3) * i - Math.PI / 6;
          const x = Math.cos(angle) * (s + 3);
          const y = Math.sin(angle) * (s + 3);
          if (i === 0) visual.graphics.moveTo(x, y);
          else visual.graphics.lineTo(x, y);
        }
        visual.graphics.closePath();
        visual.graphics.fillPath();
        // 메인 바디
        visual.graphics.fillStyle(fillColor, 1);
        visual.graphics.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 3) * i - Math.PI / 6;
          const x = Math.cos(angle) * s;
          const y = Math.sin(angle) * s;
          if (i === 0) visual.graphics.moveTo(x, y);
          else visual.graphics.lineTo(x, y);
        }
        visual.graphics.closePath();
        visual.graphics.fillPath();
        visual.graphics.lineStyle(2, colors.dark, 1);
        visual.graphics.strokePath();
        // 내부 디테일
        visual.graphics.fillStyle(colors.dark, 0.5);
        visual.graphics.fillCircle(0, 0, s * 0.4);
        break;
      }
      case 'tank': {
        const s = unitConfig.size;
        const tankUnit = entity.getComponent<Unit>(Unit);
        const isSieged = tankUnit?.isSieged || false;
        
        // 시즈 모드 외부 효과
        if (isSieged) {
          const siegePulse = 0.3 + Math.sin(time * 2) * 0.15;
          visual.graphics.fillStyle(0xff4400, siegePulse);
          visual.graphics.fillCircle(0, 0, s + 8);
        }
        
        // 트랙 (캐터필러)
        visual.graphics.fillStyle(0x333333, 1);
        visual.graphics.fillRect(-s - 2, -s * 0.7, s * 2 + 4, 4);
        visual.graphics.fillRect(-s - 2, s * 0.3, s * 2 + 4, 4);
        // 트랙 디테일
        for (let i = 0; i < 5; i++) {
          visual.graphics.fillStyle(0x555555, 1);
          visual.graphics.fillRect(-s + i * (s * 0.5), -s * 0.7, 2, 4);
          visual.graphics.fillRect(-s + i * (s * 0.5), s * 0.3, 2, 4);
        }
        
        // 메인 바디 (그라데이션 효과)
        visual.graphics.fillStyle(colors.dark, 1);
        visual.graphics.fillRect(-s, -s * 0.55, s * 2, s * 1.1);
        visual.graphics.fillStyle(fillColor, 1);
        visual.graphics.fillRect(-s + 2, -s * 0.5, s * 2 - 4, s);
        // 상부 하이라이트
        visual.graphics.fillStyle(colors.light, 0.3);
        visual.graphics.fillRect(-s + 2, -s * 0.5, s * 2 - 4, s * 0.3);
        
        // 포탑
        visual.graphics.fillStyle(colors.dark, 1);
        visual.graphics.fillCircle(0, 0, s * 0.5);
        visual.graphics.fillStyle(fillColor, 1);
        visual.graphics.fillCircle(0, 0, s * 0.4);
        
        // 포신
        const barrelLength = isSieged ? s * 1.8 : s * 1.0;
        const barrelWidth = isSieged ? 5 : 4;
        visual.graphics.fillStyle(colors.dark, 1);
        visual.graphics.fillRect(0, -barrelWidth / 2, barrelLength, barrelWidth);
        // 포신 끝
        visual.graphics.fillStyle(0x444444, 1);
        visual.graphics.fillRect(barrelLength - 4, -barrelWidth / 2 - 1, 4, barrelWidth + 2);
        
        // 시즈 모드 인디케이터
        if (isSieged) {
          visual.graphics.lineStyle(2, 0xff4400, 0.8);
          visual.graphics.strokeCircle(0, 0, s + 5);
          // "S" 텍스트 대신 시각적 표시
          visual.graphics.fillStyle(0xff0000, 0.8);
          visual.graphics.fillCircle(s * 0.8, -s * 0.3, 3);
        }
        
        // 테두리
        visual.graphics.lineStyle(1, colors.dark, 1);
        visual.graphics.strokeRect(-s, -s * 0.55, s * 2, s * 1.1);
        break;
      }
    }

    // 이동 방향 표시 (이동 중일 때)
    if (movement?.isMoving && movement.targetX !== null && movement.targetY !== null) {
      const angle = Math.atan2(movement.targetY - position.y, movement.targetX - position.x);
      const arrowLen = unitConfig.size + 5;
      visual.graphics.lineStyle(2, colors.light, 0.8);
      visual.graphics.lineBetween(0, 0, Math.cos(angle) * arrowLen, Math.sin(angle) * arrowLen);
    }
    
    // 채굴 효과 (GATHERING 상태일 때)
    if (gatherer?.state === GathererState.GATHERING) {
      const time = Date.now() / 100;
      // 펄스 효과
      const pulseSize = Math.sin(time) * 2;
      visual.graphics.lineStyle(2, 0x00ffff, 0.6);
      visual.graphics.strokeCircle(0, 0, unitConfig.size + 4 + pulseSize);
      
      // 채굴 스파크 (랜덤 위치에 작은 점들)
      visual.graphics.fillStyle(0x00ffff, 0.8);
      for (let i = 0; i < 3; i++) {
        const sparkAngle = time * 2 + i * 2.1;
        const sparkDist = unitConfig.size + 8 + Math.sin(time * 3 + i) * 4;
        const sx = Math.cos(sparkAngle) * sparkDist;
        const sy = Math.sin(sparkAngle) * sparkDist;
        visual.graphics.fillCircle(sx, sy, 2);
      }
      
      // 채굴 진행도 표시
      const progress = gatherer.gatherTimer / gatherer.gatherTime;
      const progWidth = unitConfig.size * 2;
      const progY = unitConfig.size + 12;
      visual.graphics.fillStyle(0x000000, 0.7);
      visual.graphics.fillRect(-progWidth / 2, progY, progWidth, 3);
      visual.graphics.fillStyle(0x00ffff, 1);
      visual.graphics.fillRect(-progWidth / 2, progY, progWidth * progress, 3);
    }
    
    // 공격 효과 (ATTACKING 또는 쿨다운 중일 때)
    if (combat && (combat.state === CombatState.ATTACKING || combat.state === CombatState.CHASING)) {
      const time = Date.now() / 100;
      
      // 공격 중 표시 - 붉은 테두리 펄스
      const attackPulse = 0.5 + Math.sin(time * 3) * 0.3;
      visual.graphics.lineStyle(2, 0xff4400, attackPulse);
      visual.graphics.strokeCircle(0, 0, unitConfig.size + 3);
      
      // 공격 쿨다운 시 머즐 플래시 효과
      if (combat.attackCooldown > 0 && combat.attackCooldown > 10) {
        // 방금 공격함 - 섬광 효과
        const flashIntensity = combat.attackCooldown / 15;
        visual.graphics.fillStyle(0xffff00, Math.min(0.8, flashIntensity));
        visual.graphics.fillCircle(0, 0, unitConfig.size * 0.5);
        
        // 총구 화염 효과 (Marine)
        if (unit.unitType === UnitType.MARINE) {
          visual.graphics.fillStyle(0xff6600, Math.min(0.9, flashIntensity));
          visual.graphics.fillCircle(unitConfig.size * 0.8, 0, 4);
          visual.graphics.fillStyle(0xffff00, Math.min(0.7, flashIntensity * 0.8));
          visual.graphics.fillCircle(unitConfig.size * 0.8, 0, 2);
        }
      }
    }
    
    // A-Move 중일 때 표시
    if (combat?.state === CombatState.ATTACK_MOVING) {
      const time = Date.now() / 200;
      visual.graphics.lineStyle(2, 0xff8800, 0.6);
      // 삼각형 화살표 (이동 + 공격)
      const arrowSize = unitConfig.size + 6;
      visual.graphics.beginPath();
      visual.graphics.moveTo(arrowSize, 0);
      visual.graphics.lineTo(arrowSize - 4, -4);
      visual.graphics.lineTo(arrowSize - 4, 4);
      visual.graphics.closePath();
      visual.graphics.fillStyle(0xff8800, 0.5 + Math.sin(time) * 0.3);
      visual.graphics.fillPath();
    }

    // 라벨
    visual.label.setText(unitConfig.label);
    visual.label.setVisible(true);

    // 선택 원
    visual.selectionCircle.clear();
    if (selectable?.isSelected) {
      const selColor = playerId === this.localPlayerId ? 0x00ff00 : 0xff0000;
      visual.selectionCircle.lineStyle(2, selColor, 1);
      visual.selectionCircle.strokeCircle(0, 0, unitConfig.size + 4);
      
      // 선택 시 깜빡임 효과
      visual.selectionCircle.lineStyle(1, 0xffffff, 0.5);
      visual.selectionCircle.strokeCircle(0, 0, unitConfig.size + 6);
    }

    // HP 바 (항상 표시, 데미지 받았거나 선택됐을 때 더 진하게)
    visual.hpBar.clear();
    const hpPercent = unit.getHpPercent();
    const barWidth = unitConfig.size * 2 + 4;
    const barHeight = 3;
    const yOffset = -unitConfig.size - 8;

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
    visual.graphics.setVisible(visible);
    visual.selectionCircle.setVisible(visible);
    visual.hpBar.setVisible(visible);
    visual.label.setVisible(visible);
  }

  private destroyVisual(visual: UnitVisual): void {
    visual.graphics.destroy();
    visual.selectionCircle.destroy();
    visual.hpBar.destroy();
    visual.label.destroy();
  }

  destroy(): void {
    for (const visual of this.visuals.values()) {
      this.destroyVisual(visual);
    }
    this.visuals.clear();
  }

  getSprite(entityId: number): Phaser.GameObjects.Graphics | undefined {
    return this.visuals.get(entityId)?.graphics;
  }
}
