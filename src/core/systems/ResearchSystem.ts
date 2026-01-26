// ==========================================
// ResearchSystem - 업그레이드 연구 시스템
// ==========================================

import { System } from '../ecs/System';
import type { Entity } from '../ecs/Entity';
import type { GameState } from '../GameState';
import { Owner } from '../components/Owner';
import { Building } from '../components/Building';
import { ResearchQueue } from '../components/ResearchQueue';
import { UPGRADE_STATS } from '@shared/constants';
import { UnitCategory } from '@shared/types';
import { Unit } from '../components/Unit';
import { UNIT_STATS } from '@shared/constants';

export class ResearchSystem extends System {
  readonly requiredComponents = [Building.type, ResearchQueue.type, Owner.type];
  readonly priority = 28; // Construction과 Production 사이

  update(entities: Entity[], gameState: GameState, _deltaTime: number): void {
    for (const entity of entities) {
      const building = entity.getComponent<Building>(Building)!;
      const queue = entity.getComponent<ResearchQueue>(ResearchQueue)!;
      const owner = entity.getComponent<Owner>(Owner)!;

      // 건설 중이면 연구 안 함
      if (building.isConstructing) continue;

      // 연구 진행
      const completedUpgrade = queue.advanceResearch(1);
      
      if (completedUpgrade) {
        // 플레이어 업그레이드 목록에 추가
        const player = gameState.getPlayer(owner.playerId);
        if (player && !player.upgrades.includes(completedUpgrade)) {
          player.upgrades.push(completedUpgrade);
          
          // 업그레이드 효과 적용
          this.applyUpgradeEffect(completedUpgrade, owner.playerId, gameState);
          
          console.log(`Player ${owner.playerId} completed upgrade: ${completedUpgrade}`);
        }
      }
    }
  }

  private applyUpgradeEffect(upgradeType: string, playerId: number, gameState: GameState): void {
    const stats = UPGRADE_STATS[upgradeType as keyof typeof UPGRADE_STATS];
    if (!stats?.effect) return;

    // 해당 플레이어의 모든 유닛에 업그레이드 효과 적용
    for (const entity of gameState.getAllEntities()) {
      const owner = entity.getComponent<Owner>(Owner);
      const unit = entity.getComponent<Unit>(Unit);
      
      if (!owner || owner.playerId !== playerId || !unit) continue;
      
      const unitStats = UNIT_STATS[unit.unitType];
      
      // 보병 업그레이드
      if (upgradeType.includes('infantry') && unitStats.category === UnitCategory.INFANTRY) {
        if (stats.effect.damageBonus) {
          unit.damage += stats.effect.damageBonus;
          unit.baseDamage += stats.effect.damageBonus;
        }
        if (stats.effect.armorBonus) {
          unit.armor += stats.effect.armorBonus;
        }
      }
      
      // 차량 업그레이드
      if (upgradeType.includes('vehicle') && unitStats.category === UnitCategory.VEHICLE) {
        if (stats.effect.damageBonus) {
          unit.damage += stats.effect.damageBonus;
          unit.baseDamage += stats.effect.damageBonus;
        }
        if (stats.effect.armorBonus) {
          unit.armor += stats.effect.armorBonus;
        }
      }
      
      // U-238 Shells (Marine range)
      if (upgradeType === 'extended_range' && unit.unitType === 'trooper') {
        unit.range += stats.effect.rangeBonus || 0;
        unit.baseRange += stats.effect.rangeBonus || 0;
      }
    }
  }
}
