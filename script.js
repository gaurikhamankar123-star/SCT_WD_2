(() => {
  "use strict";

  // ---------- Elements ----------
  const $ = (id) => document.getElementById(id);
  const root = document.documentElement;
  const body = document.body;
  const dialWrap = $("dialWrap");
  const timeEl = $("time");
  const mainEl = $("main");
  const csEl = $("cs");
  const statusEl = $("status");
  const toggleBtn = $("toggleBtn");
  const lapBtn = $("lapBtn");
  const resetBtn = $("resetBtn");
  const lapList = $("lapList");
  const lapCount = $("lapCount");
  const emptyState = $("emptyState");
  const ringProgress = $("ringProgress");
  const marker = $("marker");
  const ticksGroup = $("ticks");
  const swatches = document.querySelectorAll(".swatch");

  const RING_LENGTH = 2 * Math.PI * 142; // matches r="142" in the SVG
  const STORAGE_KEY = "stopwatch-state-v1";
  const THEME_KEY = "stopwatch-theme";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- State ----------
  let state = {
    running: false,
    startedAt: 0, // Date.now() when the current run began
    elapsed: 0, // ms accumulated before the current run
    laps: [], // [{ split, total }] oldest first
  };
  let rafId = null;
  let ticks = [];
  let litIdx = -1;

  // ---------- Helpers ----------
  const pad = (n) => String(n).padStart(2, "0");

  function getElapsed() {
    return state.running ? state.elapsed + (Date.now() - state.startedAt) : state.elapsed;
  }

  function parts(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const cs = Math.floor((ms % 1000) / 10);
    const main = h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
    return { main, cs: pad(cs), long: h > 0 };
  }

  const formatFull = (ms) => {
    const p = parts(ms);
    return `${p.main}.${p.cs}`;
  };

  const vibrate = (ms) => {
    if (navigator.vibrate) navigator.vibrate(ms);
  };

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (_) {
      /* storage unavailable, ignore */
    }
  }

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved && typeof saved.elapsed === "number" && Array.isArray(saved.laps)) {
        state = {
          running: !!saved.running,
          startedAt: saved.startedAt || 0,
          elapsed: saved.elapsed,
          laps: saved.laps,
        };
      }
    } catch (_) {
      /* ignore corrupted data */
    }
  }

  // ---------- Themes ----------
  function applyTheme(name) {
    root.dataset.theme = name;
    swatches.forEach((s) => s.setAttribute("aria-checked", String(s.dataset.theme === name)));
    try {
      localStorage.setItem(THEME_KEY, name);
    } catch (_) {
      /* ignore */
    }
  }

  swatches.forEach((s) => s.addEventListener("click", () => applyTheme(s.dataset.theme)));

  // ---------- Effects ----------
  function burst(originEl) {
    if (reduceMotion) return;
    const rect = originEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const styles = getComputedStyle(root);
    const colors = ["--c1", "--c2", "--c3", "--warn"].map((v) => styles.getPropertyValue(v).trim());

    for (let i = 0; i < 18; i++) {
      const dot = document.createElement("i");
      dot.className = "spark";
      dot.style.left = cx + "px";
      dot.style.top = cy + "px";
      dot.style.background = colors[i % colors.length];
      document.body.appendChild(dot);

      const angle = Math.random() * Math.PI * 2;
      const dist = 50 + Math.random() * 90;
      const x = Math.cos(angle) * dist;
      const y = Math.sin(angle) * dist;

      dot
        .animate(
          [
            { transform: "translate(-50%, -50%) scale(1)", opacity: 1 },
            { transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(0)`, opacity: 0 },
          ],
          { duration: 600 + Math.random() * 300, easing: "cubic-bezier(.2,.8,.3,1)" }
        )
        .addEventListener("finish", () => dot.remove());
    }
  }

  function flashDial() {
    dialWrap.classList.remove("flash");
    void dialWrap.offsetWidth; // restart the animation
    dialWrap.classList.add("flash");
  }

  document.querySelectorAll(".btn").forEach((btn) => {
    btn.addEventListener("pointerdown", (e) => {
      if (btn.disabled || reduceMotion) return;
      const rect = btn.getBoundingClientRect();
      const r = document.createElement("span");
      r.className = "ripple";
      r.style.left = e.clientX - rect.left + "px";
      r.style.top = e.clientY - rect.top + "px";
      btn.appendChild(r);
      r.addEventListener("animationend", () => r.remove());
    });
  });

  // ---------- Dial ticks ----------
  function buildTicks() {
    const cx = 160;
    const cy = 160;
    for (let i = 0; i < 60; i++) {
      const major = i % 5 === 0;
      const angle = (i * 6 * Math.PI) / 180;
      const outer = 126;
      const inner = major ? 113 : 119;
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", cx + outer * Math.sin(angle));
      line.setAttribute("y1", cy - outer * Math.cos(angle));
      line.setAttribute("x2", cx + inner * Math.sin(angle));
      line.setAttribute("y2", cy - inner * Math.cos(angle));
      line.setAttribute("class", major ? "tick major" : "tick");
      ticksGroup.appendChild(line);
      ticks.push(line);
    }
  }

  // ---------- Rendering ----------
  function render() {
    const ms = getElapsed();
    const p = parts(ms);

    mainEl.textContent = p.main;
    csEl.textContent = p.cs;
    timeEl.classList.toggle("long", p.long);

    // One full sweep of the ring = one minute
    const fraction = (ms % 60000) / 60000;
    ringProgress.style.strokeDashoffset = RING_LENGTH * (1 - fraction);
    marker.setAttribute("transform", `rotate(${fraction * 360} 160 160)`);

    // Light up the ticks the marker has passed
    const idx = ms > 0 ? Math.floor(fraction * 60) : -1;
    if (idx !== litIdx) {
      ticks.forEach((t, i) => t.classList.toggle("lit", i <= idx));
      litIdx = idx;
    }

    document.title = state.running ? `${formatFull(ms)} · Stopwatch` : "Stopwatch";
  }

  function renderControls() {
    const hasTime = state.elapsed > 0 || state.running;
    body.dataset.state = state.running ? "running" : hasTime ? "paused" : "ready";
    statusEl.textContent = state.running ? "Running" : hasTime ? "Paused" : "Ready";
    toggleBtn.textContent = state.running ? "Pause" : hasTime ? "Resume" : "Start";
    lapBtn.disabled = !state.running;
    resetBtn.disabled = !hasTime;
  }

  function renderLaps(newestIsNew = false) {
    const count = state.laps.length;
    lapCount.textContent = `${count} recorded`;
    emptyState.hidden = count > 0;
    lapList.hidden = count === 0;

    let fastest = -1;
    let slowest = -1;
    if (count >= 2) {
      const splits = state.laps.map((l) => l.split);
      fastest = splits.indexOf(Math.min(...splits));
      slowest = splits.indexOf(Math.max(...splits));
    }

    lapList.innerHTML = "";
    for (let i = count - 1; i >= 0; i--) {
      const lap = state.laps[i];
      const li = document.createElement("li");
      li.className = "lap";
      li.style.setProperty("--accent", `var(--c${(i % 3) + 1})`);
      if (i === fastest) li.classList.add("fastest");
      if (i === slowest) li.classList.add("slowest");
      if (newestIsNew && i === count - 1) li.classList.add("new");

      const tag =
        i === fastest
          ? '<span class="tag">Fastest</span>'
          : i === slowest
          ? '<span class="tag">Slowest</span>'
          : "";

      li.innerHTML = `
        <span class="lap-no">${i + 1}</span>
        <span class="lap-split">
          <span class="lap-split-time">${formatFull(lap.split)}</span>
          ${tag}
        </span>
        <span class="lap-total">${formatFull(lap.total)}</span>
      `;
      lapList.appendChild(li);
    }
  }

  // ---------- Loop ----------
  function loop() {
    render();
    if (state.running) rafId = requestAnimationFrame(loop);
  }

  // ---------- Actions ----------
  function start() {
    if (state.running) return;
    state.running = true;
    state.startedAt = Date.now();
    renderControls();
    save();
    vibrate(15);
    cancelAnimationFrame(rafId);
    loop();
  }

  function pause() {
    if (!state.running) return;
    state.elapsed = getElapsed();
    state.running = false;
    cancelAnimationFrame(rafId);
    render();
    renderControls();
    save();
    vibrate(15);
  }

  function toggle() {
    state.running ? pause() : start();
  }

  function lap() {
    if (!state.running) return;
    const total = getElapsed();
    const previous = state.laps.length ? state.laps[state.laps.length - 1].total : 0;
    state.laps.push({ split: total - previous, total });
    renderLaps(true);
    save();
    burst(lapBtn);
    flashDial();
    vibrate(30);
  }

  function reset() {
    cancelAnimationFrame(rafId);
    state = { running: false, startedAt: 0, elapsed: 0, laps: [] };
    litIdx = -2; // force the ticks to refresh
    render();
    renderControls();
    renderLaps();
    save();
  }

  // ---------- Events ----------
  toggleBtn.addEventListener("click", toggle);
  lapBtn.addEventListener("click", lap);
  resetBtn.addEventListener("click", reset);

  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const key = e.key.toLowerCase();

    if (e.code === "Space") {
      // A focused button already handles Space itself
      if (e.target.closest("button")) return;
      e.preventDefault();
      toggle();
    } else if (key === "l") {
      lap();
    } else if (key === "r" && !resetBtn.disabled) {
      reset();
    }
  });

  // Keep the display fresh when returning to the tab
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && state.running) {
      cancelAnimationFrame(rafId);
      loop();
    }
  });

  // ---------- Init ----------
  buildTicks();
  applyTheme(root.dataset.theme || "neon");
  load();
  render();
  renderControls();
  renderLaps();
  if (state.running) loop();
})();