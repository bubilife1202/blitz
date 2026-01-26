// ==========================================
// AIController - 향상된 AI 로직
// ==========================================

import type { GameState } from './GameState';
import type { Entity } from './ecs/Entity';
import type { PathfindingService } from './PathfindingService';
import { Position } from './components/Position';
import { Owner } from './components/Owner';
import { Unit } from './components/Unit';
import { Building } from './components/Building';
import { Movement } from './components/Movement';
import { Combat } from './components/Combat';
import { Gatherer, GathererState } from './components/Gatherer';
import { ProductionQueue } from './components/ProductionQueue';
import { ResearchQueue } from './components/ResearchQueue';
import { Selectable } from './components/Selectable';
import { Resource } from './components/Resource';
import { UnitType, BuildingType, UnitCategory, AIDifficulty, ResourceType, type PlayerId } from '@shared/types';
import { UNIT_STATS, BUILDING_STATS, canBuildBuilding, canTrainUnit, secondsToTicks } from '@shared/constants';

export enum AIState {
  BUILDING_UP = 'building_up',
  ATTACKING = 'attacking',
  DEFENDING = 'defending',
  HARASSING = 'harassing',
}

// 전략 타입
export enum AIStrategy {
  RUSH = 'rush',           // 초반 빠른 공격 (적은 유닛으로 빠르게)
  TIMING = 'timing',       // 타이밍 공격 (특정 유닛 수 도달시)
  HARASS = 'harass',       // 기습 (소규모로 자원라인 공격)
  CONTAIN = 'contain',     // 견제 (적 확장 방해)
  MACRO = 'macro',         // 매크로 (경제 우선, 늦은 공격)
}

interface BuildTask {
  buildingType: BuildingType;
  builderId: number;
  position: { x: number; y: number };
}

export class AIController {
  private gameState: GameState;
  private pathfinding: PathfindingService | null = null;
  private playerId: PlayerId;
  private difficulty: AIDifficulty;
  private state: AIState = AIState.BUILDING_UP;
  private lastAttackTick: number = 0;
  private attackInterval: number = 600; // ~37초마다 공격
  private targetPlayerId: PlayerId = 1;
  
  // 건설 관련
  private pendingBuild: BuildTask | null = null;
  private lastBuildCheck: number = 0;
  private buildCheckInterval: number = 32; // 2초마다 건설 체크
  
  // 자원 채취 관련
  private lastGatherCheck: number = 0;
  private gatherCheckInterval: number = 48; // 3초마다 채취 체크
  
  // 난이도별 공격 유닛 수 최소값
  private minAttackUnits: number = 6;
  
  // 전략 시스템
  private currentStrategy: AIStrategy = AIStrategy.TIMING;
  private strategyChangeTick: number = 0;
  private strategyDuration: number = 800; // 전략 유지 시간
  private _harassSquad: number[] = []; // 기습 부대 ID (향후 귀환 로직용)
  private lastHarassTick: number = 0;
  private harassInterval: number = 400;

  private lastRetreatTick: number = 0;
  private retreatCooldown: number = 160;

  private lastScoutTick: number = 0;
  private scoutInterval: number = 900;
  private scoutUnitId: number | null = null;

  private gasWorkerTarget: number = 2;

  constructor(
    gameState: GameState, 
    playerId: PlayerId, 
    pathfinding?: PathfindingService,
    difficulty: AIDifficulty = AIDifficulty.NORMAL
  ) {
    this.gameState = gameState;
    this.playerId = playerId;
    this.pathfinding = pathfinding || null;
    this.difficulty = difficulty;
    
    // 난이도별 설정 조정
    this.applyDifficultySettings();
  }

  private applyDifficultySettings(): void {
    switch (this.difficulty) {
      case AIDifficulty.EASY:
        this.attackInterval = 960; // ~1분마다 공격
        this.buildCheckInterval = 64; // 4초마다 건설 체크 (느림)
        this.gatherCheckInterval = 80; // 5초마다 채취 체크 (느림)
        this.minAttackUnits = 4;
        this.currentStrategy = AIStrategy.TIMING; // Easy는 단순 타이밍
        this.harassInterval = 800; // 기습 적게
        this.gasWorkerTarget = 1;
        break;
      case AIDifficulty.NORMAL:
        this.attackInterval = 600; // ~37초마다 공격
        this.buildCheckInterval = 32; // 2초마다 건설 체크
        this.gatherCheckInterval = 48; // 3초마다 채취 체크
        this.minAttackUnits = 6;
        this.currentStrategy = this.pickRandomStrategy();
        this.harassInterval = 500;
        this.gasWorkerTarget = 2;
        break;
      case AIDifficulty.HARD:
        this.attackInterval = 400; // ~25초마다 공격 (공격적)
        this.buildCheckInterval = 16; // 1초마다 건설 체크 (빠름)
        this.gatherCheckInterval = 32; // 2초마다 채취 체크 (빠름)
        this.minAttackUnits = 8;
        this.currentStrategy = this.pickRandomStrategy();
        this.harassInterval = 300; // 기습 자주
        this.gasWorkerTarget = 3;
        break;
    }
  }
  
  private pickRandomStrategy(): AIStrategy {
    const strategies = [AIStrategy.RUSH, AIStrategy.TIMING, AIStrategy.HARASS, AIStrategy.CONTAIN, AIStrategy.MACRO];
    return strategies[Math.floor(Math.random() * strategies.length)];
  }

  private selectStrategy(resources: { minerals: number; gas: number; supply: number; supplyMax: number }): AIStrategy {
    const combatUnits = this.getCombatUnits();
    const powerRatio = this.getCombatPowerRatio();
    const enemyCCCount = this.getEnemyCommandCenters().length;
    const hasFastUnits = combatUnits.some(unit => {
      const info = unit.getComponent<Unit>(Unit);
      return info && (info.unitType === UnitType.SPEEDER || info.unitType === UnitType.TROOPER);
    });

    if (powerRatio < 0.8 || combatUnits.length < Math.max(3, Math.floor(this.minAttackUnits * 0.6))) {
      return AIStrategy.MACRO;
    }

    if (enemyCCCount >= 2 && combatUnits.length >= 4) {
      return AIStrategy.CONTAIN;
    }

    if (hasFastUnits && this.difficulty !== AIDifficulty.EASY && combatUnits.length >= 2) {
      return AIStrategy.HARASS;
    }

    if (powerRatio >= 1.3 && combatUnits.length >= this.minAttackUnits) {
      return AIStrategy.RUSH;
    }

    if (resources.minerals > 500 && combatUnits.length < this.minAttackUnits) {
      return AIStrategy.MACRO;
    }

    return this.pickRandomStrategy();
  }

  private handleRetreat(currentTick: number): void {
    if (currentTick - this.lastRetreatTick < this.retreatCooldown) return;
    if (this.state !== AIState.ATTACKING && this.state !== AIState.HARASSING) return;

    const combatUnits = this.getCombatUnits();
    if (combatUnits.length === 0) return;

    const powerRatio = this.getCombatPowerRatio();
    const retreatCount = Math.max(2, Math.floor(this.minAttackUnits * 0.6));
    if (combatUnits.length >= retreatCount && powerRatio >= 0.75) return;

    const basePos = this.getBasePosition();
    if (!basePos) return;

    this.orderRetreat(combatUnits, basePos);
    this.state = AIState.DEFENDING;
    this.lastRetreatTick = currentTick;
  }

  setPathfinding(pathfinding: PathfindingService): void {
    this.pathfinding = pathfinding;
  }

  update(): void {
    const currentTick = this.gameState.getCurrentTick();
    const resources = this.gameState.getPlayerResources(this.playerId);
    if (!resources) return;

    const isDefending = this.handleDefense(currentTick);

    this.handleRetreat(currentTick);

    // 전략 변경 체크 (일정 시간마다 전략 재선택)
    if (currentTick - this.strategyChangeTick > this.strategyDuration && this.difficulty !== AIDifficulty.EASY) {
      this.currentStrategy = this.selectStrategy(resources);
      this.strategyChangeTick = currentTick;
      console.log(`AI switched to ${this.currentStrategy} strategy`);
    }

    // 건설 작업 처리
    if (currentTick - this.lastBuildCheck > this.buildCheckInterval) {
      this.processBuildOrder(resources);
      this.lastBuildCheck = currentTick;
    }
    
    // 유닛 생산 (전략에 따라 다르게)
    this.executeProduction(resources);
    
    // 자원 채취 관리
    if (currentTick - this.lastGatherCheck > this.gatherCheckInterval) {
      this.manageGatherers(resources);
      this.lastGatherCheck = currentTick;
    }

    if (currentTick - this.lastScoutTick > this.scoutInterval) {
      this.sendScout();
      this.lastScoutTick = currentTick;
    }

    this.updateHarassSquad(currentTick);

    if (!isDefending) {
      this.executeStrategy(currentTick);
    }
  }

  private handleDefense(currentTick: number): boolean {
    const defensePoint = this.findDefensePoint();
    if (!defensePoint) return false;

    const combatUnits = this.getCombatUnits();
    if (combatUnits.length === 0) return false;

    if (currentTick - this.lastAttackTick < 30) return true;

    this.state = AIState.DEFENDING;
    for (let i = 0; i < combatUnits.length; i++) {
      const unit = combatUnits[i];
      const movement = unit.getComponent<Movement>(Movement);
      const combat = unit.getComponent<Combat>(Combat);
      if (movement && combat) {
        const offset = (i % 4) * 18 - 27;
        combat.startAttackMove(defensePoint.x + offset, defensePoint.y + offset);
        movement.setTarget(defensePoint.x + offset, defensePoint.y + offset);
      }
    }

    this.lastAttackTick = currentTick;
    return true;
  }
  
  private executeStrategy(currentTick: number): void {
    const combatUnits = this.getCombatUnits();
    const powerRatio = this.getCombatPowerRatio();
    
    switch (this.currentStrategy) {
      case AIStrategy.RUSH:
        // 러시: 3유닛만 모이면 바로 공격
        if (this.shouldLaunchMainAttack(currentTick, combatUnits.length, 3, Math.max(1.0, powerRatio), 0.5)) {
          this.state = AIState.ATTACKING;
          this.launchAttack();
          this.lastAttackTick = currentTick;
        }
        break;
        
      case AIStrategy.HARASS:
        // 기습: 2유닛으로 자원라인 공격
        if (currentTick - this.lastHarassTick > this.harassInterval && combatUnits.length >= 2) {
          this.launchHarass();
          this.lastHarassTick = currentTick;
        }
        // 메인 공격도 병행
        if (this.shouldLaunchMainAttack(currentTick, combatUnits.length, this.minAttackUnits, Math.max(1.05, powerRatio), 1)) {
          this.launchAttack();
          this.lastAttackTick = currentTick;
        }
        break;
        
      case AIStrategy.CONTAIN:
        // 견제: 적 기지 앞에서 대기하며 압박
        if (this.shouldLaunchMainAttack(currentTick, combatUnits.length, 4, Math.max(1.0, powerRatio), 0.7)) {
          this.launchContain();
          this.lastAttackTick = currentTick;
        }
        break;
        
      case AIStrategy.MACRO:
        // 매크로: 많은 유닛 모아서 한방
        if (this.shouldLaunchMainAttack(currentTick, combatUnits.length, this.minAttackUnits + 4, Math.max(1.1, powerRatio), 1.5)) {
          this.state = AIState.ATTACKING;
          this.launchAttack();
          this.lastAttackTick = currentTick;
        }
        break;
        
      case AIStrategy.TIMING:
      default:
        // 기본 타이밍 공격
        if (this.shouldLaunchMainAttack(currentTick, combatUnits.length, this.minAttackUnits, Math.max(1.05, powerRatio), 1)) {
          this.state = AIState.ATTACKING;
          this.launchAttack();
          this.lastAttackTick = currentTick;
        }
        break;
    }
  }

  private updateHarassSquad(currentTick: number): void {
    if (this._harassSquad.length === 0) return;

    const harassUnits = this._harassSquad
      .map(id => this.gameState.getEntity(id))
      .filter((unit): unit is Entity => !!unit && !unit.isDestroyed());

    if (harassUnits.length < 2) {
      this._harassSquad = [];
      return;
    }

    const averageHp = harassUnits.reduce((sum, unit) => sum + this.getEntityHpPercent(unit), 0) / harassUnits.length;
    const powerRatio = this.getCombatPowerRatio();
    const basePos = this.getBasePosition();
    if (!basePos) return;

    if (averageHp < 0.45 || powerRatio < 0.7) {
      this.orderRetreat(harassUnits, basePos);
      this._harassSquad = [];
      this.state = AIState.DEFENDING;
      this.lastRetreatTick = currentTick;
    }
  }

  // ==========================================
  // 건설 관리
  // ==========================================
  
  private processBuildOrder(resources: { minerals: number; gas: number; supply: number; supplyMax: number }): void {
    // 진행 중인 건설 작업 처리
    if (this.pendingBuild) {
      this.executePendingBuild();
      return;
    }
    
    const myBuildings = this.getMyBuildings();
    const buildingTypes = myBuildings.map(b => b.getComponent<Building>(Building)!.buildingType);
    const barracksCount = buildingTypes.filter(t => t === BuildingType.BARRACKS).length;
    const factoryCount = buildingTypes.filter(t => t === BuildingType.FACTORY).length;
    const hasArmory = buildingTypes.includes(BuildingType.ARMORY);
    const hasEngineeringBay = buildingTypes.includes(BuildingType.TECH_LAB);
    const refineryCount = buildingTypes.filter(t => t === BuildingType.REFINERY).length;
    
    // 서플라이 막힘 체크 - 최우선
    if (resources.supply >= resources.supplyMax - 2) {
      if (resources.minerals >= BUILDING_STATS[BuildingType.DEPOT].mineralCost) {
        this.planBuilding(BuildingType.DEPOT);
        return;
      }
    }
    
    // 배럭 없으면 건설
    if (barracksCount === 0 && resources.minerals >= BUILDING_STATS[BuildingType.BARRACKS].mineralCost) {
      this.planBuilding(BuildingType.BARRACKS);
      return;
    }

    // Refinery 건설 (가스 필요 시)
    const needsGas = factoryCount > 0 || hasArmory || hasEngineeringBay || resources.gas < 50;
    if (refineryCount === 0 && needsGas && resources.minerals >= BUILDING_STATS[BuildingType.REFINERY].mineralCost) {
      const geyser = this.findNearestGasGeyser();
      if (geyser) {
        this.planBuilding(BuildingType.REFINERY);
        return;
      }
    }
    
    // Engineering Bay 건설 (테크 진행)
    if (!hasEngineeringBay && barracksCount > 0 && resources.minerals >= BUILDING_STATS[BuildingType.TECH_LAB].mineralCost) {
      this.planBuilding(BuildingType.TECH_LAB);
      return;
    }
    
    // 팩토리 건설
    if (factoryCount === 0 && barracksCount > 0 && 
        resources.minerals >= BUILDING_STATS[BuildingType.FACTORY].mineralCost &&
        resources.gas >= BUILDING_STATS[BuildingType.FACTORY].gasCost) {
      if (canBuildBuilding(BuildingType.FACTORY, buildingTypes)) {
        this.planBuilding(BuildingType.FACTORY);
        return;
      }
    }
    
    // 두 번째 배럭
    if (barracksCount === 1 && resources.minerals >= BUILDING_STATS[BuildingType.BARRACKS].mineralCost + 100) {
      this.planBuilding(BuildingType.BARRACKS);
      return;
    }
    
    // Armory 건설
    if (!hasArmory && factoryCount > 0 && 
        resources.minerals >= BUILDING_STATS[BuildingType.ARMORY].mineralCost &&
        resources.gas >= BUILDING_STATS[BuildingType.ARMORY].gasCost) {
      if (canBuildBuilding(BuildingType.ARMORY, buildingTypes)) {
        this.planBuilding(BuildingType.ARMORY);
        return;
      }
    }
  }
  
  private planBuilding(buildingType: BuildingType): void {
    const scvs = this.getIdleSCVs();
    if (scvs.length === 0) return;
    
    const builder = scvs[0];
    const buildPos = this.findBuildLocation(buildingType);
    
    if (!buildPos) return;
    
    this.pendingBuild = {
      buildingType,
      builderId: builder.id,
      position: buildPos,
    };
    
    // SCV를 건설 위치로 이동
    const movement = builder.getComponent<Movement>(Movement);
    if (movement) {
      movement.setTarget(buildPos.x, buildPos.y);
    }
    
    // 채취 중단
    const gatherer = builder.getComponent<Gatherer>(Gatherer);
    if (gatherer) {
      gatherer.stop();
    }
  }
  
  private executePendingBuild(): void {
    if (!this.pendingBuild) return;
    
    const builder = this.gameState.getEntity(this.pendingBuild.builderId);
    if (!builder) {
      this.pendingBuild = null;
      return;
    }
    
    const builderPos = builder.getComponent<Position>(Position);
    if (!builderPos) {
      this.pendingBuild = null;
      return;
    }
    
    // 건설 위치에 도착했는지 확인
    const dist = Math.sqrt(
      Math.pow(builderPos.x - this.pendingBuild.position.x, 2) +
      Math.pow(builderPos.y - this.pendingBuild.position.y, 2)
    );
    
    if (dist < 60) {
      // 건설 시작
      this.createBuilding(this.pendingBuild.buildingType, this.pendingBuild.position.x, this.pendingBuild.position.y);
      this.pendingBuild = null;
    }
  }
  
  private findBuildLocation(buildingType: BuildingType): { x: number; y: number } | null {
    const stats = BUILDING_STATS[buildingType];
    const tileSize = this.gameState.config.tileSize;

    if (buildingType === BuildingType.REFINERY) {
      const geyser = this.findNearestGasGeyser();
      const geyserPos = geyser?.getComponent<Position>(Position);
      if (geyserPos) {
        return { x: geyserPos.x, y: geyserPos.y };
      }
      return null;
    }
    
    // 기존 커맨드센터 위치 찾기
    const commandCenter = this.getMyBuildings().find(b => 
      b.getComponent<Building>(Building)?.buildingType === BuildingType.HQ
    );
    
    if (!commandCenter) return null;
    
    const ccPos = commandCenter.getComponent<Position>(Position);
    if (!ccPos) return null;
    
    // 나선형 탐색으로 빈 공간 찾기
    const baseTileX = Math.floor(ccPos.x / tileSize);
    const baseTileY = Math.floor(ccPos.y / tileSize);
    
    for (let radius = 3; radius < 15; radius++) {
      for (let angle = 0; angle < 8; angle++) {
        const offsetX = Math.round(Math.cos(angle * Math.PI / 4) * radius);
        const offsetY = Math.round(Math.sin(angle * Math.PI / 4) * radius);
        
        const tileX = baseTileX + offsetX;
        const tileY = baseTileY + offsetY;
        
        if (this.canPlaceBuilding(tileX, tileY, stats.size.width, stats.size.height)) {
          return {
            x: tileX * tileSize + (stats.size.width * tileSize) / 2,
            y: tileY * tileSize + (stats.size.height * tileSize) / 2,
          };
        }
      }
    }
    
    return null;
  }
  
  private canPlaceBuilding(tileX: number, tileY: number, width: number, height: number): boolean {
    const config = this.gameState.config;
    
    // 맵 경계 체크
    if (tileX < 1 || tileY < 1 || 
        tileX + width >= config.mapWidth - 1 || 
        tileY + height >= config.mapHeight - 1) {
      return false;
    }
    
    // 기존 건물과 겹침 체크
    for (const entity of this.gameState.getAllEntities()) {
      const building = entity.getComponent<Building>(Building);
      const position = entity.getComponent<Position>(Position);
      
      if (!building || !position) continue;
      
      const bTileX = Math.floor(position.x / config.tileSize) - Math.floor(building.width / 2);
      const bTileY = Math.floor(position.y / config.tileSize) - Math.floor(building.height / 2);
      
      // AABB 충돌 체크
      if (tileX < bTileX + building.width + 1 &&
          tileX + width + 1 > bTileX &&
          tileY < bTileY + building.height + 1 &&
          tileY + height + 1 > bTileY) {
        return false;
      }
    }
    
    // 자원과 겹침 체크
    for (const entity of this.gameState.getAllEntities()) {
      const resource = entity.getComponent<Resource>(Resource);
      const position = entity.getComponent<Position>(Position);
      
      if (!resource || !position) continue;
      
      const rTileX = Math.floor(position.x / config.tileSize);
      const rTileY = Math.floor(position.y / config.tileSize);
      
      if (tileX <= rTileX + 1 && tileX + width >= rTileX &&
          tileY <= rTileY + 1 && tileY + height >= rTileY) {
        return false;
      }
    }
    
    return true;
  }
  
  private createBuilding(buildingType: BuildingType, x: number, y: number): void {
    const stats = BUILDING_STATS[buildingType];
    const resources = this.gameState.getPlayerResources(this.playerId);
    
    if (!resources || 
        resources.minerals < stats.mineralCost || 
        resources.gas < stats.gasCost) {
      return;
    }
    
    // 자원 차감
    this.gameState.modifyPlayerResources(this.playerId, {
      minerals: -stats.mineralCost,
      gas: -stats.gasCost,
    });
    
    // 건물 생성
    const entity = this.gameState.createEntity();
    const building = new Building(buildingType, false);

    if (buildingType === BuildingType.REFINERY && !building.linkedGeyserId) {
      const geyser = this.findNearestGasGeyser();
      if (geyser) {
        building.linkedGeyserId = geyser.id;
      }
    }

    entity
      .addComponent(new Position(x, y))
      .addComponent(new Selectable(32))
      .addComponent(new Owner(this.playerId))
      .addComponent(building); // 건설 중
    
    // 생산 가능 건물에 ProductionQueue 추가
    if (stats.canProduce && stats.canProduce.length > 0) {
      entity.addComponent(new ProductionQueue(5));
    }

    // 연구 가능 건물에 ResearchQueue 추가
    if (stats.canResearch && stats.canResearch.length > 0) {
      entity.addComponent(new ResearchQueue());
    }
    
    // 패스파인딩 장애물 등록
    if (this.pathfinding) {
      const tileSize = this.gameState.config.tileSize;
      const tileX = Math.floor(x / tileSize);
      const tileY = Math.floor(y / tileSize);
      
      for (let dy = 0; dy < stats.size.height; dy++) {
        for (let dx = 0; dx < stats.size.width; dx++) {
          this.pathfinding.setObstacle(tileX + dx, tileY + dy);
        }
      }
    }
    
    console.log(`AI building ${buildingType} at (${x}, ${y})`);
  }

  // ==========================================
  // 유닛 생산
  // ==========================================
  
  private executeProduction(resources: { minerals: number; gas: number; supply: number; supplyMax: number }): void {
    const myBuildings = this.getMyBuildings();
    const buildingTypes = myBuildings.map(b => b.getComponent<Building>(Building)!.buildingType);
    
    for (const building of myBuildings) {
      const buildingComp = building.getComponent<Building>(Building)!;
      const queue = building.getComponent<ProductionQueue>(ProductionQueue);

      if (!queue || buildingComp.isConstructing) continue;
      if (!queue.canQueue()) continue;

      // 커맨드센터: SCV 생산
      if (buildingComp.buildingType === BuildingType.HQ) {
        const scvCount = this.getMyUnits().filter(u => 
          u.getComponent<Unit>(Unit)?.unitType === UnitType.ENGINEER
        ).length;

        if (scvCount < 12 && this.canAffordUnit(UnitType.ENGINEER, resources)) {
          this.trainUnit(queue, UnitType.ENGINEER, resources);
        }
      }
      
      // 배럭: 보병 생산
      if (buildingComp.buildingType === BuildingType.BARRACKS) {
        // 우선순위: Marine > Firebat > Medic
        if (this.canAffordUnit(UnitType.TROOPER, resources) && canTrainUnit(UnitType.TROOPER, buildingTypes)) {
          this.trainUnit(queue, UnitType.TROOPER, resources);
        } else if (this.canAffordUnit(UnitType.PYRO, resources) && canTrainUnit(UnitType.PYRO, buildingTypes)) {
          // 파이어뱃은 가스가 충분할 때만
          if (resources.gas >= 50) {
            this.trainUnit(queue, UnitType.PYRO, resources);
          }
        }
      }
      
      // 팩토리: 차량 생산
      if (buildingComp.buildingType === BuildingType.FACTORY) {
        // Vulture 우선 (가스 안 씀)
        if (this.canAffordUnit(UnitType.SPEEDER, resources) && canTrainUnit(UnitType.SPEEDER, buildingTypes)) {
          this.trainUnit(queue, UnitType.SPEEDER, resources);
        } else if (this.canAffordUnit(UnitType.ARTILLERY, resources) && canTrainUnit(UnitType.ARTILLERY, buildingTypes)) {
          this.trainUnit(queue, UnitType.ARTILLERY, resources);
        }
      }
    }
  }
  
  private canAffordUnit(unitType: UnitType, resources: { minerals: number; gas: number; supply: number; supplyMax: number }): boolean {
    const stats = UNIT_STATS[unitType];
    return resources.minerals >= stats.mineralCost &&
           resources.gas >= stats.gasCost &&
           resources.supply + stats.supplyCost <= resources.supplyMax;
  }
  
  private trainUnit(queue: ProductionQueue, unitType: UnitType, _resources: { minerals: number; gas: number; supply: number; supplyMax: number }): void {
    const stats = UNIT_STATS[unitType];
    
    queue.addToQueue(unitType, secondsToTicks(stats.buildTime));
    this.gameState.modifyPlayerResources(this.playerId, {
      minerals: -stats.mineralCost,
      gas: -stats.gasCost,
    });
  }

  // ==========================================
  // 자원 채취 관리
  // ==========================================
  
  private manageGatherers(resources: { minerals: number; gas: number; supply: number; supplyMax: number }): void {
    this.assignGasWorkers(resources);

    const idleSCVs = this.getIdleSCVs();
    if (idleSCVs.length === 0) return;
    
    // 가장 가까운 자원 찾기
    for (const scv of idleSCVs) {
      const pos = scv.getComponent<Position>(Position);
      if (!pos) continue;
      
      const nearestMineral = this.findNearestMineral(pos.x, pos.y);
      if (!nearestMineral) continue;
      
      const mineralPos = nearestMineral.getComponent<Position>(Position);
      if (!mineralPos) continue;
      
      // 채취 시작
      const gatherer = scv.getComponent<Gatherer>(Gatherer);
      const movement = scv.getComponent<Movement>(Movement);
      const commandCenter = this.findNearestCommandCenter(pos.x, pos.y);
      
      if (gatherer && movement && commandCenter) {
        gatherer.startGathering(nearestMineral.id, commandCenter.id);
        movement.setTarget(mineralPos.x, mineralPos.y);
      }
    }
  }
  
  private getIdleSCVs(): Entity[] {
    return this.getMyUnits().filter(u => {
      const unit = u.getComponent<Unit>(Unit);
      const gatherer = u.getComponent<Gatherer>(Gatherer);
      const movement = u.getComponent<Movement>(Movement);
      
      if (unit?.unitType !== UnitType.ENGINEER) return false;
      if (gatherer?.state !== GathererState.IDLE) return false;
      if (movement?.isMoving) return false;
      
      return true;
    });
  }
  
  private findNearestMineral(x: number, y: number): Entity | null {
    let nearest: Entity | null = null;
    let nearestDist = Infinity;
    
    for (const entity of this.gameState.getAllEntities()) {
      const resource = entity.getComponent<Resource>(Resource);
      const position = entity.getComponent<Position>(Position);
      
      if (!resource || !position || resource.isDepleted()) continue;
      if (resource.resourceType !== 'minerals') continue;
      
      const dist = Math.sqrt(Math.pow(x - position.x, 2) + Math.pow(y - position.y, 2));
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = entity;
      }
    }
    
    return nearest;
  }

  private findNearestGasGeyser(): Entity | null {
    let nearest: Entity | null = null;
    let nearestDist = Infinity;

    const myRefineryLinks = new Set(
      this.getMyBuildings()
        .map(b => b.getComponent<Building>(Building)?.linkedGeyserId)
        .filter((id): id is number => typeof id === 'number')
    );

    const myCC = this.getMyBuildings().find(b => b.getComponent<Building>(Building)?.buildingType === BuildingType.HQ);
    const ccPos = myCC?.getComponent<Position>(Position);
    if (!ccPos) return null;

    for (const entity of this.gameState.getAllEntities()) {
      const resource = entity.getComponent<Resource>(Resource);
      const position = entity.getComponent<Position>(Position);
      if (!resource || !position) continue;
      if (resource.resourceType !== ResourceType.GAS) continue;
      if (myRefineryLinks.has(entity.id)) continue;

      const dist = Math.hypot(position.x - ccPos.x, position.y - ccPos.y);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = entity;
      }
    }

    return nearest;
  }

  private assignGasWorkers(resources: { minerals: number; gas: number; supply: number; supplyMax: number }): void {
    const refineries = this.getMyBuildings().filter(b => {
      const building = b.getComponent<Building>(Building);
      return building?.buildingType === BuildingType.REFINERY && !building.isConstructing && building.linkedGeyserId;
    });

    if (refineries.length === 0) return;

    const buildingTypes = this.getMyBuildings().map(b => b.getComponent<Building>(Building)!.buildingType);
    const hasFactory = buildingTypes.includes(BuildingType.FACTORY);
    const hasArmory = buildingTypes.includes(BuildingType.ARMORY);
    const needsGas = hasFactory || hasArmory || resources.gas < 100;
    if (!needsGas) return;

    const desiredTotal = refineries.length * this.gasWorkerTarget;
    const currentAssigned = this.getMyUnits().filter(u => {
      const gatherer = u.getComponent<Gatherer>(Gatherer);
      return gatherer?.targetResourceId && refineries.some(r => r.id === gatherer.targetResourceId);
    }).length;

    if (currentAssigned >= desiredTotal) return;

    const idleSCVs = this.getIdleSCVs();
    if (idleSCVs.length === 0) return;

    for (const scv of idleSCVs) {
      const refinery = this.findNearestRefinery(scv);
      if (!refinery) return;

      const refineryPos = refinery.getComponent<Position>(Position);
      const gatherer = scv.getComponent<Gatherer>(Gatherer);
      const movement = scv.getComponent<Movement>(Movement);
      if (!refineryPos || !gatherer || !movement) continue;

      gatherer.startGathering(refinery.id, refinery.id);
      movement.setTarget(refineryPos.x, refineryPos.y);

      const assignedAfter = this.getMyUnits().filter(u => {
        const g = u.getComponent<Gatherer>(Gatherer);
        return g?.targetResourceId && refineries.some(r => r.id === g.targetResourceId);
      }).length;

      if (assignedAfter >= desiredTotal) return;
    }
  }

  private findNearestRefinery(worker: Entity): Entity | null {
    const pos = worker.getComponent<Position>(Position);
    if (!pos) return null;

    let nearest: Entity | null = null;
    let nearestDist = Infinity;

    for (const building of this.getMyBuildings()) {
      const buildingComp = building.getComponent<Building>(Building);
      const position = building.getComponent<Position>(Position);
      if (!buildingComp || !position) continue;
      if (buildingComp.buildingType !== BuildingType.REFINERY) continue;
      if (buildingComp.isConstructing) continue;
      if (!buildingComp.linkedGeyserId) continue;

      const dist = Math.hypot(pos.x - position.x, pos.y - position.y);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = building;
      }
    }

    return nearest;
  }

  private sendScout(): void {
    if (this.scoutUnitId) {
      const existingScout = this.gameState.getEntity(this.scoutUnitId);
      if (existingScout && !existingScout.isDestroyed()) {
        return;
      }
      this.scoutUnitId = null;
    }

    const idleSCVs = this.getIdleSCVs();
    if (idleSCVs.length === 0) return;

    const target = this.findEnemyCommandCenter() || this.getEnemyEntities()[0];
    if (!target) return;

    const targetPos = target.getComponent<Position>(Position);
    if (!targetPos) return;

    const scout = idleSCVs[0];
    const movement = scout.getComponent<Movement>(Movement);
    const gatherer = scout.getComponent<Gatherer>(Gatherer);
    if (!movement || !gatherer) return;

    gatherer.stop();
    movement.setTarget(targetPos.x, targetPos.y);
    this.scoutUnitId = scout.id;
  }

  private findEnemyCommandCenter(): Entity | null {
    return this.getEnemyEntities().find(e => {
      const building = e.getComponent<Building>(Building);
      return building?.buildingType === BuildingType.HQ;
    }) || null;
  }

  private findDefensePoint(): { x: number; y: number } | null {
    const myCC = this.getMyBuildings().find(b => b.getComponent<Building>(Building)?.buildingType === BuildingType.HQ);
    const ccPos = myCC?.getComponent<Position>(Position);
    if (!ccPos) return null;

    const threat = this.getEnemyEntities().find(e => {
      const pos = e.getComponent<Position>(Position);
      return pos && Math.hypot(pos.x - ccPos.x, pos.y - ccPos.y) < 240;
    });

    return threat ? { x: ccPos.x, y: ccPos.y } : null;
  }

  private getBasePosition(): { x: number; y: number } | null {
    const myCC = this.getMyBuildings().find(b => b.getComponent<Building>(Building)?.buildingType === BuildingType.HQ);
    const ccPos = myCC?.getComponent<Position>(Position);
    if (!ccPos) return null;
    return { x: ccPos.x, y: ccPos.y };
  }

  private getEnemyCommandCenters(): Entity[] {
    return this.getEnemyEntities().filter(e => {
      const building = e.getComponent<Building>(Building);
      return building?.buildingType === BuildingType.HQ;
    });
  }

  private orderRetreat(units: Entity[], target: { x: number; y: number }): void {
    for (let i = 0; i < units.length; i++) {
      const unit = units[i];
      const movement = unit.getComponent<Movement>(Movement);
      const combat = unit.getComponent<Combat>(Combat);
      if (!movement) continue;

      const offset = (i % 4) * 18 - 27;
      if (combat) {
        combat.stopAttackMove();
        combat.releaseHold();
      }
      movement.setTarget(target.x + offset, target.y + offset);
    }
  }

  private countEnemyCombatNear(x: number, y: number, radius: number): number {
    const enemies = this.getEnemyCombatUnits();
    let count = 0;
    for (const enemy of enemies) {
      const pos = enemy.getComponent<Position>(Position);
      if (!pos) continue;
      if (Math.hypot(pos.x - x, pos.y - y) <= radius) {
        count += 1;
      }
    }
    return count;
  }
  
  private findNearestCommandCenter(x: number, y: number): Entity | null {
    let nearest: Entity | null = null;
    let nearestDist = Infinity;
    
    for (const building of this.getMyBuildings()) {
      const buildingComp = building.getComponent<Building>(Building);
      const position = building.getComponent<Position>(Position);
      
      if (!buildingComp || !position) continue;
      if (buildingComp.buildingType !== BuildingType.HQ) continue;
      if (buildingComp.isConstructing) continue;
      
      const dist = Math.sqrt(Math.pow(x - position.x, 2) + Math.pow(y - position.y, 2));
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = building;
      }
    }
    
    return nearest;
  }

  // ==========================================
  // 공격 로직
  // ==========================================
  
  private launchAttack(): void {
    const combatUnits = this.getCombatUnits();
    const enemyEntities = this.getEnemyEntities();

    if (enemyEntities.length === 0) return;
    if (combatUnits.length < Math.floor(this.minAttackUnits * 0.6)) {
      this.state = AIState.BUILDING_UP;
      return;
    }

    // 점수 기반 타겟 선택
    const target = this.selectAttackTarget(combatUnits, enemyEntities);
    if (!target) return;
    
    const targetPos = target.getComponent<Position>(Position);
    if (!targetPos) return;

    console.log(`AI launching attack with ${combatUnits.length} units!`);

    // 모든 전투 유닛에게 공격 명령 (측면 공격 패턴)
    const spreadAngle = Math.random() * Math.PI / 4 - Math.PI / 8; // -22.5° ~ +22.5°
    for (let i = 0; i < combatUnits.length; i++) {
      const unit = combatUnits[i];
      const movement = unit.getComponent<Movement>(Movement);
      const combat = unit.getComponent<Combat>(Combat);

      if (movement && combat) {
        // 각 유닛에 약간의 오프셋 (뭉치지 않게)
        const offset = (i % 5) * 20 - 40;
        const angle = spreadAngle + (i % 3) * 0.2;
        const offsetX = Math.cos(angle) * offset;
        const offsetY = Math.sin(angle) * offset;
        
        combat.startAttackMove(targetPos.x + offsetX, targetPos.y + offsetY);
        movement.setTarget(targetPos.x + offsetX, targetPos.y + offsetY);
      }
    }
  }
  
  // 기습 공격 (자원라인 타겟)
  private launchHarass(): void {
    if (this._harassSquad.length > 0) return;
    const combatUnits = this.getCombatUnits();
    if (combatUnits.length < 2) return;

    const powerRatio = this.getCombatPowerRatio();
    if (powerRatio < 0.9 && this.difficulty !== AIDifficulty.EASY) return;
    
    // 빠른 유닛 2개 선택 (Vulture > Marine)
    const fastUnits = combatUnits
      .filter(u => {
        const unit = u.getComponent<Unit>(Unit);
        return unit && (unit.unitType === UnitType.SPEEDER || unit.unitType === UnitType.TROOPER);
      })
      .slice(0, 2);
    
    if (fastUnits.length < 2) return;
    
    // 적 일꾼 찾기
    const enemyWorkers = this.getEnemyEntities().filter(e => {
      const unit = e.getComponent<Unit>(Unit);
      return unit?.unitType === UnitType.ENGINEER;
    });
    
    if (enemyWorkers.length === 0) return;
    
    // 점수 기반 일꾼 선택 (거리/체력)
    const target = this.selectHarassTarget(fastUnits, enemyWorkers);
    const targetPos = target.getComponent<Position>(Position);
    if (!targetPos) return;

    const nearbyThreat = this.countEnemyCombatNear(targetPos.x, targetPos.y, 220);
    if (nearbyThreat >= 3 && this.difficulty !== AIDifficulty.EASY) {
      return;
    }
    
    console.log(`AI harassing with ${fastUnits.length} units!`);
    this._harassSquad = fastUnits.map(u => u.id);
    
    for (const unit of fastUnits) {
      const movement = unit.getComponent<Movement>(Movement);
      const combat = unit.getComponent<Combat>(Combat);
      if (movement && combat) {
        combat.startAttackMove(targetPos.x, targetPos.y);
        movement.setTarget(targetPos.x, targetPos.y);
      }
    }
    this.state = AIState.HARASSING;
  }
  
  // 견제 (적 확장 방해)
  private launchContain(): void {
    const combatUnits = this.getCombatUnits();
    const enemyBuildings = this.getEnemyEntities().filter(e => e.getComponent<Building>(Building));
    
    if (enemyBuildings.length === 0) return;
    
    // 적 커맨드센터 위치 찾기
    const enemyCC = enemyBuildings.find(b => 
      b.getComponent<Building>(Building)?.buildingType === BuildingType.HQ
    );
    
    if (!enemyCC) return;
    
    const ccPos = enemyCC.getComponent<Position>(Position);
    if (!ccPos) return;
    
    // 커맨드센터 앞에 라인 형성 (입구 막기)
    console.log(`AI containing enemy base with ${combatUnits.length} units!`);
    
    // 내 베이스와 적 베이스 중간 지점
    const myCC = this.getMyBuildings().find(b => 
      b.getComponent<Building>(Building)?.buildingType === BuildingType.HQ
    );
    const myPos = myCC?.getComponent<Position>(Position);
    
    const containX = myPos ? (ccPos.x + myPos.x) / 2 : ccPos.x - 200;
    const containY = myPos ? (ccPos.y + myPos.y) / 2 : ccPos.y;
    
    for (let i = 0; i < combatUnits.length; i++) {
      const unit = combatUnits[i];
      const movement = unit.getComponent<Movement>(Movement);
      const combat = unit.getComponent<Combat>(Combat);
      
      if (movement && combat) {
        // 라인 형성
        const lineOffset = (i - combatUnits.length / 2) * 30;
        combat.startAttackMove(containX + lineOffset, containY);
        movement.setTarget(containX + lineOffset, containY);
      }
    }
    
    this.state = AIState.ATTACKING;
  }
  
  private selectAttackTarget(combatUnits: Entity[], enemies: Entity[]): Entity | null {
    const center = this.getUnitsCenter(combatUnits);
    if (!center) return null;

    let best: Entity | null = null;
    let bestScore = -Infinity;

    for (const enemy of enemies) {
      const pos = enemy.getComponent<Position>(Position);
      if (!pos) continue;
      const dist = Math.hypot(pos.x - center.x, pos.y - center.y);
      const score = this.scoreTarget(enemy, dist);
      if (score > bestScore) {
        bestScore = score;
        best = enemy;
      }
    }

    return best;
  }

  private selectHarassTarget(harassUnits: Entity[], enemyWorkers: Entity[]): Entity {
    const center = this.getUnitsCenter(harassUnits);
    if (!center) return enemyWorkers[Math.floor(Math.random() * enemyWorkers.length)];

    let best = enemyWorkers[0];
    let bestScore = -Infinity;
    for (const worker of enemyWorkers) {
      const pos = worker.getComponent<Position>(Position);
      if (!pos) continue;
      const dist = Math.hypot(pos.x - center.x, pos.y - center.y);
      const hpPercent = this.getEntityHpPercent(worker);
      const score = 60 - dist * 0.04 + (1 - hpPercent) * 12;
      if (score > bestScore) {
        bestScore = score;
        best = worker;
      }
    }

    return best;
  }

  private scoreTarget(enemy: Entity, dist: number): number {
    const building = enemy.getComponent<Building>(Building);
    const unit = enemy.getComponent<Unit>(Unit);
    const hpPercent = this.getEntityHpPercent(enemy);
    let score = 0;

    if (building) {
      if ([BuildingType.BARRACKS, BuildingType.FACTORY].includes(building.buildingType)) {
        score += 120;
      } else if (building.buildingType === BuildingType.HQ) {
        score += 110;
      } else if (BUILDING_STATS[building.buildingType].isDefense) {
        score += 70;
      } else {
        score += 60;
      }
    } else if (unit) {
      if (unit.unitType === UnitType.ENGINEER) {
        score += 75;
      } else {
        score += 50;
      }
    }

    score += (1 - hpPercent) * 20;
    score -= dist * 0.03;

    return score;
  }

  private getEntityHpPercent(entity: Entity): number {
    const unit = entity.getComponent<Unit>(Unit);
    if (unit) {
      return unit.maxHp > 0 ? unit.hp / unit.maxHp : 1;
    }

    const building = entity.getComponent<Building>(Building);
    if (building) {
      return building.maxHp > 0 ? building.hp / building.maxHp : 1;
    }

    return 1;
  }

  private getUnitsCenter(units: Entity[]): { x: number; y: number } | null {
    if (units.length === 0) return null;
    let sumX = 0;
    let sumY = 0;
    let count = 0;
    for (const unit of units) {
      const pos = unit.getComponent<Position>(Position);
      if (!pos) continue;
      sumX += pos.x;
      sumY += pos.y;
      count += 1;
    }
    if (count === 0) return null;
    return { x: sumX / count, y: sumY / count };
  }

  private shouldLaunchMainAttack(
    currentTick: number,
    combatCount: number,
    minCount: number,
    requiredPowerRatio: number,
    intervalMultiplier: number
  ): boolean {
    if (combatCount < minCount) return false;

    const powerRatio = this.getCombatPowerRatio();
    if (powerRatio < requiredPowerRatio) return false;

    const enemyCCCount = this.getEnemyCommandCenters().length;
    let baseInterval = this.attackInterval * intervalMultiplier;
    if (enemyCCCount >= 2 && powerRatio >= 0.95) {
      baseInterval *= 0.8;
    }
    const timeSince = currentTick - this.lastAttackTick;
    if (timeSince >= baseInterval) return true;

    if (powerRatio > 1.4 && timeSince >= this.attackInterval * 0.5) {
      return true;
    }

    return false;
  }
  
  private getCombatUnits(): Entity[] {
    return this.getMyUnits().filter(u => {
      const unit = u.getComponent<Unit>(Unit);
      return unit && unit.unitType !== UnitType.ENGINEER && UNIT_STATS[unit.unitType].category !== UnitCategory.WORKER;
    });
  }

  private getEnemyCombatUnits(): Entity[] {
    return this.getEnemyEntities().filter(e => {
      const unit = e.getComponent<Unit>(Unit);
      return unit && unit.unitType !== UnitType.ENGINEER && UNIT_STATS[unit.unitType].category !== UnitCategory.WORKER;
    });
  }

  private getCombatPowerRatio(): number {
    const myPower = this.getCombatPower(this.getCombatUnits());
    const enemyPower = this.getCombatPower(this.getEnemyCombatUnits());
    if (enemyPower <= 0) return 2;
    return myPower / enemyPower;
  }

  private getCombatPower(units: Entity[]): number {
    let power = 0;
    for (const unitEntity of units) {
      const unit = unitEntity.getComponent<Unit>(Unit);
      if (!unit) continue;
      const stats = UNIT_STATS[unit.unitType];
      const dps = stats.attackSpeed > 0 ? stats.damage / stats.attackSpeed : 0;
      const rangeFactor = Math.max(1, stats.range * 0.6);
      const hpFactor = unit.hp * 0.6 + unit.maxHp * 0.1;
      power += hpFactor + dps * 8 + rangeFactor * 4;
    }
    return power;
  }

  // ==========================================
  // 헬퍼 메서드
  // ==========================================
  
  private getMyUnits(): Entity[] {
    return this.gameState.getAllEntities().filter(e => {
      const owner = e.getComponent<Owner>(Owner);
      const unit = e.getComponent<Unit>(Unit);
      return owner?.playerId === this.playerId && unit && !e.isDestroyed();
    });
  }

  private getMyBuildings(): Entity[] {
    return this.gameState.getAllEntities().filter(e => {
      const owner = e.getComponent<Owner>(Owner);
      const building = e.getComponent<Building>(Building);
      return owner?.playerId === this.playerId && building && !e.isDestroyed();
    });
  }

  private getEnemyEntities(): Entity[] {
    return this.gameState.getAllEntities().filter(e => {
      const owner = e.getComponent<Owner>(Owner);
      return owner && owner.playerId === this.targetPlayerId && !e.isDestroyed();
    });
  }

  getState(): AIState {
    return this.state;
  }
  
  getStrategy(): AIStrategy {
    return this.currentStrategy;
  }
  
  getHarassSquad(): number[] {
    return this._harassSquad;
  }
}
