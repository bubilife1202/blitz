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

    visual.graphics.setPosition(position.x, position.y);
    visual.label.setPosition(position.x, position.y + size + 8);

    visual.graphics.clear();

    // 고갈된 자원은 어둡게
    const alpha = resource.isDepleted() ? 0.3 : 1;

    // 외부 글로우
    visual.graphics.fillStyle(colors.glow, 0.2 * alpha);
    if (resource.resourceType === ResourceType.MINERALS) {
      // 미네랄: 다이아몬드/크리스탈 모양
      this.drawDiamond(visual.graphics, 0, 0, size + 4);
    } else {
      // 가스: 원형
      visual.graphics.fillCircle(0, 0, size + 4);
    }

    // 메인
    visual.graphics.fillStyle(colors.main, alpha);
    if (resource.resourceType === ResourceType.MINERALS) {
      this.drawDiamond(visual.graphics, 0, 0, size);
    } else {
      visual.graphics.fillCircle(0, 0, size);
      // 가스 분출 효과
      visual.graphics.fillStyle(colors.glow, 0.5 * alpha);
      visual.graphics.fillCircle(0, -size / 3, size / 3);
    }

    // 테두리
    visual.graphics.lineStyle(2, colors.dark, alpha);
    if (resource.resourceType === ResourceType.MINERALS) {
      this.strokeDiamond(visual.graphics, 0, 0, size);
    } else {
      visual.graphics.strokeCircle(0, 0, size);
    }

    // 선택 표시
    if (selectable?.isSelected) {
      visual.graphics.lineStyle(2, 0xffffff, 1);
      visual.graphics.strokeCircle(0, 0, size + 6);
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
