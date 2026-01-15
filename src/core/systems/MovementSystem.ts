// ==========================================
// MovementSystem - 유닛 이동 처리
// ==========================================

import { System } from '../ecs/System';
import type { Entity } from '../ecs/Entity';
import type { GameState } from '../GameState';
import { Position } from '../components/Position';
import { Movement } from '../components/Movement';

export class MovementSystem extends System {
  readonly requiredComponents = [Position.type, Movement.type];
  readonly priority = 10;

  update(entities: Entity[], _gameState: GameState, deltaTime: number): void {
    for (const entity of entities) {
      const position = entity.getComponent<Position>(Position);
      const movement = entity.getComponent<Movement>(Movement);

      if (!position || !movement || !movement.isMoving) continue;

      if (!movement.hasTarget()) {
        movement.stop();
        continue;
      }

      const targetX = movement.targetX!;
      const targetY = movement.targetY!;

      // 방향 계산
      const dx = targetX - position.x;
      const dy = targetY - position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // 도착 체크 (5픽셀 이내)
      if (distance < 5) {
        // 경로의 다음 웨이포인트로
        if (!movement.advanceToNextWaypoint()) {
          // 경로 끝, 정확한 위치로 이동
          position.setPosition(targetX, targetY);
          movement.stop();
        }
        continue;
      }

      // 이동
      const moveDistance = movement.speed * deltaTime;
      const ratio = Math.min(moveDistance / distance, 1);

      position.x += dx * ratio;
      position.y += dy * ratio;
    }
  }
}
