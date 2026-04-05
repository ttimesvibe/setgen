// Cloudflare Worker — Set Generator v3
// Phase 1: YouTube/Google Autocomplete + 3-character candidates + tags

const KEYWORD_SYSTEM = `인터뷰 원고에서 유튜브 검색에 활용할 핵심 키워드를 추출합니다.
JSON만 출력하세요. 다른 텍스트 없이.
{"keywords": ["키워드1", "키워드2", ...], "guest_summary": "게스트 한줄 소개"}
규칙:
- 6~10개 키워드
- 고유명사(인물, 기업, 서비스명) 우선
- 원고에서 반복 등장하거나 핵심 논점인 단어
- 너무 일반적인 단어(AI, 기술, 시장) 단독 사용 금지 — "AI 커머스", "AI 거품론"처럼 구체화`;

const SET_SYSTEM = `당신은 유튜브 인터뷰 채널 'ttimes'의 편집자입니다.
인터뷰 원고와 실시간 트렌드 데이터를 기반으로 "세트"를 생성합니다.

## 출력 형식 (반드시 이 JSON 구조를 따르세요)
{
  "tags": [
    {"tag": "키워드", "source": "trend 또는 script 또는 both", "reason": "근거 설명"}
  ],
  "thumbnail": [
    {"type": "balanced", "lines": ["줄1", "줄2", "줄3(선택)"], "reason": "이 조합을 선택한 이유"},
    {"type": "script", "lines": ["줄1", "줄2", "줄3(선택)"], "reason": "이 조합을 선택한 이유"},
    {"type": "trend", "lines": ["줄1", "줄2", "줄3(선택)"], "reason": "이 조합을 선택한 이유"}
  ],
  "youtube_title": [
    {"type": "balanced", "text": "제목", "reason": "근거"},
    {"type": "script", "text": "제목", "reason": "근거"},
    {"type": "trend", "text": "제목", "reason": "근거"}
  ],
  "description": [
    {"type": "balanced", "text": "설명문", "reason": "근거"},
    {"type": "script", "text": "설명문", "reason": "근거"},
    {"type": "trend", "text": "설명문", "reason": "근거"}
  ]
}

## 3가지 후보 성격 (반드시 3개 모두 생성)
- balanced: 스크립트 내용 50% + 트렌드 키워드 50% 균형
- script: 원고의 핵심 발언과 분석에 충실. 게스트만의 독특한 시각 강조. 트렌드 의존 최소화
- trend: 트렌드 자동완성 키워드를 제목에 직접 사용. 검색/추천 노출 극대화

## 태그 규칙
- 10~15개
- source: "trend"=트렌드 데이터에서 추출, "script"=원고 내용에서 추출, "both"=양쪽 모두
- reason: 왜 이 태그를 추천하는지 한 문장 (예: "YouTube 자동완성 3번째 노출 + 원고 후반부 핵심 주제")

## 썸네일 규칙
- 2~3줄, 각 줄 15자 내외
- 구체적 숫자, 고유명사 활용
- "충격", "경악", "소름" 같은 자극적 감탄사 금지

## 유튜브 제목 규칙
- 1줄, 40~60자
- 앞 30자 안에 핵심 검색 키워드 배치
- (게스트명 직함) 형식으로 끝남

## 설명문 규칙
- 3~5문장
- 원고에 없는 내용 절대 지어내지 말 것

## 중요
- 트렌드 데이터에서 "자동완성 순서"가 곧 검색량 순위. 1번이 가장 많이 검색됨
- reason에 "YouTube 자동완성 N번째", "Google 자동완성 N번째" 등 구체적 근거 기재
- JSON만 출력. 다른 텍스트 없이`;

async function getYTSuggestions(keyword) {
  try {
    const url = "https://clients1.google.com/complete/search?client=youtube&hl=ko&gl=kr&ds=yt&q=" + encodeURIComponent(keyword);
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    const text = await res.text();
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]") + 1;
    if (start === -1) return [];
    const data = JSON.parse(text.substring(start, end));
    return (data[1] || []).map(item => item[0]);
  } catch (e) {
    console.warn("YT suggest failed for " + keyword + ": " + e.message);
    return [];
  }
}

async function getGoogleSuggestions(keyword) {
  try {
    const url = "https://suggestqueries.google.com/complete/search?client=firefox&hl=ko&gl=kr&q=" + encodeURIComponent(keyword);
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    const data = await res.json();
    return data[1] || [];
  } catch (e) {
    console.warn("Google suggest failed for " + keyword + ": " + e.message);
    return [];
  }
}

function compressScript(text, maxChars) {
  if (text.length <= maxChars) return text;
  const headSize = Math.floor(maxChars * 0.4);
  const tailSize = Math.floor(maxChars * 0.4);
  const midSize = maxChars - headSize - tailSize - 100;
  const midStart = Math.floor(text.length * 0.4);
  return text.substring(0, headSize) + "\n\n[... 중략 ...]\n\n" + text.substring(midStart, midStart + midSize) + "\n\n[... 중략 ...]\n\n" + text.substring(text.length - tailSize);
}

async function callGPT(systemPrompt, userPrompt, apiKey, maxTokens, temperature) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": "Bearer " + apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4.1",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: temperature,
      max_tokens: maxTokens,
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  var content = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "";
  var jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("AI JSON parse failed: " + content.substring(0, 300));
  return JSON.parse(jsonMatch[0]);
}

export default {
  async fetch(request, env) {
    var url = new URL(request.url);
    var cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });

    if (url.pathname === "/generate-set" && request.method === "POST") {
      try {
        var body = await request.json();
        var script = body.script;
        var guest_name = body.guest_name;
        var guest_title = body.guest_title;
        if (!script) return Response.json({ success: false, error: "script required" }, { headers: cors });

        var apiKey = env.OPENAI_API_KEY;
        if (!apiKey) return Response.json({ success: false, error: "OPENAI_API_KEY not configured" }, { headers: cors, status: 500 });

        var compressed = compressScript(script, 10000);

        // Step 1: 키워드 추출
        var kwResult = await callGPT(KEYWORD_SYSTEM, compressed, apiKey, 500, 0.3);
        var keywords = kwResult.keywords || [];
        var guestSummary = kwResult.guest_summary || "";

        // Step 2: Autocomplete 병렬 호출
        var trendData = {};
        var kwSlice = keywords.slice(0, 8);
        var promises = kwSlice.map(function(kw) {
          return Promise.all([getYTSuggestions(kw), getGoogleSuggestions(kw)]).then(function(results) {
            trendData[kw] = { youtube: results[0].slice(0, 8), google: results[1].slice(0, 8) };
          });
        });
        await Promise.all(promises);

        // Step 3: 트렌드 포맷
        var trendBlock = "## 실시간 트렌드 데이터 (YouTube/Google Autocomplete 실측)\n\n";
        trendBlock += "아래 자동완성 목록에서 순서가 곧 검색량 순위입니다 (1번 = 가장 많이 검색됨).\n\n";
        for (var kw in trendData) {
          var d = trendData[kw];
          trendBlock += '### 키워드: "' + kw + '"\n';
          if (d.youtube.length > 0) {
            trendBlock += "YouTube 자동완성:\n";
            d.youtube.forEach(function(s, i) { trendBlock += "  " + (i+1) + ". " + s + "\n"; });
          }
          if (d.google.length > 0) {
            trendBlock += "Google 자동완성:\n";
            d.google.forEach(function(s, i) { trendBlock += "  " + (i+1) + ". " + s + "\n"; });
          }
          trendBlock += "\n";
        }

        // Step 4: 세트 생성
        var userPrompt = "## 게스트 정보\n- 이름: " + (guest_name || "(원고에서 추출)") + "\n- 직함/소속: " + (guest_title || guestSummary || "(원고에서 추출)") + "\n\n" + trendBlock + "\n## 인터뷰 원고\n" + compressScript(script, 8000);

        var result = await callGPT(SET_SYSTEM, userPrompt, apiKey, 4000, 0.8);

        return Response.json({
          success: true,
          result: result,
          trend_data: trendData,
          keywords_extracted: keywords,
        }, { headers: cors });

      } catch (e) {
        return Response.json({ success: false, error: e.message }, { headers: cors, status: 500 });
      }
    }

    if (url.pathname === "/debug-location") {
      return Response.json({ colo: request.cf?.colo, country: request.cf?.country }, { headers: cors });
    }

    return new Response("Set Generator v3", { headers: cors });
  },
};
