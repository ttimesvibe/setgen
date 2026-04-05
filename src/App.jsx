import { useState, useCallback } from "react";
import * as mammoth from "mammoth";

const WORKER_URL = "https://setgen.ttimes.workers.dev";
const FN = "'Pretendard Variable','Pretendard','Noto Sans KR',-apple-system,sans-serif";

const C = {
  bg:"#F5F6FA", sf:"#FFFFFF", bd:"#D8DBE5",
  tx:"#1A1D2E", txM:"#5C6078", txD:"#8B8FA3",
  ac:"#5B4CD4", acS:"rgba(91,76,212,0.08)", acFade:"rgba(91,76,212,0.2)",
  ok:"#16A34A", okBg:"rgba(22,163,74,0.08)", okBd:"rgba(22,163,74,0.15)",
  wn:"#D97706", wnBg:"rgba(217,119,6,0.08)",
  trendBg:"rgba(59,130,246,0.06)", trendBd:"rgba(59,130,246,0.15)", trendTx:"#2563EB",
  scriptBg:"rgba(168,85,247,0.06)", scriptBd:"rgba(168,85,247,0.15)", scriptTx:"#9333EA",
  inputBg:"rgba(0,0,0,0.03)", glass:"rgba(0,0,0,0.02)", glass2:"rgba(0,0,0,0.04)",
  btnTx:"#fff", gradAc:"linear-gradient(135deg,#5B4CD4,#7C3AED)",
};

const TYPE_LABELS = { balanced: "⚖️ 밸런스", script: "📝 스크립트 충실", trend: "🔍 트렌드 공략" };
const TYPE_COLORS = {
  balanced: { bg: C.acS, bd: "rgba(91,76,212,0.2)", tx: C.ac },
  script: { bg: C.scriptBg, bd: C.scriptBd, tx: C.scriptTx },
  trend: { bg: C.trendBg, bd: C.trendBd, tx: C.trendTx },
};
const SOURCE_BADGE = {
  trend: { label: "🔍 트렌드", bg: C.trendBg, bd: C.trendBd, tx: C.trendTx },
  script: { label: "📝 스크립트", bg: C.scriptBg, bd: C.scriptBd, tx: C.scriptTx },
  both: { label: "🔗 양쪽", bg: C.wnBg, bd: "rgba(217,119,6,0.2)", tx: C.wn },
};
const FIELD_ORDER = ["thumbnail", "youtube_title", "description"];
const FIELD_LABELS = { thumbnail: "🖼️ 썸네일/리스트 제목", youtube_title: "▶️ 유튜브 제목", description: "📝 유튜브 설명/기사/페북" };

export default function App() {
  const [fn, setFn] = useState("");
  const [script, setScript] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestTitle, setGuestTitle] = useState("");
  const [result, setResult] = useState(null);
  const [trendData, setTrendData] = useState(null);
  const [keywords, setKeywords] = useState([]);
  const [selected, setSelected] = useState({});
  const [edits, setEdits] = useState({});
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [err, setErr] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showTrend, setShowTrend] = useState(false);

  const processFile = useCallback(async (file) => {
    if (!file) return;
    setFn(file.name); setErr(null);
    try {
      let text;
      if (file.name.endsWith(".docx")) {
        const buf = await file.arrayBuffer();
        const res = await mammoth.extractRawText({ arrayBuffer: buf });
        text = res.value;
      } else {
        text = await file.text();
      }
      setScript(text);
      const speakerRe = /^([가-힣]{2,4})\s+\d{1,2}:\d{2}/gm;
      const speakers = new Set();
      let m;
      while ((m = speakerRe.exec(text)) !== null) {
        if (!["홍재의"].includes(m[1])) speakers.add(m[1]);
      }
      const guestArr = [...speakers];
      if (guestArr.length > 0) setGuestName(guestArr[0]);
    } catch (e) {
      setErr("파일 읽기 실패: " + e.message);
    }
  }, []);

  const generate = useCallback(async () => {
    if (!script.trim()) { setErr("원고를 먼저 업로드하세요."); return; }
    setLoading(true); setErr(null); setResult(null); setTrendData(null); setKeywords([]);
    setSelected({}); setEdits({});
    setLoadingMsg("키워드 추출 중...");
    try {
      const t0 = Date.now();
      const timer = setInterval(() => {
        const elapsed = Math.round((Date.now() - t0) / 1000);
        if (elapsed < 5) setLoadingMsg("키워드 추출 중...");
        else if (elapsed < 12) setLoadingMsg("YouTube/Google 트렌드 수집 중...");
        else if (elapsed < 25) setLoadingMsg("세트 생성 중...");
        else setLoadingMsg("AI 응답 대기 중... (" + elapsed + "초)");
      }, 1000);

      const res = await fetch(WORKER_URL + "/generate-set", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script, guest_name: guestName, guest_title: guestTitle }),
      });
      clearInterval(timer);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "생성 실패");
      setResult(data.result);
      setTrendData(data.trend_data || null);
      setKeywords(data.keywords_extracted || []);
      const sel = {};
      for (const key of FIELD_ORDER) sel[key] = 0;
      setSelected(sel);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false); setLoadingMsg("");
    }
  }, [script, guestName, guestTitle]);

  const getDisplayText = (key, idx) => {
    if (!result || !result[key] || !result[key][idx]) return "";
    const item = result[key][idx];
    if (key === "thumbnail") return item.lines.join("\n");
    return item.text;
  };

  const getSelectedText = (key) => {
    const idx = selected[key] ?? 0;
    const editKey = key + "-" + idx;
    if (edits[editKey] !== undefined) return edits[editKey];
    return getDisplayText(key, idx);
  };

  const copyAll = () => {
    const parts = FIELD_ORDER.map(key => {
      return "<" + FIELD_LABELS[key] + ">\n" + getSelectedText(key);
    });
    if (result?.tags) {
      parts.push("<태그>\n" + result.tags.map(t => t.tag).join(", "));
    }
    navigator.clipboard.writeText(parts.join("\n\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setFn(""); setScript(""); setGuestName(""); setGuestTitle("");
    setResult(null); setTrendData(null); setKeywords([]); setSelected({}); setEdits({}); setErr(null);
  };

  return <div style={{fontFamily:FN, background:C.bg, minHeight:"100vh", color:C.tx}}>
    {/* Header */}
    <div style={{background:C.sf, borderBottom:"1px solid "+C.bd, padding:"14px 20px",
      display:"flex", alignItems:"center", gap:12}}>
      <div style={{fontSize:16, fontWeight:800, color:C.ac}}>📦 세트 생성기</div>
      {fn && <span style={{fontSize:12, color:C.txM, background:C.glass2, padding:"3px 10px", borderRadius:6}}>{fn}</span>}
      <div style={{marginLeft:"auto", display:"flex", gap:8}}>
        {result && <button onClick={copyAll} style={{fontSize:12, padding:"5px 14px", borderRadius:6,
          border:"none", background:copied?C.ok:C.ac, color:C.btnTx, fontWeight:600, cursor:"pointer"}}>
          {copied?"✓ 복사 완료":"📋 전체 복사"}</button>}
        {(fn||result) && <button onClick={handleReset} style={{fontSize:12, padding:"5px 14px",
          borderRadius:6, border:"1px solid "+C.bd, background:C.sf, color:C.txM, cursor:"pointer"}}>× 새 파일</button>}
      </div>
    </div>

    {/* Upload */}
    {!script && !loading && <div style={{maxWidth:560, margin:"80px auto", padding:"0 24px"}}>
      <div style={{textAlign:"center", marginBottom:32}}>
        <div style={{fontSize:48, marginBottom:16}}>📦</div>
        <h1 style={{fontSize:24, fontWeight:700, marginBottom:8}}>세트 생성기 v3</h1>
        <p style={{fontSize:14, color:C.txM, lineHeight:1.7}}>
          인터뷰 원고를 업로드하면 실시간 트렌드를 반영한<br/>
          썸네일·제목·설명문·태그를 AI가 자동 생성합니다.
        </p>
      </div>
      <div onDragOver={e=>{e.preventDefault();setDragOver(true)}} onDragLeave={()=>setDragOver(false)}
        onDrop={e=>{e.preventDefault();setDragOver(false);processFile(e.dataTransfer.files[0])}}
        style={{border:"2px dashed "+(dragOver?C.ac:C.bd), borderRadius:16, padding:"48px 32px",
          textAlign:"center", background:dragOver?C.acS:C.sf, cursor:"pointer"}}
        onClick={()=>document.getElementById("fileInput").click()}>
        <div style={{fontSize:32, marginBottom:12, opacity:0.5}}>{dragOver?"📂":"📄"}</div>
        <div style={{fontSize:14, fontWeight:600, marginBottom:6}}>파일을 드래그하거나 클릭하여 업로드</div>
        <div style={{fontSize:12, color:C.txD}}>.docx 또는 .txt</div>
        <input id="fileInput" type="file" accept=".docx,.txt" onChange={e=>processFile(e.target.files[0])} style={{display:"none"}}/>
      </div>
      {err && <div style={{marginTop:16, padding:"12px 16px", borderRadius:10, background:"rgba(220,38,38,0.08)", color:"#DC2626", fontSize:13}}>⚠️ {err}</div>}
    </div>}

    {/* Guest info */}
    {script && !result && !loading && <div style={{maxWidth:600, margin:"40px auto", padding:"0 24px"}}>
      <div style={{background:C.sf, borderRadius:14, border:"1px solid "+C.bd, padding:24}}>
        <div style={{fontSize:15, fontWeight:700, marginBottom:16}}>게스트 정보</div>
        <div style={{display:"flex", gap:12, marginBottom:16}}>
          <div style={{flex:1}}>
            <label style={{fontSize:12, color:C.txD, fontWeight:600, display:"block", marginBottom:4}}>이름</label>
            <input value={guestName} onChange={e=>setGuestName(e.target.value)} placeholder="박종천"
              style={{width:"100%", padding:"8px 12px", borderRadius:8, border:"1px solid "+C.bd,
                background:C.inputBg, color:C.tx, fontSize:14, fontFamily:FN, outline:"none"}}/>
          </div>
          <div style={{flex:1}}>
            <label style={{fontSize:12, color:C.txD, fontWeight:600, display:"block", marginBottom:4}}>직함/소속</label>
            <input value={guestTitle} onChange={e=>setGuestTitle(e.target.value)} placeholder="30년 개발자"
              style={{width:"100%", padding:"8px 12px", borderRadius:8, border:"1px solid "+C.bd,
                background:C.inputBg, color:C.tx, fontSize:14, fontFamily:FN, outline:"none"}}/>
          </div>
        </div>
        <div style={{fontSize:12, color:C.txM, marginBottom:16}}>📄 {fn} · {script.length.toLocaleString()}자</div>
        <button onClick={generate} style={{width:"100%", padding:"12px", borderRadius:10, border:"none",
          background:C.gradAc, color:C.btnTx, fontSize:15, fontWeight:700, cursor:"pointer"}}>
          🚀 세트 생성 (트렌드 수집 → AI 생성)
        </button>
        {err && <div style={{marginTop:12, padding:"10px 14px", borderRadius:8, background:"rgba(220,38,38,0.08)", color:"#DC2626", fontSize:13}}>⚠️ {err}</div>}
      </div>
    </div>}

    {/* Loading */}
    {loading && <div style={{textAlign:"center", padding:"100px 24px"}}>
      <div style={{fontSize:40, marginBottom:16, animation:"spin 1.5s linear infinite"}}>📦</div>
      <div style={{fontSize:15, fontWeight:600, color:C.tx, marginBottom:8}}>{loadingMsg}</div>
      <div style={{fontSize:12, color:C.txD}}>키워드 추출 → 트렌드 수집 → 세트 생성 (20~40초)</div>
      <style>{"@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}"}</style>
    </div>}

    {/* Result */}
    {result && <div style={{maxWidth:860, margin:"20px auto", padding:"0 20px 60px"}}>

      {/* 태그 섹션 */}
      {result.tags && result.tags.length > 0 && <div style={{background:C.sf, borderRadius:14, border:"1px solid "+C.bd, padding:"18px 22px", marginBottom:14}}>
        <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12}}>
          <span style={{fontSize:14, fontWeight:700}}>🏷️ 추천 태그 ({result.tags.length}개)</span>
          <button onClick={()=>{navigator.clipboard.writeText(result.tags.map(t=>t.tag).join(", "));}}
            style={{fontSize:11, padding:"3px 10px", borderRadius:5, border:"1px solid "+C.bd, background:C.sf, color:C.txM, cursor:"pointer"}}>태그 복사</button>
        </div>
        <div style={{display:"flex", flexWrap:"wrap", gap:6, marginBottom:12}}>
          {result.tags.map((t, i) => {
            const sb = SOURCE_BADGE[t.source] || SOURCE_BADGE.script;
            return <div key={i} style={{display:"inline-flex", alignItems:"center", gap:4, padding:"4px 10px",
              borderRadius:8, background:sb.bg, border:"1px solid "+sb.bd, fontSize:12, cursor:"default"}}
              title={t.reason}>
              <span style={{fontWeight:600, color:sb.tx}}>{t.tag}</span>
              <span style={{fontSize:9, color:sb.tx, opacity:0.7}}>{t.source === "trend" ? "🔍" : t.source === "both" ? "🔗" : "📝"}</span>
            </div>;
          })}
        </div>
        <details>
          <summary style={{fontSize:11, color:C.txD, cursor:"pointer"}}>태그별 추천 근거 보기</summary>
          <div style={{marginTop:8, fontSize:12, color:C.txM, lineHeight:1.8}}>
            {result.tags.map((t, i) => <div key={i} style={{marginBottom:4}}>
              <span style={{fontWeight:600, color:C.tx}}>{t.tag}</span>
              <span style={{color:C.txD}}> — {t.reason}</span>
            </div>)}
          </div>
        </details>
      </div>}

      {/* 트렌드 데이터 토글 */}
      {trendData && <div style={{marginBottom:14}}>
        <button onClick={()=>setShowTrend(!showTrend)}
          style={{fontSize:12, color:C.trendTx, background:C.trendBg, border:"1px solid "+C.trendBd,
            padding:"6px 14px", borderRadius:8, cursor:"pointer", fontWeight:600}}>
          {showTrend ? "📊 트렌드 데이터 접기" : "📊 수집된 트렌드 데이터 보기"} ({keywords.length}개 키워드)
        </button>
        {showTrend && <div style={{background:C.sf, borderRadius:12, border:"1px solid "+C.bd, padding:16, marginTop:8, maxHeight:400, overflowY:"auto"}}>
          {Object.entries(trendData).map(([kw, data]) => <div key={kw} style={{marginBottom:14}}>
            <div style={{fontSize:13, fontWeight:700, color:C.tx, marginBottom:6}}>🔍 "{kw}"</div>
            <div style={{display:"flex", gap:16, flexWrap:"wrap"}}>
              {data.youtube && data.youtube.length > 0 && <div style={{flex:1, minWidth:200}}>
                <div style={{fontSize:10, fontWeight:700, color:C.trendTx, marginBottom:4}}>YouTube 자동완성</div>
                {data.youtube.map((s, i) => <div key={i} style={{fontSize:12, color:C.txM, padding:"2px 0"}}>
                  <span style={{color:C.txD, fontWeight:600, marginRight:4}}>{i+1}.</span> {s}
                </div>)}
              </div>}
              {data.google && data.google.length > 0 && <div style={{flex:1, minWidth:200}}>
                <div style={{fontSize:10, fontWeight:700, color:C.ok, marginBottom:4}}>Google 자동완성</div>
                {data.google.map((s, i) => <div key={i} style={{fontSize:12, color:C.txM, padding:"2px 0"}}>
                  <span style={{color:C.txD, fontWeight:600, marginRight:4}}>{i+1}.</span> {s}
                </div>)}
              </div>}
            </div>
          </div>)}
        </div>}
      </div>}

      {/* 세트 항목 */}
      {FIELD_ORDER.map(key => {
        const candidates = result[key] || [];
        if (candidates.length === 0) return null;
        const selIdx = selected[key] ?? 0;
        const selItem = candidates[selIdx];

        return <div key={key} style={{background:C.sf, borderRadius:14, border:"1px solid "+C.bd, padding:"20px 22px", marginBottom:14}}>
          <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:14}}>
            <span style={{fontSize:15, fontWeight:700}}>{FIELD_LABELS[key]}</span>
          </div>

          {/* 3 type tabs */}
          <div style={{display:"flex", gap:8, marginBottom:12}}>
            {candidates.map((c, ci) => {
              const tc = TYPE_COLORS[c.type] || TYPE_COLORS.balanced;
              const isSelected = selIdx === ci;
              return <button key={ci} onClick={() => setSelected(p => ({...p, [key]: ci}))}
                style={{fontSize:12, fontWeight:600, padding:"5px 14px", borderRadius:8, cursor:"pointer",
                  border:"1px solid "+(isSelected ? tc.bd : "transparent"),
                  background:isSelected ? tc.bg : C.glass2,
                  color:isSelected ? tc.tx : C.txD}}>
                {TYPE_LABELS[c.type] || c.type}
              </button>;
            })}
          </div>

          {/* Editable text */}
          <textarea
            value={edits[key+"-"+selIdx] !== undefined ? edits[key+"-"+selIdx] : getDisplayText(key, selIdx)}
            onChange={e => setEdits(p => ({...p, [key+"-"+selIdx]: e.target.value}))}
            rows={key === "description" ? 5 : key === "thumbnail" ? 3 : 2}
            style={{width:"100%", padding:"10px 12px", borderRadius:8, border:"1px solid "+C.bd,
              background:C.inputBg, color:C.tx, fontSize:14, fontFamily:FN, lineHeight:1.7,
              resize:"vertical", outline:"none"}}/>

          {/* Reason */}
          {selItem?.reason && <div style={{marginTop:8, padding:"8px 12px", borderRadius:8,
            background:C.glass, fontSize:12, color:C.txD, lineHeight:1.6}}>
            💡 <span style={{fontWeight:600}}>근거:</span> {selItem.reason}
          </div>}

          {/* Copy single */}
          <div style={{display:"flex", justifyContent:"flex-end", marginTop:6}}>
            <button onClick={() => navigator.clipboard.writeText(getSelectedText(key))}
              style={{fontSize:11, padding:"3px 10px", borderRadius:5, border:"1px solid "+C.bd,
                background:C.sf, color:C.txM, cursor:"pointer"}}>복사</button>
          </div>
        </div>;
      })}
    </div>}
  </div>;
}
