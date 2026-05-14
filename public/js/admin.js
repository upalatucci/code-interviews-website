"use strict";
(() => {
  var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
    get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
  }) : x)(function(x) {
    if (typeof require !== "undefined") return require.apply(this, arguments);
    throw Error('Dynamic require of "' + x + '" is not supported');
  });

  // src/admin.ts
  var ADMIN_KEY = "";
  var editingChallengeId = null;
  var previewEditor = null;
  var previewCode = "";
  var challenges = [];
  var toastTimer;
  var generatedLinkUrl = "";
  function doLogin() {
    const key = document.getElementById("admin-key-input").value.trim();
    if (!key) {
      toast("Enter your admin key", "err");
      return;
    }
    ADMIN_KEY = key;
    localStorage.setItem("adminKey", key);
    initApp();
  }
  function initApp() {
    document.getElementById("auth-screen").style.display = "none";
    document.getElementById("app").style.display = "";
    document.getElementById("key-display").textContent = "Key: " + ADMIN_KEY.slice(0, 4) + "****";
    document.querySelectorAll("[data-page]").forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const page = link.dataset["page"];
        document.querySelectorAll("[data-page]").forEach((l) => l.classList.remove("active"));
        link.classList.add("active");
        showPage(page);
      });
    });
    loadChallenges();
  }
  async function api(method, path, body) {
    const res = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json", "x-admin-key": ADMIN_KEY },
      body: body ? JSON.stringify(body) : void 0
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      if (res.status === 401) {
        toast("Invalid admin key", "err");
        logout();
        return null;
      }
      throw new Error(err.error || "Request failed");
    }
    return res.json();
  }
  function logout() {
    localStorage.removeItem("adminKey");
    ADMIN_KEY = "";
    document.getElementById("auth-screen").style.display = "";
    document.getElementById("app").style.display = "none";
  }
  function showPage(name) {
    document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
    document.getElementById("page-" + name).classList.add("active");
    document.querySelectorAll("[data-page]").forEach((l) => {
      l.classList.toggle("active", l.dataset["page"] === name);
    });
    if (name === "challenges") loadChallenges();
    if (name === "links") {
      loadChallenges();
      loadLinks();
    }
    if (name === "submissions") loadSubmissions();
  }
  async function loadChallenges() {
    try {
      challenges = await api("GET", "/api/admin/challenges") ?? [];
      renderChallenges();
    } catch (e) {
      toast(e.message, "err");
    }
  }
  function renderChallenges() {
    const el = document.getElementById("challenges-list");
    if (!challenges.length) {
      el.innerHTML = `<div class="empty-state"><div class="icon">\u{1F4CB}</div><p>No challenges yet. Create your first one!</p></div>`;
      return;
    }
    el.innerHTML = challenges.map((c) => `
    <div class="challenge-card">
      <div class="challenge-info">
        <h3>${esc(c.title)}</h3>
        <p>${esc(c.language)}${c.time_limit_minutes ? ` \xB7 \u23F1 ${c.time_limit_minutes} min` : ""} \xB7 Created ${fmtDate(c.created_at)}</p>
        <p style="margin-top:6px;color:var(--text);font-size:13px;max-width:520px">${esc(c.description).slice(0, 120)}${c.description.length > 120 ? "\u2026" : ""}</p>
      </div>
      <div class="challenge-actions">
        <button class="btn btn-ghost btn-sm" onclick="editChallenge(${c.id})">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteChallenge(${c.id})">Delete</button>
        <button class="btn btn-primary btn-sm" onclick="quickLink(${c.id})">+ Link</button>
      </div>
    </div>
  `).join("");
  }
  function setDescTab(tab) {
    const textarea = document.getElementById("c-description");
    const preview = document.getElementById("c-description-preview");
    const writeBtn = document.getElementById("desc-tab-write");
    const prevBtn = document.getElementById("desc-tab-preview");
    if (tab === "preview") {
      preview.innerHTML = marked.parse(textarea.value || "*Nothing to preview yet.*");
      textarea.style.display = "none";
      preview.style.display = "";
      writeBtn.classList.remove("active");
      prevBtn.classList.add("active");
    } else {
      textarea.style.display = "";
      preview.style.display = "none";
      writeBtn.classList.add("active");
      prevBtn.classList.remove("active");
      textarea.focus();
    }
  }
  function renderQuestionEditor(qs) {
    const container = document.getElementById("questions-editor");
    container.innerHTML = qs.map((q, i) => `
    <div class="question-editor-item" data-q-index="${i}">
      <input type="text" value="${esc(q)}" placeholder="e.g. What is the time complexity of your solution?" />
      <button type="button" class="btn-remove" onclick="removeQuestion(${i})">\xD7</button>
    </div>
  `).join("");
  }
  function getQuestions() {
    const container = document.getElementById("questions-editor");
    return Array.from(container.querySelectorAll("input")).map((el) => el.value.trim()).filter(Boolean);
  }
  function addQuestion() {
    const current = getQuestions();
    renderQuestionEditor([...current, ""]);
    const inputs = document.getElementById("questions-editor").querySelectorAll("input");
    inputs[inputs.length - 1]?.focus();
  }
  function removeQuestion(index) {
    const current = getQuestions();
    current.splice(index, 1);
    renderQuestionEditor(current);
  }
  function openChallengeModal(_id) {
    editingChallengeId = null;
    document.getElementById("challenge-modal-title").textContent = "New Challenge";
    document.getElementById("c-title").value = "";
    document.getElementById("c-description").value = "";
    document.getElementById("c-starter").value = "";
    document.getElementById("c-language").value = "javascript";
    document.getElementById("c-time-limit").value = "";
    renderQuestionEditor([]);
    setDescTab("write");
    openModal("challenge-modal");
  }
  function editChallenge(id) {
    const c = challenges.find((x) => x.id === id);
    if (!c) return;
    editingChallengeId = id;
    document.getElementById("challenge-modal-title").textContent = "Edit Challenge";
    document.getElementById("c-title").value = c.title;
    document.getElementById("c-description").value = c.description;
    document.getElementById("c-starter").value = c.starter_code || "";
    document.getElementById("c-language").value = c.language || "javascript";
    document.getElementById("c-time-limit").value = c.time_limit_minutes ? String(c.time_limit_minutes) : "";
    let qs = [];
    try {
      qs = JSON.parse(c.questions || "[]");
    } catch {
    }
    renderQuestionEditor(qs);
    setDescTab("write");
    openModal("challenge-modal");
  }
  async function saveChallenge() {
    const title = document.getElementById("c-title").value.trim();
    const description = document.getElementById("c-description").value.trim();
    const starter_code = document.getElementById("c-starter").value;
    const language = document.getElementById("c-language").value;
    const questions = getQuestions();
    const timeLimitRaw = document.getElementById("c-time-limit").value.trim();
    const time_limit_minutes = timeLimitRaw ? parseInt(timeLimitRaw, 10) || null : null;
    if (!title || !description) {
      toast("Title and description are required", "err");
      return;
    }
    try {
      if (editingChallengeId) {
        await api("PUT", `/api/admin/challenges/${editingChallengeId}`, { title, description, starter_code, language, questions, time_limit_minutes });
        toast("Challenge updated");
      } else {
        await api("POST", "/api/admin/challenges", { title, description, starter_code, language, questions, time_limit_minutes });
        toast("Challenge created");
      }
      closeModal("challenge-modal");
      loadChallenges();
    } catch (e) {
      toast(e.message, "err");
    }
  }
  async function deleteChallenge(id) {
    if (!confirm("Delete this challenge? All associated links and submissions will also be deleted.")) return;
    try {
      await api("DELETE", `/api/admin/challenges/${id}`);
      toast("Challenge deleted");
      loadChallenges();
    } catch (e) {
      toast(e.message, "err");
    }
  }
  function quickLink(challengeId) {
    showPage("links");
    openLinkModal(challengeId);
  }
  async function loadLinks() {
    try {
      const links = await api("GET", "/api/admin/links") ?? [];
      renderLinks(links);
    } catch (e) {
      toast(e.message, "err");
    }
  }
  function renderLinks(links) {
    const tbody = document.getElementById("links-tbody");
    if (!links.length) {
      tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="icon">\u{1F517}</div><p>No links yet.</p></div></td></tr>`;
      return;
    }
    tbody.innerHTML = links.map((l) => {
      const url = `${location.origin}/interview/${l.token}`;
      let status = '<span class="badge badge-gray">Pending</span>';
      if (l.submitted_at) status = '<span class="badge badge-green">Submitted</span>';
      else if (l.first_opened_at) status = '<span class="badge badge-yellow">In progress</span>';
      return `
      <tr>
        <td>
          <div style="font-weight:500">${esc(l.candidate_name || "\u2014")}</div>
          <div style="font-size:12px;color:var(--text-muted)">${esc(l.candidate_email || "")}</div>
        </td>
        <td>${esc(l.challenge_title)}</td>
        <td>${status}</td>
        <td class="no-wrap" style="font-size:12px;color:var(--text-muted)">${fmtDate(l.created_at)}</td>
        <td>
          <span class="copy-link">${url}</span>
          <button class="btn btn-ghost btn-sm" style="margin-top:4px" onclick="copyText('${url}')">Copy</button>
        </td>
        <td>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            ${l.submitted_at || l.first_opened_at ? `<button class="btn btn-ghost btn-sm" onclick="viewSubmission(${l.id},'${esc(l.candidate_name || "Candidate")}')">View</button>` : ""}
            <button class="btn btn-ghost btn-sm" title="Generate a new link for the same challenge" onclick="cloneLink(${l.challenge_id},'${esc(l.challenge_title ?? "")}')">Clone</button>
            <button class="btn btn-danger btn-sm" onclick="deleteLink(${l.id})">\xD7</button>
          </div>
        </td>
      </tr>
    `;
    }).join("");
  }
  function openLinkModal(preselect, title) {
    const sel = document.getElementById("l-challenge");
    sel.innerHTML = challenges.map(
      (c) => `<option value="${c.id}" ${c.id === preselect ? "selected" : ""}>${esc(c.title)}</option>`
    ).join("");
    if (!challenges.length) sel.innerHTML = "<option>No challenges \u2014 create one first</option>";
    document.getElementById("l-name").value = "";
    document.getElementById("l-email").value = "";
    const tokenEl = document.getElementById("link-token");
    tokenEl.style.display = "none";
    tokenEl.textContent = "";
    const linkActions = document.getElementById("link-actions");
    if (linkActions) linkActions.style.display = "none";
    document.getElementById("link-modal-title").textContent = title ?? "Generate Interview Link";
    openModal("link-modal");
    setTimeout(() => document.getElementById("l-name").focus(), 50);
  }
  function cloneLink(challengeId, challengeTitle) {
    if (!challenges.length) loadChallenges().then(() => openLinkModal(challengeId, `Clone \u2014 ${challengeTitle}`));
    else openLinkModal(challengeId, `Clone \u2014 ${challengeTitle}`);
  }
  async function generateLink() {
    const challenge_id = +document.getElementById("l-challenge").value;
    const candidate_name = document.getElementById("l-name").value.trim();
    const candidate_email = document.getElementById("l-email").value.trim();
    if (!challenge_id) {
      toast("Select a challenge", "err");
      return;
    }
    try {
      const data = await api(
        "POST",
        "/api/admin/links",
        { challenge_id, candidate_name, candidate_email }
      );
      if (!data) return;
      const url = `${location.origin}/interview/${data.token}`;
      const tokenEl = document.getElementById("link-token");
      tokenEl.textContent = url;
      tokenEl.style.display = "block";
      const linkActions = document.getElementById("link-actions");
      if (linkActions) linkActions.style.display = "flex";
      generatedLinkUrl = url;
      toast("Link generated!");
      loadLinks();
    } catch (e) {
      toast(e.message, "err");
    }
  }
  function copyGeneratedLink() {
    if (generatedLinkUrl) copyText(generatedLinkUrl);
  }
  async function deleteLink(id) {
    if (!confirm("Delete this interview link?")) return;
    try {
      await api("DELETE", `/api/admin/links/${id}`);
      toast("Link deleted");
      loadLinks();
    } catch (e) {
      toast(e.message, "err");
    }
  }
  async function loadSubmissions() {
    try {
      const links = await api("GET", "/api/admin/links") ?? [];
      renderSubmissions(links.filter((l) => l.first_opened_at));
    } catch (e) {
      toast(e.message, "err");
    }
  }
  function renderSubmissions(links) {
    const tbody = document.getElementById("submissions-tbody");
    if (!links.length) {
      tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="icon">\u{1F4DD}</div><p>No submissions yet.</p></div></td></tr>`;
      return;
    }
    tbody.innerHTML = links.map((l) => {
      let status = '<span class="badge badge-yellow">In progress</span>';
      if (l.submitted_at) status = '<span class="badge badge-green">Submitted</span>';
      return `
      <tr>
        <td><div style="font-weight:500">${esc(l.candidate_name || "\u2014")}</div><div style="font-size:12px;color:var(--text-muted)">${esc(l.candidate_email || "")}</div></td>
        <td>${esc(l.challenge_title)}</td>
        <td>${status}</td>
        <td class="no-wrap" style="font-size:12px;color:var(--text-muted)">${fmtDate(l.first_opened_at)}</td>
        <td class="no-wrap" style="font-size:12px;color:var(--text-muted)">${l.submitted_at ? fmtDate(l.submitted_at) : "\u2014"}</td>
        <td><button class="btn btn-ghost btn-sm" onclick="viewSubmission(${l.id},'${esc(l.candidate_name || "Candidate")}')">View code \u2192</button></td>
      </tr>
    `;
    }).join("");
  }
  async function viewSubmission(linkId, name) {
    try {
      const data = await api("GET", `/api/admin/submissions/${linkId}`);
      if (!data) return;
      showPage("submission-detail");
      document.getElementById("detail-title").textContent = name || "Submission";
      const cloneBtn = document.getElementById("detail-clone-btn");
      cloneBtn.onclick = () => cloneLink(link.challenge_id, esc(link.challenge_title ?? ""));
      const { link, saves } = data;
      document.getElementById("submission-meta").innerHTML = `
      <div class="meta-item"><div class="label">Candidate</div><div class="value">${esc(link.candidate_name || "\u2014")}</div></div>
      <div class="meta-item"><div class="label">Email</div><div class="value">${esc(link.candidate_email || "\u2014")}</div></div>
      <div class="meta-item"><div class="label">Challenge</div><div class="value">${esc(link.challenge_title)}</div></div>
      <div class="meta-item"><div class="label">Language</div><div class="value">${esc(link.language)}</div></div>
      <div class="meta-item"><div class="label">Opened</div><div class="value">${fmtDate(link.first_opened_at)}</div></div>
      <div class="meta-item"><div class="label">Submitted</div><div class="value">${link.submitted_at ? fmtDate(link.submitted_at) : "Not yet"}</div></div>
      <div class="meta-item"><div class="label">Time limit</div><div class="value">${link.time_limit_minutes ? `${link.time_limit_minutes} min` : "None"}</div></div>
      <div class="meta-item"><div class="label">Total saves</div><div class="value">${saves.length}</div></div>
    `;
      const savesList = document.getElementById("saves-list");
      if (!saves.length) {
        savesList.innerHTML = '<p style="color:var(--text-muted);font-size:13px">No saves recorded</p>';
      } else {
        savesList.innerHTML = saves.map((s, i) => `
        <div class="save-item ${s.is_final ? "final" : ""}"
             onclick="previewSave(${JSON.stringify(s.code).replace(/</g, "\\u003c")}, '${fmtDate(s.saved_at)}', ${s.is_final}, '${link.language}')">
          <div>
            <div style="font-size:13px;font-weight:${s.is_final ? 700 : 400}">${s.is_final ? "\u2705 Final submission" : `Auto-save #${saves.length - i}`}</div>
            <div class="save-time">${fmtDate(s.saved_at)}</div>
          </div>
          <span style="font-size:11px;color:var(--text-muted)">${s.code.split("\n").length} lines</span>
        </div>
      `).join("");
      }
      let linkQuestions = [];
      try {
        linkQuestions = JSON.parse(link.questions || "[]");
      } catch {
      }
      if (linkQuestions.length) {
        const bestSave = saves.find((s) => s.is_final) ?? saves[0];
        let answersMap = {};
        if (bestSave) {
          try {
            answersMap = JSON.parse(bestSave.answers || "{}");
          } catch {
          }
        }
        renderAnswers(linkQuestions, answersMap);
      } else {
        const el = document.getElementById("answers-block-container");
        if (el) el.innerHTML = "";
      }
      if (saves.length) {
        const best = saves.find((s) => s.is_final) ?? saves[0];
        previewSave(best.code, fmtDate(best.saved_at), best.is_final, link.language);
      }
    } catch (e) {
      toast(e.message, "err");
    }
  }
  function renderAnswers(qs, answersMap) {
    const container = document.getElementById("answers-block-container");
    if (!container) return;
    container.innerHTML = `
    <div class="answers-block">
      <h3>Candidate answers</h3>
      ${qs.map((q, i) => {
      const answer = answersMap[i]?.trim() ?? "";
      return `
          <div class="answer-item">
            <div class="answer-q"><span class="q-num">${i + 1}</span>${esc(q)}</div>
            <div class="answer-text ${answer ? "" : "empty"}">${answer ? esc(answer) : "No answer provided"}</div>
          </div>
        `;
    }).join("")}
    </div>
  `;
  }
  function previewSave(code, time, isFinal, language) {
    previewCode = code;
    document.getElementById("preview-label").textContent = (isFinal ? "\u2705 Final \xB7 " : "") + time;
    const langMap = {
      javascript: "javascript",
      typescript: "typescript",
      python: "python",
      java: "java",
      cpp: "cpp",
      go: "go",
      rust: "rust"
    };
    const monacoLang = langMap[language] ?? "plaintext";
    if (previewEditor) {
      previewEditor.setValue(code);
      const model = previewEditor.getModel();
      if (model) monaco.editor.setModelLanguage(model, monacoLang);
    } else {
      __require.config({ paths: { vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.47.0/min/vs" } });
      __require(["vs/editor/editor.main"], () => {
        previewEditor = monaco.editor.create(
          document.getElementById("preview-editor"),
          {
            value: code,
            language: monacoLang,
            theme: "vs-dark",
            readOnly: true,
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            automaticLayout: true
          }
        );
      });
    }
  }
  function copyCode() {
    if (previewCode) copyText(previewCode);
  }
  function openModal(id) {
    document.getElementById(id).classList.add("open");
  }
  function closeModal(id) {
    document.getElementById(id).classList.remove("open");
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      document.querySelectorAll(".modal-backdrop.open").forEach((m) => m.classList.remove("open"));
    }
  });
  document.querySelectorAll(".modal-backdrop").forEach((bd) => {
    bd.addEventListener("click", (e) => {
      if (e.target === bd) bd.classList.remove("open");
    });
  });
  function esc(str) {
    return String(str ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function fmtDate(iso) {
    if (!iso) return "\u2014";
    const d = new Date(iso.endsWith("Z") ? iso : iso + "Z");
    return d.toLocaleString(void 0, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }
  function copyText(text) {
    navigator.clipboard.writeText(text).then(() => toast("Copied!")).catch(() => {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      toast("Copied!");
    });
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
  Object.assign(window, {
    doLogin,
    openChallengeModal,
    editChallenge,
    saveChallenge,
    deleteChallenge,
    quickLink,
    openLinkModal,
    generateLink,
    copyGeneratedLink,
    deleteLink,
    viewSubmission,
    previewSave,
    copyCode,
    openModal,
    closeModal,
    loadSubmissions,
    copyText,
    showPage,
    addQuestion,
    removeQuestion,
    setDescTab,
    cloneLink
  });
  var saved = localStorage.getItem("adminKey");
  if (saved) {
    document.getElementById("admin-key-input").value = saved;
    ADMIN_KEY = saved;
    initApp();
  }
})();
