// Monaco + AMD require globals are declared in src/globals.d.ts
export {};

// ─── Types ────────────────────────────────────────────────────────────────────

interface CodingChallengeItem {
  id?: number;
  title: string;
  description: string;
  starter_code: string;
  language: string;
  position: number;
}

interface QuestionItem {
  id?: number;
  text: string;
  position: number;
}

interface Challenge {
  id: number;
  title: string;
  time_limit_minutes: number | null;
  created_at: string;
  coding_challenges: CodingChallengeItem[];
  interview_questions: QuestionItem[];
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
  codes: string;   // JSON: {codingChallengeId: code}
  answers: string; // JSON: {questionId: answer}
  saved_at: string;
  is_final: boolean;
}

interface SubmissionDetail {
  link: InterviewLink & { time_limit_minutes: number | null };
  saves: Save[];
  codingChallenges: CodingChallengeItem[];
  questions: QuestionItem[];
}

// ─── State ────────────────────────────────────────────────────────────────────

let ADMIN_KEY = '';
let editingChallengeId: number | null = null;
let previewEditors = new Map<number, ReturnType<typeof monaco.editor.create>>();
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
    el.innerHTML = `<div class="empty-state"><div class="icon">📋</div><p>No interviews yet. Create your first one!</p></div>`;
    return;
  }
  el.innerHTML = challenges.map(c => `
    <div class="challenge-card">
      <div class="challenge-info">
        <h3>${esc(c.title)}</h3>
        <p>
          ${c.coding_challenges.length} coding challenge${c.coding_challenges.length !== 1 ? 's' : ''}
          · ${c.interview_questions.length} question${c.interview_questions.length !== 1 ? 's' : ''}
          ${c.time_limit_minutes ? ` · ⏱ ${c.time_limit_minutes} min` : ''}
          · Created ${fmtDate(c.created_at)}
        </p>
        <p style="margin-top:6px;font-size:12px;color:var(--text-muted)">
          ${c.coding_challenges.slice(0, 3).map(cc => `<span class="lang-badge">${esc(cc.language)}</span>`).join(' ')}
        </p>
      </div>
      <div class="challenge-actions">
        <button class="btn btn-ghost btn-sm" onclick="editChallenge(${c.id})">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteChallenge(${c.id})">Delete</button>
        <button class="btn btn-primary btn-sm" onclick="quickLink(${c.id})">+ Link</button>
      </div>
    </div>
  `).join('');
}

// ─── Challenge modal ──────────────────────────────────────────────────────────

function openChallengeModal(): void {
  editingChallengeId = null;
  (document.getElementById('challenge-modal-title') as HTMLElement).textContent = 'New Interview';
  (document.getElementById('c-title') as HTMLInputElement).value = '';
  (document.getElementById('c-time-limit') as HTMLInputElement).value = '';
  renderCodingChallengesEditor([]);
  renderQuestionsEditor([]);
  openModal('challenge-modal');
}

function editChallenge(id: number): void {
  const c = challenges.find(x => x.id === id);
  if (!c) return;
  editingChallengeId = id;
  (document.getElementById('challenge-modal-title') as HTMLElement).textContent = 'Edit Interview';
  (document.getElementById('c-title') as HTMLInputElement).value = c.title;
  (document.getElementById('c-time-limit') as HTMLInputElement).value =
    c.time_limit_minutes ? String(c.time_limit_minutes) : '';
  renderCodingChallengesEditor(c.coding_challenges);
  renderQuestionsEditor(c.interview_questions);
  openModal('challenge-modal');
}

async function saveChallenge(): Promise<void> {
  const title = (document.getElementById('c-title') as HTMLInputElement).value.trim();
  const timeLimitRaw = (document.getElementById('c-time-limit') as HTMLInputElement).value.trim();
  const time_limit_minutes = timeLimitRaw ? parseInt(timeLimitRaw, 10) || null : null;
  if (!title) { toast('Interview title is required', 'err'); return; }

  const coding_challenges = getCodingChallenges();
  const interview_questions = getInterviewQuestions();

  try {
    if (editingChallengeId) {
      await api('PUT', `/api/admin/challenges/${editingChallengeId}`,
        { title, time_limit_minutes, coding_challenges, interview_questions });
      toast('Interview saved');
    } else {
      const data = await api<{ id: number }>('POST', '/api/admin/challenges', { title, time_limit_minutes });
      if (!data) return;
      await api('PUT', `/api/admin/challenges/${data.id}`,
        { title, time_limit_minutes, coding_challenges, interview_questions });
      toast('Interview created');
    }
    closeModal('challenge-modal');
    loadChallenges();
  } catch (e) { toast((e as Error).message, 'err'); }
}

async function deleteChallenge(id: number): Promise<void> {
  if (!confirm('Delete this interview? All links and submissions will also be deleted.')) return;
  try {
    await api('DELETE', `/api/admin/challenges/${id}`);
    toast('Interview deleted');
    loadChallenges();
  } catch (e) { toast((e as Error).message, 'err'); }
}

// ─── Coding challenges editor ─────────────────────────────────────────────────

function renderCodingChallengesEditor(items: CodingChallengeItem[]): void {
  const container = document.getElementById('coding-challenges-editor') as HTMLElement;
  if (!items.length) { container.innerHTML = ''; return; }
  container.innerHTML = items.map((cc, i) => buildCcHtml(cc, i)).join('');
}

function buildCcHtml(cc: Partial<CodingChallengeItem>, index: number): string {
  const langs = ['javascript','typescript','python','java','cpp','go','rust'];
  return `
    <div class="cc-item" data-index="${index}" ${cc.id ? `data-id="${cc.id}"` : ''}>
      <div class="cc-header">
        <span class="cc-label">Challenge ${index + 1}</span>
        <input class="cc-title" placeholder="Challenge title" value="${esc(cc.title ?? '')}" />
        <select class="cc-lang">
          ${langs.map(l => `<option value="${l}" ${cc.language === l ? 'selected' : ''}>${l}</option>`).join('')}
        </select>
        <button type="button" class="btn-remove" onclick="removeCodingChallenge(${index})" title="Remove">×</button>
        <button type="button" class="cc-toggle" onclick="toggleCc(${index})">▾</button>
      </div>
      <div class="cc-body">
        <div class="form-group">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
            <label style="margin:0">Description <span style="color:var(--accent2);font-size:11px;font-weight:600">Markdown</span></label>
            <div class="tab-bar" style="margin:0">
              <button type="button" class="tab-btn active" id="cc-desc-write-${index}" onclick="setCcDescTab(${index},'write')">Write</button>
              <button type="button" class="tab-btn"        id="cc-desc-prev-${index}"  onclick="setCcDescTab(${index},'preview')">Preview</button>
            </div>
          </div>
          <textarea class="cc-desc" id="cc-desc-${index}" rows="5" placeholder="Describe the problem using **Markdown**.">${esc(cc.description ?? '')}</textarea>
          <div class="markdown-preview" id="cc-desc-preview-${index}" style="display:none"></div>
        </div>
        <div class="form-group">
          <label>Starter code (optional)</label>
          <textarea class="cc-starter" rows="5" style="font-family:var(--mono);font-size:13px" placeholder="// starter code...">${esc(cc.starter_code ?? '')}</textarea>
        </div>
      </div>
    </div>
  `;
}

function addCodingChallenge(): void {
  const container = document.getElementById('coding-challenges-editor') as HTMLElement;
  const index = container.querySelectorAll('.cc-item').length;
  const div = document.createElement('div');
  div.innerHTML = buildCcHtml({}, index);
  container.appendChild(div.firstElementChild!);
}

function removeCodingChallenge(index: number): void {
  const container = document.getElementById('coding-challenges-editor') as HTMLElement;
  const items = container.querySelectorAll<HTMLElement>('.cc-item');
  if (items[index]) items[index].remove();
  // Renumber remaining items
  container.querySelectorAll<HTMLElement>('.cc-item').forEach((item, i) => {
    item.dataset['index'] = String(i);
    const lbl = item.querySelector('.cc-label');
    if (lbl) lbl.textContent = `Challenge ${i + 1}`;
    const toggleBtn = item.querySelector<HTMLButtonElement>('.cc-toggle');
    if (toggleBtn) toggleBtn.setAttribute('onclick', `toggleCc(${i})`);
    const removeBtn = item.querySelector<HTMLButtonElement>('.btn-remove');
    if (removeBtn) removeBtn.setAttribute('onclick', `removeCodingChallenge(${i})`);
  });
}

function toggleCc(index: number): void {
  const container = document.getElementById('coding-challenges-editor') as HTMLElement;
  const item = container.querySelectorAll<HTMLElement>('.cc-item')[index];
  if (!item) return;
  const body = item.querySelector<HTMLElement>('.cc-body');
  const btn = item.querySelector<HTMLElement>('.cc-toggle');
  if (!body || !btn) return;
  const open = body.style.display !== 'none';
  body.style.display = open ? 'none' : '';
  btn.textContent = open ? '▸' : '▾';
}

async function setCcDescTab(index: number, tab: 'write' | 'preview'): Promise<void> {
  const ta  = document.getElementById(`cc-desc-${index}`) as HTMLTextAreaElement | null;
  const pre = document.getElementById(`cc-desc-preview-${index}`) as HTMLElement | null;
  const wb  = document.getElementById(`cc-desc-write-${index}`) as HTMLElement | null;
  const pb  = document.getElementById(`cc-desc-prev-${index}`) as HTMLElement | null;
  if (!ta || !pre || !wb || !pb) return;

  if (tab === 'preview') {
    pre.innerHTML = await renderMd(ta.value || '*Nothing to preview yet.*');
    ta.style.display  = 'none';
    pre.style.display = 'block';
    wb.classList.remove('active');
    pb.classList.add('active');
  } else {
    ta.style.display  = '';
    pre.style.display = 'none';
    wb.classList.add('active');
    pb.classList.remove('active');
    ta.focus();
  }
}

function getCodingChallenges(): CodingChallengeItem[] {
  const container = document.getElementById('coding-challenges-editor') as HTMLElement;
  return Array.from(container.querySelectorAll<HTMLElement>('.cc-item')).map((item, i) => ({
    id: item.dataset['id'] ? Number(item.dataset['id']) : undefined,
    title: (item.querySelector<HTMLInputElement>('.cc-title')!).value.trim(),
    description: (item.querySelector<HTMLTextAreaElement>('.cc-desc')!).value,
    starter_code: (item.querySelector<HTMLTextAreaElement>('.cc-starter')!).value,
    language: (item.querySelector<HTMLSelectElement>('.cc-lang')!).value,
    position: i,
  }));
}

// ─── Questions editor ─────────────────────────────────────────────────────────

function renderQuestionsEditor(items: QuestionItem[]): void {
  const container = document.getElementById('questions-editor') as HTMLElement;
  if (!items.length) { container.innerHTML = ''; return; }
  container.innerHTML = items.map((q, i) => buildQHtml(q, i)).join('');
}

function buildQHtml(q: Partial<QuestionItem>, index: number): string {
  return `
    <div class="question-editor-item" data-index="${index}" ${q.id ? `data-id="${q.id}"` : ''}>
      <textarea class="q-text" rows="2" placeholder="e.g. What is the time complexity of your solution?">${esc(q.text ?? '')}</textarea>
      <button type="button" class="btn-remove" onclick="removeInterviewQuestion(${index})">×</button>
    </div>
  `;
}

function addInterviewQuestion(): void {
  const container = document.getElementById('questions-editor') as HTMLElement;
  const index = container.querySelectorAll('.question-editor-item').length;
  const div = document.createElement('div');
  div.innerHTML = buildQHtml({}, index);
  container.appendChild(div.firstElementChild!);
}

function removeInterviewQuestion(index: number): void {
  const container = document.getElementById('questions-editor') as HTMLElement;
  const items = container.querySelectorAll<HTMLElement>('.question-editor-item');
  if (items[index]) items[index].remove();
  container.querySelectorAll<HTMLElement>('.question-editor-item').forEach((item, i) => {
    item.dataset['index'] = String(i);
    const removeBtn = item.querySelector<HTMLButtonElement>('.btn-remove');
    if (removeBtn) removeBtn.setAttribute('onclick', `removeInterviewQuestion(${i})`);
  });
}

function getInterviewQuestions(): QuestionItem[] {
  const container = document.getElementById('questions-editor') as HTMLElement;
  return Array.from(container.querySelectorAll<HTMLElement>('.question-editor-item')).map((item, i) => ({
    id: item.dataset['id'] ? Number(item.dataset['id']) : undefined,
    text: (item.querySelector<HTMLTextAreaElement>('.q-text')!).value.trim(),
    position: i,
  })).filter(q => q.text);
}

function quickLink(challengeId: number): void {
  showPage('links');
  openLinkModal(challengeId);
}

// ─── Links ────────────────────────────────────────────────────────────────────

async function loadLinks(): Promise<void> {
  try {
    renderLinks((await api<InterviewLink[]>('GET', '/api/admin/links')) ?? []);
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
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            ${l.submitted_at || l.first_opened_at ? `<button class="btn btn-ghost btn-sm" onclick="viewSubmission(${l.id},'${esc(l.candidate_name || 'Candidate')}')">View</button>` : ''}
            <button class="btn btn-ghost btn-sm" onclick="cloneLink(${l.challenge_id},'${esc(l.challenge_title ?? '')}')">Clone</button>
            <button class="btn btn-danger btn-sm" onclick="deleteLink(${l.id})">×</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function openLinkModal(preselect?: number, title?: string): void {
  const sel = document.getElementById('l-challenge') as HTMLSelectElement;
  sel.innerHTML = challenges.map(c =>
    `<option value="${c.id}" ${c.id === preselect ? 'selected' : ''}>${esc(c.title)}</option>`
  ).join('');
  if (!challenges.length) sel.innerHTML = '<option>No interviews — create one first</option>';
  (document.getElementById('l-name') as HTMLInputElement).value = '';
  (document.getElementById('l-email') as HTMLInputElement).value = '';
  const tokenEl = document.getElementById('link-token') as HTMLElement;
  tokenEl.style.display = 'none'; tokenEl.textContent = '';
  const la = document.getElementById('link-actions');
  if (la) la.style.display = 'none';
  (document.getElementById('link-modal-title') as HTMLElement).textContent =
    title ?? 'Generate Interview Link';
  openModal('link-modal');
  setTimeout(() => (document.getElementById('l-name') as HTMLInputElement).focus(), 50);
}

function cloneLink(challengeId: number, challengeTitle: string): void {
  if (!challenges.length) loadChallenges().then(() => openLinkModal(challengeId, `Clone — ${challengeTitle}`));
  else openLinkModal(challengeId, `Clone — ${challengeTitle}`);
}

async function generateLink(): Promise<void> {
  const challenge_id = +(document.getElementById('l-challenge') as HTMLSelectElement).value;
  const candidate_name = (document.getElementById('l-name') as HTMLInputElement).value.trim();
  const candidate_email = (document.getElementById('l-email') as HTMLInputElement).value.trim();
  if (!challenge_id) { toast('Select an interview', 'err'); return; }
  try {
    const data = await api<{ id: number; token: string }>('POST', '/api/admin/links',
      { challenge_id, candidate_name, candidate_email });
    if (!data) return;
    const url = `${location.origin}/interview/${data.token}`;
    const tokenEl = document.getElementById('link-token') as HTMLElement;
    tokenEl.textContent = url; tokenEl.style.display = 'block';
    const la = document.getElementById('link-actions');
    if (la) la.style.display = 'flex';
    generatedLinkUrl = url;
    toast('Link generated!');
    loadLinks();
  } catch (e) { toast((e as Error).message, 'err'); }
}

function copyGeneratedLink(): void { if (generatedLinkUrl) copyText(generatedLinkUrl); }

async function deleteLink(id: number): Promise<void> {
  if (!confirm('Delete this interview link?')) return;
  try { await api('DELETE', `/api/admin/links/${id}`); toast('Link deleted'); loadLinks(); }
  catch (e) { toast((e as Error).message, 'err'); }
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
        <td><button class="btn btn-ghost btn-sm" onclick="viewSubmission(${l.id},'${esc(l.candidate_name || 'Candidate')}')">View →</button></td>
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

    const { link, saves, codingChallenges, questions } = data;
    const cloneBtn = document.getElementById('detail-clone-btn') as HTMLButtonElement;
    cloneBtn.onclick = () => cloneLink(link.challenge_id!, esc(link.challenge_title ?? ''));

    (document.getElementById('submission-meta') as HTMLElement).innerHTML = `
      <div class="meta-item"><div class="label">Candidate</div><div class="value">${esc(link.candidate_name || '—')}</div></div>
      <div class="meta-item"><div class="label">Email</div><div class="value">${esc(link.candidate_email || '—')}</div></div>
      <div class="meta-item"><div class="label">Interview</div><div class="value">${esc(link.challenge_title)}</div></div>
      <div class="meta-item"><div class="label">Time limit</div><div class="value">${link.time_limit_minutes ? `${link.time_limit_minutes} min` : 'None'}</div></div>
      <div class="meta-item"><div class="label">Opened</div><div class="value">${fmtDate(link.first_opened_at)}</div></div>
      <div class="meta-item"><div class="label">Submitted</div><div class="value">${link.submitted_at ? fmtDate(link.submitted_at) : 'Not yet'}</div></div>
      <div class="meta-item"><div class="label">Total saves</div><div class="value">${saves.length}</div></div>
    `;

    // Render answers block
    const bestSave = saves.find(s => s.is_final) ?? saves[0];
    renderAnswersBlock(questions, bestSave);

    // Render per-challenge code viewers
    renderCodeViewers(codingChallenges, bestSave);

    // Render save history
    const savesList = document.getElementById('saves-list') as HTMLElement;
    if (!saves.length) {
      savesList.innerHTML = '<p style="color:var(--text-muted);font-size:13px">No saves recorded</p>';
    } else {
      savesList.innerHTML = saves.map((s, i) => `
        <div class="save-item ${s.is_final ? 'final' : ''}" onclick="selectSave(${i})">
          <div>
            <div style="font-size:13px;font-weight:${s.is_final ? 700 : 400}">${s.is_final ? '✅ Final submission' : `Auto-save #${saves.length - i}`}</div>
            <div class="save-time">${fmtDate(s.saved_at)}</div>
          </div>
        </div>
      `).join('');
      // Store saves for selection
      (window as unknown as { _saves: Save[]; _codingChallenges: CodingChallengeItem[]; _questions: QuestionItem[] })._saves = saves;
      (window as unknown as { _saves: Save[]; _codingChallenges: CodingChallengeItem[]; _questions: QuestionItem[] })._codingChallenges = codingChallenges;
      (window as unknown as { _saves: Save[]; _codingChallenges: CodingChallengeItem[]; _questions: QuestionItem[] })._questions = questions;
    }
  } catch (e) { toast((e as Error).message, 'err'); }
}

function selectSave(index: number): void {
  const w = window as unknown as { _saves: Save[]; _codingChallenges: CodingChallengeItem[]; _questions: QuestionItem[] };
  const save = w._saves[index];
  if (!save) return;
  document.querySelectorAll('.save-item').forEach((el, i) => el.classList.toggle('active', i === index));
  renderCodeViewers(w._codingChallenges, save);
  renderAnswersBlock(w._questions, save);
}

function renderCodeViewers(ccs: CodingChallengeItem[], save: Save | undefined): void {
  const container = document.getElementById('code-viewers') as HTMLElement;
  if (!ccs.length) { container.innerHTML = ''; return; }

  // Update module-level state so selectCodeViewerTab / copyCodeViewer stay in sync
  _codeViewerCcs = ccs;
  _codeViewerCodesMap = {};

  let codesMap: Record<number, string> = {};
  if (save) {
    try {
      codesMap = JSON.parse(save.codes || '{}') as Record<number, string>;
      _codeViewerCodesMap = codesMap;
    } catch { /* noop */ }
  }

  // Build tabs
  const firstId = (ccs[0] as CodingChallengeItem & { id?: number }).id ?? 0;
  container.innerHTML = `
    <div class="tab-bar" id="code-viewer-tabs" style="margin-bottom:12px">
      ${ccs.map((cc, i) => `
        <button class="tab-btn ${i === 0 ? 'active' : ''}"
          onclick="selectCodeViewerTab(${i})">${esc(cc.title || `Challenge ${i + 1}`)}</button>
      `).join('')}
    </div>
    ${ccs.map((cc, i) => {
      const id = (cc as CodingChallengeItem & { id?: number }).id ?? i;
      const code = codesMap[id] ?? '';
      return `
        <div class="code-viewer-panel ${i === 0 ? '' : 'hidden'}" data-viewer-index="${i}">
          <div class="code-preview">
            <div class="code-preview-header">
              <span>${esc(cc.title || `Challenge ${i + 1}`)} · <span class="lang-badge">${esc(cc.language)}</span></span>
              <button class="btn btn-ghost btn-sm" onclick="copyCodeViewer(${i})">Copy</button>
            </div>
            <div id="code-viewer-editor-${i}" style="height:420px"></div>
          </div>
        </div>
      `;
    }).join('')}
  `;

  // Render first editor
  renderCodeViewerEditor(0, ccs[0], codesMap[(ccs[0] as CodingChallengeItem & { id?: number }).id ?? 0] ?? '');
}

let _codeViewerCcs: CodingChallengeItem[] = [];
let _codeViewerCodesMap: Record<number, string> = {};

function selectCodeViewerTab(index: number): void {
  document.querySelectorAll('.code-viewer-panel').forEach((el, i) =>
    el.classList.toggle('hidden', i !== index)
  );
  document.querySelectorAll('#code-viewer-tabs .tab-btn').forEach((el, i) =>
    el.classList.toggle('active', i === index)
  );
  renderCodeViewerEditor(index, _codeViewerCcs[index], _codeViewerCodesMap[(_codeViewerCcs[index] as CodingChallengeItem & { id?: number }).id ?? index] ?? '');
}

function renderCodeViewerEditor(index: number, cc: CodingChallengeItem | undefined, code: string): void {
  if (!cc) return;
  const containerId = `code-viewer-editor-${index}`;
  if (previewEditors.has(index)) {
    const e = previewEditors.get(index)!;
    e.setValue(code);
    const model = e.getModel();
    if (model) monaco.editor.setModelLanguage(model, cc.language || 'javascript');
    return;
  }
  require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.47.0/min/vs' } });
  require(['vs/editor/editor.main'], () => {
    const e = monaco.editor.create(document.getElementById(containerId) as HTMLElement, {
      value: code,
      language: cc.language || 'javascript',
      theme: 'vs-dark',
      readOnly: true,
      minimap: { enabled: false },
      fontSize: 13,
      lineNumbers: 'on',
      scrollBeyondLastLine: false,
      automaticLayout: true,
    });
    previewEditors.set(index, e);
  });
}

function copyCodeViewer(index: number): void {
  const w = window as unknown as { _codingChallenges: CodingChallengeItem[] };
  const cc = (w._codingChallenges ?? [])[index] as (CodingChallengeItem & { id?: number }) | undefined;
  if (!cc) return;
  const code = _codeViewerCodesMap[cc.id ?? index] ?? '';
  copyText(code);
}

function renderAnswersBlock(questions: QuestionItem[], save: Save | undefined): void {
  const container = document.getElementById('answers-block-container') as HTMLElement;
  if (!questions.length) { container.innerHTML = ''; return; }
  let answersMap: Record<number, string> = {};
  if (save) {
    try { answersMap = JSON.parse(save.answers || '{}') as Record<number, string>; } catch { /* noop */ }
  }
  container.innerHTML = `
    <div class="answers-block">
      <h3>Candidate answers</h3>
      ${questions.map((q, i) => {
        const answer = answersMap[(q as QuestionItem & { id: number }).id]?.trim() ?? '';
        return `
          <div class="answer-item">
            <div class="answer-q"><span class="q-num">${i + 1}</span>${esc(q.text)}</div>
            <div class="answer-text ${answer ? '' : 'empty'}">${answer ? esc(answer) : 'No answer provided'}</div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// ─── Markdown helper ──────────────────────────────────────────────────────────

async function renderMd(src: string): Promise<string> {
  return Promise.resolve(marked.parse(src));
}

// ─── Modal helpers ────────────────────────────────────────────────────────────

function openModal(id: string): void { (document.getElementById(id) as HTMLElement).classList.add('open'); }
function closeModal(id: string): void { (document.getElementById(id) as HTMLElement).classList.remove('open'); }

document.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Escape') document.querySelectorAll('.modal-backdrop.open').forEach(m => m.classList.remove('open'));
});
document.querySelectorAll<HTMLElement>('.modal-backdrop').forEach(bd => {
  bd.addEventListener('click', e => { if (e.target === bd) bd.classList.remove('open'); });
});

// ─── Utilities ────────────────────────────────────────────────────────────────

function esc(str: string | null | undefined): string {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso.endsWith('Z') ? iso : iso + 'Z');
  return d.toLocaleString(undefined, { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
}
function copyText(text: string): void {
  navigator.clipboard.writeText(text).then(() => toast('Copied!')).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta); toast('Copied!');
  });
}
function toast(msg: string, type: 'ok' | 'err' = 'ok'): void {
  const el = document.getElementById('toast') as HTMLElement;
  el.textContent = msg; el.className = 'show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = ''; }, 3000);
}

// ─── Expose window functions ──────────────────────────────────────────────────

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
    selectSave: typeof selectSave;
    selectCodeViewerTab: typeof selectCodeViewerTab;
    copyCodeViewer: typeof copyCodeViewer;
    openModal: typeof openModal;
    closeModal: typeof closeModal;
    loadSubmissions: typeof loadSubmissions;
    copyText: typeof copyText;
    showPage: typeof showPage;
    cloneLink: typeof cloneLink;
    addCodingChallenge: typeof addCodingChallenge;
    removeCodingChallenge: typeof removeCodingChallenge;
    toggleCc: typeof toggleCc;
    setCcDescTab: typeof setCcDescTab;
    addInterviewQuestion: typeof addInterviewQuestion;
    removeInterviewQuestion: typeof removeInterviewQuestion;
    renderMd: typeof renderMd;
  }
}
Object.assign(window, {
  doLogin, openChallengeModal, editChallenge, saveChallenge, deleteChallenge,
  quickLink, openLinkModal, generateLink, copyGeneratedLink, deleteLink,
  viewSubmission, selectSave, selectCodeViewerTab, copyCodeViewer,
  openModal, closeModal, loadSubmissions, copyText, showPage, cloneLink,
  addCodingChallenge, removeCodingChallenge, toggleCc, setCcDescTab,
  addInterviewQuestion, removeInterviewQuestion, renderMd,
});

// ─── Boot ─────────────────────────────────────────────────────────────────────

const saved = localStorage.getItem('adminKey');
if (saved) {
  (document.getElementById('admin-key-input') as HTMLInputElement).value = saved;
  ADMIN_KEY = saved;
  initApp();
}
