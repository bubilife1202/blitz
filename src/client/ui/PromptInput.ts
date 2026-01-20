// ==========================================
// PromptInput - 프롬프트 입력창으로 게임 제어
// ==========================================

import Phaser from 'phaser';
import type { GameState } from '@core/GameState';
import type { Entity } from '@core/ecs/Entity';
import type { SelectionManager } from '../input/SelectionManager';
import type { CommandManager } from '../input/CommandManager';
import type { BuildingPlacer } from '../input/BuildingPlacer';
import { Position } from '@core/components/Position';
import { Owner } from '@core/components/Owner';
import { Unit } from '@core/components/Unit';
import { Building } from '@core/components/Building';
import { Resource } from '@core/components/Resource';
import { Gatherer } from '@core/components/Gatherer';
import { UnitType, BuildingType, ResourceType } from '@shared/types';
import { geminiService, type AICmd } from '../services/GeminiService';

interface CommandResult {
  success: boolean;
  message: string;
}

export class PromptInput {
  private scene: Phaser.Scene;
  private gameState: GameState;
  private selectionManager: SelectionManager;
  private commandManager: CommandManager;
  private buildingPlacer: BuildingPlacer;
  private localPlayerId: number = 1;

  // UI 요소
  private container!: Phaser.GameObjects.Container;
  private background!: Phaser.GameObjects.Rectangle;
  private inputElement!: HTMLInputElement;
  private outputText!: Phaser.GameObjects.Text;
  private historyText!: Phaser.GameObjects.Text;
  
  private isVisible: boolean = false;
  private commandHistory: string[] = [];
  private historyIndex: number = -1;

  // 콜백
  public onTrainUnit?: (unitType: UnitType) => void;
  public onTogglePause?: () => void;

  constructor(
    scene: Phaser.Scene,
    gameState: GameState,
    selectionManager: SelectionManager,
    commandManager: CommandManager,
    buildingPlacer: BuildingPlacer
  ) {
    this.scene = scene;
    this.gameState = gameState;
    this.selectionManager = selectionManager;
    this.commandManager = commandManager;
    this.buildingPlacer = buildingPlacer;

    this.createUI();
    this.setupKeyboardInput();
  }

  private createUI(): void {
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;

    this.container = this.scene.add.container(0, 0);
    this.container.setScrollFactor(0);
    this.container.setDepth(5000);
    this.container.setVisible(false);

    // 반투명 배경
    this.background = this.scene.add.rectangle(
      width / 2,
      height - 100,
      640,
      180,
      0x000000,
      0.85
    );
    this.background.setStrokeStyle(3, 0x00ff00); // 테두리 두껍게
    this.container.add(this.background);

    // 도움말 텍스트
    const helpText = this.scene.add.text(
      width / 2 - 300,
      height - 175,
      'AI Commander: Type naturally (e.g. "Send all marines to attack 50 50")',
      { fontSize: '11px', color: '#00ff00', fontStyle: 'bold' }
    );
    this.container.add(helpText);

    // 출력 텍스트
    this.outputText = this.scene.add.text(
      width / 2 - 300,
      height - 150,
      '> Waiting for command...',
      { fontSize: '13px', color: '#ffffff', wordWrap: { width: 600 } }
    );
    this.container.add(this.outputText);

    // 히스토리 텍스트
    this.historyText = this.scene.add.text(
      width / 2 - 300,
      height - 120,
      '',
      { fontSize: '11px', color: '#888888', wordWrap: { width: 600 } }
    );
    this.container.add(this.historyText);

    // HTML Input 요소 생성
    this.createInputElement();
  }

  private createInputElement(): void {
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;

    this.inputElement = document.createElement('input');
    this.inputElement.type = 'text';
    this.inputElement.placeholder = 'Enter command...';
    this.inputElement.style.cssText = `
      position: absolute;
      left: ${width / 2 - 280}px;
      top: ${height - 55}px;
      width: 560px;
      height: 30px;
      background: #111;
      border: 1px solid #00ff00;
      color: #00ff00;
      font-family: monospace;
      font-size: 14px;
      padding: 0 10px;
      outline: none;
      display: none;
    `;

    this.inputElement.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.executeCommand(this.inputElement.value);
        this.inputElement.value = '';
      } else if (e.key === 'Escape') {
        this.hide();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.navigateHistory(-1);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.navigateHistory(1);
      }
    });

    document.body.appendChild(this.inputElement);
  }

  private setupKeyboardInput(): void {
    // Enter 키로 프롬프트 열기/닫기
    this.scene.input.keyboard?.on('keydown-ENTER', () => {
      if (!this.isVisible) {
        this.show();
      }
    });

    // ` (백틱) 키로도 열 수 있음
    this.scene.input.keyboard?.on('keydown-BACKTICK', () => {
      this.toggle();
    });
  }

  private navigateHistory(direction: number): void {
    if (this.commandHistory.length === 0) return;

    this.historyIndex += direction;
    
    if (this.historyIndex < 0) {
      this.historyIndex = 0;
    } else if (this.historyIndex >= this.commandHistory.length) {
      this.historyIndex = this.commandHistory.length;
      this.inputElement.value = '';
      return;
    }

    this.inputElement.value = this.commandHistory[this.historyIndex] || '';
  }

  private executeCommand(input: string): void {
    const trimmed = input.trim().toLowerCase();
    if (!trimmed) return;

    // 히스토리에 추가
    this.commandHistory.push(trimmed);
    this.historyIndex = this.commandHistory.length;

    // 명령 파싱 및 실행
    const result = this.parseAndExecute(trimmed);
    
    // 결과 표시
    this.outputText.setText(`> ${result.message}`);
    this.outputText.setColor(result.success ? '#00ff00' : '#ff6666');

    // 히스토리 업데이트
    const recentHistory = this.commandHistory.slice(-3).map(c => `  ${c}`).join('\n');
    this.historyText.setText(recentHistory);
  }

  private parseAndExecute(input: string): CommandResult {
    const parts = input.split(/\s+/);
    const command = parts[0];
    const args = parts.slice(1);

    switch (command) {
      case 'help':
        return this.showHelp();
      
      case 'select':
        return this.cmdSelect(args);
      
      case 'move':
      case 'm':
        return this.cmdMove(args);
      
      case 'attack':
      case 'a':
        return this.cmdAttack(args);
      
      case 'stop':
      case 's':
        return this.cmdStop();
      
      case 'hold':
      case 'h':
        return this.cmdHold();
      
      case 'build':
      case 'b':
        return this.cmdBuild(args);
      
      case 'train':
      case 't':
        return this.cmdTrain(args);

      case 'hunt':
      case 'kill':
        return this.cmdHunt();

      case 'gather':
      case 'g':
        return this.cmdGather(args);

      case 'siege':
        return this.cmdSiege();

      case 'stim':
        return this.cmdStim();

      case 'status':
        return this.cmdStatus();

      case 'resources':
      case 'res':
        return this.cmdResources();

      case 'pause':
        this.onTogglePause?.();
        return { success: true, message: 'Toggled pause' };

      case 'clear':
        this.historyText.setText('');
        return { success: true, message: 'Cleared' };

      default:
        // 일반 명령어 아님 -> AI 처리 시도 (보안 프록시 사용)
        this.processAICommand(input);
        return { success: true, message: 'AI Analyzing command...' };
    }
  }

  private async processAICommand(input: string): Promise<void> {
    if (!geminiService.hasKey()) {
      this.outputText.setText('> Error: API Key not set. Use "setkey [key]" first.');
      this.outputText.setColor('#ff6666');
      return;
    }

    try {
      const commands = await geminiService.processNaturalLanguage(input);
      this.executeAICommands(commands);
    } catch (error: any) {
      this.outputText.setText(`> AI Error: ${error.message}`);
      this.outputText.setColor('#ff6666');
    }
  }

  private executeAICommands(commands: AICmd[]): void {
    if (commands.length === 0) {
      this.outputText.setText('> AI could not understand the command.');
      this.outputText.setColor('#ff6666');
      return;
    }

    let summary = 'AI Executing: ';
    
    for (const cmd of commands) {
      summary += `${cmd.type} `;
      
      switch (cmd.type) {
        case 'select':
          this.cmdSelect([cmd.target || 'all']);
          break;
        case 'move':
          if (cmd.x !== undefined && cmd.y !== undefined) {
            this.cmdMove([cmd.x.toString(), cmd.y.toString()]);
          }
          break;
        case 'attack':
          if (cmd.x !== undefined && cmd.y !== undefined) {
            this.cmdAttack([cmd.x.toString(), cmd.y.toString()]);
          }
          break;
        case 'build':
          if (cmd.buildingType) {
            this.cmdBuild([cmd.buildingType]);
          }
          break;
        case 'train':
          if (cmd.unitType) {
            this.cmdTrain([cmd.unitType]);
          }
          break;
        case 'hunt':
          this.cmdHunt();
          break;
        case 'gather':
          this.cmdGather([cmd.resourceType || 'minerals']);
          break;
        case 'stop':
          this.cmdStop();
          break;
        case 'siege':
          this.cmdSiege();
          break;
        case 'stim':
          this.cmdStim();
          break;
      }
    }

    this.outputText.setText(`> ${summary}`);
    this.outputText.setColor('#00ffff');
  }

  private showHelp(): CommandResult {
    return {
      success: true,
      message: `Commands: select [all/scv/marine/...], move [x] [y], attack [x] [y], stop, hold, build [depot/barracks/...], train [scv/marine/...], siege, stim, status, resources, pause`
    };
  }

  private cmdSelect(args: string[]): CommandResult {
    if (args.length === 0) {
      return { success: false, message: 'Usage: select [all/scv/marine/tank/...]' };
    }

    const target = args[0];
    const entities = this.gameState.getAllEntities();
    let selected = 0;

    // 선택 해제
    this.selectionManager.clearSelection();

    for (const entity of entities) {
      const owner = entity.getComponent<Owner>(Owner);
      if (!owner || owner.playerId !== this.localPlayerId) continue;

      const unit = entity.getComponent<Unit>(Unit);
      const building = entity.getComponent<Building>(Building);

      let match = false;

      if (target === 'all') {
        match = true;
      } else if (target === 'units' && unit) {
        match = true;
      } else if (target === 'buildings' && building) {
        match = true;
      } else if (unit && unit.unitType.toLowerCase().includes(target)) {
        match = true;
      } else if (building && building.buildingType.toLowerCase().includes(target)) {
        match = true;
      }

      if (match) {
        this.selectionManager.addToSelection(entity);
        selected++;
      }
    }

    return {
      success: selected > 0,
      message: selected > 0 ? `Selected ${selected} entities` : `No match for "${target}"`
    };
  }

  private cmdMove(args: string[]): CommandResult {
    if (args.length < 2) {
      return { success: false, message: 'Usage: move [x] [y]' };
    }

    const x = parseInt(args[0]) * 32;
    const y = parseInt(args[1]) * 32;

    if (isNaN(x) || isNaN(y)) {
      return { success: false, message: 'Invalid coordinates' };
    }

    this.commandManager.issueMoveCommand(x, y);
    return { success: true, message: `Moving to (${args[0]}, ${args[1]})` };
  }

  private cmdAttack(args: string[]): CommandResult {
    if (args.length < 2) {
      // A-move 모드 진입
      this.commandManager.enterAttackMoveMode();
      return { success: true, message: 'Attack-move mode. Click to execute.' };
    }

    const x = parseInt(args[0]) * 32;
    const y = parseInt(args[1]) * 32;

    this.commandManager.issueAttackMoveCommand(x, y);
    return { success: true, message: `Attack-moving to (${args[0]}, ${args[1]})` };
  }

  private cmdStop(): CommandResult {
    this.commandManager.issueStopCommand();
    return { success: true, message: 'Stop command issued' };
  }

  private cmdHold(): CommandResult {
    this.commandManager.issueHoldCommand();
    return { success: true, message: 'Hold position' };
  }

  private cmdBuild(args: string[]): CommandResult {
    if (args.length === 0) {
      return { success: false, message: 'Usage: build [depot/barracks/factory/refinery/armory/bay]' };
    }

    const typeMap: Record<string, BuildingType> = {
      'depot': BuildingType.SUPPLY_DEPOT,
      'supply': BuildingType.SUPPLY_DEPOT,
      'barracks': BuildingType.BARRACKS,
      'bar': BuildingType.BARRACKS,
      'factory': BuildingType.FACTORY,
      'fac': BuildingType.FACTORY,
      'refinery': BuildingType.REFINERY,
      'ref': BuildingType.REFINERY,
      'armory': BuildingType.ARMORY,
      'arm': BuildingType.ARMORY,
      'bay': BuildingType.ENGINEERING_BAY,
      'eng': BuildingType.ENGINEERING_BAY,
      'cc': BuildingType.COMMAND_CENTER,
      'bunker': BuildingType.BUNKER,
      'turret': BuildingType.MISSILE_TURRET,
    };

    const buildingType = typeMap[args[0]];
    if (!buildingType) {
      return { success: false, message: `Unknown building: ${args[0]}` };
    }

    this.buildingPlacer.startPlacement(buildingType);
    return { success: true, message: `Placing ${buildingType}. Click to place, ESC to cancel.` };
  }

  private cmdTrain(args: string[]): CommandResult {
    if (args.length === 0) {
      return { success: false, message: 'Usage: train [scv/marine/firebat/medic/vulture/tank/goliath]' };
    }

    const typeMap: Record<string, UnitType> = {
      'scv': UnitType.SCV,
      'marine': UnitType.MARINE,
      'firebat': UnitType.FIREBAT,
      'medic': UnitType.MEDIC,
      'vulture': UnitType.VULTURE,
      'tank': UnitType.SIEGE_TANK,
      'siege': UnitType.SIEGE_TANK,
      'goliath': UnitType.GOLIATH,
    };

    const unitType = typeMap[args[0]];
    if (!unitType) {
      return { success: false, message: `Unknown unit: ${args[0]}` };
    }

    this.onTrainUnit?.(unitType);
    return { success: true, message: `Training ${unitType}` };
  }

  private cmdHunt(): CommandResult {
    const selected = this.selectionManager.getSelectedEntities();
    const units = selected.filter(e => e.hasComponent(Unit));
    
    if (units.length === 0) {
      return { success: false, message: 'No units selected to hunt' };
    }

    const allEntities = this.gameState.getAllEntities();
    let huntCount = 0;

    for (const unit of units) {
      const pos = unit.getComponent<Position>(Position)!;
      
      // 가장 가까운 적 찾기
      let nearestEnemy: Entity | null = null;
      let minDist = Infinity;

      for (const entity of allEntities) {
        const owner = entity.getComponent<Owner>(Owner);
        const enemyPos = entity.getComponent<Position>(Position);
        
        // 플레이어 2(AI) 유닛/건물만 타겟
        if (owner && owner.playerId !== this.localPlayerId && enemyPos) {
          const dist = pos.distanceTo(enemyPos);
          if (dist < minDist) {
            minDist = dist;
            nearestEnemy = entity;
          }
        }
      }

      if (nearestEnemy) {
        const targetPos = nearestEnemy.getComponent<Position>(Position)!;
        // 해당 적 위치로 어택무브 명령
        this.commandManager.issueAttackMoveCommand(targetPos.x, targetPos.y);
        huntCount++;
      }
    }

    return { 
      success: huntCount > 0, 
      message: huntCount > 0 ? `Hunting nearest enemies with ${huntCount} units` : 'No enemies found to hunt' 
    };
  }

  // 스마트 자원 채취 명령
  private cmdGather(args: string[]): CommandResult {
    const resourceType = args[0] || 'minerals';
    const isGas = resourceType === 'gas';

    const selected = this.selectionManager.getSelectedEntities();
    const workers = selected.filter(e => {
      const unit = e.getComponent<Unit>(Unit);
      return unit?.unitType === UnitType.SCV;
    });

    if (workers.length === 0) {
      return { success: false, message: 'No SCVs selected' };
    }

    const allEntities = this.gameState.getAllEntities();
    
    // 자원 목록 수집 (미네랄 또는 리파이너리)
    const resources: Array<{ entity: Entity; pos: Position; assignedCount: number }> = [];
    
    for (const entity of allEntities) {
      const pos = entity.getComponent<Position>(Position);
      if (!pos) continue;

      if (isGas) {
        // 가스: 완성된 리파이너리만
        const building = entity.getComponent<Building>(Building);
        const owner = entity.getComponent<Owner>(Owner);
        if (building?.buildingType === BuildingType.REFINERY && 
            !building.isConstructing && 
            owner?.playerId === this.localPlayerId) {
          const assignedCount = this.countAssignedWorkers(entity.id);
          if (assignedCount < 3) { // 리파이너리당 최대 3명
            resources.push({ entity, pos, assignedCount });
          }
        }
      } else {
        // 미네랄: Resource 컴포넌트가 있고 미네랄 타입인 것
        const resource = entity.getComponent<Resource>(Resource);
        if (resource && resource.resourceType === ResourceType.MINERALS && !resource.isDepleted()) {
          const assignedCount = this.countAssignedWorkers(entity.id);
          if (assignedCount < 2) { // 미네랄당 최대 2명
            resources.push({ entity, pos, assignedCount });
          }
        }
      }
    }

    if (resources.length === 0) {
      return { success: false, message: isGas ? 'No available refineries (build one first!)' : 'No available minerals' };
    }

    // 각 일꾼별로 최적 자원 할당
    let gatherCount = 0;
    const congestionPenalty = 100; // 혼잡도 페널티

    for (const worker of workers) {
      const workerPos = worker.getComponent<Position>(Position)!;
      
      // 점수 = 거리 + (할당된 일꾼 수 * 페널티)
      let bestResource: typeof resources[0] | null = null;
      let bestScore = Infinity;

      for (const res of resources) {
        const dist = workerPos.distanceTo(res.pos);
        const score = dist + (res.assignedCount * congestionPenalty);
        if (score < bestScore) {
          bestScore = score;
          bestResource = res;
        }
      }

      if (bestResource) {
        this.commandManager.issueGatherCommand(
          bestResource.entity.id,
          bestResource.pos.x,
          bestResource.pos.y
        );
        bestResource.assignedCount++; // 할당 수 증가 (다음 일꾼 계산에 반영)
        gatherCount++;
      }
    }

    return {
      success: gatherCount > 0,
      message: gatherCount > 0 
        ? `${gatherCount} SCV(s) gathering ${resourceType}` 
        : 'Could not assign workers to resources'
    };
  }

  // 특정 자원에 할당된 일꾼 수 계산
  private countAssignedWorkers(resourceId: number): number {
    let count = 0;
    for (const entity of this.gameState.getAllEntities()) {
      const gatherer = entity.getComponent<Gatherer>(Gatherer);
      if (gatherer && gatherer.targetResourceId === resourceId) {
        count++;
      }
    }
    return count;
  }

  private cmdSiege(): CommandResult {
    const selected = this.selectionManager.getSelectedEntities();
    let toggled = 0;

    for (const entity of selected) {
      const unit = entity.getComponent<Unit>(Unit);
      if (unit?.unitType === UnitType.SIEGE_TANK) {
        unit.toggleSiege();
        toggled++;
      }
    }

    return {
      success: toggled > 0,
      message: toggled > 0 ? `Toggled siege mode on ${toggled} tank(s)` : 'No siege tanks selected'
    };
  }

  private cmdStim(): CommandResult {
    const selected = this.selectionManager.getSelectedEntities();
    let stimmed = 0;

    for (const entity of selected) {
      const unit = entity.getComponent<Unit>(Unit);
      if (unit && (unit.unitType === UnitType.MARINE || unit.unitType === UnitType.FIREBAT)) {
        if (unit.activateStim()) {
          stimmed++;
        }
      }
    }

    return {
      success: stimmed > 0,
      message: stimmed > 0 ? `Stimmed ${stimmed} unit(s)` : 'No stimmable units selected'
    };
  }

  private cmdStatus(): CommandResult {
    const selected = this.selectionManager.getSelectedEntities();
    
    if (selected.length === 0) {
      return { success: false, message: 'Nothing selected' };
    }

    const entity = selected[0];
    const pos = entity.getComponent<Position>(Position);
    const unit = entity.getComponent<Unit>(Unit);
    const building = entity.getComponent<Building>(Building);

    let info = '';
    if (unit) {
      info = `${unit.unitType} HP:${Math.floor(unit.hp)}/${unit.maxHp} @ (${Math.floor(pos!.x / 32)}, ${Math.floor(pos!.y / 32)})`;
    } else if (building) {
      info = `${building.buildingType} HP:${Math.floor(building.hp)}/${building.maxHp}`;
    }

    return { success: true, message: info || 'Unknown entity' };
  }

  private cmdResources(): CommandResult {
    const res = this.gameState.getPlayerResources(this.localPlayerId);
    if (!res) {
      return { success: false, message: 'No resources found' };
    }

    return {
      success: true,
      message: `Minerals: ${res.minerals} | Gas: ${res.gas} | Supply: ${res.supply}/${res.supplyMax}`
    };
  }

  show(): void {
    this.isVisible = true;
    this.container.setVisible(true);
    
    // 화면 크기에 맞춰 위치 재계산
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;
    
    // HTML Input 위치 동적 조정
    const canvas = this.scene.game.canvas;
    const rect = canvas.getBoundingClientRect();
    
    this.inputElement.style.left = `${rect.left + (width / 2 - 300) * (rect.width / width)}px`;
    this.inputElement.style.top = `${rect.top + (height - 55) * (rect.height / height)}px`;
    this.inputElement.style.width = `${600 * (rect.width / width)}px`;
    
    this.inputElement.style.display = 'block';
    this.inputElement.focus();
  }

  hide(): void {
    this.isVisible = false;
    this.container.setVisible(false);
    this.inputElement.style.display = 'none';
    this.inputElement.blur();
  }

  toggle(): void {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  isOpen(): boolean {
    return this.isVisible;
  }

  destroy(): void {
    this.container.destroy();
    this.inputElement.remove();
  }
}
