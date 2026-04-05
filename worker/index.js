// Cloudflare Worker — Set Generator v5
// CTR-first design: "트렌드와 원고의 교집합에서 클릭하고 싶은 앵글을 찾는다"

// ═══════════════════════════════
// PROMPTS
// ═══════════════════════════════

const KEYWORD_SYSTEM = `인터뷰 원고에서 유튜브 검색에 활용할 핵심 키워드를 추출합니다.
JSON만 출력. 다른 텍스트 없이.
{"keywords":["키워드1","키워드2",...],"guest_summary":"게스트 한줄 소개","notable_quotes":["인상적 발언1","인상적 발언2"]}
규칙:
- keywords: 6~10개. 고유명사(인물, 기업, 서비스명) 우선. "AI 커머스"처럼 구체화
- notable_quotes: 원고에서 게스트가 한 인상적 발언 3~5개 (원문 그대로). 직관적이고 파급력 있는 표현 우선`;

function makeSetPrompt(type) {
  var typeGuide = {
    balanced: `## 이번 후보: ⚖️ 밸런스형
원고의 핵심 발언 + 시의성 있는 트렌드의 교집합을 찾아 앵글을 잡습니다.
- 썸네일/제목: 원고 내용에 충실하되, 트렌드 데이터에서 시의성이 확인된 표현을 자연스럽게 활용
- 설명문: 원고 내용 요약 + "지금 왜 이 주제가 중요한지" 시의성 연결`,

    script: `## 이번 후보: 📝 스크립트 충실형
게스트만의 독보적 시각과 인상적 발언을 최대한 살립니다.
- 썸네일/제목: 게스트의 실제 발언이나 비유를 직접 활용. 트렌드 키워드를 억지로 넣지 않음
- 설명문: 게스트의 분석과 주장을 충실하게 전달
- "이 게스트가 아니면 들을 수 없는 이야기"가 드러나야 함`,

    trend: `## 이번 후보: 🔍 시의성 극대화형
지금 사람들이 관심 있는 주제와 원고 내용의 교집합을 극대화합니다.
- 썸네일/제목: 뉴스건수가 많거나 급상승 중인 키워드를 앞에 배치. "지금 뜨는 주제"임을 즉시 느끼게
- 설명문: 현재 이슈 → 원고의 분석 → 왜 지금 봐야 하는지 순서로 구성
- 트렌드 데이터에서 뉴스 건수가 가장 많은 키워드, 급상승 매칭된 키워드를 최우선 활용`,
  };

  return `당신은 유튜브 인터뷰 채널 'ttimes'의 편집자입니다.

## ttimes 채널 특성 (반드시 참고)
- 구독자 수만~수십만 규모의 테크/비즈니스 심층 인터뷰 채널
- 시청자 유입의 69%가 홈 피드 추천(41%)과 추천 동영상(28%)
- 검색 유입은 11.7%에 불과 → 태그/검색 최적화보다 CTR이 핵심
- 현재 노출 클릭률 3.5% → 4~5%로 올리는 것이 최우선 목표
- 검색 유입 시 시청자가 치는 키워드의 97%가 1~2단어

## 세트 생성의 핵심 원칙

### 1. 썸네일/제목의 목적: 홈 피드에서 스크롤을 멈추게 하는 것
- 유튜브 홈 피드에서 수십 개 영상 사이에서 "이건 봐야 한다"고 느끼게 만들어야 함
- 핵심은 "정보 격차(information gap)" — 모르면 손해일 것 같은 느낌
- 구체적 숫자, 고유명사, 대비 구조가 효과적
- "충격", "경악", "소름", "미쳤다" 같은 자극어는 오히려 CTR을 낮춤 (어그로로 인식)

### 2. 시의성이 CTR을 올린다
- "지금 뜨고 있는 주제"라는 느낌이 클릭을 유도
- 트렌드 데이터에서 뉴스 건수가 많은 키워드 = 지금 사람들이 관심 있는 주제
- 급상승 키워드와 원고 내용의 교집합 = 최고의 앵글
- 단, 원고에 없는 내용을 시의성을 위해 지어내면 절대 안 됨 (Quality CTR 하락)

### 3. 약속과 이행의 일치 (Quality CTR)
- 썸네일/제목이 약속한 것을 영상이 반드시 전달해야 함
- 유튜브는 "높은 CTR + 낮은 시청유지율 = 클릭베이트"로 판단하여 추천 억제
- 원고에 분명히 있는 내용만 활용. 과장하지 않되, 가장 흥미로운 각도로 포장

${typeGuide[type]}

## 출력 형식 (JSON만 출력, 다른 텍스트 없이)
{
  "tags": [{"tag":"키워드","source":"trend|script|both","reason":"근거"}],
  "thumbnail": {"lines":["줄1","줄2","줄3(선택)"],"reason":"이 앵글을 선택한 이유"},
  "youtube_title": {"text":"제목","reason":"이 제목의 CTR 전략"},
  "description": {"text":"설명문","reason":"구성 전략"}
}

## 태그 규칙 (ttimes 채널 데이터 기반)
- 총 12~15개
- 1단어 태그 5~6개: 게스트명, 핵심 고유명사 (카테고리 분류 신호)
- 2단어 태그 6~8개: 주제 조합 (실제 검색 매칭용)
- 3단어 태그 1~2개: 자연스러운 것만
- 4단어 이상은 넣지 않음 (ttimes 시청자의 검색어 97%가 1~2단어)
- source: trend/script/both. reason에 구체적 근거

## 썸네일 규칙
- 2~3줄, 각 줄 15자 내외
- 홈 피드에서 스크롤을 멈추게 할 "정보 격차" 구조
- 구체적 숫자("하루 200억 손실"), 대비("A는 성장, B는 위기"), 고유명사 활용
- 게스트의 인상적 발언을 활용하면 차별화됨

## 유튜브 제목 규칙
- 1줄, 40~60자
- 핵심 주제어를 앞 20자 안에 배치 (모바일에서 뒤가 잘림)
- (게스트명 직함) 형식으로 끝남
- "~의 진짜 이유", "~할 수 있을까" 같은 호기심 유발 구조

## 설명문 규칙
- 4~6문장, 충분히 구체적으로
- 첫 문장: 시의성 있는 이슈 제시 (지금 왜 이 주제가 중요한지)
- 중간: 핵심 인사이트 2~3개 (구체적 사실/숫자 포함)
- 마지막: 게스트 소개 + 시청 유도
- 원고에 없는 내용 절대 지어내지 말 것

## 트렌드 데이터 해석법
- 자동완성 순서 = 검색량 순위 (1번이 가장 많이 검색됨)
- 🔥급상승 = Google Trends에서 현재 급상승 중인 키워드 → 시의성 최고
- 📰뉴스 N건 = 최근 24시간 뉴스 기사 수 → 많을수록 지금 화제
- 급상승 + 뉴스 많음 + 원고 내용 = 최적의 앵글
- reason에 "뉴스 N건으로 시의성 확인", "급상승 매칭" 등 구체적 근거 기재`;
}

// ═══════════════════════════════
// EXTERNAL DATA FETCHERS (변경 없음)
// ═══════════════════════════════

async function getYTSuggestions(keyword) {
  try {
    var res = await fetch("https://clients1.google.com/complete/search?client=youtube&hl=ko&gl=kr&ds=yt&q=" + encodeURIComponent(keyword), { headers: { "User-Agent": "Mozilla/5.0" } });
    var text = await res.text();
    var s = text.indexOf("["), e = text.lastIndexOf("]") + 1;
    if (s === -1) return [];
    return (JSON.parse(text.substring(s, e))[1] || []).map(function(i) { return i[0]; });
  } catch (e) { return []; }
}

async function getGoogleSuggestions(keyword) {
  try {
    var res = await fetch("https://suggestqueries.google.com/complete/search?client=firefox&hl=ko&gl=kr&q=" + encodeURIComponent(keyword), { headers: { "User-Agent": "Mozilla/5.0" } });
    return (await res.json())[1] || [];
  } catch (e) { return []; }
}

async function getGoogleTrendsRSS() {
  try {
    var res = await fetch("https://trends.google.com/trending/rss?geo=KR", { headers: { "User-Agent": "Mozilla/5.0" } });
    var xml = await res.text();
    var titles = [];
    var re = /<title><!\[CDATA\[([^\]]+)\]\]><\/title>/g;
    var m;
    while ((m = re.exec(xml)) !== null) { titles.push(m[1]); }
    if (titles.length <= 1) {
      re = /<item>[\s\S]*?<title>([^<]+)<\/title>/g;
      while ((m = re.exec(xml)) !== null) { titles.push(m[1]); }
    }
    return titles.slice(0, 20);
  } catch (e) { return []; }
}

async function getNewsCount(keyword) {
  try {
    var url = "https://news.google.com/rss/search?q=" + encodeURIComponent(keyword) + "+when:1d&hl=ko&gl=KR&ceid=KR:ko";
    var res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    var xml = await res.text();
    return (xml.match(/<item>/g) || []).length;
  } catch (e) { return 0; }
}

// ═══════════════════════════════
// HELPERS (변경 없음)
// ═══════════════════════════════

function compressScript(text, maxChars) {
  if (text.length <= maxChars) return text;
  var h = Math.floor(maxChars * 0.4), t = Math.floor(maxChars * 0.4);
  var mid = maxChars - h - t - 50, ms = Math.floor(text.length * 0.4);
  return text.substring(0, h) + "\n[...중략...]\n" + text.substring(ms, ms + mid) + "\n[...중략...]\n" + text.substring(text.length - t);
}

async function callGPT(system, user, apiKey, maxTokens, temp) {
  var res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": "Bearer " + apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-4.1", messages: [{ role: "system", content: system }, { role: "user", content: user }], temperature: temp, max_tokens: maxTokens }),
  });
  var data = await res.json();
  if (data.error) throw new Error(data.error.message);
  var content = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "";
  var jm = content.match(/\{[\s\S]*\}/);
  if (!jm) throw new Error("JSON parse failed: " + content.substring(0, 300));
  return JSON.parse(jm[0]);
}

// ═══════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════

export default {
  async fetch(request, env) {
    var url = new URL(request.url);
    var cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST,OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });

    if (url.pathname === "/generate-set" && request.method === "POST") {
      try {
        var body = await request.json();
        var script = body.script, guest_name = body.guest_name, guest_title = body.guest_title;
        if (!script) return Response.json({ success: false, error: "script required" }, { headers: cors });
        var apiKey = env.OPENAI_API_KEY;
        if (!apiKey) return Response.json({ success: false, error: "OPENAI_API_KEY not configured" }, { headers: cors, status: 500 });

        // ── Step 1: 키워드 + 인상적 발언 추출 ──
        var kwResult = await callGPT(KEYWORD_SYSTEM, compressScript(script, 10000), apiKey, 800, 0.3);
        var keywords = kwResult.keywords || [];
        var guestSummary = kwResult.guest_summary || "";
        var notableQuotes = kwResult.notable_quotes || [];

        // ── Step 2: 트렌드 데이터 병렬 수집 ──
        var trendData = {};
        var kwSlice = keywords.slice(0, 8);

        var acPromises = kwSlice.map(function(kw) {
          return Promise.all([getYTSuggestions(kw), getGoogleSuggestions(kw), getNewsCount(kw)]).then(function(r) {
            trendData[kw] = { youtube: r[0].slice(0, 8), google: r[1].slice(0, 8), news_24h: r[2] };
          });
        });
        var trendsPromise = getGoogleTrendsRSS();
        var results = await Promise.all([Promise.all(acPromises), trendsPromise]);
        var trendingNow = results[1] || [];

        // ── Step 3: 트렌드 블록 포맷 ──
        var tb = "## 실시간 트렌드 데이터\n\n";
        tb += "### 🔥 Google Trends 한국 급상승 검색어 (상위 20)\n";
        if (trendingNow.length > 0) {
          trendingNow.forEach(function(t, i) { tb += (i + 1) + ". " + t + "\n"; });
        } else { tb += "(수집 실패)\n"; }

        tb += "\n### 키워드별 시의성 지표\n\n";
        for (var kw in trendData) {
          var d = trendData[kw];
          tb += '#### "' + kw + '" 📰뉴스 ' + d.news_24h + '건/24h';
          var matched = trendingNow.filter(function(t) { return t.indexOf(kw) >= 0 || kw.indexOf(t) >= 0; });
          if (matched.length > 0) tb += " 🔥급상승";
          tb += "\n";
          if (d.youtube.length > 0) {
            tb += "YT자동완성: " + d.youtube.slice(0, 5).map(function(s, i) { return (i+1) + "." + s; }).join(" | ") + "\n";
          }
          if (d.google.length > 0) {
            tb += "Google자동완성: " + d.google.slice(0, 5).map(function(s, i) { return (i+1) + "." + s; }).join(" | ") + "\n";
          }
          tb += "\n";
        }

        // 인상적 발언 블록
        var quotesBlock = "";
        if (notableQuotes.length > 0) {
          quotesBlock = "\n## 게스트 인상적 발언 (원문)\n";
          notableQuotes.forEach(function(q, i) { quotesBlock += (i+1) + ". \"" + q + "\"\n"; });
        }

        // ── Step 4: 3개 후보 개별 호출 ──
        var guestInfo = "## 게스트\n- 이름: " + (guest_name || "(추출)") + "\n- 직함: " + (guest_title || guestSummary || "(추출)") + "\n\n";
        var scriptBlock = "\n## 인터뷰 원고\n" + compressScript(script, 7000);
        var userBase = guestInfo + tb + quotesBlock + scriptBlock;

        var setResults = await Promise.all([
          callGPT(makeSetPrompt("balanced"), userBase, apiKey, 2000, 0.8),
          callGPT(makeSetPrompt("script"), userBase, apiKey, 2000, 0.7),
          callGPT(makeSetPrompt("trend"), userBase, apiKey, 2000, 0.85),
        ]);

        // ── 결과 병합 ──
        var merged = {
          tags: [],
          thumbnail: [
            Object.assign({ type: "balanced" }, setResults[0].thumbnail),
            Object.assign({ type: "script" }, setResults[1].thumbnail),
            Object.assign({ type: "trend" }, setResults[2].thumbnail),
          ],
          youtube_title: [
            Object.assign({ type: "balanced" }, setResults[0].youtube_title),
            Object.assign({ type: "script" }, setResults[1].youtube_title),
            Object.assign({ type: "trend" }, setResults[2].youtube_title),
          ],
          description: [
            Object.assign({ type: "balanced" }, setResults[0].description),
            Object.assign({ type: "script" }, setResults[1].description),
            Object.assign({ type: "trend" }, setResults[2].description),
          ],
        };

        // 태그 병합 (3개 호출 합산, 중복 제거)
        var tagMap = {};
        setResults.forEach(function(sr) {
          (sr.tags || []).forEach(function(t) {
            if (!tagMap[t.tag]) tagMap[t.tag] = t;
            else if (t.source === "both") tagMap[t.tag] = t;
          });
        });
        merged.tags = Object.values(tagMap).slice(0, 15);

        return Response.json({
          success: true,
          result: merged,
          trend_data: trendData,
          trending_now: trendingNow,
          keywords_extracted: keywords,
          notable_quotes: notableQuotes,
        }, { headers: cors });

      } catch (e) {
        return Response.json({ success: false, error: e.message }, { headers: cors, status: 500 });
      }
    }

    if (url.pathname === "/debug-location") {
      return Response.json({ colo: request.cf ? request.cf.colo : "?", country: request.cf ? request.cf.country : "?" }, { headers: cors });
    }

    return new Response("Set Generator v5", { headers: cors });
  },
};
