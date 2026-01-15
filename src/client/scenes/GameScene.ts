// ==========================================
// GameScene - 메인 게임 씬
// ==========================================

import Phaser from 'phaser';
import { GameState } from '@core/GameState';
import { GameLoop } from '@core/GameLoop';
import { LocalHost } from '@host/LocalHost';
import { PathfindingService } from '@core/PathfindingService';
import { MovementSystem } from '@core/systems/MovementSystem';
import { GatherSystem } from '@core/systems/GatherSystem';
import { ProductionSystem } from '@core/systems/ProductionSystem';
import { CombatSystem } from '@core/systems/CombatSystem';
import { ConstructionSystem } from '@core/systems/ConstructionSystem';
import { BuilderSystem } from '@core/systems/BuilderSystem';
import { HealSystem } from '@core/systems/HealSystem';
import { VisionSystem } from '@core/systems/VisionSystem';
import { ResearchSystem } from '@core/systems/ResearchSystem';
import { DefenseSystem } from '@core/systems/DefenseSystem';
import { AIController } from '@core/AIController';
import { UnitRenderer } from '../renderer/UnitRenderer';
import { BuildingRenderer } from '../renderer/BuildingRenderer';
import { ResourceRenderer } from '../renderer/ResourceRenderer';
import { FogRenderer } from '../renderer/FogRenderer';
import { EffectsRenderer } from '../renderer/EffectsRenderer';
import { SelectionManager } from '../input/SelectionManager';
import { CommandManager } from '../input/CommandManager';
import { BuildingPlacer } from '../input/BuildingPlacer';
import { Minimap } from '../ui/Minimap';
import { HUD } from '../ui/HUD';
import { PauseMenu } from '../ui/PauseMenu';
import { Position } from '@core/components/Position';
import { Owner } from '@core/components/Owner';
import { Building } from '@core/components/Building';
import { ProductionQueue } from '@core/components/ProductionQueue';
import { Unit } from '@core/components/Unit';
import { Race, BuildingType, UnitType, UpgradeType, AIDifficulty } from '@shared/types';
import { UNIT_STATS, UPGRADE_STATS, BUILDING_STATS } from '@shared/constants';
import { ResearchQueue } from '@core/components/ResearchQueue';
import { combatEvents } from '@core/events/CombatEvents';
import { soundManager } from '../audio/SoundManager';

interface GameSceneData {
  mode: 'single' | 'multi';
  difficulty?: AIDifficulty;
}

export class GameScene extends Phaser.Scene {
  private gameState!: GameState;
  private gameLoop!: GameLoop;
  private localHost!: LocalHost;
  private pathfinding!: PathfindingService;
  private aiController!: AIController;
  
  // 렌더러
  private unitRenderer!: UnitRenderer;
  private buildingRenderer!: BuildingRenderer;
  private resourceRenderer!: ResourceRenderer;
  private fogRenderer!: FogRenderer;
  private effectsRenderer!: EffectsRenderer;
  
  // 시야 시스템 참조 (FogRenderer용)
  private visionSystem!: VisionSystem;
  
  // 입력 매니저
  private selectionManager!: SelectionManager;
  public commandManager!: CommandManager;
  private buildingPlacer!: BuildingPlacer;
  
  // UI
  private minimap!: Minimap;
  private hud!: HUD;
  private pauseMenu!: PauseMenu;
  private gameOverText!: Phaser.GameObjects.Text;
  private isPaused: boolean = false;
  private aiDifficulty: AIDifficulty = AIDifficulty.NORMAL;
  
  // 카메라 드래그
  private isDragging: boolean = false;
  private dragStartX: number = 0;
  private dragStartY: number = 0;

  // 방향키 카메라 이동
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private cameraZoom: number = 1;

  constructor() {
    super({ key: 'GameScene' });
  }

  init(data: GameSceneData): void {
    console.log('GameScene init, mode:', data.mode, 'difficulty:', data.difficulty);
    this.aiDifficulty = data.difficulty || AIDifficulty.NORMAL;
  }

  create(): void {
    // 게임 상태 초기화
    this.gameState = new GameState();
    
    // 패스파인딩 서비스 초기화
    this.pathfinding = new PathfindingService(this.gameState.config);
    
    // 로컬 호스트 초기화 (싱글플레이어)
    this.localHost = new LocalHost(this.gameState, this.pathfinding);
    
    // 플레이어 추가
    this.gameState.addPlayer(1, Race.TERRAN);
    this.gameState.addPlayer(2, Race.TERRAN); // AI
    
    // 시스템 등록 (우선순위 순서)
    this.visionSystem = new VisionSystem();
    this.gameState.addSystem(this.visionSystem); // 시야 시스템 (먼저)
    this.gameState.addSystem(new MovementSystem());
    this.gameState.addSystem(new GatherSystem());
    
    // BuilderSystem (SCV 건설 처리) - ConstructionSystem 전에 실행
    const builderSystem = new BuilderSystem();
    builderSystem.setPathfindingService(this.pathfinding);
    this.gameState.addSystem(builderSystem);
    
    this.gameState.addSystem(new ConstructionSystem());
    this.gameState.addSystem(new ProductionSystem());
    this.gameState.addSystem(new ResearchSystem()); // 연구 시스템
    this.gameState.addSystem(new HealSystem()); // 메딕 치료 시스템
    this.gameState.addSystem(new DefenseSystem()); // 방어 건물 공격 시스템
    this.gameState.addSystem(new CombatSystem());
    
    // AI 컨트롤러 (패스파인딩 연결)
    this.aiController = new AIController(this.gameState, 2, this.pathfinding, this.aiDifficulty);
    
    // 게임 루프 초기화
    this.gameLoop = new GameLoop(this.gameState, {
      onTick: (tick) => this.onGameTick(tick),
    });

    // 맵 렌더링
    this.renderMap();
    
    // 렌더러 초기화 (시야 시스템 연결)
    this.unitRenderer = new UnitRenderer(this, 1, this.visionSystem);
    this.buildingRenderer = new BuildingRenderer(this, 1, this.visionSystem);
    this.resourceRenderer = new ResourceRenderer(this);
    this.fogRenderer = new FogRenderer(this, this.visionSystem, 1);
    this.effectsRenderer = new EffectsRenderer(this);
    
    // 입력 매니저 초기화
    this.selectionManager = new SelectionManager(this, this.gameState, 1);
    this.commandManager = new CommandManager(
      this,
      this.gameState,
      this.selectionManager,
      this.pathfinding,
      1
    );
    
    // 건물 배치 매니저 초기화
    this.buildingPlacer = new BuildingPlacer(
      this,
      this.gameState,
      this.pathfinding,
      this.selectionManager,
      1
    );
    
    // 초기 유닛/건물 배치
    this.localHost.setupInitialEntities();
    
    // 카메라 드래그 입력 설정
    this.setupCameraInput();
    
    // 미니맵 설정 (200x200으로 확대)
    this.minimap = new Minimap(
      this,
      this.gameState,
      10,
      this.scale.height - 210,
      200,
      200
    );
    this.minimap.onMinimapClick = (x, y) => {
      this.cameras.main.centerOn(x, y);
    };
    
    // HUD 설정
    this.hud = new HUD(this, this.gameState, this.selectionManager);
    this.hud.onBuildCommand = (buildingType: BuildingType) => {
      this.buildingPlacer.startPlacement(buildingType);
    };
    this.hud.onTrainCommand = (unitType: UnitType) => {
      this.trainUnit(unitType);
    };
    this.hud.onSiegeCommand = () => {
      this.toggleSiegeMode();
    };
    this.hud.onStimCommand = () => {
      this.activateStimPack();
    };
    this.hud.onResearchCommand = (upgradeType: UpgradeType) => {
      this.startResearch(upgradeType);
    };
    
    // 카메라 설정
    this.setupCamera();
    
    // 게임 오버 텍스트 (숨김)
    this.gameOverText = this.add.text(
      this.scale.width / 2,
      this.scale.height / 2,
      '',
      { fontSize: '48px', color: '#ffffff', backgroundColor: '#000000' }
    );
    this.gameOverText.setOrigin(0.5);
    this.gameOverText.setScrollFactor(0);
    this.gameOverText.setDepth(5000);
    this.gameOverText.setVisible(false);
    
    // 일시정지 메뉴 설정
    this.pauseMenu = new PauseMenu(this);
    this.pauseMenu.onResume = () => this.resumeGame();
    this.pauseMenu.onRestart = () => this.restartGame();
    this.pauseMenu.onMainMenu = () => this.goToMainMenu();
    this.pauseMenu.onSettings = () => {
      // 설정 메뉴 (추후 구현)
      console.log('Settings - not implemented yet');
    };
    
    // 전투 이벤트 구독 (이펙트 연동)
    this.setupCombatEventListeners();
    
    // 게임 시작
    this.gameLoop.start();
    
    console.log('Game started!');
  }

  update(_time: number, _delta: number): void {
    if (this.gameState.isGameOver()) return;
    if (this.isPaused) return;
    
    // 패스파인딩 계산 처리
    this.pathfinding.update();
    
    // 엔티티 렌더링 업데이트
    const entities = this.gameState.getAllEntities();
    this.unitRenderer.updateEntities(entities);
    this.buildingRenderer.updateEntities(entities);
    this.resourceRenderer.updateEntities(entities);
    
    // 미니맵 업데이트
    this.minimap.update();
    
    // 안개 전쟁 업데이트
    this.fogRenderer.update();
    
    // 이펙트 업데이트
    this.effectsRenderer.update();
    
    // HUD 업데이트
    this.hud.update();
    
    // 카메라 업데이트
    this.updateCamera();
    
    // 승리/패배 체크
    this.checkGameOver();
  }

  // 게임 틱 콜백
  private onGameTick(tick: number): void {
    // AI 업데이트 (10틱마다)
    if (tick % 10 === 0) {
      this.aiController.update();
    }
  }

  // ==========================================
  // 일시정지 관련 메서드
  // ==========================================

  private togglePause(): void {
    if (this.isPaused) {
      this.resumeGame();
    } else {
      this.pauseGame();
    }
  }

  private pauseGame(): void {
    this.isPaused = true;
    this.gameLoop.stop();
    this.commandManager.setPaused(true);
    this.pauseMenu.show();
  }

  private resumeGame(): void {
    this.isPaused = false;
    this.commandManager.setPaused(false);
    this.pauseMenu.hide();
    this.gameLoop.start();
  }

  private restartGame(): void {
    this.gameLoop.stop();
    this.scene.restart({ mode: 'single', difficulty: this.aiDifficulty });
  }

  private goToMainMenu(): void {
    this.gameLoop.stop();
    this.scene.start('MenuScene');
  }

  // 맵 렌더링
  private renderMap(): void {
    const { mapWidth, mapHeight, tileSize } = this.gameState.config;
    
    const graphics = this.add.graphics();
    graphics.setDepth(0);
    
    // 배경 색상
    graphics.fillStyle(0x1a1a1a);
    graphics.fillRect(0, 0, mapWidth * tileSize, mapHeight * tileSize);
    
    // 그리드 라인
    graphics.lineStyle(1, 0x333333, 0.3);
    
    for (let y = 0; y <= mapHeight; y++) {
      graphics.lineBetween(0, y * tileSize, mapWidth * tileSize, y * tileSize);
    }
    
    for (let x = 0; x <= mapWidth; x++) {
      graphics.lineBetween(x * tileSize, 0, x * tileSize, mapHeight * tileSize);
    }
  }

  // 카메라 드래그 입력
  private setupCameraInput(): void {
    // 방향키 커서 생성
    this.cursors = this.input.keyboard!.createCursorKeys();

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.middleButtonDown()) {
        this.isDragging = true;
        this.dragStartX = pointer.x;
        this.dragStartY = pointer.y;
      }
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.isDragging) {
        const dx = this.dragStartX - pointer.x;
        const dy = this.dragStartY - pointer.y;
        this.cameras.main.scrollX += dx;
        this.cameras.main.scrollY += dy;
        this.dragStartX = pointer.x;
        this.dragStartY = pointer.y;
      }
    });

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (pointer.middleButtonReleased()) {
        this.isDragging = false;
      }
    });
    
    // 마우스 휠 줌
    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _gameObjects: unknown[], _deltaX: number, deltaY: number) => {
      const zoomSpeed = 0.1;
      if (deltaY > 0) {
        this.cameraZoom = Math.max(0.5, this.cameraZoom - zoomSpeed);
      } else {
        this.cameraZoom = Math.min(2, this.cameraZoom + zoomSpeed);
      }
      this.cameras.main.setZoom(this.cameraZoom);
    });

    // 키보드 단축키
    this.input.keyboard?.on('keydown-ESC', () => {
      // 게임 오버 상태면 메인 메뉴로
      if (this.gameState.isGameOver()) {
        this.goToMainMenu();
      } else {
        this.togglePause();
      }
    });
    
    this.input.keyboard?.on('keydown-SPACE', () => {
      const selected = this.selectionManager.getSelectedEntities();
      if (selected.length > 0) {
        const pos = selected[0].getComponent<Position>(Position);
        if (pos) {
          this.cameras.main.centerOn(pos.x, pos.y);
        }
      }
    });

    // 건물 건설 단축키 (SCV 선택시)
    this.input.keyboard?.on('keydown-B', () => {
      this.buildingPlacer.startPlacement(BuildingType.BARRACKS);
    });
    this.input.keyboard?.on('keydown-D', () => {
      this.buildingPlacer.startPlacement(BuildingType.SUPPLY_DEPOT);
    });
    this.input.keyboard?.on('keydown-C', () => {
      this.buildingPlacer.startPlacement(BuildingType.COMMAND_CENTER);
    });
    this.input.keyboard?.on('keydown-E', () => {
      this.buildingPlacer.startPlacement(BuildingType.ENGINEERING_BAY);
    });
    this.input.keyboard?.on('keydown-F', () => {
      this.buildingPlacer.startPlacement(BuildingType.FACTORY);
    });
    this.input.keyboard?.on('keydown-R', () => {
      this.buildingPlacer.startPlacement(BuildingType.ARMORY);
    });
    
    // Siege Tank 시즈 모드 토글
    this.input.keyboard?.on('keydown-O', () => {
      this.toggleSiegeMode();
    });
    
    // Stim Pack 활성화
    this.input.keyboard?.on('keydown-T', () => {
      this.activateStimPack();
    });
    
    // 유닛 생산 단축키
    this.input.keyboard?.on('keydown-S', () => {
      this.trainUnit(UnitType.SCV);
    });
    this.input.keyboard?.on('keydown-M', () => {
      this.trainUnit(UnitType.MARINE);
    });
    this.input.keyboard?.on('keydown-I', () => {
      this.trainUnit(UnitType.FIREBAT);
    });
    this.input.keyboard?.on('keydown-H', () => {
      this.trainUnit(UnitType.MEDIC);
    });
    this.input.keyboard?.on('keydown-V', () => {
      this.trainUnit(UnitType.VULTURE);
    });
    this.input.keyboard?.on('keydown-G', () => {
      this.trainUnit(UnitType.GOLIATH);
    });
    this.input.keyboard?.on('keydown-K', () => {
      this.trainUnit(UnitType.SIEGE_TANK);
    });
  }

  // 카메라 설정
  private setupCamera(): void {
    const { mapWidth, mapHeight, tileSize } = this.gameState.config;
    
    this.cameras.main.setBounds(0, 0, mapWidth * tileSize, mapHeight * tileSize);
    // 플레이어 1 베이스 중심 (커맨드센터 위치: 6*32, 8*32)
    this.cameras.main.centerOn(6 * tileSize, 8 * tileSize);
  }

  // 카메라 업데이트 (방향키 + 엣지 스크롤)
  private updateCamera(): void {
    const camera = this.cameras.main;
    const baseSpeed = 16;
    const scrollSpeed = baseSpeed / this.cameraZoom; // 줌 레벨에 따라 속도 조절

    // 방향키 카메라 이동
    if (this.cursors.left.isDown) {
      camera.scrollX -= scrollSpeed;
    }
    if (this.cursors.right.isDown) {
      camera.scrollX += scrollSpeed;
    }
    if (this.cursors.up.isDown) {
      camera.scrollY -= scrollSpeed;
    }
    if (this.cursors.down.isDown) {
      camera.scrollY += scrollSpeed;
    }

    // 엣지 스크롤 (마우스 드래그 중이 아닐 때만)
    if (!this.isDragging) {
      const pointer = this.input.activePointer;
      const edgeSize = 30;
      const edgeScrollSpeed = 14 / this.cameraZoom;

      // 마우스가 게임 캔버스 안에 있을 때만 엣지 스크롤
      if (pointer.x >= 0 && pointer.x <= this.scale.width &&
          pointer.y >= 0 && pointer.y <= this.scale.height) {
        
        // 좌우 엣지
        if (pointer.x < edgeSize) {
          const factor = 1 - (pointer.x / edgeSize); // 가장자리에 가까울수록 빠르게
          camera.scrollX -= edgeScrollSpeed * factor;
        } else if (pointer.x > this.scale.width - edgeSize) {
          const factor = 1 - ((this.scale.width - pointer.x) / edgeSize);
          camera.scrollX += edgeScrollSpeed * factor;
        }

        // 상하 엣지
        if (pointer.y < edgeSize) {
          const factor = 1 - (pointer.y / edgeSize);
          camera.scrollY -= edgeScrollSpeed * factor;
        } else if (pointer.y > this.scale.height - edgeSize) {
          const factor = 1 - ((this.scale.height - pointer.y) / edgeSize);
          camera.scrollY += edgeScrollSpeed * factor;
        }
      }
    }
  }

  // 승리/패배 체크
  private checkGameOver(): void {
    const player1Units = this.countPlayerEntities(1);
    const player2Units = this.countPlayerEntities(2);

    if (player1Units === 0 && player2Units > 0) {
      this.endGame(2, 'DEFEAT');
    } else if (player2Units === 0 && player1Units > 0) {
      this.endGame(1, 'VICTORY');
    }
  }

  private countPlayerEntities(playerId: number): number {
    return this.gameState.getAllEntities().filter(e => {
      const owner = e.getComponent<Owner>(Owner);
      return owner && owner.playerId === playerId;
    }).length;
  }

  private endGame(winnerId: number, result: string): void {
    this.gameState.endGame(winnerId);
    this.gameLoop.stop();

    this.gameOverText.setText(`${result}\n\nPress ESC to return to menu`);
    this.gameOverText.setVisible(true);
  }

  // 유닛 생산
  private trainUnit(unitType: UnitType): void {
    console.log('=== trainUnit called ===', unitType);
    const selected = this.selectionManager.getSelectedEntities();
    if (selected.length === 0) {
      console.log('No selection');
      return;
    }

    const entity = selected[0];
    const building = entity.getComponent<Building>(Building);
    const queue = entity.getComponent<ProductionQueue>(ProductionQueue);

    console.log('Building:', building?.buildingType, 'Queue:', !!queue, 'Constructing:', building?.isConstructing);

    if (!building || !queue || building.isConstructing) {
      console.log('Cannot train: no building, no queue, or constructing');
      return;
    }

    // 건물이 해당 유닛을 생산할 수 있는지 확인
    const buildingStats = BUILDING_STATS[building.buildingType];
    if (!buildingStats.canProduce || !buildingStats.canProduce.includes(unitType)) {
      console.log(`Building ${building.buildingType} cannot produce ${unitType}`);
      return;
    }

    // 자원 확인
    const stats = UNIT_STATS[unitType];
    const resources = this.gameState.getPlayerResources(1);
    if (!resources) return;

    if (resources.minerals < stats.mineralCost) {
      console.log('Not enough minerals!');
      return;
    }
    if (resources.gas < stats.gasCost) {
      console.log('Not enough gas!');
      return;
    }
    if (resources.supply + stats.supplyCost > resources.supplyMax) {
      console.log('Not enough supply!');
      return;
    }

    // 자원 차감 및 생산 큐 추가
    this.gameState.modifyPlayerResources(1, {
      minerals: -stats.mineralCost,
      gas: -stats.gasCost,
    });
    queue.addToQueue(unitType, stats.buildTime);

    console.log(`Training ${unitType}`);
  }

  // 업그레이드 연구
  private startResearch(upgradeType: UpgradeType): void {
    console.log('=== startResearch called ===', upgradeType);
    const selected = this.selectionManager.getSelectedEntities();
    if (selected.length === 0) {
      console.log('No selection');
      return;
    }

    const entity = selected[0];
    const building = entity.getComponent<Building>(Building);
    let researchQueue = entity.getComponent<ResearchQueue>(ResearchQueue);

    if (!building || building.isConstructing) {
      console.log('Cannot research: no building or constructing');
      return;
    }

    // ResearchQueue가 없으면 추가
    if (!researchQueue) {
      researchQueue = new ResearchQueue();
      entity.addComponent(researchQueue);
    }

    // 이미 연구 중인지 확인
    if (researchQueue.isResearching()) {
      console.log('Already researching!');
      return;
    }

    // 자원 확인
    const stats = UPGRADE_STATS[upgradeType];
    const resources = this.gameState.getPlayerResources(1);
    if (!resources) return;

    if (resources.minerals < stats.mineralCost) {
      console.log('Not enough minerals!');
      return;
    }
    if (resources.gas < stats.gasCost) {
      console.log('Not enough gas!');
      return;
    }

    // 자원 차감 및 연구 시작
    this.gameState.modifyPlayerResources(1, {
      minerals: -stats.mineralCost,
      gas: -stats.gasCost,
    });
    researchQueue.startResearch(upgradeType, stats.researchTime);

    console.log(`Researching ${upgradeType}`);
  }

  // Siege Tank 시즈 모드 토글
  private toggleSiegeMode(): void {
    const selected = this.selectionManager.getSelectedEntities();
    
    for (const entity of selected) {
      const unit = entity.getComponent<Unit>(Unit);
      if (unit?.unitType === UnitType.SIEGE_TANK) {
        const wasSieged = unit.isSieged;
        unit.toggleSiege();
        soundManager.play(wasSieged ? 'siege_off' : 'siege_on');
        console.log(`Siege Tank ${unit.isSieged ? 'sieged' : 'unsieged'}`);
      }
    }
  }

  // Stim Pack 활성화
  private activateStimPack(): void {
    const selected = this.selectionManager.getSelectedEntities();
    
    for (const entity of selected) {
      const unit = entity.getComponent<Unit>(Unit);
      if (unit && (unit.unitType === UnitType.MARINE || unit.unitType === UnitType.FIREBAT)) {
        if (unit.activateStim()) {
          soundManager.play('stim');
          console.log(`${unit.unitType} stimmed!`);
        }
      }
    }
  }

  // 씬 종료시 정리
  shutdown(): void {
    this.gameLoop.stop();
    
    // 이벤트 리스너 정리 (중복 등록 방지)
    combatEvents.clear();
    
    this.unitRenderer.destroy();
    this.buildingRenderer.destroy();
    this.resourceRenderer.destroy();
    this.fogRenderer.destroy();
    this.effectsRenderer.destroy();
    this.minimap.destroy();
    this.hud.destroy();
    this.pauseMenu.destroy();
    this.buildingPlacer.destroy();
  }

  // 외부에서 이펙트 접근 (CombatSystem 연동용)
  getEffectsRenderer(): EffectsRenderer {
    return this.effectsRenderer;
  }

  // 전투 이벤트 리스너 설정
  private setupCombatEventListeners(): void {
    // 공격 이벤트 → 프로젝타일 생성 + 사운드
    combatEvents.onAttack((event) => {
      this.effectsRenderer.createProjectile(
        event.attackerX,
        event.attackerY,
        event.targetX,
        event.targetY,
        event.projectileType
      );
      // 사운드 재생
      if (event.projectileType === 'flame') {
        soundManager.play('attack_flame');
      } else if (event.projectileType === 'missile') {
        soundManager.play('attack_missile');
      } else {
        soundManager.play('attack_bullet');
      }
    });

    // 죽음 이벤트 → 죽음 이펙트 생성 + 사운드
    combatEvents.onDeath((event) => {
      this.effectsRenderer.createDeathEffect(
        event.x,
        event.y,
        event.size,
        event.isBuilding
      );
      // 사운드 재생
      if (event.isBuilding) {
        soundManager.play('explosion_large');
      } else {
        soundManager.play('death');
      }
    });

    // 치유 이벤트 → 치유 프로젝타일 생성 + 사운드
    combatEvents.onHeal((event) => {
      this.effectsRenderer.createProjectile(
        event.healerX,
        event.healerY,
        event.targetX,
        event.targetY,
        'heal'
      );
      soundManager.play('heal');
    });

    // 히트 이벤트 → 히트 스파크 생성
    combatEvents.onHit((event) => {
      const intensity = event.isBuilding ? 1.5 : 1;
      this.effectsRenderer.createHitSpark(event.x, event.y, intensity);
      // 히트 사운드 (가끔만 재생하여 과부하 방지)
      if (Math.random() < 0.3) {
        soundManager.play('hit');
      }
    });
  }
}
