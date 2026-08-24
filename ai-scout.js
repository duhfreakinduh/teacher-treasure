"use strict";

/* Teacher Treasure AI Scout — reliability-first v2
   Always returns an immediate directory/freshness answer.
   Hugging Face semantic ranking upgrades the result when the model is ready.
*/
(() => {
  const HF_IMPORT = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0";
  const MODELS = ["Xenova/bge-small-en-v1.5", "Xenova/all-MiniLM-L6-v2"];
  const STALE_DAYS = 45;
  const AI_WAIT_MS = 15000;
  let embedder = null, loading = null, activeModel = null, dealVectors = null, signature = "", requestId = 0;

  const esc = (v="") => String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const waitFor = (p,ms,msg) => Promise.race([p,new Promise((_,r)=>setTimeout(()=>r(new Error(msg)),ms))]);
  function ageDays(value){ if(!value)return Infinity; const d=new Date(`${value}T12:00:00`); return Number.isNaN(d.getTime())?Infinity:Math.max(0,Math.floor((Date.now()-d.getTime())/86400000)); }
  function corpus(d){ return [d.title,d.organization,d.type,d.category,d.locationType,d.region,d.description,d.eligibility,d.savingsLabel,d.verificationStatus==="verified"?"official verified educator teacher offer":"community offer"].filter(Boolean).join(". "); }
  function deals(){ return (typeof state!=="undefined" && Array.isArray(state.deals)?state.deals:[]).filter(d=>!isExpired(d)); }
  function freshnessBoost(d){ const age=ageDays(d.lastVerified); let b=d.verificationStatus==="verified"?0.08:-0.02; if(age<=14)b+=0.07; else if(age<=30)b+=0.05; else if(age<=STALE_DAYS)b+=0.02; else if(Number.isFinite(age))b-=Math.min(0.10,(age-STALE_DAYS)/300); if(d.expires&&daysUntil(d.expires)<=7)b-=0.025; return b; }

  function installUI(){
    if(document.querySelector("#teacherAiScout"))return;
    const sidebar=document.querySelector(".sidebar"); if(!sidebar)return;
    const panel=document.createElement("section"); panel.id="teacherAiScout"; panel.className="panel teacher-ai-panel";
    panel.innerHTML=`<p class="eyebrow">Hugging Face • instant + AI</p><h2>Ask the Deal Scout</h2><p>Describe what you need. You get an immediate grounded match, then local AI improves the ranking when ready.</p><textarea id="teacherAiQuestion" rows="4" maxlength="360" placeholder="Examples: free math resources • technology savings • special-ed classroom help"></textarea><button class="btn btn-primary teacher-ai-button" id="teacherAiAsk" type="button">✨ Find my best matches</button><div id="teacherAiStatus" class="teacher-ai-status" role="status">Ready. AI loads only when needed.</div><div id="teacherAiAnswer" class="teacher-ai-answer" hidden></div>`;
    sidebar.prepend(panel); document.querySelector("#teacherAiAsk")?.addEventListener("click",runScout); updateFreshnessPanelWhenReady();
  }

  function startEmbedder(status){
    if(embedder)return Promise.resolve(embedder); if(loading)return loading;
    loading=(async()=>{
      status.textContent="Matches ready • Hugging Face AI is loading in the background…";
      const {pipeline,env}=await import(HF_IMPORT);
      if(env){env.allowLocalModels=false;env.useBrowserCache=true;if(env.backends?.onnx?.wasm)env.backends.onnx.wasm.numThreads=1;}
      let last=null;
      for(const model of MODELS){
        try{ const pipe=await pipeline("feature-extraction",model); await pipe("teacher classroom resources",{pooling:"mean",normalize:true}); embedder=pipe;activeModel=model;return pipe; }
        catch(e){last=e;try{await embedder?.dispose?.();}catch{} embedder=null;}
      }
      throw last||new Error("No semantic model loaded");
    })().catch(e=>{loading=null;throw e;});
    return loading;
  }

  function dot(a,b){let s=0;for(let i=0;i<Math.min(a.length,b.length);i++)s+=a[i]*b[i];return s;}
  function lexicalRank(q){ const terms=q.toLowerCase().split(/[^a-z0-9]+/).filter(t=>t.length>2); return deals().map(d=>{const hay=corpus(d).toLowerCase();const lex=terms.reduce((n,t)=>n+(hay.includes(t)?1:0),0)/Math.max(1,terms.length);return{deal:d,semantic:lex,score:lex+freshnessBoost(d)}}).sort((a,b)=>b.score-a.score); }
  async function semanticRank(q,status){
    const ds=deals(), sig=ds.map(d=>`${d.id}:${d.lastVerified}:${d.description}`).join("|"); const pipe=await startEmbedder(status);
    if(!dealVectors||signature!==sig){const out=await pipe(ds.map(corpus),{pooling:"mean",normalize:true});dealVectors=out.tolist();signature=sig;}
    const qv=(await pipe(q,{pooling:"mean",normalize:true})).tolist()[0];
    return ds.map((d,i)=>{const sim=dot(qv,dealVectors[i]);return{deal:d,semantic:sim,score:sim+freshnessBoost(d)}}).sort((a,b)=>b.score-a.score);
  }
  function why(r){const d=r.deal,p=[];if(d.verificationStatus==="verified")p.push("official source");const age=ageDays(d.lastVerified);if(Number.isFinite(age))p.push(`checked ${age} day${age===1?"":"s"} ago`);if(d.savingsLabel)p.push(d.savingsLabel);if(d.locationType)p.push(d.locationType.toLowerCase());return p.join(" • ");}
  function render(q,ranked,mode){const top=ranked.slice(0,5);if(!top.length)return`<div class="teacher-ai-empty">No active deals are loaded right now.</div>`;const stale=deals().filter(d=>ageDays(d.lastVerified)>STALE_DAYS).length;return`<div class="teacher-ai-summary"><strong>${esc(mode)}</strong><br>Best matches for “${esc(q)}”. ${stale?`${stale} active listing${stale===1?" is":"s are"} older than ${STALE_DAYS} days and should be rechecked.`:`No active verified listing is beyond the ${STALE_DAYS}-day freshness flag.`}</div>${top.map((r,i)=>{const d=r.deal,c=Math.max(0,Math.min(99,Math.round(Math.max(0,r.semantic)*100)));return`<article class="teacher-ai-result"><div class="teacher-ai-rank">${i+1}</div><div><strong>${esc(d.title)}</strong><span>${esc(d.organization)} • ${esc(d.category)}</span><p>${esc(d.description)}</p><small>${esc(why(r))} • match ${c}%</small><a href="${safeUrl(d.url)}" target="_blank" rel="noopener noreferrer">Check official source ↗</a></div></article>`}).join("")}<p class="teacher-ai-disclaimer">AI ranks the loaded directory; it does not independently confirm that an offer still exists. Check the official source before relying on eligibility, price, or deadline.</p>`;}

  async function runScout(){
    const q=String(document.querySelector("#teacherAiQuestion")?.value||"").trim(),status=document.querySelector("#teacherAiStatus"),answer=document.querySelector("#teacherAiAnswer");
    if(q.length<3){status.textContent="Tell the scout what you need first.";return;} if(!deals().length){status.textContent="Deals are still loading. Try again in a moment.";return;}
    const id=++requestId, initial=lexicalRank(q); answer.innerHTML=render(q,initial,"Instant verified-directory match"); answer.hidden=false; status.textContent="Matches ready • Hugging Face AI is improving the ranking in the background…";
    try{const ranked=await waitFor(semanticRank(q,status),AI_WAIT_MS,"AI startup timed out");if(id!==requestId)return;answer.innerHTML=render(q,ranked,"Hugging Face semantic ranking");status.textContent=`AI ready • ${activeModel} • grounded in ${deals().length} active listings`;}
    catch(e){if(id!==requestId)return;console.warn("Teacher Treasure AI unavailable; instant ranking remains active.",e);status.textContent="Smart matches are active. Hugging Face AI did not finish in time, so the directory answer stayed usable instead of hanging.";}
  }

  function updateFreshnessPanelWhenReady(){let tries=0;const update=()=>{tries++;const ds=typeof state!=="undefined"?(state.deals||[]):[];if(!ds.length&&tries<40){setTimeout(update,250);return;}const panel=document.querySelector(".update-panel");if(!panel||!ds.length)return;const dates=ds.filter(d=>d.verificationStatus==="verified"&&d.lastVerified).map(d=>d.lastVerified).sort();if(!dates.length)return;const newest=dates.at(-1),oldest=dates[0],old=ds.filter(d=>!isExpired(d)&&ageDays(d.lastVerified)>STALE_DAYS).length;const h=panel.querySelector("h2"),p=panel.querySelector("p:last-child");if(h)h.textContent=`Newest official check: ${new Date(`${newest}T12:00:00`).toLocaleDateString()}`;if(p)p.textContent=old?`${old} active listing${old===1?" is":"s are"} beyond the ${STALE_DAYS}-day review window. The daily GitHub freshness monitor will flag them for review.`:`Verified listings span ${oldest} through ${newest}. A daily GitHub monitor checks deadlines, stale verification dates, and official-link health.`;};update();}

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",installUI,{once:true});else installUI();
})();
