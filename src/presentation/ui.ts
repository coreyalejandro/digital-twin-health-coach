/**
 * Bundled HTML UI (neurodivergent-first, report E4/T5/T7/E7/§6.2).
 *
 * Layout principle: the VITAL action is first and unmissable. On load the user
 * sees only (1) the "I need human help" control and (2) the coaching box with a
 * Send button. Everything optional — preferences, interaction mode, twin, saved
 * plans, governance dashboard — is collapsed behind clearly-labelled toggles so
 * it never sits between the user and the thing they came to do.
 *
 * Accessibility: structured-first (chat opt-in), skip link, semantic landmarks,
 * ARIA live regions, visible focus, prefers-reduced-motion, large targets,
 * turn-taking signal. Values inserted via textContent (no innerHTML).
 */
export const PAGE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Digital Twin Health Coach</title>
<style>
  :root { --bg:#0f1419; --panel:#1b2330; --ink:#eef2f7; --muted:#9fb0c3; --accent:#5ee0b0; --warn:#ffb454; --alert:#ff6b6b; --line:#2c3a4d; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font:17px/1.6 system-ui,Segoe UI,Roboto,sans-serif; }
  a.skip { position:absolute; left:-999px; top:0; background:var(--accent); color:#062; padding:.6rem 1rem; }
  a.skip:focus { left:8px; top:8px; z-index:10; }
  header { display:flex; align-items:center; justify-content:space-between; gap:1rem; padding:1rem 1.25rem; border-bottom:1px solid var(--line); position:sticky; top:0; background:var(--bg); z-index:5; }
  header h1 { font-size:1.1rem; margin:0; }
  .panic { background:var(--alert); color:#fff; border:0; border-radius:10px; padding:.85rem 1.15rem; font-weight:700; cursor:pointer; min-height:50px; font-size:1rem; }
  .panic:focus-visible, button:focus-visible, select:focus-visible, textarea:focus-visible, summary:focus-visible { outline:3px solid var(--accent); outline-offset:2px; }
  main { max-width:760px; margin:0 auto; padding:1.25rem; }
  .intro { color:var(--muted); font-size:.95rem; margin:.2rem 0 1rem; }
  /* The primary, vital block — visually dominant, first in the DOM. */
  .coach { background:var(--panel); border:1px solid var(--line); border-radius:16px; padding:1.25rem 1.35rem; }
  .coach label { display:block; font-weight:700; font-size:1.15rem; margin:0 0 .5rem; }
  textarea { width:100%; background:#0c1118; color:var(--ink); border:1px solid var(--line); border-radius:12px; padding:.85rem; font:inherit; min-height:120px; resize:vertical; }
  .turn { color:var(--muted); font-size:.92rem; min-height:1.4em; margin:.5rem 0; }
  button.primary { background:var(--accent); color:#062; border:0; border-radius:12px; padding:.85rem 1.4rem; font-weight:700; font-size:1.05rem; cursor:pointer; min-height:52px; }
  #response { margin-top:1rem; }
  .chip { display:inline-block; border-radius:999px; padding:.15rem .6rem; font-size:.8rem; border:1px solid var(--line); }
  .disclaimer { color:var(--muted); font-size:.9rem; border-left:3px solid var(--warn); padding-left:.7rem; margin-top:.6rem; }
  /* Optional, secondary content — collapsed by default, out of the way. */
  details.opt { background:var(--panel); border:1px solid var(--line); border-radius:12px; padding:.2rem 1.1rem; margin:.8rem 0 0; }
  details.opt > summary { cursor:pointer; font-weight:600; padding:.85rem 0; list-style:none; color:var(--ink); }
  details.opt > summary::-webkit-details-marker { display:none; }
  details.opt > summary::before { content:"▸ "; color:var(--muted); }
  details.opt[open] > summary::before { content:"▾ "; }
  .row { display:flex; gap:1rem; flex-wrap:wrap; }
  .row > div { flex:1 1 200px; }
  label.sub { display:block; font-weight:600; margin:.4rem 0 .25rem; }
  select { width:100%; background:#0c1118; color:var(--ink); border:1px solid var(--line); border-radius:10px; padding:.6rem; font:inherit; }
  .tabs { display:flex; gap:.5rem; flex-wrap:wrap; margin-top:.4rem; }
  .tab { background:#0c1118; border:1px solid var(--line); color:var(--ink); border-radius:999px; padding:.5rem .9rem; cursor:pointer; }
  .tab[aria-selected="true"] { background:var(--accent); color:#062; font-weight:700; }
  .tile { display:flex; justify-content:space-between; border-bottom:1px solid var(--line); padding:.4rem 0; }
  .ok{color:var(--accent)} .watch{color:var(--warn)} .alert{color:var(--alert)} .muted{color:var(--muted)}
  ul{margin:.3rem 0 .3rem 1.1rem}
  @media (prefers-reduced-motion: reduce){ *{transition:none!important} }
</style>
</head>
<body>
<a class="skip" href="#coach">Skip to the coaching box</a>
<header>
  <h1>Digital Twin Health Coach</h1>
  <button class="panic" id="panic" aria-label="I need human help right now">I need human help</button>
</header>
<main>
  <p class="intro">Tell me what you'd like help with. General wellness support only — anything clinical or urgent goes to a human.</p>

  <!-- VITAL: the coaching action, first and unmissable -->
  <section class="coach" id="coach" aria-labelledby="coach-label">
    <label id="coach-label" for="msg">What would you like help with?</label>
    <textarea id="msg" aria-describedby="msg-help" placeholder="e.g. Help me build a gentle walking habit"></textarea>
    <p id="msg-help" class="muted" style="font-size:.88rem;margin:.4rem 0">One thing at a time works best.</p>
    <p class="turn" id="turn" aria-live="polite">Your turn.</p>
    <button class="primary" id="send">Send to coach</button>
    <div id="response" aria-live="polite"></div>
  </section>

  <!-- OPTIONAL: everything else, collapsed, out of the way -->
  <details class="opt" aria-label="Options">
    <summary>Options — how I talk to you</summary>
    <div class="row">
      <div>
        <label class="sub" for="cog">Information density</label>
        <select id="cog"><option value="minimal">Minimal</option><option value="standard" selected>Standard</option><option value="detailed">Detailed</option></select>
      </div>
      <div>
        <label class="sub" for="depth">Explanation depth</label>
        <select id="depth"><option value="summary" selected>Summary only</option><option value="detailed">Show reasoning</option></select>
      </div>
    </div>
    <div class="tabs" role="tablist" aria-label="Interaction mode" style="margin-top:.8rem">
      <button class="tab" role="tab" aria-selected="true" id="m-structured">Structured</button>
      <button class="tab" role="tab" aria-selected="false" id="m-schedule">Visual schedule</button>
      <button class="tab" role="tab" aria-selected="false" id="m-chat">Open chat (off by default)</button>
    </div>
    <p class="muted" id="mode-note" style="margin-top:.6rem;font-size:.9rem">Structured coaching is the default — it asks one clear thing at a time.</p>
  </details>

  <details class="opt"><summary>Your twin</summary><div id="twin"><button class="tab" id="loadtwin">Load twin fidelity</button></div></details>
  <details class="opt"><summary>Saved plans (work offline)</summary><div id="plans"></div></details>
  <details class="opt"><summary>Governance dashboard</summary><div id="dash"><button class="tab" id="loaddash">Refresh governance metrics</button></div></details>
</main>
<script>
(function(){
  var USER="demo", SESSION="web-"+Math.random().toString(36).slice(2,8);
  function $(id){return document.getElementById(id);}
  function el(tag,txt,cls){var e=document.createElement(tag); if(txt!=null)e.textContent=txt; if(cls)e.className=cls; return e;}
  function post(p,b){return fetch(p,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(b)}).then(function(r){return r.json();});}
  function get(p){return fetch(p).then(function(r){return r.json();});}

  $("panic").addEventListener("click",function(){
    post("/api/panic",{userId:USER,sessionId:SESSION}).then(function(d){
      var box=$("response"); box.innerHTML="";
      box.appendChild(el("p","You've been connected to a human. You did the right thing reaching out."));
      var ul=el("ul"); (d.resources||[]).forEach(function(r){ul.appendChild(el("li",r.name+" — "+r.contact+" ("+r.available+")"));});
      box.appendChild(ul);
    });
  });

  var tabs=[["m-structured","Structured coaching is the default — it asks one clear thing at a time."],
           ["m-schedule","A time-based view of your goals and medication anchors."],
           ["m-chat","Open chat is available but off by default — many people find structure calmer."]];
  tabs.forEach(function(t){ var b=$(t[0]); if(b) b.addEventListener("click",function(){
    tabs.forEach(function(o){var e=$(o[0]); if(e) e.setAttribute("aria-selected", o[0]===t[0]?"true":"false");});
    $("mode-note").textContent=t[1];
  });});

  function render(d){
    var box=$("response"); box.innerHTML="";
    var r=d.response;
    box.appendChild(el("p", r.text));
    box.appendChild(el("span", "Confidence: "+ (r.explanation.confidence||"n/a"), "chip"));
    if(r.crisisResources && r.crisisResources.length){
      var ul=el("ul"); r.crisisResources.forEach(function(x){ul.appendChild(el("li",x.name+" — "+x.contact));}); box.appendChild(ul);
    }
    if(r.explanation.disclaimer) box.appendChild(el("p", r.explanation.disclaimer, "disclaimer"));
    if($("depth").value==="detailed" && $("cog").value!=="minimal" && r.explanation.reasoning && r.explanation.reasoning.length){
      var det=el("details"); det.appendChild(el("summary","Why did I say this?"));
      var ul=el("ul"); r.explanation.reasoning.forEach(function(s){ul.appendChild(el("li", s.data+" → "+s.inference));}); det.appendChild(ul);
      if(r.explanation.citations && r.explanation.citations.length){
        var cu=el("ul"); r.explanation.citations.forEach(function(c){cu.appendChild(el("li","Source: "+c.title));}); det.appendChild(el("p","Sources:")); det.appendChild(cu);
      }
      box.appendChild(det);
    }
    if(d.agency) box.appendChild(el("p","Your health-agency score: "+d.agency.score+"/100 ("+d.agency.band+")","muted"));
    if(d.degraded) box.appendChild(el("p","(Running in safe degraded mode.)","watch"));
  }

  $("send").addEventListener("click",function(){
    var t=$("msg").value.trim(); if(!t) return;
    $("turn").textContent="Coach is thinking…";
    post("/api/coach",{userId:USER,sessionId:SESSION,text:t}).then(function(d){
      $("turn").textContent="Your turn."; render(d);
      if(d.response && d.response.disposition && d.response.disposition.indexOf("answer")===0){ savePlan(t); }
    }).catch(function(){ $("turn").textContent="Your turn."; $("response").textContent="Something went wrong. If this is urgent, use ‘I need human help’."; });
  });

  function plans(){ try{return JSON.parse(localStorage.getItem("dtc.plans")||"[]");}catch(e){return [];} }
  function savePlan(q){ var p=plans(); p.unshift({q:q,at:new Date().toISOString()}); localStorage.setItem("dtc.plans",JSON.stringify(p.slice(0,10))); loadPlans(); }
  function loadPlans(){ var box=$("plans"); if(!box) return; box.innerHTML=""; var p=plans(); if(!p.length){box.appendChild(el("p","No saved plans yet.","muted"));return;} p.forEach(function(x){var d=el("div","","tile"); d.appendChild(el("span",x.q)); box.appendChild(d);}); }
  loadPlans();

  $("loadtwin").addEventListener("click",function(){
    get("/api/twin?userId="+USER).then(function(d){
      var box=$("twin"); box.innerHTML=""; box.appendChild(el("p",d.fidelity.summary));
      var ul=el("ul"); (d.state.insights||[]).forEach(function(i){ul.appendChild(el("li",i.message));}); box.appendChild(ul);
    });
  });

  $("loaddash").addEventListener("click",function(){
    get("/api/dashboard").then(function(s){
      var box=$("dash"); box.innerHTML=""; box.appendChild(el("p",s.headline));
      s.tiles.forEach(function(t){ var d=el("div","","tile"); d.appendChild(el("span",t.label)); d.appendChild(el("span",t.value,t.status)); box.appendChild(d); });
      box.appendChild(el("p","Audit chain: "+(s.auditChainVerified?"verified":"BROKEN"), s.auditChainVerified?"ok":"alert"));
    });
  });
})();
</script>
</body>
</html>`;
