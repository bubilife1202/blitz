// ==========================================
// MenuScene - 메인 메뉴 (리마스터)
// ==========================================

import Phaser from 'phaser';
import { AIDifficulty } from '@shared/types';

export class MenuScene extends Phaser.Scene {
  private difficultyPanel: Phaser.GameObjects.Container | null = null;
  private aiCountPanel: Phaser.GameObjects.Container | null = null;
  private mainButtons: Phaser.GameObjects.Container[] = [];
  private selectedDifficulty: AIDifficulty = AIDifficulty.NORMAL;

  // 배경 효과
  private stars: Phaser.GameObjects.Rectangle[] = [];
  private titleGlow: number = 0;
  private titleText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'MenuScene' });
  }

  create(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // 1. 다크 스페이스 배경
    this.add.rectangle(width / 2, height / 2, width, height, 0x050510);
    
    // 2. 움직이는 별 배경 생성
    this.createStarfield(width, height);
    
    // 3. 홀로그램 그리드 바닥
    this.createGrid(width, height);

    // 4. 비네팅 (가장자리 어둡게)
    const vignette = this.add.graphics();
    vignette.fillStyle(0x000000, 1);
    vignette.alpha = 0;
    // 그라데이션 텍스처를 쓸 수 없으니 여러 겹의 투명 사각형으로 흉내내거나
    // 쉐이더 없이 간단히 원형 마스크 반전 느낌으로 처리
    // 여기서는 간단히 상단/하단 그라데이션 띠만 추가
    const topGrad = this.add.graphics();
    topGrad.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.8, 0.8, 0, 0);
    topGrad.fillRect(0, 0, width, 150);
    
    const botGrad = this.add.graphics();
    botGrad.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.8, 0.8);
    botGrad.fillRect(0, height - 150, width, 150);

    // 5. 타이틀
    this.titleText = this.add.text(width / 2, height / 3 - 20, 'BLITZ', {
      fontSize: '86px',
      color: '#ffffff',
      fontStyle: 'bold',
      fontFamily: 'Arial Black, Impact, sans-serif'
    });
    this.titleText.setOrigin(0.5);
    this.titleText.setStroke('#4a9eff', 2);
    this.titleText.setShadow(0, 0, '#4a9eff', 20, true, true);

    // 서브타이틀
    const subtitle = this.add.text(width / 2, height / 3 + 50, 'TACTICAL OPERATIONS COMMAND', {
      fontSize: '16px',
      color: '#4a9eff',
      letterSpacing: 4
    });
    subtitle.setOrigin(0.5);

    // 6. 메인 버튼들 (초기 애니메이션 적용)
    const startBtn = this.createTechButton(width / 2, height / 2 + 60, 'DEPLOY MISSION', () => {
      this.showDifficultySelection();
    });
    
    const multiBtn = this.createTechButton(width / 2, height / 2 + 130, 'MULTIPLAYER', () => {}, true);
    
    this.mainButtons.push(startBtn, multiBtn);

    // 버튼 등장 애니메이션
    this.tweens.add({
      targets: this.mainButtons,
      y: '+=20',
      alpha: { from: 0, to: 1 },
      duration: 800,
      stagger: 200,
      ease: 'Power2'
    });

    // 버전 정보
    this.add.text(width - 20, height - 20, 'v1.1.0 // SYSTEM READY', {
      fontSize: '12px',
      color: '#4a9eff',
      fontFamily: 'monospace'
    }).setOrigin(1, 1).setAlpha(0.7);
  }

  update(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // 별 이동
    this.stars.forEach(star => {
      star.x -= star.getData('speed');
      if (star.x < 0) {
        star.x = width;
        star.y = Math.random() * height;
      }
    });

    // 타이틀 글로우 효과
    this.titleGlow += 0.05;
    this.titleText.setShadow(0, 0, '#4a9eff', 20 + Math.sin(this.titleGlow) * 10, true, true);
  }

  // =================================================================
  // 배경 효과 메서드
  // =================================================================

  private createStarfield(width: number, height: number): void {
    // 3개 레이어: 배경(느림, 작음) -> 중경 -> 전경(빠름, 큼)
    const layers = [
      { count: 100, speed: 0.2, size: 1, alpha: 0.3 },
      { count: 50, speed: 0.5, size: 2, alpha: 0.6 },
      { count: 20, speed: 1.2, size: 3, alpha: 0.9 }
    ];

    layers.forEach(layer => {
      for (let i = 0; i < layer.count; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        const star = this.add.rectangle(x, y, layer.size, layer.size, 0xffffff);
        star.setAlpha(layer.alpha);
        star.setData('speed', layer.speed);
        this.stars.push(star);
      }
    });
  }

  private createGrid(width: number, height: number): void {
    // 바닥에 깔리는 투시 원근감 그리드 (장식용)
    const gridGraphics = this.add.graphics();
    gridGraphics.lineStyle(1, 0x1a3a5a, 0.3);
    
    // 수평선
    for (let i = 0; i < height; i += 40) {
      gridGraphics.moveTo(0, i);
      gridGraphics.lineTo(width, i);
    }
    // 수직선
    for (let i = 0; i < width; i += 40) {
      gridGraphics.moveTo(i, 0);
      gridGraphics.lineTo(i, height);
    }
    // 그리드는 정적으로 둠 (너무 어지럽지 않게)
  }

  // =================================================================
  // UI 컴포넌트 메서드
  // =================================================================

  private createTechButton(x: number, y: number, text: string, onClick: () => void, disabled: boolean = false): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    const w = 300;
    const h = 50;

    // 메인 배경 (잘린 모서리 느낌은 Graphics로 직접 그리기)
    const bg = this.add.graphics();
    const color = disabled ? 0x333333 : 0x0f3460;
    const hoverColor = 0x1a1a4e;
    const pressColor = 0x0f2040;
    const borderColor = disabled ? 0x555555 : 0x4a9eff;

    const drawButton = (bgColor: number, lineColor: number) => {
      bg.clear();
      bg.fillStyle(bgColor, 0.8);
      bg.lineStyle(2, lineColor, 1);
      
      // 육각형 느낌의 Chamfered Box
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

      // 장식용 라인 (Tech 느낌)
      bg.lineStyle(1, lineColor, 0.5);
      bg.beginPath();
      bg.moveTo(-w/2 + 5, h/2 + 4);
      bg.lineTo(w/2 - 5, h/2 + 4);
      bg.strokePath();
    };

    drawButton(color, borderColor);

    // 텍스트
    const btnText = this.add.text(0, 0, text, {
      fontSize: '18px',
      color: disabled ? '#888888' : '#ffffff',
      fontStyle: 'bold',
      fontFamily: 'Arial'
    });
    btnText.setOrigin(0.5);

    container.add([bg, btnText]);

    if (!disabled) {
      // 히트 영역 설정 (사각형)
      const hitArea = new Phaser.Geom.Rectangle(-w/2, -h/2, w, h);
      container.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);

      container.on('pointerover', () => {
        drawButton(hoverColor, 0x6acaff);
        btnText.setColor('#6acaff');
        this.tweens.add({
          targets: container,
          scaleX: 1.05,
          scaleY: 1.05,
          duration: 100
        });
      });

      container.on('pointerout', () => {
        drawButton(color, borderColor);
        btnText.setColor('#ffffff');
        this.tweens.add({
          targets: container,
          scaleX: 1,
          scaleY: 1,
          duration: 100
        });
      });

      container.on('pointerdown', () => {
        drawButton(pressColor, 0x225588);
        btnText.setColor('#aaaaaa');
        container.setScale(0.98);
      });

      container.on('pointerup', () => {
        drawButton(hoverColor, 0x6acaff);
        btnText.setColor('#6acaff');
        container.setScale(1.05);
        onClick();
      });
    }

    return container;
  }

  // =================================================================
  // 패널 로직 (디자인만 Tech 스타일로 변경)
  // =================================================================

  private showDifficultySelection(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // 메인 버튼 숨기기
    this.tweens.add({
      targets: this.mainButtons,
      alpha: 0,
      y: '+=20',
      duration: 300,
      onComplete: () => {
        this.mainButtons.forEach(btn => btn.setVisible(false));
      }
    });

    // 난이도 패널
    this.difficultyPanel = this.add.container(width / 2, height / 2);
    this.difficultyPanel.setAlpha(0);

    const title = this.add.text(0, -100, 'SELECT DIFFICULTY', {
      fontSize: '24px',
      color: '#4a9eff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const easy = this.createTechButton(0, -30, 'EASY', () => {
      this.selectedDifficulty = AIDifficulty.EASY;
      this.showAICountSelection();
    });
    
    const normal = this.createTechButton(0, 40, 'NORMAL', () => {
      this.selectedDifficulty = AIDifficulty.NORMAL;
      this.showAICountSelection();
    });

    const hard = this.createTechButton(0, 110, 'HARD', () => {
      this.selectedDifficulty = AIDifficulty.HARD;
      this.showAICountSelection();
    });

    const back = this.createTechButton(0, 200, 'ABORT', () => this.hideDifficultySelection());
    
    // 색상 커스터마이징 (난이도별 색상)
    // ... (복잡도 줄이기 위해 기본 스타일 사용, 텍스트로 구분)

    this.difficultyPanel.add([title, easy, normal, hard, back]);

    this.tweens.add({
      targets: this.difficultyPanel,
      alpha: 1,
      y: height / 2, // 원래 위치로
      duration: 400,
      ease: 'Power2'
    });
  }

  private hideDifficultySelection(): void {
    if (!this.difficultyPanel) return;

    this.tweens.add({
      targets: this.difficultyPanel,
      alpha: 0,
      duration: 300,
      onComplete: () => {
        this.difficultyPanel?.destroy();
        this.difficultyPanel = null;
        
        // 메인 버튼 복구
        this.mainButtons.forEach(btn => {
          btn.setVisible(true);
          btn.setAlpha(0);
          btn.y -= 20; // reset pos logic approx
        });
        
        this.tweens.add({
          targets: this.mainButtons,
          alpha: 1,
          y: '+=20',
          duration: 300
        });
      }
    });
  }

  private showAICountSelection(): void {
    if (this.difficultyPanel) {
      this.tweens.add({
        targets: this.difficultyPanel,
        alpha: 0,
        duration: 300,
        onComplete: () => this.difficultyPanel?.setVisible(false)
      });
    }

    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    this.aiCountPanel = this.add.container(width / 2, height / 2);
    this.aiCountPanel.setAlpha(0);

    const title = this.add.text(0, -100, 'ENEMY COUNT', {
      fontSize: '24px',
      color: '#ff4444',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const btn1 = this.createTechButton(0, -30, '1 vs 1 (DUEL)', () => this.startSinglePlayer(this.selectedDifficulty, 1));
    const btn2 = this.createTechButton(0, 40, '1 vs 2 (SKIRMISH)', () => this.startSinglePlayer(this.selectedDifficulty, 2));
    const btn3 = this.createTechButton(0, 110, '1 vs 3 (WAR)', () => this.startSinglePlayer(this.selectedDifficulty, 3));
    const back = this.createTechButton(0, 200, 'BACK', () => this.hideAICountSelection());

    this.aiCountPanel.add([title, btn1, btn2, btn3, back]);

    this.tweens.add({
      targets: this.aiCountPanel,
      alpha: 1,
      duration: 400,
      delay: 200
    });
  }

  private hideAICountSelection(): void {
    if (!this.aiCountPanel) return;

    this.tweens.add({
      targets: this.aiCountPanel,
      alpha: 0,
      duration: 300,
      onComplete: () => {
        this.aiCountPanel?.destroy();
        this.aiCountPanel = null;

        if (this.difficultyPanel) {
          this.difficultyPanel.setVisible(true);
          this.tweens.add({
            targets: this.difficultyPanel,
            alpha: 1,
            duration: 300
          });
        }
      }
    });
  }

  private startSinglePlayer(difficulty: AIDifficulty = AIDifficulty.NORMAL, aiCount: number = 1): void {
    // 페이드 아웃 후 시작
    this.cameras.main.fadeOut(1000, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('GameScene', { mode: 'single', difficulty, aiCount });
    });
  }
}
