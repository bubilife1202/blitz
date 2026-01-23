// ==========================================
// LobbyScene - 멀티플레이어 로비
// ==========================================

import Phaser from 'phaser';
import { NetworkClient, NetworkEvent } from '@core/network/NetworkClient';

export class LobbyScene extends Phaser.Scene {
  private network!: NetworkClient;
  private statusText!: Phaser.GameObjects.Text;
  private idText!: Phaser.GameObjects.Text;
  private inputElement!: HTMLInputElement;

  private hasStarted: boolean = false;
  private handlePlayerJoined = (peerId: string) => {
    this.statusText.setText(`PLAYER JOINED: ${peerId}`);
    this.statusText.setColor('#44ff44');

    if (!this.network.isHost || this.hasStarted) return;

    this.hasStarted = true;
    const seed = Date.now();
    this.network.broadcast('START_GAME', { seed, guestPlayerId: 2 });
    this.scene.start('GameScene', { mode: 'multi', isHost: true, playerId: 1, seed });
  };

  private handleGameStart = (payload: { seed: number; guestPlayerId?: number }) => {
    if (this.network.isHost) return;
    if (this.hasStarted) return;
    this.hasStarted = true;
    const playerId = payload?.guestPlayerId ?? 2;
    this.scene.start('GameScene', { mode: 'multi', isHost: false, playerId, seed: payload.seed });
  };
  
  // UI 컨테이너
  private mainContainer!: Phaser.GameObjects.Container;
  private joinContainer!: Phaser.GameObjects.Container;
  private hostContainer!: Phaser.GameObjects.Container;

  constructor() {
    super({ key: 'LobbyScene' });
  }

  init(): void {
    this.network = NetworkClient.getInstance();
  }

  create(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // 배경 (MenuScene과 동일한 다크 스페이스 느낌)
    this.add.rectangle(width / 2, height / 2, width, height, 0x050510);
    this.createGrid(width, height);

    // 타이틀
    this.add.text(width / 2, 80, 'MULTIPLAYER LOBBY', {
      fontSize: '42px',
      color: '#4a9eff',
      fontStyle: 'bold',
      fontFamily: 'Arial Black'
    }).setOrigin(0.5);

    // 상태 텍스트
    this.statusText = this.add.text(width / 2, 140, 'INITIALIZING NETWORK...', {
      fontSize: '16px',
      color: '#888888',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    // 메인 컨테이너
    this.mainContainer = this.add.container(width / 2, height / 2);
    
    const createBtn = this.createTechButton(0, -40, 'CREATE ROOM', () => this.showHostUI());
    const joinBtn = this.createTechButton(0, 40, 'JOIN ROOM', () => this.showJoinUI());
    const backBtn = this.createTechButton(0, 150, 'BACK', () => this.scene.start('MenuScene'));
    
    this.mainContainer.add([createBtn, joinBtn, backBtn]);

    // 호스트 UI 컨테이너 (초기엔 숨김)
    this.createHostUI(width, height);
    
    // 참가자 UI 컨테이너 (초기엔 숨김)
    this.createJoinUI(width, height);

    this.prepareNetwork();

    // 네트워크 이벤트 리스너
    this.network.on(NetworkEvent.PLAYER_JOINED, this.handlePlayerJoined);
    this.network.on(NetworkEvent.GAME_START, this.handleGameStart);

    // 씬 종료 시 정리 (shutdown 이벤트가 destroy보다 먼저, 확실하게 호출됨)
    this.events.once('shutdown', this.cleanup, this);
  }

  private cleanup(): void {
    this.network.off(NetworkEvent.PLAYER_JOINED, this.handlePlayerJoined);
    this.network.off(NetworkEvent.GAME_START, this.handleGameStart);
    if (this.inputElement) {
      this.inputElement.remove();
    }
    this.hasStarted = false; // 상태 초기화
  }
  
  private createHostUI(width: number, height: number): void {
    this.hostContainer = this.add.container(width / 2, height / 2);
    this.hostContainer.setVisible(false);
    
    const infoText = this.add.text(0, -80, 'ROOM CREATED. SHARE THIS ID:', {
      fontSize: '18px', color: '#aaaaaa'
    }).setOrigin(0.5);
    
    // ID 표시 텍스트
    this.idText = this.add.text(0, -40, 'Generating...', {
      fontSize: '28px', color: '#ffff00', fontStyle: 'bold', fontFamily: 'monospace'
    }).setOrigin(0.5);
    
    const waitText = this.add.text(0, 50, 'Waiting for player to join...', {
      fontSize: '16px', color: '#4a9eff'
    }).setOrigin(0.5);
    
    // 깜빡임 효과
    this.tweens.add({
      targets: waitText,
      alpha: 0.5,
      duration: 800,
      yoyo: true,
      repeat: -1
    });
    
    const backBtn = this.createTechButton(0, 150, 'CANCEL', () => {
      this.hostContainer.setVisible(false);
      this.mainContainer.setVisible(true);
      this.statusText.setText('NETWORK READY');
    });
    
    this.hostContainer.add([infoText, this.idText, waitText, backBtn]);
  }
  
  private createJoinUI(width: number, height: number): void {
    this.joinContainer = this.add.container(width / 2, height / 2);
    this.joinContainer.setVisible(false);
    
    const infoText = this.add.text(0, -80, 'ENTER HOST ID:', {
      fontSize: '18px', color: '#aaaaaa'
    }).setOrigin(0.5);
    
    // HTML Input 엘리먼트 생성 (Phaser 위에 오버레이)
    this.inputElement = document.createElement('input');
    this.inputElement.type = 'text';
    this.inputElement.style.position = 'absolute';
    this.inputElement.style.top = '50%';
    this.inputElement.style.left = '50%';
    this.inputElement.style.transform = 'translate(-50%, -100%)';
    this.inputElement.style.width = '250px';
    this.inputElement.style.height = '30px';
    this.inputElement.style.fontSize = '20px';
    this.inputElement.style.textAlign = 'center';
    this.inputElement.style.display = 'none'; // 초기엔 숨김
    document.body.appendChild(this.inputElement);
    
    const connectBtn = this.createTechButton(0, 40, 'CONNECT', () => {
      const hostId = this.inputElement.value;
      if (hostId) {
        this.statusText.setText('CONNECTING...');
        this.network.joinRoom(hostId);
      }
    });
    
    const backBtn = this.createTechButton(0, 150, 'BACK', () => {
      this.joinContainer.setVisible(false);
      this.mainContainer.setVisible(true);
      this.inputElement.style.display = 'none';
      this.statusText.setText('NETWORK READY');
    });
    
    this.joinContainer.add([infoText, connectBtn, backBtn]);
  }
  
  private async showHostUI(): Promise<void> {
    const ready = await this.prepareNetwork();
    if (!ready) return;

    this.network.createRoom();
    this.idText.setText(this.network.myId);
    
    // 클립보드 복사
    navigator.clipboard.writeText(this.network.myId).then(() => {
      this.statusText.setText('ID COPIED TO CLIPBOARD!');
    });
    
    this.mainContainer.setVisible(false);
    this.hostContainer.setVisible(true);
  }
  
  private async showJoinUI(): Promise<void> {
    const ready = await this.prepareNetwork();
    if (!ready) return;

    this.mainContainer.setVisible(false);
    this.joinContainer.setVisible(true);
    this.inputElement.style.display = 'block';
    this.inputElement.focus();
  }

  private async prepareNetwork(): Promise<boolean> {
    if (this.network.myId) {
      this.statusText.setText('NETWORK READY');
      this.statusText.setColor('#44ff44');
      return true;
    }

    this.statusText.setText('INITIALIZING NETWORK...');
    this.statusText.setColor('#888888');

    try {
      await this.network.initialize();
      this.statusText.setText('NETWORK READY');
      this.statusText.setColor('#44ff44');
      return true;
    } catch {
      this.statusText.setText('NETWORK ERROR');
      this.statusText.setColor('#ff4444');
      return false;
    }
  }

  // =================================================================
  // UI 헬퍼
  // =================================================================
  
  private createGrid(width: number, height: number): void {
    const gridGraphics = this.add.graphics();
    gridGraphics.lineStyle(1, 0x1a3a5a, 0.3);
    for (let i = 0; i < height; i += 40) {
      gridGraphics.moveTo(0, i);
      gridGraphics.lineTo(width, i);
    }
    for (let i = 0; i < width; i += 40) {
      gridGraphics.moveTo(i, 0);
      gridGraphics.lineTo(i, height);
    }
  }

  private createTechButton(x: number, y: number, text: string, onClick: () => void): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    const w = 250;
    const h = 45;

    const bg = this.add.graphics();
    const color = 0x0f3460;
    const drawButton = (c: number) => {
      bg.clear();
      bg.fillStyle(c, 0.8);
      bg.lineStyle(2, 0x4a9eff, 1);
      
      const cut = 15;
      bg.beginPath();
      bg.moveTo(-w/2 + cut, -h/2);
      bg.lineTo(w/2 - cut, -h/2);
      bg.lineTo(w/2, -h/2 + cut);
      bg.lineTo(w/2, h/2 - cut);
      bg.lineTo(w/2 - cut, h/2);
      bg.lineTo(-w/2 + cut, h/2);
      bg.lineTo(-w/2, h/2 - cut);
      bg.lineTo(-w/2, -h/2 + cut);
      bg.closePath();
      bg.fillPath();
      bg.strokePath();
    };

    drawButton(color);

    const btnText = this.add.text(0, 0, text, {
      fontSize: '18px', color: '#ffffff', fontStyle: 'bold'
    }).setOrigin(0.5);

    container.add([bg, btnText]);
    container.setInteractive(new Phaser.Geom.Rectangle(-w/2, -h/2, w, h), Phaser.Geom.Rectangle.Contains);

    container.on('pointerover', () => { drawButton(0x1a1a4e); btnText.setColor('#6acaff'); });
    container.on('pointerout', () => { drawButton(color); btnText.setColor('#ffffff'); });
    container.on('pointerdown', () => { drawButton(0x0f2040); btnText.setColor('#aaaaaa'); });
    container.on('pointerup', () => { onClick(); });

    return container;
  }
  
  // Phaser 씬 lifecycle에서 호출될 수 있으므로 유지 (shutdown에서 이미 정리됨)
  destroy(): void {
    this.cleanup();
  }
}
