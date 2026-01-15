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
  [UnitType.SCV]: {
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
  [UnitType.MARINE]: {
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
  [UnitType.FIREBAT]: {
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
    requires: [BuildingType.ENGINEERING_BAY],
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
    requires: [BuildingType.ENGINEERING_BAY],
    isHealer: true,
    healRate: 5, // HP per tick
    visionRange: 9,
  },
  [UnitType.VULTURE]: {
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
  [UnitType.SIEGE_TANK]: {
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
  [UnitType.GOLIATH]: {
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
  [BuildingType.COMMAND_CENTER]: {
    hp: 1500,
    armor: 1,
    buildTime: 100,
    mineralCost: 400,
    gasCost: 0,
    supplyProvided: 10,
    size: { width: 4, height: 3 },
    canProduce: [UnitType.SCV],
    visionRange: 11,
  },
  [BuildingType.SUPPLY_DEPOT]: {
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
    canProduce: [UnitType.MARINE, UnitType.FIREBAT, UnitType.MEDIC],
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
    canProduce: [UnitType.VULTURE, UnitType.SIEGE_TANK, UnitType.GOLIATH],
    visionRange: 9,
  },
  [BuildingType.ENGINEERING_BAY]: {
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
      UpgradeType.STIM_PACK, UpgradeType.U238_SHELLS,
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
      UpgradeType.SIEGE_TECH, UpgradeType.ION_THRUSTERS,
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
  [BuildingType.MISSILE_TURRET]: {
    hp: 200,
    armor: 0,
    buildTime: 30,
    mineralCost: 75,
    gasCost: 0,
    supplyProvided: 0,
    size: { width: 2, height: 2 },
    requires: [BuildingType.ENGINEERING_BAY],
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
    building: BuildingType.ENGINEERING_BAY,
    effect: { damageBonus: 1 },
  },
  [UpgradeType.INFANTRY_WEAPONS_2]: {
    mineralCost: 175,
    gasCost: 175,
    researchTime: 190,
    building: BuildingType.ENGINEERING_BAY,
    requires: [UpgradeType.INFANTRY_WEAPONS_1],
    effect: { damageBonus: 1 },
  },
  [UpgradeType.INFANTRY_WEAPONS_3]: {
    mineralCost: 250,
    gasCost: 250,
    researchTime: 220,
    building: BuildingType.ENGINEERING_BAY,
    requires: [UpgradeType.INFANTRY_WEAPONS_2],
    effect: { damageBonus: 1 },
  },
  // Infantry Armor
  [UpgradeType.INFANTRY_ARMOR_1]: {
    mineralCost: 100,
    gasCost: 100,
    researchTime: 160,
    building: BuildingType.ENGINEERING_BAY,
    effect: { armorBonus: 1 },
  },
  [UpgradeType.INFANTRY_ARMOR_2]: {
    mineralCost: 175,
    gasCost: 175,
    researchTime: 190,
    building: BuildingType.ENGINEERING_BAY,
    requires: [UpgradeType.INFANTRY_ARMOR_1],
    effect: { armorBonus: 1 },
  },
  [UpgradeType.INFANTRY_ARMOR_3]: {
    mineralCost: 250,
    gasCost: 250,
    researchTime: 220,
    building: BuildingType.ENGINEERING_BAY,
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
    building: BuildingType.ENGINEERING_BAY,
    effect: { special: 'stim_pack' },
  },
  [UpgradeType.U238_SHELLS]: {
    mineralCost: 150,
    gasCost: 150,
    researchTime: 100,
    building: BuildingType.ENGINEERING_BAY,
    effect: { rangeBonus: 1 },
  },
  [UpgradeType.SIEGE_TECH]: {
    mineralCost: 150,
    gasCost: 150,
    researchTime: 120,
    building: BuildingType.ARMORY,
    effect: { special: 'siege_mode' },
  },
  [UpgradeType.ION_THRUSTERS]: {
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
