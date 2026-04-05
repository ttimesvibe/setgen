import { useState, useCallback } from "react";
import * as mammoth from "mammoth";

const WORKER_URL = "https://setgen.ttimes.workers.dev";
const FN = "'Pretendard Variable','Pretendard','Noto Sans KR',-apple-system,sans-serif";

const C = {
  bg:"#F5F6FA", sf:"#FFFFFF", bd:"#D8DBE5",
  tx:"#1A1D2E", txM:"#5C6078", txD:"#8B8FA3",
  ac:"#5B4CD4", acS:"rgba(91,76,212,0.08)", acFade:"rgba(91,76,212,0.2)",
  ok:"#16A34A", okBg:"rgba(22,163,74,0.08)", okBd:"rgba(22,163,74,0.15)",
  wn:"#D97706",
  inputBg:"rgba(0,0,0,0.03)", glass:"rgba(0,0,0,0.02)", glass2:"rgba(0,0,0,0.04)",
  btnTx:"#fff", gradAc:"linear-gradient(135deg,#5B4CD4,#7C3AED)",
};

const LABELS = {
  thumbnail: "썸네일/리스트 제목",
  youtube_title: "유튜브 제목",
  article_title: "기사 제목",
  portal_title: "네이버/다음 제목",
  description: "유튜브 설명/기사/페북",
};
const ICONS = {
  thumbnail: "🖼️", youtube_title: "▶️", article_title: "📰",
  portal_title: "🔍", description: "📝",
};
const FIELD_ORDER = ["thumbnail", "youtube_title", "article_title", "portal_title", "description"];

export default function App() {
  const [fn, setFn] = useState("");
  const [script, setScript] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestTitle, setGuestTitle] = useState("");
  const [result, setResult] = useState(null);
  const [selected, setSelected] = useState({});
  const [edits, setEdits] = useState({});
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [copied, setCopied] = useState(false);

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
      // Auto-extract guest info from first few lines
      const lines = text.split("\n").slice(0, 10).join(" ");
      const nameMatch = lines.match(/(?:홍재의|진행자|MC)\s+(\S+)|(\S+)\s+\d{1,2}:\d{2}/);
      // Try to find non-host speakers
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
    setLoading(true); setErr(null); setResult(null); setSelected({}); setEdits({});
    try {
      const res = await fetch(`${WORKER_URL}/generate-set`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script, guest_name: guestName, guest_title: guestTitle }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "생성 실패");
      setResult(data.result);
      // Default select first candidate for each
      const sel = {};
      for (const key of FIELD_ORDER) {
        if (data.result[key]?.length > 0) sel[key] = 0;
      }
      setSelected(sel);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, [script, guestName, guestTitle]);

  const getDisplayText = (key, idx) => {
    if (!result || !result[key]) return "";
    const item = result[key][idx];
    if (key === "thumbnail") return item.lines.join("\n");
    return item;
  };

  const getSelectedText = (key) => {
    const idx = selected[key] ?? 0;
    const editKey = `${key}-${idx}`;
    if (edits[editKey] !== undefined) return edits[editKey];
    return getDisplayText(key, idx);
  };

  const copyAll = () => {
    const parts = FIELD_ORDER.map(key => {
      const label = `<${LABELS[key]}>`;
      const text = getSelectedText(key);
      return `${label}\n${text}`;
    });
    navigator.clipboard.writeText(parts.join("\n\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setFn(""); setScript(""); setGuestName(""); setGuestTitle("");
    setResult(null); setSelected({}); setEdits({}); setErr(null);
  };

  return <div style={{fontFamily:FN, background:C.bg, minHeight:"100vh", color:C.tx}}>
    {/* Header */}
    <div style={{background:C.sf, borderBottom:`1px solid ${C.bd}`, padding:"14px 20px",
      display:"flex", alignItems:"center", gap:12}}>
      <div style={{fontSize:16, fontWeight:800, color:C.ac}}>📦 세트 생성기</div>
      {fn && <span style={{fontSize:12, color:C.txM, background:C.glass2, padding:"3px 10px", borderRadius:6}}>{fn}</span>}
      <div style={{marginLeft:"auto", display:"flex", gap:8}}>
        {result && <button onClick={copyAll} style={{fontSize:12, padding:"5px 14px", borderRadius:6,
          border:"none", background:copied?C.ok:C.ac, color:C.btnTx, fontWeight:600, cursor:"pointer",
          transition:"all 0.15s"}}>{copied?"✓ 복사 완료":"📋 전체 복사"}</button>}
        {(fn || result) && <button onClick={handleReset} style={{fontSize:12, padding:"5px 14px",
          borderRadius:6, border:`1px solid ${C.bd}`, background:C.sf, color:C.txM, cursor:"pointer"}}>× 새 파일</button>}
      </div>
    </div>

    {/* Upload */}
    {!script && !loading && <div style={{maxWidth:560, margin:"80px auto", padding:"0 24px"}}>
      <div style={{textAlign:"center", marginBottom:32}}>
        <div style={{fontSize:48, marginBottom:16}}>📦</div>
        <h1 style={{fontSize:24, fontWeight:700, marginBottom:8}}>세트 생성기</h1>
        <p style={{fontSize:14, color:C.txM, lineHeight:1.7}}>
          인터뷰 원고를 업로드하면<br/>
          썸네일·제목·설명문을 AI가 자동 생성합니다.
        </p>
      </div>
      <div onDragOver={e=>{e.preventDefault();setDragOver(true)}} onDragLeave={()=>setDragOver(false)}
        onDrop={e=>{e.preventDefault();setDragOver(false);processFile(e.dataTransfer.files[0])}}
        style={{border:`2px dashed ${dragOver?C.ac:C.bd}`, borderRadius:16, padding:"48px 32px",
          textAlign:"center", background:dragOver?C.acS:C.sf, transition:"all 0.15s", cursor:"pointer"}}
        onClick={()=>document.getElementById("fileInput").click()}>
        <div style={{fontSize:32, marginBottom:12, opacity:0.5}}>{dragOver?"📂":"📄"}</div>
        <div style={{fontSize:14, fontWeight:600, marginBottom:6}}>파일을 드래그하거나 클릭하여 업로드</div>
        <div style={{fontSize:12, color:C.txD}}>.docx 또는 .txt</div>
        <input id="fileInput" type="file" accept=".docx,.txt" onChange={e=>processFile(e.target.files[0])} style={{display:"none"}}/>
      </div>
      {err && <div style={{marginTop:16, padding:"12px 16px", borderRadius:10,
        background:"rgba(220,38,38,0.08)", border:"1px solid rgba(220,38,38,0.15)",
        color:"#DC2626", fontSize:13}}>⚠️ {err}</div>}
    </div>}

    {/* Script loaded — guest info + generate */}
    {script && !result && !loading && <div style={{maxWidth:600, margin:"40px auto", padding:"0 24px"}}>
      <div style={{background:C.sf, borderRadius:14, border:`1px solid ${C.bd}`, padding:24}}>
        <div style={{fontSize:15, fontWeight:700, marginBottom:16}}>게스트 정보</div>
        <div style={{display:"flex", gap:12, marginBottom:16}}>
          <div style={{flex:1}}>
            <label style={{fontSize:12, color:C.txD, fontWeight:600, display:"block", marginBottom:4}}>이름</label>
            <input value={guestName} onChange={e=>setGuestName(e.target.value)} placeholder="박종천"
              style={{width:"100%", padding:"8px 12px", borderRadius:8, border:`1px solid ${C.bd}`,
                background:C.inputBg, color:C.tx, fontSize:14, fontFamily:FN, outline:"none"}}/>
          </div>
          <div style={{flex:1}}>
            <label style={{fontSize:12, color:C.txD, fontWeight:600, display:"block", marginBottom:4}}>직함/소속</label>
            <input value={guestTitle} onChange={e=>setGuestTitle(e.target.value)} placeholder="30년 개발자"
              style={{width:"100%", padding:"8px 12px", borderRadius:8, border:`1px solid ${C.bd}`,
                background:C.inputBg, color:C.tx, fontSize:14, fontFamily:FN, outline:"none"}}/>
          </div>
        </div>
        <div style={{fontSize:12, color:C.txM, marginBottom:16}}>
          📄 {fn} · {script.length.toLocaleString()}자 로드됨
        </div>
        <button onClick={generate} style={{width:"100%", padding:"12px", borderRadius:10, border:"none",
          background:C.gradAc, color:C.btnTx, fontSize:15, fontWeight:700, cursor:"pointer",
          boxShadow:`0 4px 14px ${C.acFade}`}}>
          🚀 세트 생성
        </button>
        {err && <div style={{marginTop:12, padding:"10px 14px", borderRadius:8,
          background:"rgba(220,38,38,0.08)", color:"#DC2626", fontSize:13}}>⚠️ {err}</div>}
      </div>
    </div>}

    {/* Loading */}
    {loading && <div style={{textAlign:"center", padding:"120px 24px"}}>
      <div style={{fontSize:40, marginBottom:16, animation:"spin 1.5s linear infinite"}}>📦</div>
      <div style={{fontSize:14, color:C.txM}}>세트 생성 중... (10~20초 소요)</div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>}

    {/* Result */}
    {result && <div style={{maxWidth:800, margin:"24px auto", padding:"0 24px 60px"}}>
      {FIELD_ORDER.map(key => {
        const candidates = result[key] || [];
        if (candidates.length === 0) return null;
        const selIdx = selected[key] ?? 0;

        return <div key={key} style={{background:C.sf, borderRadius:14, border:`1px solid ${C.bd}`,
          padding:"20px 22px", marginBottom:14}}>
          <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:12}}>
            <span style={{fontSize:18}}>{ICONS[key]}</span>
            <span style={{fontSize:14, fontWeight:700}}>{LABELS[key]}</span>
            <span style={{fontSize:11, color:C.txD, marginLeft:"auto"}}>{candidates.length}개 후보</span>
          </div>

          {/* Candidates */}
          <div style={{display:"flex", gap:8, flexWrap:"wrap", marginBottom:12}}>
            {candidates.map((_, ci) => (
              <button key={ci} onClick={() => setSelected(p => ({...p, [key]: ci}))}
                style={{fontSize:12, fontWeight:600, padding:"4px 14px", borderRadius:6, cursor:"pointer",
                  border:`1px solid ${selIdx===ci?C.ac:"transparent"}`,
                  background:selIdx===ci?C.acS:C.glass2,
                  color:selIdx===ci?C.ac:C.txD}}>
                후보 {ci+1}
              </button>
            ))}
          </div>

          {/* Editable text */}
          <textarea
            value={edits[`${key}-${selIdx}`] !== undefined ? edits[`${key}-${selIdx}`] : getDisplayText(key, selIdx)}
            onChange={e => setEdits(p => ({...p, [`${key}-${selIdx}`]: e.target.value}))}
            rows={key === "description" ? 5 : key === "thumbnail" ? 3 : 2}
            style={{width:"100%", padding:"10px 12px", borderRadius:8, border:`1px solid ${C.bd}`,
              background:C.inputBg, color:C.tx, fontSize:14, fontFamily:FN, lineHeight:1.7,
              resize:"vertical", outline:"none"}}/>

          {/* Copy single */}
          <div style={{display:"flex", justifyContent:"flex-end", marginTop:6}}>
            <button onClick={() => {
              navigator.clipboard.writeText(getSelectedText(key));
            }} style={{fontSize:11, padding:"3px 10px", borderRadius:5, border:`1px solid ${C.bd}`,
              background:C.sf, color:C.txM, cursor:"pointer"}}>복사</button>
          </div>
        </div>;
      })}
    </div>}
  </div>;
}
