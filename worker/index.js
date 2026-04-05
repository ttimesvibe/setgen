// Cloudflare Worker — Set Generator v4
// 4 separate GPT calls + Google Trends RSS + News RSS

// ═══════════════════════════════
// PROMPTS
// ═══════════════════════════════

const KEYWORD_SYSTEM = `인터뷰 원고에서 유튜브 검색에 활용할 핵심 키워드를 추출합니다.
JSON만 출력. 다른 텍스트 없이.
{"keywords":["키워드1","키워드2",...],"guest_summary":"게스트 한줄 소개"}
규칙: 6~10개, 고유명사 우선, "AI 커머스"처럼 구체화`;

function makeSetPrompt(type) {
  const typeDesc = {
    balanced: "스크립트 내용과 트렌드 키워드를 50:50으로 균형 있게 반영합니다. 원고의 핵심 발언을 살리되, 트렌드 자동완성 상위 키워드도 제목에 자연스럽게 녹여주세요.",
    script: "원고의 핵심 발언과 분석에 충실합니다. 게스트만의 독특한 시각과 표현을 최대한 살려주세요. 트렌드 자동완성 키워드를 억지로 넣지 마세요. 원고에 있는 인상적 표현이나 비유를 활용하세요.",
    trend: "트렌드 자동완성 상위 1~3위 키워드를 제목에 반드시 포함합니다. 유튜브 검색과 추천 알고리즘 노출을 극대화하세요. 급상승 키워드가 있으면 최우선 반영하세요.",
  };
  return `당신은 유튜브 인터뷰 채널 'ttimes'의 편집자입니다.

## 이번 후보의 성격: ${type === "balanced" ? "⚖️ 밸런스형" : type === "script" ? "📝 스크립트 충실형" : "🔍 트렌드 공략형"}
${typeDesc[type]}

## 출력 형식 (JSON만 출력, 다른 텍스트 없이)
{
  "tags": [{"tag":"키워드","source":"trend|script|both","reason":"근거"}],
  "thumbnail": {"lines":["줄1","줄2","줄3(선택)"],"reason":"이유"},
  "youtube_title": {"text":"제목","reason":"근거"},
  "description": {"text":"설명문 3~5문장","reason":"근거"}
}

## 태그: 10~15개. source: trend/script/both. reason에 "YouTube 자동완성 N번째" 등 구체적 근거
## 썸네일: 2~3줄, 각 줄 15자 내외. 구체적 숫자/고유명사 활용. "충격","경악","소름" 금지
## 유튜브 제목: 1줄 40~60자. 앞 30자 안에 핵심 검색 키워드 배치. (게스트명 직함) 포함
## 설명문: 3~5문장. 충분히 길고 구체적으로. 원고에 없는 내용 절대 지어내지 말 것

## 트렌드 데이터 해석법
- 자동완성 순서 = 검색량 순위 (1번 = 가장 많이 검색됨)
- 🔥급상승 = Google Trends에서 현재 급상승 중인 키워드
- 📰뉴스N건 = 최근 24시간 내 해당 키워드 관련 뉴스 기사 수 (많을수록 시의성 높음)
- reason에 이 지표들을 구체적으로 인용하세요`;
}

// ═══════════════════════════════
// EXTERNAL DATA FETCHERS
// ═══════════════════════════════

async function getYTSuggestions(keyword) {
  try {
    const res = await fetch("https://clients1.google.com/complete/search?client=youtube&hl=ko&gl=kr&ds=yt&q=" + encodeURIComponent(keyword), { headers: { "User-Agent": "Mozilla/5.0" } });
    const text = await res.text();
    const s = text.indexOf("["), e = text.lastIndexOf("]") + 1;
    if (s === -1) return [];
    return (JSON.parse(text.substring(s, e))[1] || []).map(function(i) { return i[0]; });
  } catch (e) { return []; }
}

async function getGoogleSuggestions(keyword) {
  try {
    const res = await fetch("https://suggestqueries.google.com/complete/search?client=firefox&hl=ko&gl=kr&q=" + encodeURIComponent(keyword), { headers: { "User-Agent": "Mozilla/5.0" } });
    return (await res.json())[1] || [];
  } catch (e) { return []; }
}

async function getGoogleTrendsRSS() {
  try {
    const res = await fetch("https://trends.google.com/trending/rss?geo=KR", { headers: { "User-Agent": "Mozilla/5.0" } });
    const xml = await res.text();
    var titles = [];
    var re = /<title><!\[CDATA\[([^\]]+)\]\]><\/title>/g;
    var m;
    while ((m = re.exec(xml)) !== null) { titles.push(m[1]); }
    // fallback: <title>text</title> without CDATA
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
    var count = (xml.match(/<item>/g) || []).length;
    return count;
  } catch (e) { return 0; }
}

// ═══════════════════════════════
// HELPERS
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

        // ── Step 1: 키워드 추출 ──
        var kwResult = await callGPT(KEYWORD_SYSTEM, compressScript(script, 10000), apiKey, 500, 0.3);
        var keywords = kwResult.keywords || [];
        var guestSummary = kwResult.guest_summary || "";

        // ── Step 2: 트렌드 데이터 병렬 수집 ──
        var trendData = {};
        var kwSlice = keywords.slice(0, 8);

        // 2a: Autocomplete + News count 병렬
        var acPromises = kwSlice.map(function(kw) {
          return Promise.all([getYTSuggestions(kw), getGoogleSuggestions(kw), getNewsCount(kw)]).then(function(r) {
            trendData[kw] = { youtube: r[0].slice(0, 8), google: r[1].slice(0, 8), news_24h: r[2] };
          });
        });
        // 2b: Google Trends RSS (급상승 검색어)
        var trendsPromise = getGoogleTrendsRSS();

        var results = await Promise.all([Promise.all(acPromises), trendsPromise]);
        var trendingNow = results[1] || [];

        // ── Step 3: 트렌드 블록 포맷 ──
        var tb = "## 실시간 트렌드 데이터\n\n";
        tb += "### 🔥 Google Trends 한국 급상승 검색어 (상위 20)\n";
        if (trendingNow.length > 0) {
          trendingNow.forEach(function(t, i) { tb += (i + 1) + ". " + t + "\n"; });
        } else {
          tb += "(수집 실패)\n";
        }
        tb += "\n### 키워드별 자동완성 + 뉴스 시의성\n";
        tb += "자동완성 순서 = 검색량 순위 (1번 = 가장 많이 검색됨)\n\n";
        for (var kw in trendData) {
          var d = trendData[kw];
          tb += '#### "' + kw + '" 📰최근24시간 뉴스 ' + d.news_24h + '건\n';
          if (d.youtube.length > 0) {
            tb += "YouTube 자동완성: ";
            tb += d.youtube.slice(0, 5).map(function(s, i) { return (i + 1) + "." + s; }).join(" | ") + "\n";
          }
          if (d.google.length > 0) {
            tb += "Google 자동완성: ";
            tb += d.google.slice(0, 5).map(function(s, i) { return (i + 1) + "." + s; }).join(" | ") + "\n";
          }
          // 급상승 매칭
          var matched = trendingNow.filter(function(t) { return t.indexOf(kw) >= 0 || kw.indexOf(t) >= 0; });
          if (matched.length > 0) tb += "🔥 급상승 매칭: " + matched.join(", ") + "\n";
          tb += "\n";
        }

        // ── Step 4: 3개 후보 개별 호출 ──
        var guestInfo = "## 게스트\n- 이름: " + (guest_name || "(추출)") + "\n- 직함: " + (guest_title || guestSummary || "(추출)") + "\n\n";
        var scriptBlock = "\n## 인터뷰 원고\n" + compressScript(script, 7000);
        var userBase = guestInfo + tb + scriptBlock;

        var setResults = await Promise.all([
          callGPT(makeSetPrompt("balanced"), userBase, apiKey, 2000, 0.8),
          callGPT(makeSetPrompt("script"), userBase, apiKey, 2000, 0.7),
          callGPT(makeSetPrompt("trend"), userBase, apiKey, 2000, 0.85),
        ]);

        // ── 결과 병합 ──
        var merged = {
          tags: setResults[0].tags || [],
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

        // 태그 병합: 3개 호출의 태그를 합치고 중복 제거
        var tagMap = {};
        setResults.forEach(function(sr) {
          (sr.tags || []).forEach(function(t) {
            if (!tagMap[t.tag]) tagMap[t.tag] = t;
            else if (t.source === "both" || tagMap[t.tag].source !== "both") tagMap[t.tag] = t;
          });
        });
        merged.tags = Object.values(tagMap).slice(0, 15);

        return Response.json({
          success: true,
          result: merged,
          trend_data: trendData,
          trending_now: trendingNow,
          keywords_extracted: keywords,
        }, { headers: cors });

      } catch (e) {
        return Response.json({ success: false, error: e.message }, { headers: cors, status: 500 });
      }
    }

    if (url.pathname === "/debug-location") {
      return Response.json({ colo: request.cf ? request.cf.colo : "?", country: request.cf ? request.cf.country : "?" }, { headers: cors });
    }

    return new Response("Set Generator v4", { headers: cors });
  },
};
