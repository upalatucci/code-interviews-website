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
  var previewEditors = /* @__PURE__ */ new Map();
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
      el.innerHTML = `<div class="empty-state"><div class="icon">\u{1F4CB}</div><p>No interviews yet. Create your first one!</p></div>`;
      return;
    }
    el.innerHTML = challenges.map((c) => `
    <div class="challenge-card">
      <div class="challenge-info">
        <h3>${esc(c.title)}</h3>
        <p>
          ${c.coding_challenges.length} coding challenge${c.coding_challenges.length !== 1 ? "s" : ""}
          \xB7 ${c.interview_questions.length} question${c.interview_questions.length !== 1 ? "s" : ""}
          ${c.time_limit_minutes ? ` \xB7 \u23F1 ${c.time_limit_minutes} min` : ""}
          \xB7 Created ${fmtDate(c.created_at)}
        </p>
        <p style="margin-top:6px;font-size:12px;color:var(--text-muted)">
          ${c.coding_challenges.slice(0, 3).map((cc) => `<span class="lang-badge">${esc(cc.language)}</span>`).join(" ")}
        </p>
      </div>
      <div class="challenge-actions">
        <button class="btn btn-ghost btn-sm" onclick="editChallenge(${c.id})">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteChallenge(${c.id})">Delete</button>
        <button class="btn btn-primary btn-sm" onclick="quickLink(${c.id})">+ Link</button>
      </div>
    </div>
  `).join("");
  }
  function openChallengeModal() {
    editingChallengeId = null;
    document.getElementById("challenge-modal-title").textContent = "New Interview";
    document.getElementById("c-title").value = "";
    document.getElementById("c-time-limit").value = "";
    renderCodingChallengesEditor([]);
    renderQuestionsEditor([]);
    openModal("challenge-modal");
  }
  function editChallenge(id) {
    const c = challenges.find((x) => x.id === id);
    if (!c) return;
    editingChallengeId = id;
    document.getElementById("challenge-modal-title").textContent = "Edit Interview";
    document.getElementById("c-title").value = c.title;
    document.getElementById("c-time-limit").value = c.time_limit_minutes ? String(c.time_limit_minutes) : "";
    renderCodingChallengesEditor(c.coding_challenges);
    renderQuestionsEditor(c.interview_questions);
    openModal("challenge-modal");
  }
  async function saveChallenge() {
    const title = document.getElementById("c-title").value.trim();
    const timeLimitRaw = document.getElementById("c-time-limit").value.trim();
    const time_limit_minutes = timeLimitRaw ? parseInt(timeLimitRaw, 10) || null : null;
    if (!title) {
      toast("Interview title is required", "err");
      return;
    }
    const coding_challenges = getCodingChallenges();
    const interview_questions = getInterviewQuestions();
    try {
      if (editingChallengeId) {
        await api(
          "PUT",
          `/api/admin/challenges/${editingChallengeId}`,
          { title, time_limit_minutes, coding_challenges, interview_questions }
        );
        toast("Interview saved");
      } else {
        const data = await api("POST", "/api/admin/challenges", { title, time_limit_minutes });
        if (!data) return;
        await api(
          "PUT",
          `/api/admin/challenges/${data.id}`,
          { title, time_limit_minutes, coding_challenges, interview_questions }
        );
        toast("Interview created");
      }
      closeModal("challenge-modal");
      loadChallenges();
    } catch (e) {
      toast(e.message, "err");
    }
  }
  async function deleteChallenge(id) {
    if (!confirm("Delete this interview? All links and submissions will also be deleted.")) return;
    try {
      await api("DELETE", `/api/admin/challenges/${id}`);
      toast("Interview deleted");
      loadChallenges();
    } catch (e) {
      toast(e.message, "err");
    }
  }
  function renderCodingChallengesEditor(items) {
    const container = document.getElementById("coding-challenges-editor");
    if (!items.length) {
      container.innerHTML = "";
      return;
    }
    container.innerHTML = items.map((cc, i) => buildCcHtml(cc, i)).join("");
  }
  function buildCcHtml(cc, index) {
    const langs = ["javascript", "typescript", "python", "java", "cpp", "go", "rust"];
    return `
    <div class="cc-item" data-index="${index}" ${cc.id ? `data-id="${cc.id}"` : ""}>
      <div class="cc-header">
        <span class="cc-label">Challenge ${index + 1}</span>
        <input class="cc-title" placeholder="Challenge title" value="${esc(cc.title ?? "")}" />
        <select class="cc-lang">
          ${langs.map((l) => `<option value="${l}" ${cc.language === l ? "selected" : ""}>${l}</option>`).join("")}
        </select>
        <button type="button" class="btn-remove" onclick="removeCodingChallenge(${index})" title="Remove">\xD7</button>
        <button type="button" class="cc-toggle" onclick="toggleCc(${index})">\u25BE</button>
      </div>
      <div class="cc-body">
        <div class="form-group">
          <label style="display:flex;align-items:center;justify-content:space-between">
            Description <span style="color:var(--accent2);font-size:11px;font-weight:600">Markdown</span>
          </label>
          <textarea class="cc-desc" rows="5" placeholder="Describe the problem using **Markdown**.">${esc(cc.description ?? "")}</textarea>
        </div>
        <div class="form-group">
          <label>Starter code (optional)</label>
          <textarea class="cc-starter" rows="5" style="font-family:var(--mono);font-size:13px" placeholder="// starter code...">${esc(cc.starter_code ?? "")}</textarea>
        </div>
      </div>
    </div>
  `;
  }
  function addCodingChallenge() {
    const container = document.getElementById("coding-challenges-editor");
    const index = container.querySelectorAll(".cc-item").length;
    const div = document.createElement("div");
    div.innerHTML = buildCcHtml({}, index);
    container.appendChild(div.firstElementChild);
  }
  function removeCodingChallenge(index) {
    const container = document.getElementById("coding-challenges-editor");
    const items = container.querySelectorAll(".cc-item");
    if (items[index]) items[index].remove();
    container.querySelectorAll(".cc-item").forEach((item, i) => {
      item.dataset["index"] = String(i);
      const lbl = item.querySelector(".cc-label");
      if (lbl) lbl.textContent = `Challenge ${i + 1}`;
      const toggleBtn = item.querySelector(".cc-toggle");
      if (toggleBtn) toggleBtn.setAttribute("onclick", `toggleCc(${i})`);
      const removeBtn = item.querySelector(".btn-remove");
      if (removeBtn) removeBtn.setAttribute("onclick", `removeCodingChallenge(${i})`);
    });
  }
  function toggleCc(index) {
    const container = document.getElementById("coding-challenges-editor");
    const item = container.querySelectorAll(".cc-item")[index];
    if (!item) return;
    const body = item.querySelector(".cc-body");
    const btn = item.querySelector(".cc-toggle");
    if (!body || !btn) return;
    const open = body.style.display !== "none";
    body.style.display = open ? "none" : "";
    btn.textContent = open ? "\u25B8" : "\u25BE";
  }
  function getCodingChallenges() {
    const container = document.getElementById("coding-challenges-editor");
    return Array.from(container.querySelectorAll(".cc-item")).map((item, i) => ({
      id: item.dataset["id"] ? Number(item.dataset["id"]) : void 0,
      title: item.querySelector(".cc-title").value.trim(),
      description: item.querySelector(".cc-desc").value,
      starter_code: item.querySelector(".cc-starter").value,
      language: item.querySelector(".cc-lang").value,
      position: i
    }));
  }
  function renderQuestionsEditor(items) {
    const container = document.getElementById("questions-editor");
    if (!items.length) {
      container.innerHTML = "";
      return;
    }
    container.innerHTML = items.map((q, i) => buildQHtml(q, i)).join("");
  }
  function buildQHtml(q, index) {
    return `
    <div class="question-editor-item" data-index="${index}" ${q.id ? `data-id="${q.id}"` : ""}>
      <textarea class="q-text" rows="2" placeholder="e.g. What is the time complexity of your solution?">${esc(q.text ?? "")}</textarea>
      <button type="button" class="btn-remove" onclick="removeInterviewQuestion(${index})">\xD7</button>
    </div>
  `;
  }
  function addInterviewQuestion() {
    const container = document.getElementById("questions-editor");
    const index = container.querySelectorAll(".question-editor-item").length;
    const div = document.createElement("div");
    div.innerHTML = buildQHtml({}, index);
    container.appendChild(div.firstElementChild);
  }
  function removeInterviewQuestion(index) {
    const container = document.getElementById("questions-editor");
    const items = container.querySelectorAll(".question-editor-item");
    if (items[index]) items[index].remove();
    container.querySelectorAll(".question-editor-item").forEach((item, i) => {
      item.dataset["index"] = String(i);
      const removeBtn = item.querySelector(".btn-remove");
      if (removeBtn) removeBtn.setAttribute("onclick", `removeInterviewQuestion(${i})`);
    });
  }
  function getInterviewQuestions() {
    const container = document.getElementById("questions-editor");
    return Array.from(container.querySelectorAll(".question-editor-item")).map((item, i) => ({
      id: item.dataset["id"] ? Number(item.dataset["id"]) : void 0,
      text: item.querySelector(".q-text").value.trim(),
      position: i
    })).filter((q) => q.text);
  }
  function quickLink(challengeId) {
    showPage("links");
    openLinkModal(challengeId);
  }
  async function loadLinks() {
    try {
      renderLinks(await api("GET", "/api/admin/links") ?? []);
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
            <button class="btn btn-ghost btn-sm" onclick="cloneLink(${l.challenge_id},'${esc(l.challenge_title ?? "")}')">Clone</button>
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
    if (!challenges.length) sel.innerHTML = "<option>No interviews \u2014 create one first</option>";
    document.getElementById("l-name").value = "";
    document.getElementById("l-email").value = "";
    const tokenEl = document.getElementById("link-token");
    tokenEl.style.display = "none";
    tokenEl.textContent = "";
    const la = document.getElementById("link-actions");
    if (la) la.style.display = "none";
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
      toast("Select an interview", "err");
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
      const la = document.getElementById("link-actions");
      if (la) la.style.display = "flex";
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
        <td><button class="btn btn-ghost btn-sm" onclick="viewSubmission(${l.id},'${esc(l.candidate_name || "Candidate")}')">View \u2192</button></td>
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
      const { link, saves, codingChallenges, questions } = data;
      const cloneBtn = document.getElementById("detail-clone-btn");
      cloneBtn.onclick = () => cloneLink(link.challenge_id, esc(link.challenge_title ?? ""));
      document.getElementById("submission-meta").innerHTML = `
      <div class="meta-item"><div class="label">Candidate</div><div class="value">${esc(link.candidate_name || "\u2014")}</div></div>
      <div class="meta-item"><div class="label">Email</div><div class="value">${esc(link.candidate_email || "\u2014")}</div></div>
      <div class="meta-item"><div class="label">Interview</div><div class="value">${esc(link.challenge_title)}</div></div>
      <div class="meta-item"><div class="label">Time limit</div><div class="value">${link.time_limit_minutes ? `${link.time_limit_minutes} min` : "None"}</div></div>
      <div class="meta-item"><div class="label">Opened</div><div class="value">${fmtDate(link.first_opened_at)}</div></div>
      <div class="meta-item"><div class="label">Submitted</div><div class="value">${link.submitted_at ? fmtDate(link.submitted_at) : "Not yet"}</div></div>
      <div class="meta-item"><div class="label">Total saves</div><div class="value">${saves.length}</div></div>
    `;
      const bestSave = saves.find((s) => s.is_final) ?? saves[0];
      renderAnswersBlock(questions, bestSave);
      renderCodeViewers(codingChallenges, bestSave);
      const savesList = document.getElementById("saves-list");
      if (!saves.length) {
        savesList.innerHTML = '<p style="color:var(--text-muted);font-size:13px">No saves recorded</p>';
      } else {
        savesList.innerHTML = saves.map((s, i) => `
        <div class="save-item ${s.is_final ? "final" : ""}" onclick="selectSave(${i})">
          <div>
            <div style="font-size:13px;font-weight:${s.is_final ? 700 : 400}">${s.is_final ? "\u2705 Final submission" : `Auto-save #${saves.length - i}`}</div>
            <div class="save-time">${fmtDate(s.saved_at)}</div>
          </div>
        </div>
      `).join("");
        window._saves = saves;
        window._codingChallenges = codingChallenges;
        window._questions = questions;
      }
    } catch (e) {
      toast(e.message, "err");
    }
  }
  function selectSave(index) {
    const w = window;
    const save = w._saves[index];
    if (!save) return;
    document.querySelectorAll(".save-item").forEach((el, i) => el.classList.toggle("active", i === index));
    renderCodeViewers(w._codingChallenges, save);
    renderAnswersBlock(w._questions, save);
  }
  function renderCodeViewers(ccs, save) {
    const container = document.getElementById("code-viewers");
    if (!ccs.length) {
      container.innerHTML = "";
      return;
    }
    let codesMap = {};
    if (save) {
      try {
        codesMap = JSON.parse(save.codes || "{}");
      } catch {
      }
    }
    const firstId = ccs[0].id ?? 0;
    container.innerHTML = `
    <div class="tab-bar" id="code-viewer-tabs" style="margin-bottom:12px">
      ${ccs.map((cc, i) => `
        <button class="tab-btn ${i === 0 ? "active" : ""}"
          onclick="selectCodeViewerTab(${i})">${esc(cc.title || `Challenge ${i + 1}`)}</button>
      `).join("")}
    </div>
    ${ccs.map((cc, i) => {
      const id = cc.id ?? i;
      const code = codesMap[id] ?? "";
      return `
        <div class="code-viewer-panel ${i === 0 ? "" : "hidden"}" data-viewer-index="${i}">
          <div class="code-preview">
            <div class="code-preview-header">
              <span>${esc(cc.title || `Challenge ${i + 1}`)} \xB7 <span class="lang-badge">${esc(cc.language)}</span></span>
              <button class="btn btn-ghost btn-sm" onclick="copyCodeViewer(${i})">Copy</button>
            </div>
            <div id="code-viewer-editor-${i}" style="height:420px"></div>
          </div>
        </div>
      `;
    }).join("")}
  `;
    renderCodeViewerEditor(0, ccs[0], codesMap[ccs[0].id ?? 0] ?? "");
  }
  var _codeViewerCcs = [];
  var _codeViewerCodesMap = {};
  function selectCodeViewerTab(index) {
    document.querySelectorAll(".code-viewer-panel").forEach(
      (el, i) => el.classList.toggle("hidden", i !== index)
    );
    document.querySelectorAll("#code-viewer-tabs .tab-btn").forEach(
      (el, i) => el.classList.toggle("active", i === index)
    );
    renderCodeViewerEditor(index, _codeViewerCcs[index], _codeViewerCodesMap[_codeViewerCcs[index].id ?? index] ?? "");
  }
  function renderCodeViewerEditor(index, cc, code) {
    if (!cc) return;
    const containerId = `code-viewer-editor-${index}`;
    if (previewEditors.has(index)) {
      const e = previewEditors.get(index);
      e.setValue(code);
      const model = e.getModel();
      if (model) monaco.editor.setModelLanguage(model, cc.language || "javascript");
      return;
    }
    __require.config({ paths: { vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.47.0/min/vs" } });
    __require(["vs/editor/editor.main"], () => {
      const e = monaco.editor.create(document.getElementById(containerId), {
        value: code,
        language: cc.language || "javascript",
        theme: "vs-dark",
        readOnly: true,
        minimap: { enabled: false },
        fontSize: 13,
        lineNumbers: "on",
        scrollBeyondLastLine: false,
        automaticLayout: true
      });
      previewEditors.set(index, e);
    });
  }
  function copyCodeViewer(index) {
    const w = window;
    const cc = (w._codingChallenges ?? [])[index];
    if (!cc) return;
    const code = _codeViewerCodesMap[cc.id ?? index] ?? "";
    copyText(code);
  }
  function renderAnswersBlock(questions, save) {
    const container = document.getElementById("answers-block-container");
    if (!questions.length) {
      container.innerHTML = "";
      return;
    }
    let answersMap = {};
    if (save) {
      try {
        answersMap = JSON.parse(save.answers || "{}");
      } catch {
      }
    }
    container.innerHTML = `
    <div class="answers-block">
      <h3>Candidate answers</h3>
      ${questions.map((q, i) => {
      const answer = answersMap[q.id]?.trim() ?? "";
      return `
          <div class="answer-item">
            <div class="answer-q"><span class="q-num">${i + 1}</span>${esc(q.text)}</div>
            <div class="answer-text ${answer ? "" : "empty"}">${answer ? esc(answer) : "No answer provided"}</div>
          </div>
        `;
    }).join("")}
    </div>
  `;
  }
  async function renderMd(src) {
    return Promise.resolve(marked.parse(src));
  }
  function openModal(id) {
    document.getElementById(id).classList.add("open");
  }
  function closeModal(id) {
    document.getElementById(id).classList.remove("open");
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") document.querySelectorAll(".modal-backdrop.open").forEach((m) => m.classList.remove("open"));
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
    return d.toLocaleString(void 0, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
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
    selectSave,
    selectCodeViewerTab,
    copyCodeViewer,
    openModal,
    closeModal,
    loadSubmissions,
    copyText,
    showPage,
    cloneLink,
    addCodingChallenge,
    removeCodingChallenge,
    toggleCc,
    addInterviewQuestion,
    removeInterviewQuestion,
    renderMd
  });
  var saved = localStorage.getItem("adminKey");
  if (saved) {
    document.getElementById("admin-key-input").value = saved;
    ADMIN_KEY = saved;
    initApp();
  }
})();
