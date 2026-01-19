// ==========================================
// GeminiService - 보안 프록시를 통한 AI 제어
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
  // 이제 API 키를 클라이언트에 저장하지 않습니다.
  private proxyUrl: string = '/.netlify/functions/gemini';

  async processNaturalLanguage(prompt: string): Promise<AICmd[]> {
    const systemInstruction = `
      당신은 RTS 게임의 사령관입니다. 사용자의 자연어 명령을 게임 엔진이 이해할 수 있는 JSON 명령어 배열로 변환하세요.
      
      사용 가능한 명령어 타입:
      1. { "type": "select", "target": "all" | "units" | "buildings" | "scv" | "marine" | "tank" | "goliath" }
      2. { "type": "move", "x": number, "y": number } (좌표 범위: 0~100)
      3. { "type": "attack", "x": number, "y": number }
      4. { "type": "build", "buildingType": "depot" | "barracks" | "factory" | "refinery" | "armory" }
      5. { "type": "train", "unitType": "scv" | "marine" | "firebat" | "medic" | "tank" | "goliath" }
      6. { "type": "hunt" }
      7. { "type": "stop" }
      8. { "type": "siege" }
      9. { "type": "stim" }
      
      응답은 반드시 순수 JSON 배열만 반환하세요.
    `;

    try {
      const response = await fetch(this.proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, systemInstruction })
      });

      if (!response.ok) {
        throw new Error('AI 서비스 연결 실패 (API Key 설정을 확인하세요)');
      }

      const data = await response.json();
      const textResponse = data.candidates[0].content.parts[0].text;
      
      const jsonMatch = textResponse.match(/\[.*\]/s);
      return jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    } catch (error) {
      console.error('Gemini Service Error:', error);
      throw error;
    }
  }

  // 항상 true 반환 (서버에서 키를 관리하므로)
  hasKey(): boolean {
    return true; 
  }
}

export const geminiService = new GeminiService();
