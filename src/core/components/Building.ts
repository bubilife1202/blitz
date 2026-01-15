// ==========================================
// Building 컴포넌트 - 건물 정보
// ==========================================

import { Component } from '../ecs/Component';
import { BuildingType } from '@shared/types';
import { BUILDING_STATS } from '@shared/constants';

export interface BuildingData {
  buildingType: BuildingType;
  hp: number;
  maxHp: number;
  isConstructing: boolean;
  constructionProgress: number;
  rallyPointX: number | null;
  rallyPointY: number | null;
  linkedGeyserId: number | null;
  // Bunker 관련
  garrisonedUnits: number[];
  maxGarrison: number;
}

export class Building extends Component {
  static readonly type = 'building';

  public buildingType: BuildingType;
  public hp: number;
  public maxHp: number;
  public isConstructing: boolean;
  public constructionProgress: number; // 0-100
  public rallyPointX: number | null = null;
  public rallyPointY: number | null = null;
  public width: number;
  public height: number;
  public linkedGeyserId: number | null = null; // Refinery용 - 연결된 가스 간헐천 ID
  
  // Bunker 관련
  public garrisonedUnits: number[] = []; // 탑승한 유닛 ID 목록
  public maxGarrison: number = 0; // 최대 탑승 가능 유닛 수 (Bunker: 4)

  constructor(buildingType: BuildingType, startConstructed: boolean = false) {
    super();
    this.buildingType = buildingType;

    const stats = BUILDING_STATS[buildingType];
    this.maxHp = stats.hp;
    this.hp = startConstructed ? stats.hp : stats.hp * 0.1;
    this.isConstructing = !startConstructed;
    this.constructionProgress = startConstructed ? 100 : 0;
    this.width = stats.size.width;
    this.height = stats.size.height;
    
    // Bunker 탑승 가능 유닛 수 설정
    if (buildingType === BuildingType.BUNKER) {
      this.maxGarrison = 4;
    }
  }
  
  // Bunker 탑승/하차 메서드
  canGarrison(): boolean {
    return this.buildingType === BuildingType.BUNKER && 
           !this.isConstructing && 
           this.garrisonedUnits.length < this.maxGarrison;
  }
  
  garrisonUnit(unitId: number): boolean {
    if (!this.canGarrison()) return false;
    this.garrisonedUnits.push(unitId);
    return true;
  }
  
  ungarrisonUnit(unitId: number): boolean {
    const index = this.garrisonedUnits.indexOf(unitId);
    if (index === -1) return false;
    this.garrisonedUnits.splice(index, 1);
    return true;
  }
  
  ungarrisonAll(): number[] {
    const units = [...this.garrisonedUnits];
    this.garrisonedUnits = [];
    return units;
  }
  
  getGarrisonCount(): number {
    return this.garrisonedUnits.length;
  }

  addConstructionProgress(amount: number): void {
    if (!this.isConstructing) return;
    
    this.constructionProgress = Math.min(100, this.constructionProgress + amount);
    
    // HP도 비례해서 증가
    const stats = BUILDING_STATS[this.buildingType];
    this.hp = stats.hp * (0.1 + 0.9 * (this.constructionProgress / 100));
    
    if (this.constructionProgress >= 100) {
      this.isConstructing = false;
      this.hp = this.maxHp;
    }
  }

  takeDamage(amount: number): number {
    const stats = BUILDING_STATS[this.buildingType];
    const actualDamage = Math.max(0, amount - stats.armor);
    this.hp = Math.max(0, this.hp - actualDamage);
    return actualDamage;
  }

  isDestroyed(): boolean {
    return this.hp <= 0;
  }

  setRallyPoint(x: number, y: number): void {
    this.rallyPointX = x;
    this.rallyPointY = y;
  }

  serialize(): BuildingData {
    return {
      buildingType: this.buildingType,
      hp: this.hp,
      maxHp: this.maxHp,
      isConstructing: this.isConstructing,
      constructionProgress: this.constructionProgress,
      rallyPointX: this.rallyPointX,
      rallyPointY: this.rallyPointY,
      linkedGeyserId: this.linkedGeyserId,
      garrisonedUnits: [...this.garrisonedUnits],
      maxGarrison: this.maxGarrison,
    };
  }

  deserialize(data: unknown): void {
    const d = data as BuildingData;
    this.buildingType = d.buildingType;
    this.hp = d.hp;
    this.maxHp = d.maxHp;
    this.isConstructing = d.isConstructing;
    this.constructionProgress = d.constructionProgress;
    this.rallyPointX = d.rallyPointX;
    this.rallyPointY = d.rallyPointY;
    this.linkedGeyserId = d.linkedGeyserId;
    this.garrisonedUnits = d.garrisonedUnits || [];
    this.maxGarrison = d.maxGarrison || 0;
  }

  clone(): Building {
    const b = new Building(this.buildingType, !this.isConstructing);
    b.hp = this.hp;
    b.constructionProgress = this.constructionProgress;
    b.rallyPointX = this.rallyPointX;
    b.rallyPointY = this.rallyPointY;
    b.linkedGeyserId = this.linkedGeyserId;
    b.garrisonedUnits = [...this.garrisonedUnits];
    b.maxGarrison = this.maxGarrison;
    return b;
  }
}
