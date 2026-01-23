// ==========================================
// ReportFeed - 감독 모드 우측 보고서 피드 (로그)
// ==========================================

import Phaser from 'phaser';
import type { PlanSnapshot, DirectorLog } from '@core/PlayerDirector';

export class ReportFeed {
  private scene: Phaser.Scene;
  private container!: Phaser.GameObjects.Container;
  
  // UI 요소
  private logTexts: Phaser.GameObjects.Text[] = [];
  
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.createUI();
  }

  private createUI(): void {
    const width = this.scene.scale.width;
    
    // PlanFeed(50) + PlanFeed Height(200) + Gap(10) -> 260
    // 우측 상단에 배치, PlanFeed 아래
    const panelW = 210; // 190 -> 210
    const panelH = 170; // 150 -> 170
    
    this.container = this.scene.add.container(width - panelW - 10, 260); // width - 200 -> width - panelW - 10
    this.container.setScrollFactor(0);
    this.container.setDepth(3100);
    
    // 배경
    const bg = this.scene.add.rectangle(0, 0, panelW, panelH, 0x0a1628, 0.9);
    bg.setOrigin(0, 0);
    bg.setStrokeStyle(2, 0x1a3a5a);
    this.container.add(bg);
    
    // 타이틀
    const title = this.scene.add.text(panelW / 2, 10, '[ 보고서 ]', {
      fontSize: '14px', // 12px -> 14px
      color: '#4a9eff',
      fontStyle: 'bold',
    });
    title.setOrigin(0.5, 0);
    this.container.add(title);
    
    // 구분선
    const divider1 = this.scene.add.rectangle(panelW / 2, 32, panelW - 20, 1, 0x2a4a6a);
    this.container.add(divider1);
  }

  update(snapshot: PlanSnapshot): void {
    // 기존 로그 제거
    this.clearDynamicElements();
    
    if (!snapshot.enabled) {
        return;
    }
    
    // 로그 표시
    this.renderLogs(snapshot.recentLogs);
  }

  private clearDynamicElements(): void {
    for (const text of this.logTexts) {
      text.destroy();
    }
    this.logTexts = [];
  }

  private renderLogs(logs: DirectorLog[]): void {
    const startY = 40; // 35 -> 40
    const lineH = 18;  // 16 -> 18
    
    // 최대 7개 정도 표시
    logs.slice(0, 7).forEach((log, i) => {
      const y = startY + i * lineH;
      const color = log.type === 'action' ? '#44aaff' : 
                    log.type === 'warning' ? '#ffaa44' : '#cccccc'; // #888888 -> #cccccc
      
      const text = this.scene.add.text(10, y, `• ${log.message}`, {
        fontSize: '12px', // 10px -> 12px
        color,
        wordWrap: { width: 190 } // 170 -> 190
      });
      
      this.container.add(text);
      this.logTexts.push(text);
    });
  }

  setVisible(visible: boolean): void {
    this.container.setVisible(visible);
  }

  destroy(): void {
    this.clearDynamicElements();
    this.container.destroy();
  }
}
