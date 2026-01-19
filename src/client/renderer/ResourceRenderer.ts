// ==========================================
// ResourceRenderer - 자원 렌더링 (미네랄, 가스)
// ==========================================

import Phaser from 'phaser';
import type { Entity } from '@core/ecs/Entity';
import { Position } from '@core/components/Position';
import { Selectable } from '@core/components/Selectable';
import { Resource } from '@core/components/Resource';
import { ResourceType } from '@shared/types';

interface ResourceVisual {
  graphics: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
}

// 자원 타입별 색상
const RESOURCE_COLORS: Record<ResourceType, { main: number; dark: number; glow: number }> = {
  [ResourceType.MINERALS]: { main: 0x00ddff, dark: 0x006688, glow: 0x88ffff },
  [ResourceType.GAS]: { main: 0x00ff66, dark: 0x006622, glow: 0x88ff88 },
};

export class ResourceRenderer {
  private scene: Phaser.Scene;
  private visuals: Map<number, ResourceVisual> = new Map();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  updateEntities(entities: Entity[]): void {
    const activeIds = new Set<number>();

    for (const entity of entities) {
      const position = entity.getComponent<Position>(Position);
      const resource = entity.getComponent<Resource>(Resource);

      if (!position || !resource) continue;

      activeIds.add(entity.id);

      let visual = this.visuals.get(entity.id);

      if (!visual) {
        visual = this.createVisual();
        this.visuals.set(entity.id, visual);
      }

      this.updateVisual(visual, entity);
    }

    for (const [id, visual] of this.visuals) {
      if (!activeIds.has(id)) {
        this.destroyVisual(visual);
        this.visuals.delete(id);
      }
    }
  }

  private createVisual(): ResourceVisual {
    const graphics = this.scene.add.graphics();
    graphics.setDepth(3);

    const label = this.scene.add.text(0, 0, '', {
      fontSize: '9px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    });
    label.setOrigin(0.5, 0.5);
    label.setDepth(4);

    return { graphics, label };
  }

  private updateVisual(visual: ResourceVisual, entity: Entity): void {
    const position = entity.getComponent<Position>(Position)!;
    const resource = entity.getComponent<Resource>(Resource)!;
    const selectable = entity.getComponent<Selectable>(Selectable);

    const colors = RESOURCE_COLORS[resource.resourceType] || { main: 0xffffff, dark: 0x888888, glow: 0xffffff };
    const size = resource.resourceType === ResourceType.MINERALS ? 14 : 18;
    const time = Date.now() / 1000;

    visual.graphics.setPosition(position.x, position.y);
    visual.label.setPosition(position.x, position.y + size + 12);

    visual.graphics.clear();

    // 고갈된 자원은 어둡게
    const alpha = resource.isDepleted() ? 0.3 : 1;

    if (resource.resourceType === ResourceType.MINERALS) {
      // === 미네랄: 반짝이는 크리스탈 ===
      
      // 외부 글로우 (펄스)
      const glowPulse = 0.15 + Math.sin(time * 2) * 0.1;
      visual.graphics.fillStyle(colors.glow, glowPulse * alpha);
      this.drawDiamond(visual.graphics, 0, 0, size + 6);
      
      // 그림자
      visual.graphics.fillStyle(0x000000, 0.3 * alpha);
      this.drawDiamond(visual.graphics, 2, 2, size);
      
      // 메인 크리스탈
      visual.graphics.fillStyle(colors.main, alpha);
      this.drawDiamond(visual.graphics, 0, 0, size);
      
      // 내부 하이라이트 (3D 효과)
      visual.graphics.fillStyle(0xffffff, 0.4 * alpha);
      this.drawDiamond(visual.graphics, -size * 0.15, -size * 0.2, size * 0.4);
      
      // 반짝임 효과 (여러 개의 작은 스파클)
      for (let i = 0; i < 3; i++) {
        const sparkleTime = time * 3 + i * 2.1;
        const sparkleAlpha = (Math.sin(sparkleTime) + 1) * 0.3 * alpha;
        const sparkleX = Math.cos(i * 2.5) * size * 0.5;
        const sparkleY = Math.sin(i * 2.5) * size * 0.4;
        visual.graphics.fillStyle(0xffffff, sparkleAlpha);
        visual.graphics.fillCircle(sparkleX, sparkleY, 2);
      }
      
      // 테두리
      visual.graphics.lineStyle(2, colors.dark, alpha);
      this.strokeDiamond(visual.graphics, 0, 0, size);
      
    } else {
      // === 가스 간헐천: 증기 효과 ===
      
      // 외부 글로우
      const glowPulse = 0.2 + Math.sin(time * 1.5) * 0.1;
      visual.graphics.fillStyle(colors.glow, glowPulse * alpha);
      visual.graphics.fillCircle(0, 0, size + 5);
      
      // 그림자
      visual.graphics.fillStyle(0x000000, 0.3 * alpha);
      visual.graphics.fillCircle(2, 2, size);
      
      // 메인 원
      visual.graphics.fillStyle(colors.main, alpha);
      visual.graphics.fillCircle(0, 0, size);
      
      // 내부 어두운 구멍 (간헐천 입구)
      visual.graphics.fillStyle(colors.dark, alpha);
      visual.graphics.fillCircle(0, 0, size * 0.5);
      visual.graphics.fillStyle(0x003311, alpha);
      visual.graphics.fillCircle(0, 0, size * 0.3);
      
      // 증기/연기 파티클 효과
      for (let i = 0; i < 4; i++) {
        const particleTime = time * 2 + i * 1.5;
        const particleY = -size * 0.3 - (particleTime % 1) * size * 0.8;
        const particleAlpha = (1 - (particleTime % 1)) * 0.5 * alpha;
        const particleSize = 3 + (particleTime % 1) * 4;
        const particleX = Math.sin(particleTime * 3 + i) * 4;
        
        visual.graphics.fillStyle(colors.glow, particleAlpha);
        visual.graphics.fillCircle(particleX, particleY, particleSize);
      }
      
      // 테두리
      visual.graphics.lineStyle(2, colors.dark, alpha);
      visual.graphics.strokeCircle(0, 0, size);
    }

    // 선택 표시
    if (selectable?.isSelected) {
      const selectPulse = 0.7 + Math.sin(time * 4) * 0.3;
      visual.graphics.lineStyle(2, 0x00ff00, selectPulse);
      visual.graphics.strokeCircle(0, 0, size + 8);
      visual.graphics.lineStyle(1, 0xffffff, selectPulse * 0.5);
      visual.graphics.strokeCircle(0, 0, size + 10);
    }

    // 남은 자원량 표시
    const remaining = resource.amount;
    visual.label.setText(`${remaining}`);
    visual.label.setAlpha(alpha);
  }

  private drawDiamond(graphics: Phaser.GameObjects.Graphics, x: number, y: number, size: number): void {
    graphics.beginPath();
    graphics.moveTo(x, y - size);
    graphics.lineTo(x + size * 0.7, y);
    graphics.lineTo(x, y + size * 0.7);
    graphics.lineTo(x - size * 0.7, y);
    graphics.closePath();
    graphics.fillPath();
  }

  private strokeDiamond(graphics: Phaser.GameObjects.Graphics, x: number, y: number, size: number): void {
    graphics.beginPath();
    graphics.moveTo(x, y - size);
    graphics.lineTo(x + size * 0.7, y);
    graphics.lineTo(x, y + size * 0.7);
    graphics.lineTo(x - size * 0.7, y);
    graphics.closePath();
    graphics.strokePath();
  }

  private destroyVisual(visual: ResourceVisual): void {
    visual.graphics.destroy();
    visual.label.destroy();
  }

  destroy(): void {
    for (const visual of this.visuals.values()) {
      this.destroyVisual(visual);
    }
    this.visuals.clear();
  }
}
