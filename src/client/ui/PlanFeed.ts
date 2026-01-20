// ==========================================
// PlanFeed - 감독 모드 우측 계획 피드
// ==========================================

import Phaser from 'phaser';
import type { PlanSnapshot, PlanAction, ApprovalRequest, DirectorLog } from '@core/PlayerDirector';

export class PlanFeed {
  private scene: Phaser.Scene;
  private container!: Phaser.GameObjects.Container;
  
  // UI 요소
  private actionCards: Phaser.GameObjects.Container[] = [];
  private approvalCard: Phaser.GameObjects.Container | null = null;
  private logTexts: Phaser.GameObjects.Text[] = [];
  
  // 콜백
  public onApprovalResponse?: (requestId: string, optionId: string) => void;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.createUI();
  }

  private createUI(): void {
    const width = this.scene.scale.width;
    
    // 우측 상단에 배치
    this.container = this.scene.add.container(width - 200, 50);
    this.container.setScrollFactor(0);
    this.container.setDepth(3100);
    
    const panelW = 190;
    const panelH = 280;
    
    // 배경
    const bg = this.scene.add.rectangle(0, 0, panelW, panelH, 0x0a1628, 0.9);
    bg.setOrigin(0, 0);
    bg.setStrokeStyle(2, 0x1a3a5a);
    this.container.add(bg);
    
    // 타이틀
    const title = this.scene.add.text(panelW / 2, 8, '[ AI 계획 ]', {
      fontSize: '12px',
      color: '#4a9eff',
      fontStyle: 'bold',
    });
    title.setOrigin(0.5, 0);
    this.container.add(title);
    
    // 구분선
    const divider1 = this.scene.add.rectangle(panelW / 2, 28, panelW - 20, 1, 0x2a4a6a);
    this.container.add(divider1);
    
    // 로그 영역 라벨
    const logLabel = this.scene.add.text(10, 180, '최근 활동', {
      fontSize: '9px',
      color: '#666666',
    });
    this.container.add(logLabel);
    
    // 구분선 2
    const divider2 = this.scene.add.rectangle(panelW / 2, 195, panelW - 20, 1, 0x2a4a6a);
    this.container.add(divider2);
  }

  update(snapshot: PlanSnapshot): void {
    // 기존 요소 제거
    this.clearDynamicElements();
    
    if (!snapshot.enabled) {
      // 비활성화 상태
      const offText = this.scene.add.text(95, 100, '감독 모드 OFF', {
        fontSize: '12px',
        color: '#555555',
      });
      offText.setOrigin(0.5);
      this.container.add(offText);
      this.actionCards.push(this.createTempContainer(offText));
      return;
    }
    
    // 승인 요청 표시 (있으면)
    if (snapshot.approvalRequest) {
      this.renderApprovalCard(snapshot.approvalRequest, 35);
    }
    
    // 액션 카드 표시
    const startY = snapshot.approvalRequest ? 95 : 35;
    this.renderActionCards(snapshot.nextActions, startY);
    
    // 로그 표시
    this.renderLogs(snapshot.recentLogs);
  }

  private clearDynamicElements(): void {
    for (const card of this.actionCards) {
      card.destroy();
    }
    this.actionCards = [];
    
    if (this.approvalCard) {
      this.approvalCard.destroy();
      this.approvalCard = null;
    }
    
    for (const text of this.logTexts) {
      text.destroy();
    }
    this.logTexts = [];
  }

  private createTempContainer(...objects: Phaser.GameObjects.GameObject[]): Phaser.GameObjects.Container {
    const container = this.scene.add.container(0, 0);
    for (const obj of objects) {
      container.add(obj);
    }
    return container;
  }

  private renderApprovalCard(request: ApprovalRequest, y: number): void {
    const cardW = 170;
    const cardH = 70; // 더 크게
    const x = 10;
    
    const container = this.scene.add.container(x, y);
    
    // 배경 (강조)
    const bg = this.scene.add.rectangle(0, 0, cardW, cardH, 0x442200, 0.95);
    bg.setOrigin(0, 0);
    bg.setStrokeStyle(3, 0xff8800);
    container.add(bg);
    
    // 제목
    const title = this.scene.add.text(cardW / 2, 8, `⚠ ${request.title}`, {
      fontSize: '12px',
      color: '#ffaa00',
      fontStyle: 'bold',
    });
    title.setOrigin(0.5, 0);
    container.add(title);
    
    // 설명
    const desc = this.scene.add.text(cardW / 2, 26, request.description, {
      fontSize: '9px',
      color: '#cccccc',
      wordWrap: { width: cardW - 20 },
      align: 'center',
    });
    desc.setOrigin(0.5, 0);
    container.add(desc);
    
    // 버튼들 - 더 크고 눈에 띄게
    const btnW = 70;
    const btnH = 24;
    const btnY = cardH - btnH - 8;
    const totalBtnWidth = request.options.length * btnW + (request.options.length - 1) * 10;
    const startX = (cardW - totalBtnWidth) / 2;
    
    request.options.forEach((opt, i) => {
      const btnX = startX + i * (btnW + 10);
      const isApprove = opt.id === 'approve';
      
      // 버튼을 scene에 직접 추가하고 depth 높게 설정
      const worldX = this.container.x + x + btnX;
      const worldY = this.container.y + y + btnY;
      
      const btn = this.scene.add.rectangle(worldX, worldY, btnW, btnH, isApprove ? 0x227722 : 0x772222);
      btn.setOrigin(0, 0);
      btn.setStrokeStyle(2, isApprove ? 0x44ff44 : 0xff4444);
      btn.setInteractive({ useHandCursor: true });
      btn.setScrollFactor(0);
      btn.setDepth(3200); // 높은 depth
      
      const btnText = this.scene.add.text(worldX + btnW / 2, worldY + btnH / 2, opt.label, {
        fontSize: '12px',
        color: '#ffffff',
        fontStyle: 'bold',
      });
      btnText.setOrigin(0.5);
      btnText.setScrollFactor(0);
      btnText.setDepth(3201);
      
      btn.on('pointerover', () => {
        btn.setFillStyle(isApprove ? 0x339933 : 0x993333);
        btn.setStrokeStyle(3, isApprove ? 0x66ff66 : 0xff6666);
      });
      btn.on('pointerout', () => {
        btn.setFillStyle(isApprove ? 0x227722 : 0x772222);
        btn.setStrokeStyle(2, isApprove ? 0x44ff44 : 0xff4444);
      });
      btn.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        pointer.event.stopPropagation();
        console.log('Approval button clicked:', opt.id);
        this.onApprovalResponse?.(request.id, opt.id);
      });
      
      // 버튼은 별도로 추적 (container 밖)
      this.actionCards.push(this.createTempContainer(btn, btnText));
    });
    
    this.container.add(container);
    this.approvalCard = container;
  }

  private renderActionCards(actions: PlanAction[], startY: number): void {
    const cardW = 170;
    const cardH = 28;
    const gap = 4;
    
    actions.slice(0, 4).forEach((action, i) => {
      const y = startY + i * (cardH + gap);
      const container = this.scene.add.container(10, y);
      
      // 배경
      const bgColor = this.getActionColor(action.type);
      const bg = this.scene.add.rectangle(0, 0, cardW, cardH, bgColor, 0.6);
      bg.setOrigin(0, 0);
      bg.setStrokeStyle(1, this.getActionBorderColor(action.type));
      container.add(bg);
      
      // 아이콘
      const icon = this.getActionIcon(action.type);
      const iconText = this.scene.add.text(5, cardH / 2, icon, {
        fontSize: '12px',
        color: '#ffffff',
      });
      iconText.setOrigin(0, 0.5);
      container.add(iconText);
      
      // 설명
      const descText = this.scene.add.text(22, cardH / 2, action.description, {
        fontSize: '10px',
        color: '#ffffff',
      });
      descText.setOrigin(0, 0.5);
      container.add(descText);
      
      // 진행률 (있으면)
      if (action.progress !== undefined) {
        const progressW = cardW - 30;
        const progressH = 3;
        const progressBg = this.scene.add.rectangle(25, cardH - 5, progressW, progressH, 0x333333);
        progressBg.setOrigin(0, 0.5);
        container.add(progressBg);
        
        const progressFill = this.scene.add.rectangle(25, cardH - 5, progressW * (action.progress / 100), progressH, 0x44aaff);
        progressFill.setOrigin(0, 0.5);
        container.add(progressFill);
      }
      
      this.container.add(container);
      this.actionCards.push(container);
    });
  }

  private renderLogs(logs: DirectorLog[]): void {
    const startY = 205;
    const lineH = 14;
    
    logs.slice(0, 5).forEach((log, i) => {
      const y = startY + i * lineH;
      const color = log.type === 'action' ? '#44aaff' : 
                    log.type === 'warning' ? '#ffaa44' : '#888888';
      
      const text = this.scene.add.text(10, y, `• ${log.message}`, {
        fontSize: '9px',
        color,
      });
      
      this.container.add(text);
      this.logTexts.push(text);
    });
  }

  private getActionColor(type: PlanAction['type']): number {
    switch (type) {
      case 'attack': return 0x442222;
      case 'build': return 0x224422;
      case 'production': return 0x222244;
      case 'gather': return 0x444422;
      case 'expand': return 0x442244;
      default: return 0x333333;
    }
  }

  private getActionBorderColor(type: PlanAction['type']): number {
    switch (type) {
      case 'attack': return 0xff4444;
      case 'build': return 0x44ff44;
      case 'production': return 0x4444ff;
      case 'gather': return 0xffff44;
      case 'expand': return 0xff44ff;
      default: return 0x666666;
    }
  }

  private getActionIcon(type: PlanAction['type']): string {
    switch (type) {
      case 'attack': return '⚔';
      case 'build': return '🔧';
      case 'production': return '⚙';
      case 'gather': return '💎';
      case 'expand': return '🏠';
      default: return '•';
    }
  }

  setVisible(visible: boolean): void {
    this.container.setVisible(visible);
  }

  destroy(): void {
    this.clearDynamicElements();
    this.container.destroy();
  }
}
