"use strict";

/* Teacher Treasure AI Scout
   Semantic search runs in the browser with a small Hugging Face embedding model.
   Answers are grounded only in the deals currently loaded by Teacher Treasure.
   Verified, non-expired, recently checked offers receive a ranking boost.
   If the model cannot load, the same UI falls back to a transparent keyword ranker.
*/

(() => {
  const HF_IMPORT = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0";
  const MODEL_CANDIDATES = ["Xenova/bge-small-en-v1.5", "Xenova/all-MiniLM-L6-v2"];
  const STALE_DAYS = 45;
  let embedder = null;
  let loading = null;
  let activeModel = null;
  let dealVectors = null;
  let dealVectorSignature = "";

  function aiEscape(value = "") {
    return String(value).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  }

  function dateAgeDays(value) {
    if (!value) return Infinity;
    const date = new Date(`${value}T12:00:00`);
    if (Number.isNaN(date.getTime())) return Infinity;
    return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
  }

  function dealCorpus(deal) {
    return [
      deal.title,
      deal.organization,
      deal.type,
      deal.category,
      deal.locationType,
      deal.region,
      deal.description,
      deal.eligibility,
      deal.savingsLabel,
      deal.verificationStatus === "verified" ? "official verified educator teacher offer" : "community offer"
    ].filter(Boolean).join(". ");
  }

  function installUI() {
    if (document.querySelector("#teacherAiScout")) return;
    const sidebar = document.querySelector(".sidebar");
    if (!sidebar) return;
    const panel = document.createElement("section");
    panel.id = "teacherAiScout";
    panel.className = "panel teacher-ai-panel";
    panel.innerHTML = `
      <p class="eyebrow">Hugging Face • private browser AI</p>
      <h2>Ask the Deal Scout</h2>
      <p>Describe what you need in normal words. AI searches the offers already loaded here and favors official, current listings.</p>
      <textarea id="teacherAiQuestion" rows="4" maxlength="360" placeholder="Examples: I need free math resources for elementary students • Any technology savings for a new teacher? • What can help a special-ed classroom?"></textarea>
      <button class="btn btn-primary teacher-ai-button" id="teacherAiAsk" type="button">✨ Find my best matches</button>
      <div id="teacherAiStatus" class="teacher-ai-status" role="status">AI loads only when you ask.</div>
      <div id="teacherAiAnswer" class="teacher-ai-answer" hidden></div>`;
    sidebar.prepend(panel);
    document.querySelector("#teacherAiAsk")?.addEventListener("click", runScout);
    updateFreshnessPanelWhenReady();
  }

  async function ensureEmbedder(status) {
    if (embedder) return embedder;
    if (loading) return loading;
    loading = (async () => {
      status.textContent = "Loading lightweight Hugging Face semantic search…";
      const { pipeline, env } = await import(HF_IMPORT);
      if (env) {
        env.allowLocalModels = false;
        env.useBrowserCache = true;
        if (env.backends?.onnx?.wasm) env.backends.onnx.wasm.numThreads = 1;
      }
      let lastError = null;
      for (const model of MODEL_CANDIDATES) {
        try {
          const pipe = await pipeline("feature-extraction", model, { dtype: "q8" });
          await pipe("teacher classroom resources", { pooling: "mean", normalize: true });
          embedder = pipe;
          activeModel = model;
          return pipe;
        } catch (error) {
          lastError = error;
          embedder = null;
        }
      }
      throw lastError || new Error("No semantic model loaded");
    })().finally(() => { loading = null; });
    return loading;
  }

  function dot(a, b) {
    let total = 0;
    for (let i = 0; i < Math.min(a.length, b.length); i += 1) total += a[i] * b[i];
    return total;
  }

  function currentDeals() {
    return (state?.deals || []).filter(deal => !isExpired(deal));
  }

  function freshnessBoost(deal) {
    const age = dateAgeDays(deal.lastVerified);
    let boost = deal.verificationStatus === "verified" ? 0.08 : -0.02;
    if (age <= 14) boost += 0.07;
    else if (age <= 30) boost += 0.05;
    else if (age <= STALE_DAYS) boost += 0.02;
    else if (Number.isFinite(age)) boost -= Math.min(0.10, (age - STALE_DAYS) / 300);
    if (deal.expires && daysUntil(deal.expires) <= 7) boost -= 0.025;
    return boost;
  }

  async function semanticRank(query, status) {
    const deals = currentDeals();
    const signature = deals.map(deal => `${deal.id}:${deal.lastVerified}:${deal.description}`).join("|");
    const pipe = await ensureEmbedder(status);
    if (!dealVectors || dealVectorSignature !== signature) {
      const output = await pipe(deals.map(dealCorpus), { pooling: "mean", normalize: true });
      dealVectors = output.tolist();
      dealVectorSignature = signature;
    }
    const q = await pipe(query, { pooling: "mean", normalize: true });
    const queryVector = q.tolist()[0];
    return deals.map((deal, i) => ({
      deal,
      semantic: dot(queryVector, dealVectors[i]),
      score: dot(queryVector, dealVectors[i]) + freshnessBoost(deal)
    })).sort((a, b) => b.score - a.score);
  }

  function lexicalRank(query) {
    const deals = currentDeals();
    const terms = query.toLowerCase().split(/[^a-z0-9]+/).filter(term => term.length > 2);
    return deals.map(deal => {
      const hay = dealCorpus(deal).toLowerCase();
      const lexical = terms.reduce((n, term) => n + (hay.includes(term) ? 1 : 0), 0) / Math.max(1, terms.length);
      return { deal, semantic: lexical, score: lexical + freshnessBoost(deal) };
    }).sort((a, b) => b.score - a.score);
  }

  function matchWhy(result) {
    const deal = result.deal;
    const pieces = [];
    if (deal.verificationStatus === "verified") pieces.push("official source");
    const age = dateAgeDays(deal.lastVerified);
    if (Number.isFinite(age)) pieces.push(`checked ${age} day${age === 1 ? "" : "s"} ago`);
    if (deal.savingsLabel) pieces.push(deal.savingsLabel);
    if (deal.locationType) pieces.push(deal.locationType.toLowerCase());
    return pieces.join(" • ");
  }

  function renderResults(query, ranked, mode) {
    const top = ranked.slice(0, 5);
    if (!top.length) return `<div class="teacher-ai-empty">No active deals are loaded right now.</div>`;
    const staleCount = currentDeals().filter(deal => dateAgeDays(deal.lastVerified) > STALE_DAYS).length;
    return `
      <div class="teacher-ai-summary"><strong>${aiEscape(mode)}</strong><br>Best matches for “${aiEscape(query)}”. ${staleCount ? `${staleCount} active listing${staleCount === 1 ? " is" : "s are"} older than ${STALE_DAYS} days and should be rechecked.` : `No active verified listing is beyond the ${STALE_DAYS}-day freshness flag.`}</div>
      ${top.map((result, index) => {
        const deal = result.deal;
        const confidence = Math.max(0, Math.min(99, Math.round(Math.max(0, result.semantic) * 100)));
        return `<article class="teacher-ai-result">
          <div class="teacher-ai-rank">${index + 1}</div>
          <div><strong>${aiEscape(deal.title)}</strong><span>${aiEscape(deal.organization)} • ${aiEscape(deal.category)}</span><p>${aiEscape(deal.description)}</p><small>${aiEscape(matchWhy(result))} • semantic match ${confidence}%</small><a href="${safeUrl(deal.url)}" target="_blank" rel="noopener noreferrer">Check official source ↗</a></div>
        </article>`;
      }).join("")}
      <p class="teacher-ai-disclaimer">AI ranks the directory; it does not independently confirm that an offer still exists. Always use the official link before relying on eligibility, price, or deadline.</p>`;
  }

  async function runScout() {
    const question = String(document.querySelector("#teacherAiQuestion")?.value || "").trim();
    const status = document.querySelector("#teacherAiStatus");
    const answer = document.querySelector("#teacherAiAnswer");
    const button = document.querySelector("#teacherAiAsk");
    if (question.length < 3) {
      status.textContent = "Tell the scout what you need first.";
      return;
    }
    if (!state?.deals?.length) {
      status.textContent = "Deals are still loading. Try again in a moment.";
      return;
    }

    button.disabled = true;
    answer.hidden = true;
    let ranked;
    let mode = "AI semantic ranking";
    try {
      ranked = await semanticRank(question, status);
      status.textContent = `AI ready • ${activeModel} • grounded in ${currentDeals().length} active listings`;
    } catch (error) {
      console.warn("Teacher Treasure semantic AI unavailable; using keyword fallback.", error);
      ranked = lexicalRank(question);
      mode = "Offline smart fallback";
      status.textContent = "Hugging Face AI could not load, so the scout used the same verified directory with keyword + freshness ranking.";
    } finally {
      button.disabled = false;
    }
    answer.innerHTML = renderResults(question, ranked, mode);
    answer.hidden = false;
  }

  function updateFreshnessPanelWhenReady() {
    let tries = 0;
    const update = () => {
      tries += 1;
      const deals = state?.deals || [];
      if (!deals.length && tries < 40) {
        setTimeout(update, 250);
        return;
      }
      const panel = document.querySelector(".update-panel");
      if (!panel || !deals.length) return;
      const verifiedDates = deals.filter(d => d.verificationStatus === "verified" && d.lastVerified).map(d => d.lastVerified).sort();
      if (!verifiedDates.length) return;
      const newest = verifiedDates[verifiedDates.length - 1];
      const oldest = verifiedDates[0];
      const oldCount = deals.filter(d => !isExpired(d) && dateAgeDays(d.lastVerified) > STALE_DAYS).length;
      const heading = panel.querySelector("h2");
      const text = panel.querySelector("p:last-child");
      if (heading) heading.textContent = `Newest official check: ${new Date(`${newest}T12:00:00`).toLocaleDateString()}`;
      if (text) text.textContent = oldCount
        ? `${oldCount} active listing${oldCount === 1 ? " is" : "s are"} beyond the ${STALE_DAYS}-day review window. The daily GitHub freshness monitor will flag them for review.`
        : `Verified listings span ${oldest} through ${newest}. A daily GitHub monitor checks deadlines, stale verification dates, and official-link health.`;
    };
    update();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", installUI, { once: true });
  else installUI();
})();
