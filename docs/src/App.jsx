import { useState, useCallback } from "react";
import * as mammoth from "mammoth";

const WORKER_URL = "https://setgen.ttimes.workers.dev";
const FN = "'Pretendard Variable','Pretendard','Noto Sans KR',-apple-system,sans-serif";
const C = {
  bg:"#F5F6FA",sf:"#FFFFFF",bd:"#D8DBE5",tx:"#1A1D2E",txM:"#5C6078",txD:"#8B8FA3",
  ac:"#5B4CD4",acS:"rgba(91,76,212,0.08)",acFade:"rgba(91,76,212,0.2)",
  ok:"#16A34A",okBg:"rgba(22,163,74,0.08)",okBd:"rgba(22,163,74,0.15)",
  wn:"#D97706",wnBg:"rgba(217,119,6,0.08)",
  trendBg:"rgba(59,130,246,0.06)",trendBd:"rgba(59,130,246,0.15)",trendTx:"#2563EB",
  scriptBg:"rgba(168,85,247,0.06)",scriptBd:"rgba(168,85,247,0.15)",scriptTx:"#9333EA",
  fireBg:"rgba(239,68,68,0.06)",fireBd:"rgba(239,68,68,0.15)",fireTx:"#DC2626",
  inputBg:"rgba(0,0,0,0.03)",glass:"rgba(0,0,0,0.02)",glass2:"rgba(0,0,0,0.04)",
  btnTx:"#fff",gradAc:"linear-gradient(135deg,#5B4CD4,#7C3AED)",
};
const TYPE_LABELS={balanced:"⚖️ 밸런스",trend:"🔍 트렌드 공략",focus:"🎯 선택과 집중",script:"📝 스크립트 충실"};
const TYPE_COLORS={
  balanced:{bg:C.acS,bd:"rgba(91,76,212,0.2)",tx:C.ac},
  trend:{bg:C.trendBg,bd:C.trendBd,tx:C.trendTx},
  focus:{bg:"rgba(234,88,12,0.06)",bd:"rgba(234,88,12,0.15)",tx:"#EA580C"},
  script:{bg:C.scriptBg,bd:C.scriptBd,tx:C.scriptTx},
};
const SRC_BADGE={
  trend:{label:"🔍",bg:C.trendBg,bd:C.trendBd,tx:C.trendTx},
  script:{label:"📝",bg:C.scriptBg,bd:C.scriptBd,tx:C.scriptTx},
  both:{label:"🔗",bg:C.wnBg,bd:"rgba(217,119,6,0.2)",tx:C.wn},
};
const FIELDS=["thumbnail","youtube_title","description"];
const FLABELS={thumbnail:"🖼️ 썸네일/리스트 제목",youtube_title:"▶️ 유튜브 제목",description:"📝 유튜브 설명/기사/페북"};

export default function App(){
  const [fn,setFn]=useState("");
  const [script,setScript]=useState("");
  const [gN,setGN]=useState("");
  const [gT,setGT]=useState("");
  const [result,setResult]=useState(null);
  const [trendData,setTrendData]=useState(null);
  const [trendingNow,setTrendingNow]=useState([]);
  const [keywords,setKeywords]=useState([]);
  const [sel,setSel]=useState({});
  const [edits,setEdits]=useState({});
  const [loading,setLoading]=useState(false);
  const [loadMsg,setLoadMsg]=useState("");
  const [err,setErr]=useState(null);
  const [dragOver,setDragOver]=useState(false);
  const [copied,setCopied]=useState(false);
  const [showTrend,setShowTrend]=useState(false);
  const [focusKw,setFocusKw]=useState("");

  const processFile=useCallback(async(file)=>{
    if(!file)return;setFn(file.name);setErr(null);
    try{
      let text;
      if(file.name.endsWith(".docx")){const buf=await file.arrayBuffer();text=(await mammoth.extractRawText({arrayBuffer:buf})).value;}
      else{text=await file.text();}
      setScript(text);
      const re=/^([가-힣]{2,4})\s+\d{1,2}:\d{2}/gm;const sp=new Set();let m;
      while((m=re.exec(text))!==null){if(!["홍재의"].includes(m[1]))sp.add(m[1]);}
      const g=[...sp];if(g.length>0)setGN(g[0]);
    }catch(e){setErr("파일 읽기 실패: "+e.message);}
  },[]);

  const generate=useCallback(async()=>{
    if(!script.trim()){setErr("원고를 먼저 업로드하세요.");return;}
    setLoading(true);setErr(null);setResult(null);setTrendData(null);setTrendingNow([]);setKeywords([]);setSel({});setEdits({});
    const t0=Date.now();
    const thirdLabel=focusKw.trim()?"선택과집중":"스크립트";
    const timer=setInterval(()=>{
      const s=Math.round((Date.now()-t0)/1000);
      if(s<5)setLoadMsg("① 키워드 추출 중...");
      else if(s<12)setLoadMsg("② 트렌드 수집 중 (YouTube·Google·Trends RSS·News)...");
      else if(s<20)setLoadMsg("③ 밸런스형 세트 생성 중...");
      else if(s<28)setLoadMsg("④ 트렌드형 세트 생성 중...");
      else if(s<36)setLoadMsg("⑤ "+thirdLabel+"형 세트 생성 중...");
      else setLoadMsg("결과 취합 중... ("+s+"초)");
    },1000);
    try{
      const res=await fetch(WORKER_URL+"/generate-set",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({script,guest_name:gN,guest_title:gT,focus_keyword:focusKw})});
      clearInterval(timer);
      const data=await res.json();
      if(!data.success)throw new Error(data.error||"생성 실패");
      setResult(data.result);setTrendData(data.trend_data||null);setTrendingNow(data.trending_now||[]);setKeywords(data.keywords_extracted||[]);
      const s={};FIELDS.forEach(k=>{s[k]=0;});setSel(s);
    }catch(e){setErr(e.message);}
    finally{setLoading(false);setLoadMsg("");clearInterval(timer);}
  },[script,gN,gT,focusKw]);

  const getDisplay=(key,idx)=>{
    if(!result||!result[key]||!result[key][idx])return "";
    const item=result[key][idx];
    return key==="thumbnail"?item.lines.join("\n"):item.text;
  };
  const getSelected=(key)=>{const idx=sel[key]??0;const ek=key+"-"+idx;return edits[ek]!==undefined?edits[ek]:getDisplay(key,idx);};

  const copyAll=()=>{
    const parts=FIELDS.map(k=>"<"+FLABELS[k]+">\n"+getSelected(k));
    if(result?.tags)parts.push("<태그>\n"+result.tags.map(t=>t.tag).join(", "));
    navigator.clipboard.writeText(parts.join("\n\n"));setCopied(true);setTimeout(()=>setCopied(false),2000);
  };

  const reset=()=>{setFn("");setScript("");setGN("");setGT("");setFocusKw("");setResult(null);setTrendData(null);setTrendingNow([]);setKeywords([]);setSel({});setEdits({});setErr(null);};

  return <div style={{fontFamily:FN,background:C.bg,minHeight:"100vh",color:C.tx}}>
    <div style={{background:C.sf,borderBottom:"1px solid "+C.bd,padding:"14px 20px",display:"flex",alignItems:"center",gap:12}}>
      <div style={{fontSize:16,fontWeight:800,color:C.ac}}>📦 세트 생성기 v6</div>
      {fn&&<span style={{fontSize:12,color:C.txM,background:C.glass2,padding:"3px 10px",borderRadius:6}}>{fn}</span>}
      <div style={{marginLeft:"auto",display:"flex",gap:8}}>
        {result&&<button onClick={copyAll} style={{fontSize:12,padding:"5px 14px",borderRadius:6,border:"none",background:copied?C.ok:C.ac,color:C.btnTx,fontWeight:600,cursor:"pointer"}}>{copied?"✓ 복사 완료":"📋 전체 복사"}</button>}
        {(fn||result)&&<button onClick={reset} style={{fontSize:12,padding:"5px 14px",borderRadius:6,border:"1px solid "+C.bd,background:C.sf,color:C.txM,cursor:"pointer"}}>× 새 파일</button>}
      </div>
    </div>

    {!script&&!loading&&<div style={{maxWidth:560,margin:"80px auto",padding:"0 24px"}}>
      <div style={{textAlign:"center",marginBottom:32}}>
        <div style={{fontSize:48,marginBottom:16}}>📦</div>
        <h1 style={{fontSize:24,fontWeight:700,marginBottom:8}}>세트 생성기 v6</h1>
        <p style={{fontSize:14,color:C.txM,lineHeight:1.7}}>실시간 트렌드 + 3가지 성격의 후보를 개별 생성합니다.</p>
        <p style={{fontSize:12,color:C.txD,marginTop:4}}>밸런스 · 트렌드 공략 · 선택과 집중</p>
      </div>
      <div onDragOver={e=>{e.preventDefault();setDragOver(true)}} onDragLeave={()=>setDragOver(false)}
        onDrop={e=>{e.preventDefault();setDragOver(false);processFile(e.dataTransfer.files[0])}}
        style={{border:"2px dashed "+(dragOver?C.ac:C.bd),borderRadius:16,padding:"48px 32px",textAlign:"center",background:dragOver?C.acS:C.sf,cursor:"pointer"}}
        onClick={()=>document.getElementById("fi").click()}>
        <div style={{fontSize:32,marginBottom:12,opacity:0.5}}>{dragOver?"📂":"📄"}</div>
        <div style={{fontSize:14,fontWeight:600,marginBottom:6}}>파일을 드래그하거나 클릭</div>
        <div style={{fontSize:12,color:C.txD}}>.docx 또는 .txt</div>
        <input id="fi" type="file" accept=".docx,.txt" onChange={e=>processFile(e.target.files[0])} style={{display:"none"}}/>
      </div>
      {err&&<div style={{marginTop:16,padding:"12px 16px",borderRadius:10,background:C.fireBg,border:"1px solid "+C.fireBd,color:C.fireTx,fontSize:13}}>⚠️ {err}</div>}
    </div>}

    {script&&!result&&!loading&&<div style={{maxWidth:600,margin:"40px auto",padding:"0 24px"}}>
      <div style={{background:C.sf,borderRadius:14,border:"1px solid "+C.bd,padding:24}}>
        <div style={{fontSize:15,fontWeight:700,marginBottom:16}}>게스트 정보</div>
        <div style={{display:"flex",gap:12,marginBottom:16,alignItems:"flex-end"}}>
          <div style={{width:140,flexShrink:0}}><label style={{fontSize:12,color:C.txD,fontWeight:600,display:"block",marginBottom:4}}>이름</label>
            <input value={gN} onChange={e=>setGN(e.target.value)} placeholder="박종천" style={{width:"100%",padding:"8px 12px",borderRadius:8,border:"1px solid "+C.bd,background:C.inputBg,color:C.tx,fontSize:14,fontFamily:FN,outline:"none",boxSizing:"border-box"}}/></div>
          <div style={{flex:1,minWidth:0}}><label style={{fontSize:12,color:C.txD,fontWeight:600,display:"block",marginBottom:4}}>직함/소속</label>
            <input value={gT} onChange={e=>setGT(e.target.value)} placeholder="30년 개발자" style={{width:"100%",padding:"8px 12px",borderRadius:8,border:"1px solid "+C.bd,background:C.inputBg,color:C.tx,fontSize:14,fontFamily:FN,outline:"none",boxSizing:"border-box"}}/></div>
        </div>
        <div style={{fontSize:12,color:C.txM,marginBottom:16}}>📄 {fn} · {script.length.toLocaleString()}자</div>
        <div style={{marginBottom:16}}>
          <label style={{fontSize:12,color:"#EA580C",fontWeight:600,display:"block",marginBottom:4}}>🎯 집중 키워드 (선택)</label>
          <input value={focusKw} onChange={e=>setFocusKw(e.target.value)} placeholder="예: 애플 중심으로 / 애플과 구글의 전쟁 / 애플"
            style={{width:"100%",padding:"8px 12px",borderRadius:8,border:"1px solid rgba(234,88,12,0.3)",background:"rgba(234,88,12,0.04)",color:C.tx,fontSize:14,fontFamily:FN,outline:"none",boxSizing:"border-box"}}/>
          <div style={{fontSize:11,color:C.txD,marginTop:4}}>입력하면 3번째 후보가 이 키워드 중심으로 생성됩니다. 비워두면 스크립트 충실형으로 생성.</div>
        </div>
        <button onClick={generate} style={{width:"100%",padding:"12px",borderRadius:10,border:"none",background:C.gradAc,color:C.btnTx,fontSize:15,fontWeight:700,cursor:"pointer"}}>
          🚀 세트 생성 (키워드→트렌드 수집→3개 개별 생성)</button>
        {err&&<div style={{marginTop:12,padding:"10px 14px",borderRadius:8,background:C.fireBg,color:C.fireTx,fontSize:13}}>⚠️ {err}</div>}
      </div>
    </div>}

    {loading&&<div style={{textAlign:"center",padding:"80px 24px"}}>
      <div style={{fontSize:40,marginBottom:16,animation:"spin 1.5s linear infinite"}}>📦</div>
      <div style={{fontSize:15,fontWeight:600,color:C.tx,marginBottom:8}}>{loadMsg}</div>
      <div style={{fontSize:12,color:C.txD}}>총 4회 GPT 호출 (30~50초 소요)</div>
      <div style={{maxWidth:300,margin:"20px auto",height:4,background:C.bd,borderRadius:2,overflow:"hidden"}}>
        <div style={{height:"100%",background:C.ac,borderRadius:2,animation:"progress 40s linear",width:"0%"}}/>
      </div>
      <style>{"@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}@keyframes progress{from{width:0%}to{width:95%}}"}</style>
    </div>}

    {result&&<div style={{maxWidth:860,margin:"20px auto",padding:"0 20px 60px"}}>

      {/* 태그 */}
      {result.tags&&result.tags.length>0&&<div style={{background:C.sf,borderRadius:14,border:"1px solid "+C.bd,padding:"18px 22px",marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
          <span style={{fontSize:14,fontWeight:700}}>🏷️ 추천 태그 ({result.tags.length}개)</span>
          <button onClick={()=>navigator.clipboard.writeText(result.tags.map(t=>t.tag).join(", "))}
            style={{fontSize:11,padding:"3px 10px",borderRadius:5,border:"1px solid "+C.bd,background:C.sf,color:C.txM,cursor:"pointer"}}>태그 복사</button>
        </div>
        <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12}}>
          {result.tags.map((t,i)=>{const sb=SRC_BADGE[t.source]||SRC_BADGE.script;
            return <div key={i} style={{display:"inline-flex",alignItems:"center",gap:4,padding:"4px 10px",borderRadius:8,background:sb.bg,border:"1px solid "+sb.bd,fontSize:12,cursor:"default"}} title={t.reason}>
              <span style={{fontWeight:600,color:sb.tx}}>{t.tag}</span>
              <span style={{fontSize:9,color:sb.tx,opacity:0.7}}>{sb.label}</span>
            </div>;})}
        </div>
        <details><summary style={{fontSize:11,color:C.txD,cursor:"pointer"}}>태그별 추천 근거</summary>
          <div style={{marginTop:8,fontSize:12,color:C.txM,lineHeight:1.8}}>
            {result.tags.map((t,i)=><div key={i} style={{marginBottom:4}}><span style={{fontWeight:600,color:C.tx}}>{t.tag}</span> — {t.reason}</div>)}
          </div>
        </details>
      </div>}

      {/* 트렌드 데이터 */}
      {(trendData||trendingNow.length>0)&&<div style={{marginBottom:14}}>
        <button onClick={()=>setShowTrend(!showTrend)} style={{fontSize:12,color:C.trendTx,background:C.trendBg,border:"1px solid "+C.trendBd,padding:"6px 14px",borderRadius:8,cursor:"pointer",fontWeight:600}}>
          {showTrend?"📊 트렌드 접기":"📊 수집된 트렌드 데이터 보기"}</button>
        {showTrend&&<div style={{background:C.sf,borderRadius:12,border:"1px solid "+C.bd,padding:16,marginTop:8,maxHeight:500,overflowY:"auto"}}>
          {trendingNow.length>0&&<div style={{marginBottom:16}}>
            <div style={{fontSize:13,fontWeight:700,color:C.fireTx,marginBottom:8}}>🔥 Google Trends 한국 급상승 검색어</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {trendingNow.map((t,i)=><span key={i} style={{fontSize:11,padding:"3px 8px",borderRadius:6,background:C.fireBg,border:"1px solid "+C.fireBd,color:C.fireTx}}>{t}</span>)}
            </div>
          </div>}
          {trendData&&Object.entries(trendData).map(([kw,d])=><div key={kw} style={{marginBottom:14}}>
            <div style={{fontSize:13,fontWeight:700,color:C.tx,marginBottom:4}}>
              🔍 "{kw}" <span style={{fontSize:11,fontWeight:400,color:d.news_24h>5?C.fireTx:C.txD}}>📰 뉴스 {d.news_24h}건/24h</span>
            </div>
            <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
              {d.youtube&&d.youtube.length>0&&<div style={{flex:1,minWidth:200}}>
                <div style={{fontSize:10,fontWeight:700,color:C.trendTx,marginBottom:4}}>YouTube</div>
                {d.youtube.map((s,i)=><div key={i} style={{fontSize:12,color:C.txM,padding:"1px 0"}}><span style={{color:C.txD,fontWeight:600,marginRight:4}}>{i+1}.</span>{s}</div>)}
              </div>}
              {d.google&&d.google.length>0&&<div style={{flex:1,minWidth:200}}>
                <div style={{fontSize:10,fontWeight:700,color:C.ok,marginBottom:4}}>Google</div>
                {d.google.map((s,i)=><div key={i} style={{fontSize:12,color:C.txM,padding:"1px 0"}}><span style={{color:C.txD,fontWeight:600,marginRight:4}}>{i+1}.</span>{s}</div>)}
              </div>}
            </div>
          </div>)}
        </div>}
      </div>}

      {/* 세트 항목 */}
      {FIELDS.map(key=>{
        const cands=result[key]||[];if(cands.length===0)return null;
        const si=sel[key]??0;const item=cands[si];
        return <div key={key} style={{background:C.sf,borderRadius:14,border:"1px solid "+C.bd,padding:"20px 22px",marginBottom:14}}>
          <div style={{fontSize:15,fontWeight:700,marginBottom:14}}>{FLABELS[key]}</div>
          <div style={{display:"flex",gap:8,marginBottom:12}}>
            {cands.map((c,ci)=>{const tc=TYPE_COLORS[c.type]||TYPE_COLORS.balanced;const isSel=si===ci;
              return <button key={ci} onClick={()=>setSel(p=>({...p,[key]:ci}))}
                style={{fontSize:12,fontWeight:600,padding:"5px 14px",borderRadius:8,cursor:"pointer",
                  border:"1px solid "+(isSel?tc.bd:"transparent"),background:isSel?tc.bg:C.glass2,color:isSel?tc.tx:C.txD}}>
                {TYPE_LABELS[c.type]||c.type}</button>;})}
          </div>
          <textarea value={edits[key+"-"+si]!==undefined?edits[key+"-"+si]:getDisplay(key,si)}
            onChange={e=>setEdits(p=>({...p,[key+"-"+si]:e.target.value}))}
            rows={key==="description"?6:key==="thumbnail"?3:2}
            style={{width:"100%",padding:"10px 12px",borderRadius:8,border:"1px solid "+C.bd,background:C.inputBg,color:C.tx,fontSize:14,fontFamily:FN,lineHeight:1.7,resize:"vertical",outline:"none"}}/>
          {item?.reason&&<div style={{marginTop:8,padding:"8px 12px",borderRadius:8,background:C.glass,fontSize:12,color:C.txD,lineHeight:1.6}}>
            💡 <span style={{fontWeight:600}}>근거:</span> {item.reason}</div>}
          <div style={{display:"flex",justifyContent:"flex-end",marginTop:6}}>
            <button onClick={()=>navigator.clipboard.writeText(getSelected(key))}
              style={{fontSize:11,padding:"3px 10px",borderRadius:5,border:"1px solid "+C.bd,background:C.sf,color:C.txM,cursor:"pointer"}}>복사</button>
          </div>
        </div>;})}
    </div>}
  </div>;
}
