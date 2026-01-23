// ==========================================
// PlanFeed - 감독 모드 우측 계획 피드
// ==========================================

import Phaser from 'phaser';
import type { PlanSnapshot, PlanAction, ApprovalRequest } from '@core/PlayerDirector';

export class PlanFeed {
  private scene: Phaser.Scene;
  private container!: Phaser.GameObjects.Container;
  
  // UI 요소
  private background!: Phaser.GameObjects.Rectangle;
  private contentContainer!: Phaser.GameObjects.Container;
  private collapseIcon!: Phaser.GameObjects.Text;
  private actionCards: Phaser.GameObjects.Container[] = [];
  private approvalCard: Phaser.GameObjects.Container | null = null;
  
  // 접기 상태
  private isCollapsed = false;
  private readonly panelW = 200;
  private readonly panelH = 180;
  private readonly headerH = 28;
  
  // 콜백
  public onApprovalResponse?: (requestId: string, optionId: string) => void;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.createUI();
  }

  private createUI(): void {
    const width = this.scene.scale.width;
    
    // 우측 상단에 배치
    this.container = this.scene.add.container(width - this.panelW - 10, 10);
    this.container.setScrollFactor(0);
    this.container.setDepth(3100);
    
    // 배경
    this.background = this.scene.add.rectangle(0, 0, this.panelW, this.panelH, 0x0a1628, 0.9);
    this.background.setOrigin(0, 0);
    this.background.setStrokeStyle(2, 0x1a3a5a);
    this.container.add(this.background);
    
    // 헤더 (클릭으로 접기/펼치기)
    const header = this.scene.add.rectangle(0, 0, this.panelW, this.headerH, 0x1a3a5a, 1);
    header.setOrigin(0, 0);
    header.setInteractive({ useHandCursor: true });
    this.container.add(header);
    
    // 타이틀
    const title = this.scene.add.text(10, this.headerH / 2, '[ AI 계획 ]', {
      fontSize: '13px',
      color: '#4a9eff',
      fontStyle: 'bold',
    });
    title.setOrigin(0, 0.5);
    this.container.add(title);
    
    // 접기 아이콘
    this.collapseIcon = this.scene.add.text(this.panelW - 20, this.headerH / 2, '▼', {
      fontSize: '12px',
      color: '#4a9eff',
    });
    this.collapseIcon.setOrigin(0.5);
    this.container.add(this.collapseIcon);
    
    // 헤더 클릭 이벤트
    header.on('pointerdown', () => this.toggleCollapse());
    header.on('pointerover', () => header.setFillStyle(0x2a4a6a));
    header.on('pointerout', () => header.setFillStyle(0x1a3a5a));
    
    // 컨텐츠 컨테이너
    this.contentContainer = this.scene.add.container(0, this.headerH);
    this.container.add(this.contentContainer);
  }
  
  private toggleCollapse(): void {
    this.isCollapsed = !this.isCollapsed;
    
    if (this.isCollapsed) {
      this.contentContainer.setVisible(false);
      this.background.setSize(this.panelW, this.headerH);
      this.collapseIcon.setText('▲');
    } else {
      this.contentContainer.setVisible(true);
      this.background.setSize(this.panelW, this.panelH);
      this.collapseIcon.setText('▼');
    }
  }
  
  isCollapsedState(): boolean {
    return this.isCollapsed;
  }
  
  getHeight(): number {
    return this.isCollapsed ? this.headerH : this.panelH;
  }

  update(snapshot: PlanSnapshot): void {
    // 기존 요소 제거
    this.clearDynamicElements();
    
    if (!snapshot.enabled) {
      // 비활성화 상태
      const offText = this.scene.add.text(this.panelW / 2, 60, '감독 모드 OFF', {
        fontSize: '13px',
        color: '#555555',
      });
      offText.setOrigin(0.5);
      this.contentContainer.add(offText);
      this.actionCards.push(this.createTempContainer(offText));
      return;
    }
    
    // 승인 요청 표시 (있으면)
    if (snapshot.approvalRequest) {
      this.renderApprovalCard(snapshot.approvalRequest, 8);
    }
    
    // 액션 카드 표시
    const startY = snapshot.approvalRequest ? 90 : 8;
    this.renderActionCards(snapshot.nextActions, startY);
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
  }

  private createTempContainer(...objects: Phaser.GameObjects.GameObject[]): Phaser.GameObjects.Container {
    const container = this.scene.add.container(0, 0);
    for (const obj of objects) {
      container.add(obj);
    }
    return container;
  }

  private renderApprovalCard(request: ApprovalRequest, y: number): void {
    const cardW = 180;
    const cardH = 76;
    const x = 10;
    
    const container = this.scene.add.container(x, y);
    
    // 배경 (강조)
    const bg = this.scene.add.rectangle(0, 0, cardW, cardH, 0x442200, 0.95);
    bg.setOrigin(0, 0);
    bg.setStrokeStyle(2, 0xff8800);
    container.add(bg);
    
    // 제목
    const title = this.scene.add.text(cardW / 2, 6, `⚠ ${request.title}`, {
      fontSize: '11px',
      color: '#ffaa00',
      fontStyle: 'bold',
    });
    title.setOrigin(0.5, 0);
    container.add(title);
    
    // 설명
    const desc = this.scene.add.text(cardW / 2, 22, request.description, {
      fontSize: '10px',
      color: '#cccccc',
      wordWrap: { width: cardW - 16 },
      align: 'center',
    });
    desc.setOrigin(0.5, 0);
    container.add(desc);
    
    // 버튼들
    const btnH = 22;
    const btnY = cardH - btnH - 6;
    
    const optionCount = request.options.length;
    let btnW = 70;
    let gap = 8;
    let fontSize = '10px';

    if (optionCount >= 3) {
      gap = 4;
      btnW = Math.floor((cardW - (gap * (optionCount - 1)) - 8) / optionCount);
      fontSize = '9px';
    }

    const totalBtnWidth = optionCount * btnW + (optionCount - 1) * gap;
    const startX = (cardW - totalBtnWidth) / 2;
    
    request.options.forEach((opt, i) => {
      const btnX = startX + i * (btnW + gap);
      const isApprove = opt.id === 'approve';
      
      const worldX = this.container.x + x + btnX;
      const worldY = this.container.y + this.headerH + y + btnY;
      
      const btn = this.scene.add.rectangle(worldX, worldY, btnW, btnH, isApprove ? 0x227722 : 0x772222);
      btn.setOrigin(0, 0);
      btn.setStrokeStyle(2, isApprove ? 0x44ff44 : 0xff4444);
      btn.setInteractive({ useHandCursor: true });
      btn.setScrollFactor(0);
      btn.setDepth(3200);
      
      const btnText = this.scene.add.text(worldX + btnW / 2, worldY + btnH / 2, opt.label, {
        fontSize: fontSize,
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
        this.onApprovalResponse?.(request.id, opt.id);
      });
      
      this.actionCards.push(this.createTempContainer(btn, btnText));
    });
    
    this.contentContainer.add(container);
    this.approvalCard = container;
  }

  private renderActionCards(actions: PlanAction[], startY: number): void {
    const cardW = 190;
    const cardH = 32;
    const gap = 6;
    
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
      const iconText = this.scene.add.text(8, cardH / 2, icon, {
        fontSize: '14px',
        color: '#ffffff',
      });
      iconText.setOrigin(0, 0.5);
      container.add(iconText);
      
      // 설명
      const descText = this.scene.add.text(28, cardH / 2, action.description, {
        fontSize: '11px',
        color: '#ffffff',
      });
      descText.setOrigin(0, 0.5);
      container.add(descText);
      
      // 진행률 (있으면)
      if (action.progress !== undefined) {
        const progressW = cardW - 36;
        const progressH = 3;
        const progressBg = this.scene.add.rectangle(30, cardH - 6, progressW, progressH, 0x333333);
        progressBg.setOrigin(0, 0.5);
        container.add(progressBg);
        
        const progressFill = this.scene.add.rectangle(30, cardH - 6, progressW * (action.progress / 100), progressH, 0x44aaff);
        progressFill.setOrigin(0, 0.5);
        container.add(progressFill);
      }
      
      this.container.add(container);
      this.actionCards.push(container);
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
