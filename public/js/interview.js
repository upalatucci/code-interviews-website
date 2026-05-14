"use strict";
(() => {
  var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
    get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
  }) : x)(function(x) {
    if (typeof require !== "undefined") return require.apply(this, arguments);
    throw Error('Dynamic require of "' + x + '" is not supported');
  });

  // src/interview.ts
  var TOKEN = location.pathname.split("/").pop() ?? "";
  var theEditor = null;
  var editorModels = /* @__PURE__ */ new Map();
  var currentCcId = null;
  var currentView = "coding";
  var codingChallenges = [];
  var questions = [];
  var remainingSecondsAtLoad = null;
  var startTime = 0;
  var timerInterval = null;
  var autoSaveInterval = null;
  var saveTimeout = null;
  var isSubmitted = false;
  var warnTimer;
  var toastTimer;
  var WARN_THRESHOLD = 5 * 60;
  var DANGER_THRESHOLD = 60;
  var langMap = {
    javascript: "javascript",
    typescript: "typescript",
    python: "python",
    java: "java",
    cpp: "cpp",
    go: "go",
    rust: "rust"
  };
  window.addEventListener("DOMContentLoaded", () => {
    loadInterview();
    blockPaste();
  });
  async function loadInterview() {
    try {
      const res = await fetch(`/api/interview/${TOKEN}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.submitted) {
        showSubmittedOverlay();
        return;
      }
      document.title = data.title + " \u2014 Red Hat Interview";
      document.getElementById("loading-state").style.display = "none";
      if (data.needsStart) {
        showPrestartOverlay(data);
        return;
      }
      await launchInterview(data);
    } catch {
      document.getElementById("loading-state").style.display = "none";
      document.getElementById("error-state").style.display = "flex";
    }
  }
  function showPrestartOverlay(data) {
    const overlay = document.getElementById("prestart-overlay");
    document.getElementById("prestart-title").textContent = data.title;
    document.getElementById("prestart-meta").innerHTML = `\u23F1 <span>${data.timeLimitMinutes} minute${data.timeLimitMinutes === 1 ? "" : "s"} time limit</span>`;
    overlay.style.display = "flex";
    document.getElementById("prestart-btn").onclick = async () => {
      const btn = document.getElementById("prestart-btn");
      btn.disabled = true;
      btn.textContent = "Starting\u2026";
      try {
        const startRes = await fetch(`/api/interview/${TOKEN}/start`, { method: "POST" });
        if (!startRes.ok) throw new Error();
        const { remainingSeconds } = await startRes.json();
        overlay.style.display = "none";
        await launchInterview({ ...data, remainingSeconds, needsStart: false });
      } catch {
        btn.disabled = false;
        btn.textContent = "Start challenge \u2192";
        toast("Could not start \u2014 please try again", "err");
      }
    };
  }
  async function launchInterview(data) {
    codingChallenges = data.codingChallenges;
    questions = data.questions;
    document.getElementById("interview-app").style.display = "";
    document.getElementById("interview-title").textContent = data.title;
    renderNav();
    if (codingChallenges.length === 0) {
      showQuestionsView(data.savedAnswers);
    } else {
      await showCodingChallenge(codingChallenges[0], data.savedAnswers);
      questions.forEach((q) => {
        const el = document.getElementById(`q-answer-${q.id}`);
        if (el && data.savedAnswers[q.id]) el.value = data.savedAnswers[q.id];
      });
    }
    remainingSecondsAtLoad = data.remainingSeconds;
    startTimer();
    startAutoSave();
    if (data.remainingSeconds !== null && data.remainingSeconds <= 0) {
      clearInterval(autoSaveInterval);
      clearInterval(timerInterval);
      setTimeout(() => forceSubmit(), 800);
    }
  }
  function renderNav() {
    const nav = document.getElementById("challenge-nav");
    const parts = [];
    codingChallenges.forEach((cc, i) => {
      parts.push(`<button class="nav-tab ${i === 0 ? "active" : ""}" data-cc-id="${cc.id}" onclick="selectCodingChallenge(${cc.id})">
      <span class="nav-num">${i + 1}</span>${escHtml(cc.title || `Challenge ${i + 1}`)}
    </button>`);
    });
    if (questions.length > 0) {
      parts.push(`<button class="nav-tab" data-view="questions" onclick="selectQuestionsView()">
      Questions <span class="nav-badge">${questions.length}</span>
    </button>`);
    }
    nav.innerHTML = parts.join("");
    nav.style.display = parts.length > 1 ? "" : "none";
  }
  function setActiveNavTab(selector) {
    document.querySelectorAll(".nav-tab").forEach((t) => t.classList.remove("active"));
    const el = document.querySelector(selector);
    if (el) el.classList.add("active");
  }
  async function showCodingChallenge(cc, savedAnswers) {
    currentView = "coding";
    currentCcId = cc.id;
    document.getElementById("run-btn").style.display = "";
    setActiveNavTab(`[data-cc-id="${cc.id}"]`);
    document.getElementById("problem-description").innerHTML = await Promise.resolve(marked.parse(cc.description || ""));
    renderQuestionsInPanel(savedAnswers);
    const editorPanel = document.getElementById("editor-panel");
    editorPanel.style.display = "";
    document.getElementById("lang-badge").textContent = cc.language.toUpperCase().slice(0, 4);
    if (!theEditor) {
      await initMonaco(cc);
    } else {
      swapModel(cc);
    }
  }
  function selectCodingChallenge(ccId) {
    if (isSubmitted) return;
    const cc = codingChallenges.find((c) => c.id === ccId);
    if (cc) showCodingChallenge(cc);
  }
  function showQuestionsView(savedAnswers) {
    currentView = "questions";
    setActiveNavTab('[data-view="questions"]');
    document.getElementById("problem-description").innerHTML = "";
    renderQuestionsInPanel(savedAnswers);
    document.getElementById("run-btn").style.display = "none";
    if (codingChallenges.length === 0) {
      document.getElementById("editor-panel").style.display = "none";
      document.getElementById("interview-layout").classList.add("questions-only");
    }
  }
  function selectQuestionsView() {
    if (isSubmitted) return;
    showQuestionsView();
  }
  function renderQuestionsInPanel(savedAnswers) {
    const section = document.getElementById("questions-section");
    if (!questions.length) {
      section.innerHTML = "";
      return;
    }
    section.innerHTML = `
    <div class="questions-section">
      <h3>Questions</h3>
      ${questions.map((q, i) => `
        <div class="question-item">
          <div class="question-label"><span class="q-num">${i + 1}</span>${escHtml(q.text)}</div>
          <textarea class="question-textarea" id="q-answer-${q.id}"
            placeholder="Type your answer here\u2026">${escHtml(savedAnswers?.[q.id] ?? "")}</textarea>
        </div>
      `).join("")}
    </div>
  `;
    section.querySelectorAll(".question-textarea").forEach((ta) => {
      ta.addEventListener("input", scheduleAutoSave);
    });
  }
  async function initMonaco(firstChallenge) {
    await new Promise((resolve) => {
      __require.config({ paths: { vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.47.0/min/vs" } });
      __require(["vs/editor/editor.main"], () => {
        monaco.editor.defineTheme("rh-dark", {
          base: "vs-dark",
          inherit: true,
          rules: [],
          colors: {
            "editor.background": "#0f0f0f",
            "editor.lineHighlightBackground": "#1a1a1a",
            "editorLineNumber.foreground": "#404040",
            "editorLineNumber.activeForeground": "#8a8d90",
            "editor.selectionBackground": "#ee000033"
          }
        });
        codingChallenges.forEach((cc) => {
          if (!editorModels.has(cc.id)) {
            editorModels.set(cc.id, monaco.editor.createModel(
              cc.starterCode || "",
              langMap[cc.language] ?? "plaintext"
            ));
          }
        });
        theEditor = monaco.editor.create(
          document.getElementById("editor-container"),
          {
            model: editorModels.get(firstChallenge.id),
            theme: "rh-dark",
            fontSize: 14,
            fontFamily: "'Red Hat Mono', 'JetBrains Mono', monospace",
            fontLigatures: true,
            lineNumbers: "on",
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            padding: { top: 16, bottom: 16 },
            wordWrap: "on",
            tabSize: 2
          }
        );
        theEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyV, flashPasteWarning);
        theEditor.getDomNode()?.addEventListener("paste", (e) => {
          e.preventDefault();
          e.stopPropagation();
          flashPasteWarning();
        }, true);
        theEditor.onDidChangeModelContent(scheduleAutoSave);
        resolve();
      });
    });
  }
  function swapModel(cc) {
    if (!theEditor) return;
    if (!editorModels.has(cc.id)) {
      editorModels.set(cc.id, monaco.editor.createModel(
        cc.starterCode || "",
        langMap[cc.language] ?? "plaintext"
      ));
    }
    theEditor.setModel(editorModels.get(cc.id));
    theEditor.layout();
  }
  function blockPaste() {
    document.addEventListener("paste", (e) => {
      e.preventDefault();
      e.stopPropagation();
      flashPasteWarning();
    }, true);
    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") {
        e.preventDefault();
        e.stopPropagation();
        flashPasteWarning();
      }
    }, true);
    document.addEventListener("contextmenu", (e) => e.preventDefault(), true);
  }
  function flashPasteWarning() {
    const el = document.getElementById("paste-warning");
    el.classList.add("show");
    clearTimeout(warnTimer);
    warnTimer = setTimeout(() => el.classList.remove("show"), 2e3);
  }
  function getCodes() {
    const result = {};
    editorModels.forEach((model, id) => {
      result[id] = model.getValue();
    });
    return result;
  }
  function getAnswers() {
    const result = {};
    questions.forEach((q) => {
      const el = document.getElementById(`q-answer-${q.id}`);
      if (el) result[q.id] = el.value;
    });
    return result;
  }
  function scheduleAutoSave() {
    if (saveTimeout) clearTimeout(saveTimeout);
    setStatus("saving");
    saveTimeout = setTimeout(autoSave, 4e3);
  }
  function startAutoSave() {
    autoSaveInterval = setInterval(autoSave, 3e4);
  }
  async function autoSave() {
    if (isSubmitted) return;
    try {
      await fetch(`/api/interview/${TOKEN}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codes: getCodes(), answers: getAnswers() })
      });
      setStatus("saved");
    } catch {
      setStatus("");
    }
  }
  function setStatus(s) {
    const el = document.getElementById("autosave-status");
    el.className = "autosave-status " + s;
    if (s === "saving") el.textContent = "\u23F3 Saving\u2026";
    else if (s === "saved") el.textContent = "\u2713 Saved";
    else el.textContent = "Auto-save on";
  }
  function submitCode() {
    document.getElementById("confirm-modal").classList.add("open");
  }
  function closeConfirm() {
    document.getElementById("confirm-modal").classList.remove("open");
  }
  async function confirmSubmit() {
    if (isSubmitted) return;
    closeConfirm();
    await doSubmit(false);
  }
  async function forceSubmit() {
    if (isSubmitted) return;
    await doSubmit(true);
  }
  async function doSubmit(timedOut) {
    try {
      const res = await fetch(`/api/interview/${TOKEN}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codes: getCodes(), answers: getAnswers() })
      });
      if (res.ok) {
        isSubmitted = true;
        if (autoSaveInterval) clearInterval(autoSaveInterval);
        if (timerInterval) clearInterval(timerInterval);
        editorModels.forEach((m) => m.dispose());
        theEditor?.dispose();
        if (timedOut) showTimedOutOverlay();
        else showSubmittedOverlay();
      } else {
        const err = await res.json();
        toast(err.error || "Submit failed", "err");
      }
    } catch {
      if (timedOut) setTimeout(() => forceSubmit(), 2e3);
      else toast("Network error \u2014 please try again", "err");
    }
  }
  function showSubmittedOverlay() {
    document.getElementById("loading-state").style.display = "none";
    document.getElementById("interview-app").style.display = "";
    document.getElementById("submitted-overlay").classList.add("show");
    document.getElementById("submit-btn").disabled = true;
  }
  function showTimedOutOverlay() {
    const box = document.getElementById("submitted-overlay").querySelector(".submitted-box");
    box.innerHTML = `
    <div class="icon">\u23F1\uFE0F</div>
    <h2>Time's up!</h2>
    <p>Your solution has been automatically submitted.</p>
    <p style="margin-top:12px;font-size:12px;color:var(--text-muted)">You may close this tab.</p>
  `;
    showSubmittedOverlay();
  }
  function startTimer() {
    startTime = Date.now();
    const timerEl = document.getElementById("timer");
    const labelEl = document.getElementById("timer-label");
    const isTimed = remainingSecondsAtLoad !== null;
    if (isTimed) {
      timerEl.classList.add("timed");
      labelEl.style.display = "";
    }
    timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1e3);
      const pad = (n) => String(n).padStart(2, "0");
      if (isTimed) {
        const rem = remainingSecondsAtLoad - elapsed;
        if (rem <= 0) {
          clearInterval(timerInterval);
          timerEl.textContent = "00:00";
          timerEl.className = "timer timed danger";
          forceSubmit();
          return;
        }
        const h = Math.floor(rem / 3600), m = Math.floor(rem % 3600 / 60), s = rem % 60;
        timerEl.textContent = h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
        timerEl.className = "timer timed" + (rem <= DANGER_THRESHOLD ? " danger" : rem <= WARN_THRESHOLD ? " warning" : "");
      } else {
        const h = Math.floor(elapsed / 3600), m = Math.floor(elapsed % 3600 / 60), s = elapsed % 60;
        timerEl.textContent = h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
      }
    }, 1e3);
  }
  var PISTON_API = "https://emkc.org/api/v2/piston/execute";
  var pistonLangMap = {
    javascript: { language: "javascript", version: "*" },
    typescript: { language: "typescript", version: "*" },
    python: { language: "python3", version: "*" },
    java: { language: "java", version: "*" },
    cpp: { language: "c++", version: "*" },
    go: { language: "go", version: "*" },
    rust: { language: "rust", version: "*" }
  };
  var runCount = 0;
  async function runCode() {
    if (isSubmitted) return;
    const cc = codingChallenges.find((c) => c.id === currentCcId);
    if (!cc) {
      toast("Select a coding challenge to run", "err");
      return;
    }
    const pistonLang = pistonLangMap[cc.language];
    if (!pistonLang) {
      toast(`Running ${cc.language} is not supported`, "err");
      return;
    }
    const code = theEditor ? theEditor.getValue() : "";
    if (!code.trim()) {
      toast("Write some code first", "err");
      return;
    }
    setRunning(true);
    showOutputPanel();
    setOutputRunning();
    try {
      const res = await fetch(PISTON_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: pistonLang.language,
          version: pistonLang.version,
          files: [{ content: code }]
        })
      });
      if (!res.ok) throw new Error(`Code runner returned ${res.status}`);
      const data = await res.json();
      runCount++;
      updateRunCountBadge();
      displayRunOutput(data);
    } catch (e) {
      setOutputError(e.message);
    } finally {
      setRunning(false);
    }
  }
  function setRunning(running) {
    const btn = document.getElementById("run-btn");
    btn.classList.toggle("running", running);
    btn.textContent = running ? "\u23F3 Running\u2026" : "\u25B6 Run";
    btn.disabled = running;
  }
  function showOutputPanel() {
    const panel = document.getElementById("run-output-panel");
    panel.style.display = "";
  }
  function clearOutput() {
    document.getElementById("run-output-panel").style.display = "none";
    document.getElementById("run-output").innerHTML = "";
  }
  function updateRunCountBadge() {
    const badge = document.getElementById("run-count-badge");
    badge.textContent = `Run ${runCount}`;
    badge.classList.add("show");
  }
  function setOutputRunning() {
    document.getElementById("run-output").innerHTML = '<div class="output-running">Running your code\u2026</div>';
  }
  function setOutputError(msg) {
    document.getElementById("run-output").innerHTML = `<pre class="output-stderr">Error: ${escHtml(msg)}</pre>
     <div class="output-exit err">\u2717 Could not execute code</div>`;
  }
  function displayRunOutput(data) {
    const out = document.getElementById("run-output");
    const parts = [];
    if (data.compile) {
      if (data.compile.stdout) {
        parts.push(`<pre class="output-stdout">${escHtml(data.compile.stdout)}</pre>`);
      }
      if (data.compile.stderr) {
        parts.push(`<pre class="output-stderr">${escHtml(data.compile.stderr)}</pre>`);
      }
      if (data.compile.code !== 0) {
        out.innerHTML = parts.join("") + `<div class="output-exit err">\u2717 Compilation failed (exit code ${data.compile.code})</div>`;
        return;
      }
    }
    if (data.run.stdout) {
      parts.push(`<pre class="output-stdout">${escHtml(data.run.stdout)}</pre>`);
    }
    if (data.run.stderr) {
      parts.push(`<pre class="output-stderr">${escHtml(data.run.stderr)}</pre>`);
    }
    if (!data.run.stdout && !data.run.stderr) {
      parts.push('<div class="output-empty">(no output)</div>');
    }
    const exitOk = data.run.code === 0;
    parts.push(
      `<div class="output-exit ${exitOk ? "ok" : "err"}">${exitOk ? "\u2713" : "\u2717"} Process exited with code ${data.run.code}</div>`
    );
    out.innerHTML = parts.join("");
  }
  function escHtml(s) {
    return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function toast(msg, type = "ok") {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.className = "show " + type;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.className = "";
    }, 3e3);
  }
  window.addEventListener("beforeunload", (e) => {
    if (!isSubmitted && editorModels.size > 0) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
  Object.assign(window, { submitCode, closeConfirm, confirmSubmit, selectCodingChallenge, selectQuestionsView, runCode, clearOutput });
})();
