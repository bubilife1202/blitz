// ==========================================
// GeminiService - 자연어 명령을 게임 로직으로 변환
// ==========================================

export interface AICmd {
  type: string;
  target?: string;
  x?: number;
  y?: number;
  buildingType?: string;
  unitType?: string;
}

export class GeminiService {
  private apiKey: string = '';
  private modelName: string = 'gemini-2.0-flash';
  private apiUrl: string = 'https://generativelanguage.googleapis.com/v1beta/models';

  setApiKey(key: string): void {
    this.apiKey = key;
  }

  hasKey(): boolean {
    return this.apiKey !== '';
  }

  async processNaturalLanguage(prompt: string): Promise<AICmd[]> {
    if (!this.apiKey) {
      throw new Error('API Key가 설정되지 않았습니다. "setkey [API키]" 명령어를 먼저 입력해주세요.');
    }

    const systemInstruction = `
      당신은 RTS 게임의 사령관입니다. 사용자의 자연어 명령을 게임 엔진이 이해할 수 있는 JSON 명령어 배열로 변환하세요.
      
      사용 가능한 명령어 타입:
      1. { "type": "select", "target": "all" | "units" | "buildings" | "scv" | "marine" | "tank" | "goliath" }
      2. { "type": "move", "x": number, "y": number } (좌표 범위: 0~100)
      3. { "type": "attack", "x": number, "y": number }
      4. { "type": "build", "buildingType": "depot" | "barracks" | "factory" | "refinery" | "armory" }
      5. { "type": "train", "unitType": "scv" | "marine" | "firebat" | "medic" | "tank" | "goliath" }
      6. { "type": "hunt" } (가까운 적 자동 추적 공격)
      7. { "type": "stop" }
      8. { "type": "siege" } (시즈탱크 모드 변경)
      9. { "type": "stim" } (마린/파이어뱃 스팀팩)
      
      응답은 반드시 다른 설명 없이 순수 JSON 배열만 반환하세요.
      좌표(x, y)는 0에서 100 사이의 숫자로 표현하세요. (게임 내부에서 32배수 타일로 자동 변환됨)
      
      예시: "해병들 다 선택해서 적진으로 가" -> [{"type": "select", "target": "marine"}, {"type": "hunt"}]
      예시: "50 50 위치에 배럭 지어" -> [{"type": "build", "buildingType": "barracks", "x": 50, "y": 50}]
    `;

    try {
      const response = await fetch(`${this.apiUrl}/${this.modelName}:generateContent?key=${this.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `${systemInstruction}\n\n사용자 명령: "${prompt}"`
            }]
          }]
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API Error: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      const textResponse = data.candidates[0].content.parts[0].text;
      
      // JSON 부분만 추출
      const jsonMatch = textResponse.match(/\[.*\]/s);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      return [];
    } catch (error) {
      console.error('Gemini API Error:', error);
      throw error;
    }
  }
}

export const geminiService = new GeminiService();
