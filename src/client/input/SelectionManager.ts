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

  private selectionBox: Phaser.GameObjects.Graphics | null = null;
  private selectionStart: { x: number; y: number } | null = null;
  private selectedEntities: Set<EntityId> = new Set();
  
  // 호버 상태
  private hoveredEntityId: EntityId | null = null;
  
  // 명령 모드 플래그 (A-move 등 명령 실행 중 선택 해제 방지)
  private isCommandMode: boolean = false;

  // 콜백
  public onSelectionChange?: (selectedIds: EntityId[]) => void;
  public onHoverChange?: (entityId: EntityId | null) => void;

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

    // 드래그 중 + 호버 검출
    this.scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (pointer.leftButtonDown() && this.selectionStart) {
        this.updateSelectionBox(pointer.worldX, pointer.worldY);
      } else if (!pointer.leftButtonDown()) {
        // 호버 검출
        this.updateHover(pointer.worldX, pointer.worldY);
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

    // 선택 박스 생성 (Graphics 사용)
    this.selectionBox = this.scene.add.graphics();
    this.selectionBox.setDepth(1100); // Above fog (1000)
  }

  private updateSelectionBox(x: number, y: number): void {
    if (!this.selectionBox || !this.selectionStart) return;

    const width = x - this.selectionStart.x;
    const height = y - this.selectionStart.y;
    
    const absWidth = Math.abs(width);
    const absHeight = Math.abs(height);
    const posX = width >= 0 ? this.selectionStart.x : x;
    const posY = height >= 0 ? this.selectionStart.y : y;

    this.selectionBox.clear();
    
    // 반투명 배경
    this.selectionBox.fillStyle(0x00ff00, 0.1);
    this.selectionBox.fillRect(0, 0, absWidth, absHeight);
    
    // 점선 테두리 또는 일반 테두리
    this.selectionBox.lineStyle(1, 0x00ff00, 0.5);
    this.selectionBox.strokeRect(0, 0, absWidth, absHeight);
    
    // 코너 브라켓 (더 "하이테크"한 느낌)
    const bracketSize = Math.min(10, absWidth / 3, absHeight / 3);
    if (bracketSize > 2) {
      this.selectionBox.lineStyle(2, 0x00ff00, 1);
      
      // 좌상
      this.selectionBox.lineBetween(0, 0, bracketSize, 0);
      this.selectionBox.lineBetween(0, 0, 0, bracketSize);
      
      // 우상
      this.selectionBox.lineBetween(absWidth, 0, absWidth - bracketSize, 0);
      this.selectionBox.lineBetween(absWidth, 0, absWidth, bracketSize);
      
      // 좌하
      this.selectionBox.lineBetween(0, absHeight, bracketSize, absHeight);
      this.selectionBox.lineBetween(0, absHeight, 0, absHeight - bracketSize);
      
      // 우하
      this.selectionBox.lineBetween(absWidth, absHeight, absWidth - bracketSize, absHeight);
      this.selectionBox.lineBetween(absWidth, absHeight, absWidth, absHeight - bracketSize);
    }

    this.selectionBox.setPosition(posX, posY);
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

    // 명령 모드 중이면 선택 유지 (A-move 등 명령 후 선택 해제 방지)
    if (this.isCommandMode) {
      this.isCommandMode = false; // 플래그 리셋
      return;
    }

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

  // 프로그래밍적으로 선택 추가
  addToSelection(entity: Entity): void {
    const selectable = entity.getComponent<Selectable>(Selectable);
    if (selectable) {
      selectable.select();
      this.selectedEntities.add(entity.id);
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

  // 스냅샷 로드 후 선택 상태 복구
  syncSelection(): void {
    const nextSelected: Set<EntityId> = new Set();
    for (const id of this.selectedEntities) {
      const entity = this.gameState.getEntity(id);
      if (!entity) continue;
      const selectable = entity.getComponent<Selectable>(Selectable);
      if (selectable) {
        selectable.select();
        nextSelected.add(id);
      }
    }
    this.selectedEntities = nextSelected;
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

  // 명령 모드 설정 (명령 실행 중 선택 해제 방지)
  setCommandMode(enabled: boolean): void {
    this.isCommandMode = enabled;
  }

  // 명령 모드 확인
  isInCommandMode(): boolean {
    return this.isCommandMode;
  }
  
  // 호버 업데이트
  private updateHover(x: number, y: number): void {
    const entities = this.gameState.getAllEntities();
    let closestEntity: Entity | null = null;
    let closestDist = Infinity;
    
    for (const entity of entities) {
      const position = entity.getComponent<Position>(Position);
      const selectable = entity.getComponent<Selectable>(Selectable);
      
      if (!position || !selectable || entity.isDestroyed()) continue;
      
      const dist = Math.sqrt(Math.pow(x - position.x, 2) + Math.pow(y - position.y, 2));
      
      if (dist < selectable.selectionRadius + 10 && dist < closestDist) {
        closestDist = dist;
        closestEntity = entity;
      }
    }
    
    const newHoveredId = closestEntity?.id ?? null;
    if (newHoveredId !== this.hoveredEntityId) {
      this.hoveredEntityId = newHoveredId;
      this.onHoverChange?.(newHoveredId);
    }
  }
  
  // 호버된 엔티티 ID
  getHoveredEntityId(): EntityId | null {
    return this.hoveredEntityId;
  }
}
