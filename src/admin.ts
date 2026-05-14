// Monaco + AMD require globals are declared in src/globals.d.ts
export {};

// ─── Types ────────────────────────────────────────────────────────────────────

interface Challenge {
  id: number;
  title: string;
  description: string;
  starter_code: string;
  language: string;
  /** JSON string: string[] */
  questions: string;
  time_limit_minutes: number | null;
  created_at: string;
}

interface InterviewLink {
  id: number;
  token: string;
  challenge_id: number;
  challenge_title: string;
  candidate_name: string;
  candidate_email: string;
  created_at: string;
  first_opened_at: string | null;
  submitted_at: string | null;
}

interface Save {
  id: number;
  code: string;
  /** JSON string: Record<number, string> */
  answers: string;
  saved_at: string;
  is_final: boolean;
}

interface SubmissionDetail {
  link: InterviewLink & { language: string; questions: string; time_limit_minutes: number | null };
  saves: Save[];
}

// ─── State ────────────────────────────────────────────────────────────────────

let ADMIN_KEY = '';
let editingChallengeId: number | null = null;
let previewEditor: ReturnType<typeof monaco.editor.create> | null = null;
let previewCode = '';
let challenges: Challenge[] = [];
let toastTimer: ReturnType<typeof setTimeout>;
let generatedLinkUrl = '';

// ─── Auth ─────────────────────────────────────────────────────────────────────

function doLogin(): void {
  const key = (document.getElementById('admin-key-input') as HTMLInputElement).value.trim();
  if (!key) { toast('Enter your admin key', 'err'); return; }
  ADMIN_KEY = key;
  localStorage.setItem('adminKey', key);
  initApp();
}

function initApp(): void {
  (document.getElementById('auth-screen') as HTMLElement).style.display = 'none';
  (document.getElementById('app') as HTMLElement).style.display = '';
  (document.getElementById('key-display') as HTMLElement).textContent =
    'Key: ' + ADMIN_KEY.slice(0, 4) + '****';

  document.querySelectorAll<HTMLElement>('[data-page]').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const page = link.dataset['page']!;
      document.querySelectorAll('[data-page]').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      showPage(page);
    });
  });

  loadChallenges();
}

// ─── API helper ───────────────────────────────────────────────────────────────

async function api<T = unknown>(method: string, path: string, body?: unknown): Promise<T | null> {
  const res = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json', 'x-admin-key': ADMIN_KEY },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText })) as { error: string };
    if (res.status === 401) { toast('Invalid admin key', 'err'); logout(); return null; }
    throw new Error(err.error || 'Request failed');
  }
  return res.json() as Promise<T>;
}

function logout(): void {
  localStorage.removeItem('adminKey');
  ADMIN_KEY = '';
  (document.getElementById('auth-screen') as HTMLElement).style.display = '';
  (document.getElementById('app') as HTMLElement).style.display = 'none';
}

// ─── Page navigation ──────────────────────────────────────────────────────────

function showPage(name: string): void {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  (document.getElementById('page-' + name) as HTMLElement).classList.add('active');
  document.querySelectorAll<HTMLElement>('[data-page]').forEach(l => {
    l.classList.toggle('active', l.dataset['page'] === name);
  });
  if (name === 'challenges') loadChallenges();
  if (name === 'links') { loadChallenges(); loadLinks(); }
  if (name === 'submissions') loadSubmissions();
}

// ─── Challenges ───────────────────────────────────────────────────────────────

async function loadChallenges(): Promise<void> {
  try {
    challenges = (await api<Challenge[]>('GET', '/api/admin/challenges')) ?? [];
    renderChallenges();
  } catch (e) { toast((e as Error).message, 'err'); }
}

function renderChallenges(): void {
  const el = document.getElementById('challenges-list') as HTMLElement;
  if (!challenges.length) {
    el.innerHTML = `<div class="empty-state"><div class="icon">📋</div><p>No challenges yet. Create your first one!</p></div>`;
    return;
  }
  el.innerHTML = challenges.map(c => `
    <div class="challenge-card">
      <div class="challenge-info">
        <h3>${esc(c.title)}</h3>
        <p>${esc(c.language)}${c.time_limit_minutes ? ` · ⏱ ${c.time_limit_minutes} min` : ''} · Created ${fmtDate(c.created_at)}</p>
        <p style="margin-top:6px;color:var(--text);font-size:13px;max-width:520px">${esc(c.description).slice(0, 120)}${c.description.length > 120 ? '…' : ''}</p>
      </div>
      <div class="challenge-actions">
        <button class="btn btn-ghost btn-sm" onclick="editChallenge(${c.id})">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteChallenge(${c.id})">Delete</button>
        <button class="btn btn-primary btn-sm" onclick="quickLink(${c.id})">+ Link</button>
      </div>
    </div>
  `).join('');
}

// ─── Question editor helpers ──────────────────────────────────────────────────

function renderQuestionEditor(qs: string[]): void {
  const container = document.getElementById('questions-editor') as HTMLElement;
  container.innerHTML = qs.map((q, i) => `
    <div class="question-editor-item" data-q-index="${i}">
      <input type="text" value="${esc(q)}" placeholder="e.g. What is the time complexity of your solution?" />
      <button type="button" class="btn-remove" onclick="removeQuestion(${i})">×</button>
    </div>
  `).join('');
}

function getQuestions(): string[] {
  const container = document.getElementById('questions-editor') as HTMLElement;
  return Array.from(container.querySelectorAll<HTMLInputElement>('input'))
    .map(el => el.value.trim())
    .filter(Boolean);
}

function addQuestion(): void {
  const current = getQuestions();
  renderQuestionEditor([...current, '']);
  // Focus the new input
  const inputs = (document.getElementById('questions-editor') as HTMLElement)
    .querySelectorAll<HTMLInputElement>('input');
  inputs[inputs.length - 1]?.focus();
}

function removeQuestion(index: number): void {
  const current = getQuestions();
  current.splice(index, 1);
  renderQuestionEditor(current);
}

// ─────────────────────────────────────────────────────────────────────────────

function openChallengeModal(_id?: number): void {
  editingChallengeId = null;
  (document.getElementById('challenge-modal-title') as HTMLElement).textContent = 'New Challenge';
  (document.getElementById('c-title') as HTMLInputElement).value = '';
  (document.getElementById('c-description') as HTMLTextAreaElement).value = '';
  (document.getElementById('c-starter') as HTMLTextAreaElement).value = '';
  (document.getElementById('c-language') as HTMLSelectElement).value = 'javascript';
  (document.getElementById('c-time-limit') as HTMLInputElement).value = '';
  renderQuestionEditor([]);
  openModal('challenge-modal');
}

function editChallenge(id: number): void {
  const c = challenges.find(x => x.id === id);
  if (!c) return;
  editingChallengeId = id;
  (document.getElementById('challenge-modal-title') as HTMLElement).textContent = 'Edit Challenge';
  (document.getElementById('c-title') as HTMLInputElement).value = c.title;
  (document.getElementById('c-description') as HTMLTextAreaElement).value = c.description;
  (document.getElementById('c-starter') as HTMLTextAreaElement).value = c.starter_code || '';
  (document.getElementById('c-language') as HTMLSelectElement).value = c.language || 'javascript';
  (document.getElementById('c-time-limit') as HTMLInputElement).value =
    c.time_limit_minutes ? String(c.time_limit_minutes) : '';
  let qs: string[] = [];
  try { qs = JSON.parse(c.questions || '[]') as string[]; } catch { /* noop */ }
  renderQuestionEditor(qs);
  openModal('challenge-modal');
}

async function saveChallenge(): Promise<void> {
  const title = (document.getElementById('c-title') as HTMLInputElement).value.trim();
  const description = (document.getElementById('c-description') as HTMLTextAreaElement).value.trim();
  const starter_code = (document.getElementById('c-starter') as HTMLTextAreaElement).value;
  const language = (document.getElementById('c-language') as HTMLSelectElement).value;
  const questions = getQuestions();
  const timeLimitRaw = (document.getElementById('c-time-limit') as HTMLInputElement).value.trim();
  const time_limit_minutes = timeLimitRaw ? parseInt(timeLimitRaw, 10) || null : null;
  if (!title || !description) { toast('Title and description are required', 'err'); return; }
  try {
    if (editingChallengeId) {
      await api('PUT', `/api/admin/challenges/${editingChallengeId}`, { title, description, starter_code, language, questions, time_limit_minutes });
      toast('Challenge updated');
    } else {
      await api('POST', '/api/admin/challenges', { title, description, starter_code, language, questions, time_limit_minutes });
      toast('Challenge created');
    }
    closeModal('challenge-modal');
    loadChallenges();
  } catch (e) { toast((e as Error).message, 'err'); }
}

async function deleteChallenge(id: number): Promise<void> {
  if (!confirm('Delete this challenge? All associated links and submissions will also be deleted.')) return;
  try {
    await api('DELETE', `/api/admin/challenges/${id}`);
    toast('Challenge deleted');
    loadChallenges();
  } catch (e) { toast((e as Error).message, 'err'); }
}

function quickLink(challengeId: number): void {
  showPage('links');
  openLinkModal(challengeId);
}

// ─── Links ────────────────────────────────────────────────────────────────────

async function loadLinks(): Promise<void> {
  try {
    const links = (await api<InterviewLink[]>('GET', '/api/admin/links')) ?? [];
    renderLinks(links);
  } catch (e) { toast((e as Error).message, 'err'); }
}

function renderLinks(links: InterviewLink[]): void {
  const tbody = document.getElementById('links-tbody') as HTMLElement;
  if (!links.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="icon">🔗</div><p>No links yet.</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = links.map(l => {
    const url = `${location.origin}/interview/${l.token}`;
    let status = '<span class="badge badge-gray">Pending</span>';
    if (l.submitted_at) status = '<span class="badge badge-green">Submitted</span>';
    else if (l.first_opened_at) status = '<span class="badge badge-yellow">In progress</span>';
    return `
      <tr>
        <td>
          <div style="font-weight:500">${esc(l.candidate_name || '—')}</div>
          <div style="font-size:12px;color:var(--text-muted)">${esc(l.candidate_email || '')}</div>
        </td>
        <td>${esc(l.challenge_title)}</td>
        <td>${status}</td>
        <td class="no-wrap" style="font-size:12px;color:var(--text-muted)">${fmtDate(l.created_at)}</td>
        <td>
          <span class="copy-link">${url}</span>
          <button class="btn btn-ghost btn-sm" style="margin-top:4px" onclick="copyText('${url}')">Copy</button>
        </td>
        <td>
          <div style="display:flex;gap:6px">
            ${l.submitted_at || l.first_opened_at ? `<button class="btn btn-ghost btn-sm" onclick="viewSubmission(${l.id},'${esc(l.candidate_name || 'Candidate')}')">View</button>` : ''}
            <button class="btn btn-danger btn-sm" onclick="deleteLink(${l.id})">×</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function openLinkModal(preselect?: number): void {
  const sel = document.getElementById('l-challenge') as HTMLSelectElement;
  sel.innerHTML = challenges.map(c =>
    `<option value="${c.id}" ${c.id === preselect ? 'selected' : ''}>${esc(c.title)}</option>`
  ).join('');
  if (!challenges.length) sel.innerHTML = '<option>No challenges — create one first</option>';
  (document.getElementById('l-name') as HTMLInputElement).value = '';
  (document.getElementById('l-email') as HTMLInputElement).value = '';
  const tokenEl = document.getElementById('link-token') as HTMLElement;
  tokenEl.style.display = 'none';
  tokenEl.textContent = '';
  const linkActions = document.getElementById('link-actions');
  if (linkActions) linkActions.style.display = 'none';
  openModal('link-modal');
}

async function generateLink(): Promise<void> {
  const challenge_id = +(document.getElementById('l-challenge') as HTMLSelectElement).value;
  const candidate_name = (document.getElementById('l-name') as HTMLInputElement).value.trim();
  const candidate_email = (document.getElementById('l-email') as HTMLInputElement).value.trim();
  if (!challenge_id) { toast('Select a challenge', 'err'); return; }
  try {
    const data = await api<{ id: number; token: string }>(
      'POST', '/api/admin/links', { challenge_id, candidate_name, candidate_email }
    );
    if (!data) return;
    const url = `${location.origin}/interview/${data.token}`;
    const tokenEl = document.getElementById('link-token') as HTMLElement;
    tokenEl.textContent = url;
    tokenEl.style.display = 'block';
    const linkActions = document.getElementById('link-actions');
    if (linkActions) linkActions.style.display = 'flex';
    generatedLinkUrl = url;
    toast('Link generated!');
    loadLinks();
  } catch (e) { toast((e as Error).message, 'err'); }
}

function copyGeneratedLink(): void {
  if (generatedLinkUrl) copyText(generatedLinkUrl);
}

async function deleteLink(id: number): Promise<void> {
  if (!confirm('Delete this interview link?')) return;
  try {
    await api('DELETE', `/api/admin/links/${id}`);
    toast('Link deleted');
    loadLinks();
  } catch (e) { toast((e as Error).message, 'err'); }
}

// ─── Submissions ──────────────────────────────────────────────────────────────

async function loadSubmissions(): Promise<void> {
  try {
    const links = (await api<InterviewLink[]>('GET', '/api/admin/links')) ?? [];
    renderSubmissions(links.filter(l => l.first_opened_at));
  } catch (e) { toast((e as Error).message, 'err'); }
}

function renderSubmissions(links: InterviewLink[]): void {
  const tbody = document.getElementById('submissions-tbody') as HTMLElement;
  if (!links.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="icon">📝</div><p>No submissions yet.</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = links.map(l => {
    let status = '<span class="badge badge-yellow">In progress</span>';
    if (l.submitted_at) status = '<span class="badge badge-green">Submitted</span>';
    return `
      <tr>
        <td><div style="font-weight:500">${esc(l.candidate_name || '—')}</div><div style="font-size:12px;color:var(--text-muted)">${esc(l.candidate_email || '')}</div></td>
        <td>${esc(l.challenge_title)}</td>
        <td>${status}</td>
        <td class="no-wrap" style="font-size:12px;color:var(--text-muted)">${fmtDate(l.first_opened_at)}</td>
        <td class="no-wrap" style="font-size:12px;color:var(--text-muted)">${l.submitted_at ? fmtDate(l.submitted_at) : '—'}</td>
        <td><button class="btn btn-ghost btn-sm" onclick="viewSubmission(${l.id},'${esc(l.candidate_name || 'Candidate')}')">View code →</button></td>
      </tr>
    `;
  }).join('');
}

async function viewSubmission(linkId: number, name: string): Promise<void> {
  try {
    const data = await api<SubmissionDetail>('GET', `/api/admin/submissions/${linkId}`);
    if (!data) return;

    showPage('submission-detail');
    (document.getElementById('detail-title') as HTMLElement).textContent = name || 'Submission';

    const { link, saves } = data;
    (document.getElementById('submission-meta') as HTMLElement).innerHTML = `
      <div class="meta-item"><div class="label">Candidate</div><div class="value">${esc(link.candidate_name || '—')}</div></div>
      <div class="meta-item"><div class="label">Email</div><div class="value">${esc(link.candidate_email || '—')}</div></div>
      <div class="meta-item"><div class="label">Challenge</div><div class="value">${esc(link.challenge_title)}</div></div>
      <div class="meta-item"><div class="label">Language</div><div class="value">${esc(link.language)}</div></div>
      <div class="meta-item"><div class="label">Opened</div><div class="value">${fmtDate(link.first_opened_at)}</div></div>
      <div class="meta-item"><div class="label">Submitted</div><div class="value">${link.submitted_at ? fmtDate(link.submitted_at) : 'Not yet'}</div></div>
      <div class="meta-item"><div class="label">Time limit</div><div class="value">${link.time_limit_minutes ? `${link.time_limit_minutes} min` : 'None'}</div></div>
      <div class="meta-item"><div class="label">Total saves</div><div class="value">${saves.length}</div></div>
    `;

    const savesList = document.getElementById('saves-list') as HTMLElement;
    if (!saves.length) {
      savesList.innerHTML = '<p style="color:var(--text-muted);font-size:13px">No saves recorded</p>';
    } else {
      savesList.innerHTML = saves.map((s, i) => `
        <div class="save-item ${s.is_final ? 'final' : ''}"
             onclick="previewSave(${JSON.stringify(s.code).replace(/</g, '\\u003c')}, '${fmtDate(s.saved_at)}', ${s.is_final}, '${link.language}')">
          <div>
            <div style="font-size:13px;font-weight:${s.is_final ? 700 : 400}">${s.is_final ? '✅ Final submission' : `Auto-save #${saves.length - i}`}</div>
            <div class="save-time">${fmtDate(s.saved_at)}</div>
          </div>
          <span style="font-size:11px;color:var(--text-muted)">${s.code.split('\n').length} lines</span>
        </div>
      `).join('');
    }

    // Show answers for the final (or latest) save
    let linkQuestions: string[] = [];
    try { linkQuestions = JSON.parse(link.questions || '[]') as string[]; } catch { /* noop */ }

    if (linkQuestions.length) {
      const bestSave = saves.find(s => s.is_final) ?? saves[0];
      let answersMap: Record<number, string> = {};
      if (bestSave) {
        try { answersMap = JSON.parse(bestSave.answers || '{}') as Record<number, string>; } catch { /* noop */ }
      }
      renderAnswers(linkQuestions, answersMap);
    } else {
      const el = document.getElementById('answers-block-container');
      if (el) el.innerHTML = '';
    }

    if (saves.length) {
      const best = saves.find(s => s.is_final) ?? saves[0];
      previewSave(best.code, fmtDate(best.saved_at), best.is_final, link.language);
    }
  } catch (e) { toast((e as Error).message, 'err'); }
}

function renderAnswers(qs: string[], answersMap: Record<number, string>): void {
  const container = document.getElementById('answers-block-container');
  if (!container) return;
  container.innerHTML = `
    <div class="answers-block">
      <h3>Candidate answers</h3>
      ${qs.map((q, i) => {
        const answer = answersMap[i]?.trim() ?? '';
        return `
          <div class="answer-item">
            <div class="answer-q"><span class="q-num">${i + 1}</span>${esc(q)}</div>
            <div class="answer-text ${answer ? '' : 'empty'}">${answer ? esc(answer) : 'No answer provided'}</div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function previewSave(code: string, time: string, isFinal: boolean, language: string): void {
  previewCode = code;
  (document.getElementById('preview-label') as HTMLElement).textContent =
    (isFinal ? '✅ Final · ' : '') + time;

  const langMap: Record<string, string> = {
    javascript: 'javascript', typescript: 'typescript', python: 'python',
    java: 'java', cpp: 'cpp', go: 'go', rust: 'rust',
  };
  const monacoLang = langMap[language] ?? 'plaintext';

  if (previewEditor) {
    previewEditor.setValue(code);
    const model = previewEditor.getModel();
    if (model) monaco.editor.setModelLanguage(model, monacoLang);
  } else {
    require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.47.0/min/vs' } });
    require(['vs/editor/editor.main'], () => {
      previewEditor = monaco.editor.create(
        document.getElementById('preview-editor') as HTMLElement,
        {
          value: code, language: monacoLang, theme: 'vs-dark', readOnly: true,
          minimap: { enabled: false }, fontSize: 13, lineNumbers: 'on',
          scrollBeyondLastLine: false, automaticLayout: true,
        }
      );
    });
  }
}

function copyCode(): void {
  if (previewCode) copyText(previewCode);
}

// ─── Modal helpers ────────────────────────────────────────────────────────────

function openModal(id: string): void {
  (document.getElementById(id) as HTMLElement).classList.add('open');
}
function closeModal(id: string): void {
  (document.getElementById(id) as HTMLElement).classList.remove('open');
}

document.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-backdrop.open').forEach(m => m.classList.remove('open'));
  }
});
document.querySelectorAll<HTMLElement>('.modal-backdrop').forEach(bd => {
  bd.addEventListener('click', e => { if (e.target === bd) bd.classList.remove('open'); });
});

// ─── Utilities ────────────────────────────────────────────────────────────────

function esc(str: string | null | undefined): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso.endsWith('Z') ? iso : iso + 'Z');
  return d.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function copyText(text: string): void {
  navigator.clipboard.writeText(text).then(() => toast('Copied!')).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    toast('Copied!');
  });
}

function toast(msg: string, type: 'ok' | 'err' = 'ok'): void {
  const el = document.getElementById('toast') as HTMLElement;
  el.textContent = msg;
  el.className = 'show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = ''; }, 3000);
}

// ─── Expose functions called from inline HTML onclick handlers ────────────────
// esbuild bundles as IIFE by default; expose needed globals on window
declare global {
  interface Window {
    doLogin: typeof doLogin;
    openChallengeModal: typeof openChallengeModal;
    editChallenge: typeof editChallenge;
    saveChallenge: typeof saveChallenge;
    deleteChallenge: typeof deleteChallenge;
    quickLink: typeof quickLink;
    openLinkModal: typeof openLinkModal;
    generateLink: typeof generateLink;
    copyGeneratedLink: typeof copyGeneratedLink;
    deleteLink: typeof deleteLink;
    viewSubmission: typeof viewSubmission;
    previewSave: typeof previewSave;
    copyCode: typeof copyCode;
    openModal: typeof openModal;
    closeModal: typeof closeModal;
    loadSubmissions: typeof loadSubmissions;
    copyText: typeof copyText;
    showPage: typeof showPage;
    addQuestion: typeof addQuestion;
    removeQuestion: typeof removeQuestion;
  }
}
Object.assign(window, {
  doLogin, openChallengeModal, editChallenge, saveChallenge, deleteChallenge,
  quickLink, openLinkModal, generateLink, copyGeneratedLink, deleteLink,
  viewSubmission, previewSave, copyCode, openModal, closeModal,
  loadSubmissions, copyText, showPage, addQuestion, removeQuestion,
});

// ─── Boot ─────────────────────────────────────────────────────────────────────
const saved = localStorage.getItem('adminKey');
if (saved) {
  (document.getElementById('admin-key-input') as HTMLInputElement).value = saved;
  ADMIN_KEY = saved;
  initApp();
}
