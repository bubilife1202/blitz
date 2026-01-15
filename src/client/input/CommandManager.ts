// ==========================================
// CommandManager - 유닛 명령 관리
// ==========================================

import Phaser from 'phaser';
import type { GameState } from '@core/GameState';
import type { SelectionManager } from './SelectionManager';
import type { PathfindingService } from '@core/PathfindingService';
import type { Entity } from '@core/ecs/Entity';
import { Position } from '@core/components/Position';
import { Movement } from '@core/components/Movement';
import { Combat } from '@core/components/Combat';
import { Gatherer } from '@core/components/Gatherer';
import { Owner } from '@core/components/Owner';
import { Unit } from '@core/components/Unit';
import { Building } from '@core/components/Building';
import { Resource } from '@core/components/Resource';
import { Selectable } from '@core/components/Selectable';
import { CommandType, BuildingType, type PlayerId, type GameCommand, type Vector2 } from '@shared/types';
import { soundManager } from '../audio/SoundManager';

export class CommandManager {
  private scene: Phaser.Scene;
  private gameState: GameState;
  private selectionManager: SelectionManager;
  private pathfinding: PathfindingService;
  private localPlayerId: PlayerId;

  // 이동 마커 표시
  private moveMarker: Phaser.GameObjects.Graphics | null = null;
  private moveMarkerTween: Phaser.Tweens.Tween | null = null;

  // A-Move 모드
  private isAttackMoveMode: boolean = false;
  private attackMoveCursor: Phaser.GameObjects.Graphics | null = null;
  
  // 일시정지 상태 (입력 차단용)
  private isPaused: boolean = false;

  // 명령 콜백 (서버/로컬호스트로 전달)
  public onCommand?: (command: GameCommand) => void;

  constructor(
    scene: Phaser.Scene,
    gameState: GameState,
    selectionManager: SelectionManager,
    pathfinding: PathfindingService,
    localPlayerId: PlayerId = 1
  ) {
    this.scene = scene;
    this.gameState = gameState;
    this.selectionManager = selectionManager;
    this.pathfinding = pathfinding;
    this.localPlayerId = localPlayerId;

    this.setupInput();
    this.createMoveMarker();
  }

  // 일시정지 상태 설정
  setPaused(paused: boolean): void {
    this.isPaused = paused;
    // A-Move 모드 해제
    if (paused) {
      this.exitAttackMoveMode();
    }
  }

  private setupInput(): void {
    // 우클릭: 이동/공격 명령
    this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) {
        this.handleRightClick(pointer.worldX, pointer.worldY);
      }
    });

    // 키보드 단축키
    this.scene.input.keyboard?.on('keydown-S', () => {
      this.issueStopCommand();
    });

    this.scene.input.keyboard?.on('keydown-H', () => {
      this.issueHoldCommand();
    });

    this.scene.input.keyboard?.on('keydown-A', () => {
      this.enterAttackMoveMode();
    });
  }

  private createMoveMarker(): void {
    this.moveMarker = this.scene.add.graphics();
    this.moveMarker.setDepth(100);
    this.moveMarker.setVisible(false);
  }

  private handleRightClick(x: number, y: number): void {
    if (this.isPaused) return;
    if (!this.selectionManager.hasSelection()) return;

    // 클릭 위치에 있는 엔티티 찾기
    const targetEntity = this.findEntityAtPosition(x, y);
    
    if (targetEntity) {
      // 자원인지 확인 → 채취 명령
      const resource = targetEntity.getComponent<Resource>(Resource);
      if (resource && !resource.isDepleted()) {
        this.issueGatherCommand(targetEntity.id, x, y);
        return;
      }
      
      // Refinery인지 확인 → 가스 채취 명령
      const building = targetEntity.getComponent<Building>(Building);
      const targetOwner = targetEntity.getComponent<Owner>(Owner);
      if (building && building.buildingType === BuildingType.REFINERY && 
          !building.isConstructing && targetOwner?.playerId === this.localPlayerId) {
        this.issueGatherCommand(targetEntity.id, x, y);
        return;
      }
      
      // 적 유닛/건물인지 확인 → 공격 명령
      if (targetOwner && targetOwner.playerId !== this.localPlayerId) {
        const hasUnitOrBuilding = targetEntity.getComponent<Unit>(Unit) || building;
        if (hasUnitOrBuilding) {
          this.issueAttackCommand(targetEntity.id, x, y);
          return;
        }
      }
    }

    // 기본: 이동 명령
    this.issueMoveCommand(x, y);
  }

  // 특정 위치에서 엔티티 찾기
  private findEntityAtPosition(x: number, y: number): Entity | null {
    const entities = this.gameState.getAllEntities();
    let closestEntity: Entity | null = null;
    let closestDistance = Infinity;

    for (const entity of entities) {
      const position = entity.getComponent<Position>(Position);
      const selectable = entity.getComponent<Selectable>(Selectable);

      if (!position || !selectable) continue;

      const distance = Math.sqrt(
        Math.pow(x - position.x, 2) + Math.pow(y - position.y, 2)
      );

      // 선택 반경 내에서 가장 가까운 엔티티
      if (distance <= selectable.selectionRadius * 1.5 && distance < closestDistance) {
        closestEntity = entity;
        closestDistance = distance;
      }
    }

    return closestEntity;
  }

  // 공격 명령
  async issueAttackCommand(targetEntityId: number, targetX: number, targetY: number): Promise<void> {
    const selectedEntities = this.selectionManager.getSelectedEntities();
    if (selectedEntities.length === 0) return;

    // 공격 마커 표시 (빨간색) + 사운드
    this.showAttackMarker(targetX, targetY);
    soundManager.play('command_attack');

    for (const entity of selectedEntities) {
      const combat = entity.getComponent<Combat>(Combat);
      const movement = entity.getComponent<Movement>(Movement);

      if (!combat) continue; // 전투 불가 유닛은 스킵

      // 공격 타겟 설정
      combat.setTarget(targetEntityId);
      combat.releaseHold();
      
      // 타겟 위치로 이동
      if (movement) {
        movement.setTarget(targetX, targetY);
      }
    }

    // 명령 콜백
    this.onCommand?.({
      type: CommandType.ATTACK,
      playerId: this.localPlayerId,
      entityIds: selectedEntities.map((e) => e.id),
      targetEntityId: targetEntityId,
      targetPosition: { x: targetX, y: targetY },
      tick: this.gameState.getCurrentTick(),
    });
  }

  // 자원 채취 명령
  async issueGatherCommand(resourceEntityId: number, targetX: number, targetY: number): Promise<void> {
    const selectedEntities = this.selectionManager.getSelectedEntities();
    if (selectedEntities.length === 0) return;

    // 채취 마커 표시 (청록색)
    this.showGatherMarker(targetX, targetY);

    // 가장 가까운 커맨드 센터 찾기
    const commandCenter = this.findNearestCommandCenter(targetX, targetY);
    if (!commandCenter) {
      console.log('No command center found!');
      return;
    }

    for (const entity of selectedEntities) {
      const gatherer = entity.getComponent<Gatherer>(Gatherer);
      const movement = entity.getComponent<Movement>(Movement);

      if (!gatherer) continue; // 채취 불가 유닛은 스킵

      // 채취 시작
      gatherer.startGathering(resourceEntityId, commandCenter.id);
      
      // 자원 위치로 이동
      if (movement) {
        movement.setTarget(targetX, targetY);
      }
    }

    // 명령 콜백
    this.onCommand?.({
      type: CommandType.GATHER,
      playerId: this.localPlayerId,
      entityIds: selectedEntities.map((e) => e.id),
      targetEntityId: resourceEntityId,
      targetPosition: { x: targetX, y: targetY },
      tick: this.gameState.getCurrentTick(),
    });
  }

  // 가장 가까운 커맨드 센터 찾기
  private findNearestCommandCenter(x: number, y: number): Entity | null {
    const entities = this.gameState.getAllEntities();
    let nearest: Entity | null = null;
    let nearestDist = Infinity;

    for (const entity of entities) {
      const building = entity.getComponent<Building>(Building);
      const owner = entity.getComponent<Owner>(Owner);
      const position = entity.getComponent<Position>(Position);

      if (!building || !owner || !position) continue;
      if (building.buildingType !== BuildingType.COMMAND_CENTER) continue;
      if (owner.playerId !== this.localPlayerId) continue;
      if (building.isConstructing) continue;

      const dist = Math.sqrt(Math.pow(x - position.x, 2) + Math.pow(y - position.y, 2));
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = entity;
      }
    }

    return nearest;
  }

  // 공격 마커 표시 (빨간색)
  private showAttackMarker(x: number, y: number): void {
    if (!this.moveMarker) return;

    this.moveMarkerTween?.stop();

    this.moveMarker.clear();
    this.moveMarker.lineStyle(2, 0xff0000, 1);
    this.moveMarker.strokeCircle(0, 0, 15);
    // X 모양
    this.moveMarker.lineBetween(-8, -8, 8, 8);
    this.moveMarker.lineBetween(-8, 8, 8, -8);

    this.moveMarker.setPosition(x, y);
    this.moveMarker.setVisible(true);
    this.moveMarker.setAlpha(1);

    this.moveMarkerTween = this.scene.tweens.add({
      targets: this.moveMarker,
      alpha: 0,
      scale: 1.5,
      duration: 500,
      onComplete: () => {
        this.moveMarker?.setVisible(false);
        this.moveMarker?.setScale(1);
      },
    });
  }

  // 채취 마커 표시 (청록색)
  private showGatherMarker(x: number, y: number): void {
    if (!this.moveMarker) return;

    this.moveMarkerTween?.stop();

    this.moveMarker.clear();
    this.moveMarker.lineStyle(2, 0x00ffff, 1);
    this.moveMarker.strokeCircle(0, 0, 15);
    // 다이아몬드 모양
    this.moveMarker.lineBetween(0, -10, 10, 0);
    this.moveMarker.lineBetween(10, 0, 0, 10);
    this.moveMarker.lineBetween(0, 10, -10, 0);
    this.moveMarker.lineBetween(-10, 0, 0, -10);

    this.moveMarker.setPosition(x, y);
    this.moveMarker.setVisible(true);
    this.moveMarker.setAlpha(1);

    this.moveMarkerTween = this.scene.tweens.add({
      targets: this.moveMarker,
      alpha: 0,
      scale: 1.5,
      duration: 500,
      onComplete: () => {
        this.moveMarker?.setVisible(false);
        this.moveMarker?.setScale(1);
      },
    });
  }

  // 이동 명령
  async issueMoveCommand(targetX: number, targetY: number): Promise<void> {
    const selectedEntities = this.selectionManager.getSelectedEntities();
    if (selectedEntities.length === 0) return;

    // 이동 마커 표시 + 사운드
    this.showMoveMarker(targetX, targetY);
    soundManager.play('command_move');

    // 여러 유닛 이동시 포메이션 계산
    const positions = this.calculateFormation(
      selectedEntities.length,
      targetX,
      targetY
    );

    for (let i = 0; i < selectedEntities.length; i++) {
      const entity = selectedEntities[i];
      const position = entity.getComponent<Position>(Position);
      const movement = entity.getComponent<Movement>(Movement);

      if (!position || !movement) continue;

      const targetPos = positions[i];

      // 경로 찾기
      const path = await this.pathfinding.findPath(
        position.x,
        position.y,
        targetPos.x,
        targetPos.y
      );

      if (path.length > 0) {
        movement.setPath(path);
      } else {
        // 경로를 못 찾으면 직선 이동
        movement.setTarget(targetPos.x, targetPos.y);
      }
    }

    // 명령 콜백 (멀티플레이어용)
    this.onCommand?.({
      type: CommandType.MOVE,
      playerId: this.localPlayerId,
      entityIds: selectedEntities.map((e) => e.id),
      targetPosition: { x: targetX, y: targetY },
      tick: this.gameState.getCurrentTick(),
    });
  }

  // 정지 명령
  issueStopCommand(): void {
    if (this.isPaused) return;
    const selectedEntities = this.selectionManager.getSelectedEntities();

    for (const entity of selectedEntities) {
      const movement = entity.getComponent<Movement>(Movement);
      movement?.stop();
    }

    this.onCommand?.({
      type: CommandType.STOP,
      playerId: this.localPlayerId,
      entityIds: selectedEntities.map((e) => e.id),
      tick: this.gameState.getCurrentTick(),
    });
  }

  // 홀드 명령
  issueHoldCommand(): void {
    if (this.isPaused) return;
    const selectedEntities = this.selectionManager.getSelectedEntities();

    for (const entity of selectedEntities) {
      const movement = entity.getComponent<Movement>(Movement);
      const combat = entity.getComponent<Combat>(Combat);
      movement?.stop();
      combat?.holdPosition();
    }

    this.onCommand?.({
      type: CommandType.HOLD,
      playerId: this.localPlayerId,
      entityIds: selectedEntities.map((e) => e.id),
      tick: this.gameState.getCurrentTick(),
    });
  }

  // A-Move 모드 진입
  enterAttackMoveMode(): void {
    if (this.isPaused) return;
    if (!this.selectionManager.hasSelection()) return;
    
    this.isAttackMoveMode = true;
    
    // 커서 변경 시각적 표시
    if (!this.attackMoveCursor) {
      this.attackMoveCursor = this.scene.add.graphics();
      this.attackMoveCursor.setDepth(2000);
    }
    this.attackMoveCursor.clear();
    this.attackMoveCursor.lineStyle(2, 0xff6600, 1);
    this.attackMoveCursor.strokeCircle(0, 0, 10);
    this.attackMoveCursor.lineBetween(-6, -6, 6, 6);
    this.attackMoveCursor.lineBetween(-6, 6, 6, -6);
    this.attackMoveCursor.setVisible(true);

    // 마우스 따라다니기
    const moveHandler = (pointer: Phaser.Input.Pointer) => {
      this.attackMoveCursor?.setPosition(pointer.worldX, pointer.worldY);
    };
    
    // 좌클릭: A-Move 실행
    const clickHandler = (pointer: Phaser.Input.Pointer) => {
      if (pointer.leftButtonDown() && this.isAttackMoveMode) {
        this.issueAttackMoveCommand(pointer.worldX, pointer.worldY);
        this.exitAttackMoveMode();
        this.scene.input.off('pointermove', moveHandler);
        this.scene.input.off('pointerdown', clickHandler);
      } else if (pointer.rightButtonDown()) {
        // 우클릭으로 취소
        this.exitAttackMoveMode();
        this.scene.input.off('pointermove', moveHandler);
        this.scene.input.off('pointerdown', clickHandler);
      }
    };

    this.scene.input.on('pointermove', moveHandler);
    this.scene.input.on('pointerdown', clickHandler);

    // ESC로 취소
    const escHandler = () => {
      this.exitAttackMoveMode();
      this.scene.input.off('pointermove', moveHandler);
      this.scene.input.off('pointerdown', clickHandler);
      this.scene.input.keyboard?.off('keydown-ESC', escHandler);
    };
    this.scene.input.keyboard?.once('keydown-ESC', escHandler);
  }

  // A-Move 모드 종료
  private exitAttackMoveMode(): void {
    this.isAttackMoveMode = false;
    this.attackMoveCursor?.setVisible(false);
  }

  // A-Move 명령 발행
  issueAttackMoveCommand(targetX: number, targetY: number): void {
    const selectedEntities = this.selectionManager.getSelectedEntities();
    if (selectedEntities.length === 0) return;

    // A-Move 마커 표시 (주황색) + 사운드
    this.showAttackMoveMarker(targetX, targetY);
    soundManager.play('command_attack');

    for (const entity of selectedEntities) {
      const combat = entity.getComponent<Combat>(Combat);
      const movement = entity.getComponent<Movement>(Movement);

      if (!combat || !movement) continue;

      // A-Move 시작
      combat.startAttackMove(targetX, targetY);
      movement.setTarget(targetX, targetY);
    }

    // 명령 콜백
    this.onCommand?.({
      type: CommandType.ATTACK,
      playerId: this.localPlayerId,
      entityIds: selectedEntities.map((e) => e.id),
      targetPosition: { x: targetX, y: targetY },
      tick: this.gameState.getCurrentTick(),
    });
  }

  // A-Move 마커 표시 (주황색)
  private showAttackMoveMarker(x: number, y: number): void {
    if (!this.moveMarker) return;

    this.moveMarkerTween?.stop();

    this.moveMarker.clear();
    this.moveMarker.lineStyle(2, 0xff6600, 1);
    this.moveMarker.strokeCircle(0, 0, 15);
    // 화살표 모양
    this.moveMarker.lineBetween(0, -10, 0, 10);
    this.moveMarker.lineBetween(-6, 4, 0, 10);
    this.moveMarker.lineBetween(6, 4, 0, 10);

    this.moveMarker.setPosition(x, y);
    this.moveMarker.setVisible(true);
    this.moveMarker.setAlpha(1);

    this.moveMarkerTween = this.scene.tweens.add({
      targets: this.moveMarker,
      alpha: 0,
      scale: 1.5,
      duration: 500,
      onComplete: () => {
        this.moveMarker?.setVisible(false);
        this.moveMarker?.setScale(1);
      },
    });
  }

  // 포메이션 계산 (간단한 그리드 배치)
  private calculateFormation(
    unitCount: number,
    centerX: number,
    centerY: number
  ): Vector2[] {
    if (unitCount === 1) {
      return [{ x: centerX, y: centerY }];
    }

    const positions: Vector2[] = [];
    const spacing = 40; // 유닛 간 간격
    const cols = Math.ceil(Math.sqrt(unitCount));

    for (let i = 0; i < unitCount; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const rowUnits = Math.min(cols, unitCount - row * cols);
      const offsetX = (col - (rowUnits - 1) / 2) * spacing;
      const offsetY = (row - Math.floor((unitCount - 1) / cols) / 2) * spacing;

      positions.push({
        x: centerX + offsetX,
        y: centerY + offsetY,
      });
    }

    return positions;
  }

  // 이동 마커 표시
  private showMoveMarker(x: number, y: number): void {
    if (!this.moveMarker) return;

    // 기존 트윈 정지
    this.moveMarkerTween?.stop();

    // 마커 그리기
    this.moveMarker.clear();
    this.moveMarker.lineStyle(2, 0x00ff00, 1);
    this.moveMarker.strokeCircle(0, 0, 15);
    this.moveMarker.lineBetween(-10, 0, 10, 0);
    this.moveMarker.lineBetween(0, -10, 0, 10);

    this.moveMarker.setPosition(x, y);
    this.moveMarker.setVisible(true);
    this.moveMarker.setAlpha(1);

    // 페이드 아웃 애니메이션
    this.moveMarkerTween = this.scene.tweens.add({
      targets: this.moveMarker,
      alpha: 0,
      scale: 1.5,
      duration: 500,
      onComplete: () => {
        this.moveMarker?.setVisible(false);
        this.moveMarker?.setScale(1);
      },
    });
  }
}
