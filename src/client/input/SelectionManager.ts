// ==========================================
// SelectionManager - 유닛 선택 관리
// ==========================================

import Phaser from 'phaser';
import type { GameState } from '@core/GameState';
import type { Entity } from '@core/ecs/Entity';
import { Position } from '@core/components/Position';
import { Selectable } from '@core/components/Selectable';
import { Owner } from '@core/components/Owner';
import type { PlayerId, EntityId } from '@shared/types';
import { Unit } from '@core/components/Unit';
import { Building } from '@core/components/Building';
import { soundManager } from '../audio/SoundManager';

export class SelectionManager {
  private scene: Phaser.Scene;
  private gameState: GameState;
  private localPlayerId: PlayerId;

  private selectionBox: Phaser.GameObjects.Rectangle | null = null;
  private selectionStart: { x: number; y: number } | null = null;
  private selectedEntities: Set<EntityId> = new Set();

  // 콜백
  public onSelectionChange?: (selectedIds: EntityId[]) => void;

  constructor(scene: Phaser.Scene, gameState: GameState, localPlayerId: PlayerId = 1) {
    this.scene = scene;
    this.gameState = gameState;
    this.localPlayerId = localPlayerId;

    this.setupInput();
  }

  private setupInput(): void {
    // 좌클릭 시작
    this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.leftButtonDown()) {
        this.startSelection(pointer.worldX, pointer.worldY);
      }
    });

    // 드래그 중
    this.scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (pointer.leftButtonDown() && this.selectionStart) {
        this.updateSelectionBox(pointer.worldX, pointer.worldY);
      }
    });

    // 좌클릭 끝
    this.scene.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (pointer.leftButtonReleased()) {
        this.endSelection(pointer.worldX, pointer.worldY, pointer.event.shiftKey);
      }
    });
  }

  private startSelection(x: number, y: number): void {
    this.selectionStart = { x, y };

    // 선택 박스 생성
    this.selectionBox = this.scene.add.rectangle(x, y, 0, 0, 0x00ff00, 0.2);
    this.selectionBox.setStrokeStyle(1, 0x00ff00);
    this.selectionBox.setDepth(1000);
    this.selectionBox.setOrigin(0, 0);
  }

  private updateSelectionBox(x: number, y: number): void {
    if (!this.selectionBox || !this.selectionStart) return;

    const width = x - this.selectionStart.x;
    const height = y - this.selectionStart.y;

    // setSize는 양수만 받으므로 위치 조정 필요
    this.selectionBox.setPosition(
      width >= 0 ? this.selectionStart.x : x,
      height >= 0 ? this.selectionStart.y : y
    );
    this.selectionBox.setSize(Math.abs(width), Math.abs(height));
  }

  private endSelection(endX: number, endY: number, addToSelection: boolean): void {
    if (!this.selectionStart) return;

    const startX = this.selectionStart.x;
    const startY = this.selectionStart.y;

    // 선택 박스 제거
    if (this.selectionBox) {
      this.selectionBox.destroy();
      this.selectionBox = null;
    }
    this.selectionStart = null;

    // 드래그 거리 계산
    const dragDistance = Math.sqrt(
      Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2)
    );

    // Shift 키 없으면 기존 선택 해제
    if (!addToSelection) {
      this.clearSelection();
    }

    if (dragDistance < 5) {
      // 클릭 선택 (드래그 거리가 작으면)
      this.selectAtPoint(endX, endY, addToSelection);
    } else {
      // 박스 선택
      this.selectInBox(
        Math.min(startX, endX),
        Math.min(startY, endY),
        Math.abs(endX - startX),
        Math.abs(endY - startY),
        addToSelection
      );
    }

    // 콜백 호출
    this.onSelectionChange?.(this.getSelectedIds());
  }

  // 특정 지점에서 유닛 선택
  private selectAtPoint(x: number, y: number, addToSelection: boolean): void {
    const entities = this.gameState.getAllEntities();
    let closestEntity: Entity | null = null;
    let closestDistance = Infinity;

    for (const entity of entities) {
      const position = entity.getComponent<Position>(Position);
      const selectable = entity.getComponent<Selectable>(Selectable);
      const owner = entity.getComponent<Owner>(Owner);

      if (!position || !selectable) continue;

      // 자신의 유닛만 선택 가능
      if (!owner || owner.playerId !== this.localPlayerId) continue;

      const distance = Math.sqrt(
        Math.pow(x - position.x, 2) + Math.pow(y - position.y, 2)
      );

      if (distance <= selectable.selectionRadius && distance < closestDistance) {
        closestEntity = entity;
        closestDistance = distance;
      }
    }

    if (closestEntity) {
      const selectable = closestEntity.getComponent<Selectable>(Selectable)!;
      if (addToSelection) {
        selectable.toggle();
        if (selectable.isSelected) {
          this.selectedEntities.add(closestEntity.id);
        } else {
          this.selectedEntities.delete(closestEntity.id);
        }
      } else {
        selectable.select();
        this.selectedEntities.add(closestEntity.id);
      }
      // 선택 사운드 재생
      const isBuilding = closestEntity.getComponent<Building>(Building);
      const isUnit = closestEntity.getComponent<Unit>(Unit);
      if (isBuilding) {
        soundManager.play('select_building');
      } else if (isUnit) {
        soundManager.play('select_unit');
      }
    }
  }

  // 박스 영역 내 유닛 선택
  private selectInBox(
    x: number,
    y: number,
    width: number,
    height: number,
    _addToSelection: boolean
  ): void {
    const entities = this.gameState.getAllEntities();

    for (const entity of entities) {
      const position = entity.getComponent<Position>(Position);
      const selectable = entity.getComponent<Selectable>(Selectable);
      const owner = entity.getComponent<Owner>(Owner);

      if (!position || !selectable) continue;

      // 자신의 유닛만 선택 가능
      if (!owner || owner.playerId !== this.localPlayerId) continue;

      // 박스 내에 있는지 확인
      if (
        position.x >= x &&
        position.x <= x + width &&
        position.y >= y &&
        position.y <= y + height
      ) {
        selectable.select();
        this.selectedEntities.add(entity.id);
      }
    }
  }

  // 선택 해제
  clearSelection(): void {
    for (const entityId of this.selectedEntities) {
      const entity = this.gameState.getEntity(entityId);
      if (entity) {
        const selectable = entity.getComponent<Selectable>(Selectable);
        selectable?.deselect();
      }
    }
    this.selectedEntities.clear();
  }

  // 선택된 엔티티 ID 목록
  getSelectedIds(): EntityId[] {
    return Array.from(this.selectedEntities);
  }

  // 선택된 엔티티 목록
  getSelectedEntities(): Entity[] {
    const entities: Entity[] = [];
    for (const id of this.selectedEntities) {
      const entity = this.gameState.getEntity(id);
      if (entity) {
        entities.push(entity);
      }
    }
    return entities;
  }

  // 선택된 유닛이 있는지 확인
  hasSelection(): boolean {
    return this.selectedEntities.size > 0;
  }
}
