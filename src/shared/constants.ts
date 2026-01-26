// ==========================================
// 게임 상수 정의
// ==========================================

import { BuildingType, UnitType, UpgradeType, UnitCategory, type GameConfig } from './types';

// 기본 게임 설정
export const DEFAULT_GAME_CONFIG: GameConfig = {
  mapWidth: 128,      // 타일 단위
  mapHeight: 128,
  tileSize: 32,       // 픽셀 단위
  tickRate: 16,       // 초당 16틱 (약 62.5ms 간격)
};

// ==========================================
// 시간 단위 변환 헬퍼 함수
// ==========================================
// buildTime, researchTime 등은 "초" 단위로 정의됨
// 시스템에서 사용 시 틱으로 변환 필요

export const TICK_RATE = DEFAULT_GAME_CONFIG.tickRate;

/** 초를 틱으로 변환 */
export function secondsToTicks(seconds: number): number {
  return Math.round(seconds * TICK_RATE);
}

/** 틱을 초로 변환 */
export function ticksToSeconds(ticks: number): number {
  return ticks / TICK_RATE;
}

/** 초당 값을 틱당 값으로 변환 (예: DPS → DPT) */
export function perSecondToPerTick(valuePerSecond: number): number {
  return valuePerSecond / TICK_RATE;
}

/** 틱당 값을 초당 값으로 변환 */
export function perTickToPerSecond(valuePerTick: number): number {
  return valuePerTick * TICK_RATE;
}

// 자원 관련
export const INITIAL_MINERALS = 50;
export const INITIAL_GAS = 0;
export const INITIAL_SUPPLY = 0;
export const INITIAL_SUPPLY_MAX = 10;

// 유닛 스탯
export const UNIT_STATS: Record<UnitType, {
  hp: number;
  armor: number;
  damage: number;
  attackSpeed: number;
  moveSpeed: number;
  range: number;
  buildTime: number;
  mineralCost: number;
  gasCost: number;
  supplyCost: number;
  category: UnitCategory;
  requires?: BuildingType[];
  isHealer?: boolean;
  healRate?: number;
  splashDamage?: boolean;
  splashRadius?: number;
  canSiege?: boolean;
  siegeDamage?: number;
  siegeRange?: number;
  visionRange: number;
}> = {
  [UnitType.ENGINEER]: {
    hp: 60,
    armor: 0,
    damage: 5,
    attackSpeed: 1.0,
    moveSpeed: 2.8,
    range: 1,
    buildTime: 20,
    mineralCost: 50,
    gasCost: 0,
    supplyCost: 1,
    category: UnitCategory.WORKER,
    visionRange: 7,
  },
  [UnitType.TROOPER]: {
    hp: 40,
    armor: 0,
    damage: 6,
    attackSpeed: 0.86,
    moveSpeed: 2.8,
    range: 4,
    buildTime: 24,
    mineralCost: 50,
    gasCost: 0,
    supplyCost: 1,
    category: UnitCategory.INFANTRY,
    visionRange: 9,
  },
  [UnitType.PYRO]: {
    hp: 50,
    armor: 1,
    damage: 8,
    attackSpeed: 0.9,
    moveSpeed: 2.8,
    range: 1,
    buildTime: 24,
    mineralCost: 50,
    gasCost: 25,
    supplyCost: 1,
    category: UnitCategory.INFANTRY,
    requires: [BuildingType.TECH_LAB],
    splashDamage: true,
    splashRadius: 1.5,
    visionRange: 8,
  },
  [UnitType.MEDIC]: {
    hp: 60,
    armor: 1,
    damage: 0,
    attackSpeed: 0,
    moveSpeed: 2.8,
    range: 2,
    buildTime: 30,
    mineralCost: 50,
    gasCost: 25,
    supplyCost: 1,
    category: UnitCategory.INFANTRY,
    requires: [BuildingType.TECH_LAB],
    isHealer: true,
    healRate: 5, // HP per tick
    visionRange: 9,
  },
  [UnitType.SPEEDER]: {
    hp: 80,
    armor: 0,
    damage: 20,
    attackSpeed: 1.2,
    moveSpeed: 4.5,
    range: 5,
    buildTime: 30,
    mineralCost: 75,
    gasCost: 0,
    supplyCost: 2,
    category: UnitCategory.VEHICLE,
    visionRange: 8,
  },
  [UnitType.ARTILLERY]: {
    hp: 150,
    armor: 1,
    damage: 30,
    attackSpeed: 1.5,
    moveSpeed: 2.2,
    range: 7,
    buildTime: 50,
    mineralCost: 150,
    gasCost: 100,
    supplyCost: 2,
    category: UnitCategory.VEHICLE,
    requires: [BuildingType.ARMORY],
    canSiege: true,
    siegeDamage: 70,
    siegeRange: 12,
    splashDamage: true,
    splashRadius: 2,
    visionRange: 10,
  },
  [UnitType.WALKER]: {
    hp: 125,
    armor: 1,
    damage: 12,
    attackSpeed: 0.9,
    moveSpeed: 2.6,
    range: 5,
    buildTime: 40,
    mineralCost: 100,
    gasCost: 50,
    supplyCost: 2,
    category: UnitCategory.VEHICLE,
    requires: [BuildingType.ARMORY],
    visionRange: 8,
  },
};

// 건물 스탯
export const BUILDING_STATS: Record<BuildingType, {
  hp: number;
  armor: number;
  buildTime: number;
  mineralCost: number;
  gasCost: number;
  supplyProvided: number;
  size: { width: number; height: number };
  requires?: BuildingType[];
  canProduce?: UnitType[];
  canResearch?: UpgradeType[];
  visionRange: number;
  isDefense?: boolean;
  damage?: number;
  range?: number;
  attackSpeed?: number;
}> = {
  [BuildingType.HQ]: {
    hp: 1500,
    armor: 1,
    buildTime: 100,
    mineralCost: 400,
    gasCost: 0,
    supplyProvided: 10,
    size: { width: 4, height: 3 },
    canProduce: [UnitType.ENGINEER],
    visionRange: 11,
  },
  [BuildingType.DEPOT]: {
    hp: 500,
    armor: 1,
    buildTime: 40,
    mineralCost: 100,
    gasCost: 0,
    supplyProvided: 8,
    size: { width: 2, height: 2 },
    visionRange: 7,
  },
  [BuildingType.REFINERY]: {
    hp: 750,
    armor: 1,
    buildTime: 40,
    mineralCost: 100,
    gasCost: 0,
    supplyProvided: 0,
    size: { width: 3, height: 2 },
    visionRange: 7,
  },
  [BuildingType.BARRACKS]: {
    hp: 1000,
    armor: 1,
    buildTime: 60,
    mineralCost: 150,
    gasCost: 0,
    supplyProvided: 0,
    size: { width: 3, height: 3 },
    canProduce: [UnitType.TROOPER, UnitType.PYRO, UnitType.MEDIC],
    visionRange: 9,
  },
  [BuildingType.FACTORY]: {
    hp: 1250,
    armor: 1,
    buildTime: 80,
    mineralCost: 200,
    gasCost: 100,
    supplyProvided: 0,
    size: { width: 4, height: 3 },
    requires: [BuildingType.BARRACKS],
    canProduce: [UnitType.SPEEDER, UnitType.ARTILLERY, UnitType.WALKER],
    visionRange: 9,
  },
  [BuildingType.TECH_LAB]: {
    hp: 850,
    armor: 1,
    buildTime: 60,
    mineralCost: 125,
    gasCost: 0,
    supplyProvided: 0,
    size: { width: 3, height: 2 },
    canResearch: [
      UpgradeType.INFANTRY_WEAPONS_1, UpgradeType.INFANTRY_WEAPONS_2, UpgradeType.INFANTRY_WEAPONS_3,
      UpgradeType.INFANTRY_ARMOR_1, UpgradeType.INFANTRY_ARMOR_2, UpgradeType.INFANTRY_ARMOR_3,
      UpgradeType.STIM_PACK, UpgradeType.EXTENDED_RANGE,
    ],
    visionRange: 8,
  },
  [BuildingType.ARMORY]: {
    hp: 750,
    armor: 1,
    buildTime: 60,
    mineralCost: 100,
    gasCost: 50,
    supplyProvided: 0,
    size: { width: 3, height: 2 },
    requires: [BuildingType.FACTORY],
    canResearch: [
      UpgradeType.VEHICLE_WEAPONS_1, UpgradeType.VEHICLE_WEAPONS_2, UpgradeType.VEHICLE_WEAPONS_3,
      UpgradeType.VEHICLE_ARMOR_1, UpgradeType.VEHICLE_ARMOR_2, UpgradeType.VEHICLE_ARMOR_3,
      UpgradeType.BOMBARDMENT_MODE, UpgradeType.BOOSTERS,
    ],
    visionRange: 8,
  },
  [BuildingType.BUNKER]: {
    hp: 350,
    armor: 1,
    buildTime: 30,
    mineralCost: 100,
    gasCost: 0,
    supplyProvided: 0,
    size: { width: 2, height: 2 },
    requires: [BuildingType.BARRACKS],
    visionRange: 8,
    isDefense: true,
  },
  [BuildingType.TURRET]: {
    hp: 200,
    armor: 0,
    buildTime: 30,
    mineralCost: 75,
    gasCost: 0,
    supplyProvided: 0,
    size: { width: 2, height: 2 },
    requires: [BuildingType.TECH_LAB],
    visionRange: 11,
    isDefense: true,
    damage: 20,
    range: 7,
    attackSpeed: 1.0,
  },
};

// 업그레이드 스탯
export const UPGRADE_STATS: Record<UpgradeType, {
  mineralCost: number;
  gasCost: number;
  researchTime: number;
  building: BuildingType;
  requires?: UpgradeType[];
  effect: {
    damageBonus?: number;
    armorBonus?: number;
    rangeBonus?: number;
    speedBonus?: number;
    special?: string;
  };
}> = {
  // Infantry Weapons
  [UpgradeType.INFANTRY_WEAPONS_1]: {
    mineralCost: 100,
    gasCost: 100,
    researchTime: 160,
    building: BuildingType.TECH_LAB,
    effect: { damageBonus: 1 },
  },
  [UpgradeType.INFANTRY_WEAPONS_2]: {
    mineralCost: 175,
    gasCost: 175,
    researchTime: 190,
    building: BuildingType.TECH_LAB,
    requires: [UpgradeType.INFANTRY_WEAPONS_1],
    effect: { damageBonus: 1 },
  },
  [UpgradeType.INFANTRY_WEAPONS_3]: {
    mineralCost: 250,
    gasCost: 250,
    researchTime: 220,
    building: BuildingType.TECH_LAB,
    requires: [UpgradeType.INFANTRY_WEAPONS_2],
    effect: { damageBonus: 1 },
  },
  // Infantry Armor
  [UpgradeType.INFANTRY_ARMOR_1]: {
    mineralCost: 100,
    gasCost: 100,
    researchTime: 160,
    building: BuildingType.TECH_LAB,
    effect: { armorBonus: 1 },
  },
  [UpgradeType.INFANTRY_ARMOR_2]: {
    mineralCost: 175,
    gasCost: 175,
    researchTime: 190,
    building: BuildingType.TECH_LAB,
    requires: [UpgradeType.INFANTRY_ARMOR_1],
    effect: { armorBonus: 1 },
  },
  [UpgradeType.INFANTRY_ARMOR_3]: {
    mineralCost: 250,
    gasCost: 250,
    researchTime: 220,
    building: BuildingType.TECH_LAB,
    requires: [UpgradeType.INFANTRY_ARMOR_2],
    effect: { armorBonus: 1 },
  },
  // Vehicle Weapons
  [UpgradeType.VEHICLE_WEAPONS_1]: {
    mineralCost: 100,
    gasCost: 100,
    researchTime: 160,
    building: BuildingType.ARMORY,
    effect: { damageBonus: 2 },
  },
  [UpgradeType.VEHICLE_WEAPONS_2]: {
    mineralCost: 175,
    gasCost: 175,
    researchTime: 190,
    building: BuildingType.ARMORY,
    requires: [UpgradeType.VEHICLE_WEAPONS_1],
    effect: { damageBonus: 2 },
  },
  [UpgradeType.VEHICLE_WEAPONS_3]: {
    mineralCost: 250,
    gasCost: 250,
    researchTime: 220,
    building: BuildingType.ARMORY,
    requires: [UpgradeType.VEHICLE_WEAPONS_2],
    effect: { damageBonus: 2 },
  },
  // Vehicle Armor
  [UpgradeType.VEHICLE_ARMOR_1]: {
    mineralCost: 100,
    gasCost: 100,
    researchTime: 160,
    building: BuildingType.ARMORY,
    effect: { armorBonus: 1 },
  },
  [UpgradeType.VEHICLE_ARMOR_2]: {
    mineralCost: 175,
    gasCost: 175,
    researchTime: 190,
    building: BuildingType.ARMORY,
    requires: [UpgradeType.VEHICLE_ARMOR_1],
    effect: { armorBonus: 1 },
  },
  [UpgradeType.VEHICLE_ARMOR_3]: {
    mineralCost: 250,
    gasCost: 250,
    researchTime: 220,
    building: BuildingType.ARMORY,
    requires: [UpgradeType.VEHICLE_ARMOR_2],
    effect: { armorBonus: 1 },
  },
  // Special Upgrades
  [UpgradeType.STIM_PACK]: {
    mineralCost: 100,
    gasCost: 100,
    researchTime: 120,
    building: BuildingType.TECH_LAB,
    effect: { special: 'stim_pack' },
  },
  [UpgradeType.EXTENDED_RANGE]: {
    mineralCost: 150,
    gasCost: 150,
    researchTime: 100,
    building: BuildingType.TECH_LAB,
    effect: { rangeBonus: 1 },
  },
  [UpgradeType.BOMBARDMENT_MODE]: {
    mineralCost: 150,
    gasCost: 150,
    researchTime: 120,
    building: BuildingType.ARMORY,
    effect: { special: 'siege_mode' },
  },
  [UpgradeType.BOOSTERS]: {
    mineralCost: 100,
    gasCost: 100,
    researchTime: 100,
    building: BuildingType.ARMORY,
    effect: { speedBonus: 1.5 },
  },
};

// 자원 노드
export const MINERAL_AMOUNT = 1500;
export const GAS_AMOUNT = 2500;
export const MINERAL_GATHER_RATE = 8; // 틱당 채취량
export const GAS_GATHER_RATE = 4;

// 전투 관련
export const AGGRO_RANGE = 7; // 타일 단위

// 이동 관련
export const MOVEMENT_ARRIVAL_THRESHOLD_BASE = 5; // 픽셀 단위
export const MOVEMENT_ARRIVAL_THRESHOLD_MULTIPLIER = 1.5;
export const STIM_MOVE_SPEED_MULTIPLIER = 1.5; // 스팀팩 이동속도 보너스
export const UNIT_SEPARATION_RADIUS = 20; // 유닛 분리 반경 (픽셀)
export const UNIT_SEPARATION_FORCE = 0.3; // 분리 힘 강도

// 테크 트리 검증 헬퍼
export function canBuildBuilding(
  buildingType: BuildingType,
  playerBuildings: BuildingType[]
): boolean {
  const stats = BUILDING_STATS[buildingType];
  if (!stats.requires || stats.requires.length === 0) {
    return true;
  }
  return stats.requires.every(req => playerBuildings.includes(req));
}

export function canTrainUnit(
  unitType: UnitType,
  playerBuildings: BuildingType[]
): boolean {
  const stats = UNIT_STATS[unitType];
  if (!stats.requires || stats.requires.length === 0) {
    return true;
  }
  return stats.requires.every(req => playerBuildings.includes(req));
}

export function canResearchUpgrade(
  upgradeType: UpgradeType,
  completedUpgrades: UpgradeType[]
): boolean {
  const stats = UPGRADE_STATS[upgradeType];
  if (!stats.requires || stats.requires.length === 0) {
    return true;
  }
  return stats.requires.every(req => completedUpgrades.includes(req));
}
