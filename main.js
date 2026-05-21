/* ── Toast ── */
function showToast(msg, type = "success") {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.className = `show ${type}`;
  clearTimeout(t._tid);
  t._tid = setTimeout(() => { t.className = ""; }, 3200);
}

/* ── Escape HTML ── */
function esc(s) { return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

/* ── Animate score ring ── */
function animateRing(score) {
  const arc = document.getElementById("ringArc");
  if (!arc) return;
  const r = 52, circ = 2 * Math.PI * r;
  arc.style.strokeDasharray  = circ;
  arc.style.strokeDashoffset = circ;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    arc.style.strokeDashoffset = circ - (score / 100) * circ;
  }));
}

/* ── Animated counter roll-up ── */
function animateCount(el, target, suffix = "") {
  const dur = 900, start = performance.now();
  const from = parseFloat(el.textContent) || 0;
  function step(now) {
    const p = Math.min((now - start) / dur, 1);
    const ease = 1 - Math.pow(1 - p, 3);
    el.textContent = (Math.round((from + (target - from) * ease) * 10) / 10) + suffix;
    if (p < 1) requestAnimationFrame(step);
    else el.textContent = target + suffix;
  }
  requestAnimationFrame(step);
}

/* ── Confetti burst ── */
function launchConfetti() {
  const canvas = document.createElement("canvas");
  canvas.id = "confetti-canvas";
  document.body.appendChild(canvas);
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext("2d");

  const colors = ["#a78bfa","#7c3aed","#22c55e","#f59e0b","#38bdf8","#f472b6"];
  const pieces = Array.from({ length: 120 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * -canvas.height,
    r: Math.random() * 6 + 3,
    d: Math.random() * 4 + 2,
    color: colors[Math.floor(Math.random() * colors.length)],
    tilt: Math.random() * 10 - 5,
    tiltSpeed: Math.random() * 0.1 + 0.05,
    angle: 0,
  }));

  let frame, elapsed = 0;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach(p => {
      p.angle += p.tiltSpeed;
      p.y += p.d;
      p.tilt = Math.sin(p.angle) * 12;
      ctx.beginPath();
      ctx.lineWidth = p.r;
      ctx.strokeStyle = p.color;
      ctx.moveTo(p.x + p.tilt + p.r / 2, p.y);
      ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r / 2);
      ctx.stroke();
    });
    elapsed++;
    if (elapsed < 180) frame = requestAnimationFrame(draw);
    else { cancelAnimationFrame(frame); canvas.remove(); }
  }
  draw();
}

/* ── Typing headline ── */
function typeHeadline(el, text, speed = 55) {
  el.textContent = "";
  const cursor = document.createElement("span");
  cursor.className = "typing-cursor";
  el.appendChild(cursor);
  let i = 0;
  const iv = setInterval(() => {
    el.insertBefore(document.createTextNode(text[i++]), cursor);
    if (i >= text.length) { clearInterval(iv); setTimeout(() => cursor.remove(), 1200); }
  }, speed);
}

/* ── Predict form ── */
const predictForm = document.getElementById("predictForm");
if (predictForm) {
  /* Slider live labels */
  predictForm.querySelectorAll("input[type=range], input[type=number]").forEach(inp => {
    const out = document.getElementById("val_" + inp.name);
    if (out) { out.textContent = inp.value; inp.addEventListener("input", () => out.textContent = inp.value); }
  });

  predictForm.addEventListener("submit", async e => {
    e.preventDefault();
    const btn = predictForm.querySelector(".btn-primary");
    const orig = btn.innerHTML;
    btn.innerHTML = '<span class="spin"></span> Analyzing…';
    btn.disabled = true;

    const payload = Object.fromEntries(new FormData(predictForm).entries());

    try {
      const res  = await fetch("/api/predict", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const json = await res.json();
      if (!res.ok) { showToast(json.error || "Something went wrong", "error"); return; }
      renderResult(json);
      document.getElementById("result").scrollIntoView({ behavior: "smooth", block: "start" });
      if (json.result === "Ready") setTimeout(launchConfetti, 600);
    } catch { showToast("Network error. Please try again.", "error"); }
    finally  { btn.innerHTML = orig; btn.disabled = false; }
  });
}

/* ── Render result card ── */
function renderResult(d) {
  const el = document.getElementById("result");
  if (!el) return;

  const bc = { "Ready": "badge-ready", "Average": "badge-average", "Needs Work": "badge-needs" }[d.result] || "badge-average";

  const tips = d.suggestions && d.suggestions.length
    ? `<div class="suggestions">
         <div class="suggestions-title">
           <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
           Areas to improve
         </div>
         <ul>${d.suggestions.map(s => `<li>${s}</li>`).join("")}</ul>
       </div>`
    : `<div class="success-box">All key metrics met — you are placement ready!</div>`;

  el.innerHTML = `
    <div class="card fade-up" style="border-top:2px solid var(--primary); text-align:center;">
      <div class="score-ring-wrap">
        <svg width="130" height="130" viewBox="0 0 130 130" class="score-ring">
          <circle class="ring-bg"  cx="65" cy="65" r="52" stroke-width="8"/>
          <circle class="ring-arc" id="ringArc" cx="65" cy="65" r="52" stroke-width="8"/>
        </svg>
        <div>
          <div class="score-num">${d.score}%</div>
          <div class="score-lbl">Readiness Score</div>
        </div>
      </div>
      <span class="badge ${bc}" style="margin-bottom:12px;display:inline-block;">${d.result}</span>
      <p style="color:var(--muted);font-size:0.875rem;margin-bottom:16px;">${d.message}</p>
      <button class="btn-outline" onclick="downloadReport()">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Download Report
      </button>
      <div style="margin-top:16px;">${tips}</div>
    </div>`;

  el.style.display = "block";
  animateRing(d.score);
}

/* ── Download PDF report ── */
function downloadReport() {
  const el = document.getElementById("result");
  if (!el) return;
  const w = window.open("", "_blank");
  w.document.write(`<!DOCTYPE html><html><head><title>Placement Report</title>
    <style>
      body{font-family:Arial,sans-serif;padding:40px;color:#111;max-width:700px;margin:0 auto;}
      h1{color:#7c3aed;margin-bottom:4px;}
      .score{font-size:3rem;font-weight:700;color:#7c3aed;}
      .badge{display:inline-block;padding:4px 14px;border-radius:99px;font-size:0.8rem;font-weight:700;border:1px solid #ccc;margin:8px 0;}
      .section{margin-top:24px;}
      .section h3{font-size:0.85rem;text-transform:uppercase;letter-spacing:0.5px;color:#666;margin-bottom:10px;}
      ul{padding-left:20px;} li{margin-bottom:6px;color:#444;}
      .meta{color:#888;font-size:0.85rem;margin-top:4px;}
      hr{border:none;border-top:1px solid #eee;margin:20px 0;}
    </style></head><body>
    ${el.querySelector(".score-num") ? `
    <h1>Placement Readiness Report</h1>
    <div class="meta">Generated on ${new Date().toLocaleDateString("en-IN",{day:"numeric",month:"long",year:"numeric"})}</div>
    <hr>
    <div class="score">${el.querySelector(".score-num").textContent}</div>
    <div class="badge">${el.querySelector(".badge").textContent}</div>
    <p>${el.querySelector("p").textContent}</p>
    ${el.querySelector(".suggestions ul") ? `<div class="section"><h3>Areas to Improve</h3><ul>${
      [...el.querySelectorAll(".suggestions li")].map(li=>`<li>${li.textContent}</li>`).join("")
    }</ul></div>` : "<p style='color:#22c55e;font-weight:600;'>All key metrics met!</p>"}
    ` : "<p>No result data found.</p>"}
    </body></html>`);
  w.document.close();
  setTimeout(() => { w.print(); }, 400);
}
