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
  var editor = null;
  var startTime = 0;
  var remainingSecondsAtLoad = null;
  var timerInterval = null;
  var autoSaveInterval = null;
  var saveTimeout = null;
  var lastSavedCode = "";
  var isSubmitted = false;
  var questions = [];
  var warnTimer;
  var toastTimer;
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
    loadChallenge();
    blockPaste();
  });
  async function loadChallenge() {
    try {
      const res = await fetch(`/api/interview/${TOKEN}`);
      if (!res.ok) throw new Error("Not found");
      const data = await res.json();
      if (data.submitted) {
        showSubmittedOverlay();
        return;
      }
      document.title = data.title + " \u2014 Code Interview";
      document.getElementById("problem-title").textContent = data.title;
      document.getElementById("problem-description").innerHTML = marked.parse(data.description);
      document.getElementById("lang-badge").textContent = data.language.toUpperCase().slice(0, 4);
      questions = data.questions ?? [];
      renderQuestions(questions, data.savedAnswers ?? {});
      document.getElementById("loading-state").style.display = "none";
      document.getElementById("interview-app").style.display = "";
      if (data.remainingSeconds !== null && data.remainingSeconds <= 0) {
        initEditor(data.starterCode || "", data.language);
        startAutoSave();
        setTimeout(() => forceSubmit(), 800);
        return;
      }
      remainingSecondsAtLoad = data.remainingSeconds;
      initEditor(data.starterCode || "", data.language);
      startTimer();
      startAutoSave();
    } catch {
      document.getElementById("loading-state").style.display = "none";
      document.getElementById("error-state").style.display = "flex";
    }
  }
  function initEditor(code, language) {
    __require.config({ paths: { vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.47.0/min/vs" } });
    __require(["vs/editor/editor.main"], () => {
      const monacoLang = langMap[language] ?? "plaintext";
      monaco.editor.defineTheme("dark-custom", {
        base: "vs-dark",
        inherit: true,
        rules: [],
        colors: {
          "editor.background": "#0f1117",
          "editor.lineHighlightBackground": "#1a1d27",
          "editorLineNumber.foreground": "#3e4460",
          "editorLineNumber.activeForeground": "#8892a4"
        }
      });
      editor = monaco.editor.create(
        document.getElementById("editor-container"),
        {
          value: code,
          language: monacoLang,
          theme: "dark-custom",
          fontSize: 14,
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          fontLigatures: true,
          lineNumbers: "on",
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          automaticLayout: true,
          padding: { top: 16, bottom: 16 },
          wordWrap: "on",
          tabSize: 2,
          suggestOnTriggerCharacters: true
        }
      );
      lastSavedCode = code;
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyV, () => {
        flashPasteWarning();
      });
      editor.getDomNode()?.addEventListener("paste", (e) => {
        e.preventDefault();
        e.stopPropagation();
        flashPasteWarning();
      }, true);
      editor.onDidChangeModelContent(() => {
        if (saveTimeout) clearTimeout(saveTimeout);
        setStatus("saving");
        saveTimeout = setTimeout(autoSave, 4e3);
      });
    });
  }
  function renderQuestions(qs, saved) {
    const section = document.getElementById("questions-section");
    if (!qs.length) {
      section.innerHTML = "";
      return;
    }
    section.innerHTML = `
    <div class="questions-section">
      <h3>Questions</h3>
      ${qs.map((q, i) => `
        <div class="question-item">
          <div class="question-label">
            <span class="q-num">${i + 1}</span>${escHtml(q)}
          </div>
          <textarea
            class="question-textarea"
            id="q-answer-${i}"
            placeholder="Type your answer here\u2026"
          >${escHtml(saved[i] ?? "")}</textarea>
        </div>
      `).join("")}
    </div>
  `;
    section.querySelectorAll(".question-textarea").forEach((ta) => {
      ta.addEventListener("input", () => {
        if (saveTimeout) clearTimeout(saveTimeout);
        setStatus("saving");
        saveTimeout = setTimeout(autoSave, 4e3);
      });
    });
  }
  function getAnswers() {
    const result = {};
    questions.forEach((_, i) => {
      const el = document.getElementById(`q-answer-${i}`);
      if (el) result[i] = el.value;
    });
    return result;
  }
  function escHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
  function startAutoSave() {
    autoSaveInterval = setInterval(autoSave, 3e4);
  }
  async function autoSave() {
    if (!editor || isSubmitted) return;
    const code = editor.getValue();
    const answers = getAnswers();
    if (code === lastSavedCode) {
      setStatus("saved");
      return;
    }
    try {
      const res = await fetch(`/api/interview/${TOKEN}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, answers })
      });
      if (res.ok) {
        lastSavedCode = code;
        setStatus("saved");
      }
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
    if (!editor || isSubmitted) return;
    const code = editor.getValue();
    const answers = getAnswers();
    closeConfirm();
    try {
      const res = await fetch(`/api/interview/${TOKEN}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, answers })
      });
      if (res.ok) {
        isSubmitted = true;
        if (autoSaveInterval) clearInterval(autoSaveInterval);
        if (timerInterval) clearInterval(timerInterval);
        editor.updateOptions({ readOnly: true });
        showSubmittedOverlay();
      } else {
        const err = await res.json();
        toast(err.error || "Submit failed", "err");
      }
    } catch {
      toast("Network error \u2014 please try again", "err");
    }
  }
  function showSubmittedOverlay() {
    document.getElementById("loading-state").style.display = "none";
    document.getElementById("interview-app").style.display = "";
    document.getElementById("submitted-overlay").classList.add("show");
    document.getElementById("submit-btn").disabled = true;
  }
  var WARN_THRESHOLD = 5 * 60;
  var DANGER_THRESHOLD = 60;
  function startTimer() {
    startTime = Date.now();
    const timerEl = document.getElementById("timer");
    const isTimed = remainingSecondsAtLoad !== null;
    if (isTimed) {
      timerEl.classList.add("timed");
      document.getElementById("timer-label").style.display = "";
    }
    timerInterval = setInterval(() => {
      const elapsedSecs = Math.floor((Date.now() - startTime) / 1e3);
      if (isTimed) {
        const remaining = remainingSecondsAtLoad - elapsedSecs;
        if (remaining <= 0) {
          clearInterval(timerInterval);
          timerEl.textContent = "00:00";
          timerEl.className = "timer timed danger";
          forceSubmit();
          return;
        }
        const h = Math.floor(remaining / 3600);
        const m = Math.floor(remaining % 3600 / 60);
        const s = remaining % 60;
        const pad = (n) => String(n).padStart(2, "0");
        timerEl.textContent = h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
        if (remaining <= DANGER_THRESHOLD) {
          timerEl.className = "timer timed danger";
        } else if (remaining <= WARN_THRESHOLD) {
          timerEl.className = "timer timed warning";
        } else {
          timerEl.className = "timer timed";
        }
      } else {
        const h = Math.floor(elapsedSecs / 3600);
        const m = Math.floor(elapsedSecs % 3600 / 60);
        const s = elapsedSecs % 60;
        const pad = (n) => String(n).padStart(2, "0");
        timerEl.textContent = h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
      }
    }, 1e3);
  }
  async function forceSubmit() {
    if (isSubmitted) return;
    const code = editor ? editor.getValue() : "";
    const answers = getAnswers();
    try {
      const res = await fetch(`/api/interview/${TOKEN}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, answers })
      });
      if (res.ok) {
        isSubmitted = true;
        if (autoSaveInterval) clearInterval(autoSaveInterval);
        if (timerInterval) clearInterval(timerInterval);
        editor?.updateOptions({ readOnly: true });
        showTimedOutOverlay();
      }
    } catch {
      setTimeout(forceSubmit, 2e3);
    }
  }
  function showTimedOutOverlay() {
    const overlay = document.getElementById("submitted-overlay");
    const box = overlay.querySelector(".submitted-box");
    box.innerHTML = `
    <div class="icon">\u23F1\uFE0F</div>
    <h2>Time's up!</h2>
    <p>Your solution has been automatically submitted.</p>
    <p style="margin-top:12px;font-size:12px;color:var(--text-muted)">You may close this tab.</p>
  `;
    showSubmittedOverlay();
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
  Object.assign(window, { submitCode, closeConfirm, confirmSubmit });
  window.addEventListener("beforeunload", (e) => {
    if (!isSubmitted && editor && editor.getValue() !== lastSavedCode) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
})();
