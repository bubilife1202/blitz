// ==========================================
// ComponentFactory - 컴포넌트 역직렬화 팩토리
// ==========================================

import type { Component } from './ecs/Component';
import { UnitType, BuildingType, ResourceType, type ComponentType } from '@shared/types';

import { Position } from './components/Position';
import { Selectable } from './components/Selectable';
import { Owner } from './components/Owner';
import { Unit } from './components/Unit';
import { Building } from './components/Building';
import { Movement } from './components/Movement';
import { Combat } from './components/Combat';
import { Gatherer } from './components/Gatherer';
import { Resource } from './components/Resource';
import { ProductionQueue } from './components/ProductionQueue';
import { ResearchQueue } from './components/ResearchQueue';

// 타입 검증 헬퍼 함수
function isValidUnitType(value: string): value is UnitType {
  return Object.values(UnitType).includes(value as UnitType);
}

function isValidBuildingType(value: string): value is BuildingType {
  return Object.values(BuildingType).includes(value as BuildingType);
}

function isValidResourceType(value: string): value is ResourceType {
  return Object.values(ResourceType).includes(value as ResourceType);
}

// 컴포넌트 타입별 팩토리 함수
type ComponentDeserializer = (data: unknown) => Component;

const componentFactories: Record<ComponentType, ComponentDeserializer> = {
  position: (data) => {
    const d = data as { x: number; y: number };
    return new Position(d.x, d.y);
  },
  selectable: (data) => {
    const d = data as { radius: number };
    return new Selectable(d.radius);
  },
  owner: (data) => {
    const d = data as { playerId: number };
    return new Owner(d.playerId);
  },
  unit: (data) => {
    const d = data as { unitType: string };
    if (!isValidUnitType(d.unitType)) {
      throw new Error(`Invalid unit type: ${d.unitType}`);
    }
    const unit = new Unit(d.unitType);
    unit.deserialize(data);
    return unit;
  },
  building: (data) => {
    const d = data as { buildingType: string; isConstructing: boolean };
    if (!isValidBuildingType(d.buildingType)) {
      throw new Error(`Invalid building type: ${d.buildingType}`);
    }
    const building = new Building(d.buildingType, !d.isConstructing);
    building.deserialize(data);
    return building;
  },
  movement: (data) => {
    const d = data as { speed: number };
    const movement = new Movement(d.speed);
    movement.deserialize(data);
    return movement;
  },
  combat: (data) => {
    const combat = new Combat();
    combat.deserialize(data);
    return combat;
  },
  gatherer: (data) => {
    const d = data as { carryingCapacity: number };
    const gatherer = new Gatherer(d.carryingCapacity);
    gatherer.deserialize(data);
    return gatherer;
  },
  resource: (data) => {
    const d = data as { resourceType: string; maxAmount: number; gatherRate: number };
    if (!isValidResourceType(d.resourceType)) {
      throw new Error(`Invalid resource type: ${d.resourceType}`);
    }
    const resource = new Resource(d.resourceType, d.maxAmount, d.gatherRate);
    resource.deserialize(data);
    return resource;
  },
  productionQueue: (data) => {
    const d = data as { maxQueueSize: number };
    const queue = new ProductionQueue(d.maxQueueSize);
    queue.deserialize(data);
    return queue;
  },
  researchQueue: (data) => {
    const queue = new ResearchQueue();
    queue.deserialize(data);
    return queue;
  },
};

export function createComponentFromData(type: ComponentType, data: unknown): Component | null {
  const factory = componentFactories[type];
  if (!factory) {
    console.warn(`Unknown component type: ${type}`);
    return null;
  }
  try {
    return factory(data);
  } catch (e) {
    console.error(`Failed to deserialize component ${type}:`, e);
    return null;
  }
}

export function isKnownComponentType(type: string): type is ComponentType {
  return type in componentFactories;
}
