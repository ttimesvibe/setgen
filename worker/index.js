// Cloudflare Worker — Set Generator
// Endpoints: POST /generate-set

const SYSTEM_PROMPT = `당신은 유튜브 인터뷰 채널 'ttimes'의 편집자입니다.
인터뷰 원고를 읽고 아래 형식의 "세트"를 생성합니다. 각 항목별로 2~3개 후보를 만들어주세요.

## 출력 형식 (JSON)
{
  "thumbnail": [
    {"lines": ["첫줄", "둘째줄", "셋째줄(선택)"]},
    {"lines": ["첫줄", "둘째줄", "셋째줄(선택)"]}
  ],
  "youtube_title": ["후보1", "후보2", "후보3"],
  "description": ["후보1", "후보2"]
}

## 각 항목 규칙

### 썸네일/리스트 제목 (thumbnail)
- 2~3줄, 각 줄 15자 내외
- 첫 줄: 게스트 정체성이나 주제의 훅 (예: "30년 개발자의 기업분석", "(커머스) (SNS) (성인 모드)")
- 둘째 줄: 충격/호기심 유발 (예: "빅테크가 왜 사람 자르냐구요?", "'AI = 챗GPT' 시절은 갔다")
- 셋째 줄(선택): 구체적 사례 (예: "아마존은 어떻게 일하는지 아세요?", "오픈AI 줄줄이 서비스 접는 이유")

### 유튜브 제목 (youtube_title)
- 1줄, 40~60자
- 핵심 주제 + (게스트명 직함) 형식
- 예: "1년간 현장에서 겪어본 '토큰 이코노미'의 현실 (30년 개발자 박종천)"

### 유튜브 설명/기사/페북 (description)
- 3~5문장 요약문
- 첫 문장: 트렌드/이슈 제시
- 중간: 핵심 인사이트 2~3개, 구체적 내용 포함
- 마지막: 게스트 소개 + 시청/구독 유도
- 예: "클로드 코드와 '오퍼스 4.6' 등장 이후 에이전틱 AI의 성능이 임계점을 넘었다는 분석이 많습니다..."

## 중요 원칙
- 원고의 핵심 주제와 게스트의 독특한 시각을 반영
- 과장하지 않되, 클릭을 유도할 수 있는 자연스러운 표현
- 게스트의 발언 중 인상적인 표현을 활용
- JSON만 출력하고 다른 텍스트는 포함하지 마세요`;

function compressScript(text, maxChars = 12000) {
  if (text.length <= maxChars) return text;
  const headSize = Math.floor(maxChars * 0.4);
  const tailSize = Math.floor(maxChars * 0.4);
  const midSize = maxChars - headSize - tailSize - 100;
  const midStart = Math.floor(text.length * 0.4);
  return text.substring(0, headSize) +
    "\n\n[... 중략 ...]\n\n" +
    text.substring(midStart, midStart + midSize) +
    "\n\n[... 중략 ...]\n\n" +
    text.substring(text.length - tailSize);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });

    if (url.pathname === "/generate-set" && request.method === "POST") {
      try {
        const { script, guest_name, guest_title } = await request.json();
        if (!script) return Response.json({ success: false, error: "script required" }, { headers: cors });

        const compressed = compressScript(script);
        const userPrompt = `## 게스트 정보
- 이름: ${guest_name || "(원고에서 추출해주세요)"}
- 직함/소속: ${guest_title || "(원고에서 추출해주세요)"}

## 인터뷰 원고
${compressed}`;

        const apiKey = env.OPENAI_API_KEY;
        if (!apiKey) return Response.json({ success: false, error: "OPENAI_API_KEY not configured" }, { headers: cors, status: 500 });

        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "gpt-4.1",
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: userPrompt },
            ],
            temperature: 0.8,
            max_tokens: 2000,
          }),
        });

        const data = await res.json();
        if (data.error) return Response.json({ success: false, error: data.error.message }, { headers: cors });

        const content = data.choices?.[0]?.message?.content || "";
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return Response.json({ success: false, error: "AI 응답 파싱 실패", raw: content }, { headers: cors });

        const result = JSON.parse(jsonMatch[0]);
        return Response.json({ success: true, result }, { headers: cors });
      } catch (e) {
        return Response.json({ success: false, error: e.message }, { headers: cors, status: 500 });
      }
    }

    if (url.pathname === "/debug-location") {
      return Response.json({ colo: request.cf?.colo, country: request.cf?.country }, { headers: cors });
    }

    return new Response("Set Generator Worker", { headers: cors });
  },
};
