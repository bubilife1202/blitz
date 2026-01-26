// ==========================================
// MovementSystem - 유닛 이동 처리
// ==========================================

import { System } from '../ecs/System';
import type { Entity } from '../ecs/Entity';
import type { GameState } from '../GameState';
import { Position } from '../components/Position';
import { Movement } from '../components/Movement';
import { Unit } from '../components/Unit';
import { 
  MOVEMENT_ARRIVAL_THRESHOLD_BASE, 
  MOVEMENT_ARRIVAL_THRESHOLD_MULTIPLIER, 
  STIM_MOVE_SPEED_MULTIPLIER,
  UNIT_SEPARATION_RADIUS,
  UNIT_SEPARATION_FORCE
} from '@shared/constants';
import { Owner } from '../components/Owner';

export class MovementSystem extends System {
  readonly requiredComponents = [Position.type, Movement.type];
  readonly priority = 10;

  update(entities: Entity[], _gameState: GameState, deltaTime: number): void {
    for (const entity of entities) {
      const position = entity.getComponent<Position>(Position);
      const movement = entity.getComponent<Movement>(Movement);
      const unit = entity.getComponent<Unit>(Unit);

      if (!position || !movement) continue;

      if (unit) {
        this.updateStimSpeed(unit, movement);
      }

      if (!movement.isMoving || !movement.hasTarget()) {
        if (movement.isMoving) movement.stop();
        continue;
      }

      const targetX = movement.targetX!;
      const targetY = movement.targetY!;

      const dx = targetX - position.x;
      const dy = targetY - position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      const arrivalThreshold = Math.max(
        MOVEMENT_ARRIVAL_THRESHOLD_BASE,
        movement.speed * deltaTime * MOVEMENT_ARRIVAL_THRESHOLD_MULTIPLIER
      );
      
      if (distance < arrivalThreshold) {
        if (!movement.advanceToNextWaypoint()) {
          position.setPosition(targetX, targetY);
          movement.stop();
        }
        continue;
      }

      const moveDistance = movement.speed * deltaTime;
      const ratio = Math.min(moveDistance / distance, 1);

      position.x += dx * ratio;
      position.y += dy * ratio;
    }

    this.applySeparation(entities);
  }

  private applySeparation(entities: Entity[]): void {
    const movingUnits: Array<{ entity: Entity; pos: Position; owner: number }> = [];
    
    for (const entity of entities) {
      const pos = entity.getComponent<Position>(Position);
      const movement = entity.getComponent<Movement>(Movement);
      const owner = entity.getComponent<Owner>(Owner);
      const unit = entity.getComponent<Unit>(Unit);
      
      if (pos && movement && owner && unit) {
        movingUnits.push({ entity, pos, owner: owner.playerId });
      }
    }

    for (let i = 0; i < movingUnits.length; i++) {
      const a = movingUnits[i];
      let separationX = 0;
      let separationY = 0;
      let neighborCount = 0;

      for (let j = 0; j < movingUnits.length; j++) {
        if (i === j) continue;
        const b = movingUnits[j];
        if (a.owner !== b.owner) continue;

        const dx = a.pos.x - b.pos.x;
        const dy = a.pos.y - b.pos.y;
        const distSq = dx * dx + dy * dy;

        if (distSq < UNIT_SEPARATION_RADIUS * UNIT_SEPARATION_RADIUS && distSq > 0) {
          const dist = Math.sqrt(distSq);
          const factor = (UNIT_SEPARATION_RADIUS - dist) / UNIT_SEPARATION_RADIUS;
          separationX += (dx / dist) * factor;
          separationY += (dy / dist) * factor;
          neighborCount++;
        }
      }

      if (neighborCount > 0) {
        a.pos.x += separationX * UNIT_SEPARATION_FORCE;
        a.pos.y += separationY * UNIT_SEPARATION_FORCE;
      }
    }
  }

  private updateStimSpeed(unit: Unit, movement: Movement): void {
    if (unit.isStimmed) {
      unit.updateStim();
      movement.speed = unit.baseMoveSpeed * 32 * STIM_MOVE_SPEED_MULTIPLIER;
    } else {
      const expectedSpeed = unit.baseMoveSpeed * 32;
      if (movement.speed !== expectedSpeed) {
        movement.speed = expectedSpeed;
      }
    }
  }
}
