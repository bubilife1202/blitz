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
  resourceType?: string;
}

export class GeminiService {
  // 이제 API 키를 클라이언트에 저장하지 않습니다.
  private proxyUrl: string = '/.netlify/functions/gemini';

  async processNaturalLanguage(prompt: string): Promise<AICmd[]> {
    const systemInstruction = `
      당신은 RTS 게임의 사령관입니다. 사용자의 자연어 명령을 게임 엔진이 이해할 수 있는 JSON 명령어 배열로 변환하세요.
      
      중요 규칙:
      - 복합 명령(A하고 B해라)은 각각 독립적으로 처리하세요
      - 일꾼(SCV)은 자원 채취와 건설만 가능합니다. 절대 공격/전투 명령을 주지 마세요
      - 공격/전투 명령은 반드시 전투 유닛(marine, firebat, tank, goliath, vulture)에게만 내리세요
      - "공격해라", "적을 쳐라" 등은 { "type": "select", "target": "units" } 후 { "type": "hunt" } 사용
      
      사용 가능한 명령어 타입:
      1. { "type": "select", "target": "all" | "units" | "buildings" | "scv" | "marine" | "tank" | "goliath" }
      2. { "type": "move", "x": number, "y": number } (좌표 범위: 0~100)
      3. { "type": "attack", "x": number, "y": number }
      4. { "type": "build", "buildingType": "depot" | "barracks" | "factory" | "refinery" | "armory" }
      5. { "type": "train", "unitType": "scv" | "marine" | "firebat" | "medic" | "tank" | "goliath" }
      6. { "type": "hunt" } - 전투 유닛이 가장 가까운 적을 자동 추적 공격
      7. { "type": "gather", "resourceType": "minerals" | "gas" }
      8. { "type": "stop" }
      9. { "type": "siege" }
      10. { "type": "stim" }
      
      응답은 반드시 순수 JSON 배열만 반환하세요.
      
      예시:
      - "일꾼들 일시켜" -> [{"type": "select", "target": "scv"}, {"type": "gather", "resourceType": "minerals"}]
      - "일꾼 일시키고 공격해" -> [{"type": "select", "target": "scv"}, {"type": "gather", "resourceType": "minerals"}, {"type": "select", "target": "units"}, {"type": "hunt"}]
      - "빨리 공격해" -> [{"type": "select", "target": "units"}, {"type": "hunt"}]
      - "마린 뽑아" -> [{"type": "train", "unitType": "marine"}]
    `;

    try {
      const response = await fetch(this.proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, systemInstruction })
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.error || 'Unknown Server Error';
        throw new Error(`AI 서비스 응답 에러: ${errorMsg} (Netlify 환경변수 GEMINI_API_KEY와 배포 상태를 확인하세요)`);
      }

      const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!textResponse) {
        throw new Error('AI가 응답을 생성하지 못했습니다.');
      }
      
      const jsonMatch = textResponse.match(/\[.*\]/s);
      return jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    } catch (error: any) {
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
