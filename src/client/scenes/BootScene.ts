// ==========================================
// BootScene - 게임 초기화 및 에셋 로딩
// ==========================================

import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    // 로딩 프로그레스 바 생성
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // 배경
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000);

    // 로딩 텍스트
    const loadingText = this.add.text(width / 2, height / 2 - 50, 'Loading...', {
      fontSize: '32px',
      color: '#ffffff',
    });
    loadingText.setOrigin(0.5);

    // 프로그레스 바 배경
    const progressBarBg = this.add.rectangle(width / 2, height / 2, 400, 30, 0x222222);
    progressBarBg.setOrigin(0.5);

    // 프로그레스 바
    const progressBar = this.add.rectangle(width / 2 - 195, height / 2, 0, 20, 0x00ff00);
    progressBar.setOrigin(0, 0.5);

    // 로딩 진행률 업데이트
    this.load.on('progress', (value: number) => {
      progressBar.width = 390 * value;
    });

    this.load.on('complete', () => {
      loadingText.setText('Complete!');
    });

    // ==========================================
    // Kenney Sci-Fi RTS 에셋 로딩
    // ==========================================
    this.loadKenneyAssets();
    
    // 플레이스홀더 에셋도 생성 (폴백용)
    this.createPlaceholderAssets();
  }

  create(): void {
    // 맵 타일맵 데이터 미리 생성 (128x128)
    this.generateMapTileset();
    
    // 메뉴 씬으로 전환
    this.scene.start('MenuScene');
  }
  
  // 맵용 타일셋 텍스처 미리 생성
  private generateMapTileset(): void {
    console.time('BootScene: generateMapTileset');
    
    // Kenney 타일 프레임들을 하나의 타일셋 텍스처로 합치기
    const tileSize = 32;
    const tileFrames = [
      'scifiTile_01.png', 'scifiTile_02.png', 'scifiTile_03.png', 'scifiTile_04.png', 
      'scifiTile_05.png', 'scifiTile_06.png', 'scifiTile_07.png', 'scifiTile_10.png',
      'scifiTile_13.png', 'scifiTile_14.png', 'scifiTile_15.png', 'scifiTile_16.png',
      'scifiTile_17.png', 'scifiTile_18.png', 'scifiTile_19.png', 'scifiTile_20.png',
      'scifiTile_21.png', 'scifiTile_27.png', 'scifiTile_28.png', 'scifiTile_29.png',
      'scifiTile_30.png', 'scifiTile_31.png', 'scifiTile_32.png', 'scifiTile_33.png',
      'scifiTile_34.png', 'scifiTile_35.png', 'scifiTile_41.png', 'scifiTile_42.png'
    ];
    
    // 타일셋 텍스처 생성 (가로로 나열: 28개 × 32px = 896px)
    const tilesetWidth = tileFrames.length * tileSize;
    const rt = this.make.renderTexture({ x: 0, y: 0, width: tilesetWidth, height: tileSize }, false);
    
    for (let i = 0; i < tileFrames.length; i++) {
      rt.drawFrame('scifi', tileFrames[i], i * tileSize, 0);
    }
    
    // 'map_tileset' 텍스처로 저장
    rt.saveTexture('map_tileset');
    rt.destroy();
    
    // 타일 인덱스 정보를 레지스트리에 저장
    this.registry.set('mapTileCount', tileFrames.length);
    
    console.timeEnd('BootScene: generateMapTileset');
  }

  // Kenney Sci-Fi RTS 에셋 로딩
  private loadKenneyAssets(): void {
    // 스프라이트시트 + XML 아틀라스 로딩
    // publicDir이 'assets'이므로 상대 경로 사용
    this.load.atlasXML(
      'scifi',
      'sprites/scifiRTS_spritesheet.png',
      'sprites/scifiRTS_spritesheet.xml'
    );
  }

  // 플레이스홀더 에셋 생성 (폴백용)
  private createPlaceholderAssets(): void {
    // 유닛 플레이스홀더 (32x32 사각형)
    const unitGraphics = this.make.graphics({ x: 0, y: 0 });
    unitGraphics.fillStyle(0x00ff00);
    unitGraphics.fillRect(0, 0, 32, 32);
    unitGraphics.generateTexture('unit_placeholder', 32, 32);
    unitGraphics.destroy();

    // 건물 플레이스홀더 (64x64 사각형)
    const buildingGraphics = this.make.graphics({ x: 0, y: 0 });
    buildingGraphics.fillStyle(0x0000ff);
    buildingGraphics.fillRect(0, 0, 64, 64);
    buildingGraphics.generateTexture('building_placeholder', 64, 64);
    buildingGraphics.destroy();

    // 자원 플레이스홀더 (24x24 사각형)
    const resourceGraphics = this.make.graphics({ x: 0, y: 0 });
    resourceGraphics.fillStyle(0x00ffff);
    resourceGraphics.fillRect(0, 0, 24, 24);
    resourceGraphics.generateTexture('mineral_placeholder', 24, 24);
    resourceGraphics.destroy();

    // 타일 플레이스홀더 (32x32)
    const tileGraphics = this.make.graphics({ x: 0, y: 0 });
    tileGraphics.fillStyle(0x333333);
    tileGraphics.fillRect(0, 0, 32, 32);
    tileGraphics.lineStyle(1, 0x444444);
    tileGraphics.strokeRect(0, 0, 32, 32);
    tileGraphics.generateTexture('tile_placeholder', 32, 32);
    tileGraphics.destroy();

    // 선택 원 플레이스홀더
    const selectionGraphics = this.make.graphics({ x: 0, y: 0 });
    selectionGraphics.lineStyle(2, 0x00ff00);
    selectionGraphics.strokeCircle(20, 20, 18);
    selectionGraphics.generateTexture('selection_circle', 40, 40);
    selectionGraphics.destroy();
  }
}
