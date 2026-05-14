// Monaco + AMD globals declared in src/globals.d.ts
export {};

// ─── Types ────────────────────────────────────────────────────────────────────

interface CodingChallengeData {
  id: number;
  title: string;
  description: string; // Markdown
  starterCode: string;
  language: string;
  position: number;
}

interface QuestionData {
  id: number;
  text: string; // plain text
  position: number;
}

interface InterviewData {
  title: string;
  submitted: boolean;
  timeLimitMinutes: number | null;
  remainingSeconds: number | null;
  needsStart: boolean;
  codingChallenges: CodingChallengeData[];
  questions: QuestionData[];
  savedAnswers: Record<number, string>;
}

type SaveStatus = 'saving' | 'saved' | '';

// ─── State ────────────────────────────────────────────────────────────────────

const TOKEN = location.pathname.split('/').pop() ?? '';

let theEditor: ReturnType<typeof monaco.editor.create> | null = null;
const editorModels = new Map<number, ReturnType<typeof monaco.editor.createModel>>();
let currentCcId: number | null = null;
let currentView: 'coding' | 'questions' = 'coding';

let codingChallenges: CodingChallengeData[] = [];
let questions: QuestionData[] = [];

let remainingSecondsAtLoad: number | null = null;
let startTime = 0;
let timerInterval: ReturnType<typeof setInterval> | null = null;
let autoSaveInterval: ReturnType<typeof setInterval> | null = null;
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let isSubmitted = false;

let warnTimer: ReturnType<typeof setTimeout>;
let toastTimer: ReturnType<typeof setTimeout>;

const WARN_THRESHOLD = 5 * 60;
const DANGER_THRESHOLD = 60;

const langMap: Record<string, string> = {
  javascript: 'javascript', typescript: 'typescript', python: 'python',
  java: 'java', cpp: 'cpp', go: 'go', rust: 'rust',
};

// ─── Boot ─────────────────────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', () => {
  loadInterview();
  blockPaste();
});

async function loadInterview(): Promise<void> {
  try {
    const res = await fetch(`/api/interview/${TOKEN}`);
    if (!res.ok) throw new Error();
    const data: InterviewData = await res.json();

    if (data.submitted) { showSubmittedOverlay(); return; }

    document.title = data.title + ' — Red Hat Interview';
    (document.getElementById('loading-state') as HTMLElement).style.display = 'none';

    if (data.needsStart) { showPrestartOverlay(data); return; }

    await launchInterview(data);
  } catch {
    (document.getElementById('loading-state') as HTMLElement).style.display = 'none';
    (document.getElementById('error-state') as HTMLElement).style.display = 'flex';
  }
}

// ─── Pre-start overlay ────────────────────────────────────────────────────────

function showPrestartOverlay(data: InterviewData): void {
  const overlay = document.getElementById('prestart-overlay') as HTMLElement;
  (document.getElementById('prestart-title') as HTMLElement).textContent = data.title;
  (document.getElementById('prestart-meta') as HTMLElement).innerHTML =
    `⏱ <span>${data.timeLimitMinutes} minute${data.timeLimitMinutes === 1 ? '' : 's'} time limit</span>`;
  overlay.style.display = 'flex';

  (document.getElementById('prestart-btn') as HTMLButtonElement).onclick = async () => {
    const btn = document.getElementById('prestart-btn') as HTMLButtonElement;
    btn.disabled = true;
    btn.textContent = 'Starting…';
    try {
      const startRes = await fetch(`/api/interview/${TOKEN}/start`, { method: 'POST' });
      if (!startRes.ok) throw new Error();
      const { remainingSeconds } = await startRes.json() as { remainingSeconds: number };
      overlay.style.display = 'none';
      await launchInterview({ ...data, remainingSeconds, needsStart: false });
    } catch {
      btn.disabled = false;
      btn.textContent = 'Start challenge →';
      toast('Could not start — please try again', 'err');
    }
  };
}

// ─── Launch ───────────────────────────────────────────────────────────────────

async function launchInterview(data: InterviewData): Promise<void> {
  codingChallenges = data.codingChallenges;
  questions = data.questions;

  (document.getElementById('interview-app') as HTMLElement).style.display = '';
  (document.getElementById('interview-title') as HTMLElement).textContent = data.title;

  // Build challenge navigation
  renderNav();

  // Show questions tab if no coding challenges
  if (codingChallenges.length === 0) {
    showQuestionsView(data.savedAnswers);
  } else {
    await showCodingChallenge(codingChallenges[0], data.savedAnswers);
    // Restore question answers
    questions.forEach(q => {
      const el = document.getElementById(`q-answer-${q.id}`) as HTMLTextAreaElement | null;
      if (el && data.savedAnswers[q.id]) el.value = data.savedAnswers[q.id];
    });
  }

  remainingSecondsAtLoad = data.remainingSeconds;
  startTimer();
  startAutoSave();

  if (data.remainingSeconds !== null && data.remainingSeconds <= 0) {
    clearInterval(autoSaveInterval!);
    clearInterval(timerInterval!);
    setTimeout(() => forceSubmit(), 800);
  }
}

// ─── Navigation ───────────────────────────────────────────────────────────────

function renderNav(): void {
  const nav = document.getElementById('challenge-nav') as HTMLElement;
  const parts: string[] = [];

  codingChallenges.forEach((cc, i) => {
    parts.push(`<button class="nav-tab ${i === 0 ? 'active' : ''}" data-cc-id="${cc.id}" onclick="selectCodingChallenge(${cc.id})">
      <span class="nav-num">${i + 1}</span>${escHtml(cc.title || `Challenge ${i + 1}`)}
    </button>`);
  });

  if (questions.length > 0) {
    parts.push(`<button class="nav-tab" data-view="questions" onclick="selectQuestionsView()">
      Questions <span class="nav-badge">${questions.length}</span>
    </button>`);
  }

  nav.innerHTML = parts.join('');
  nav.style.display = parts.length > 1 ? '' : 'none';
}

function setActiveNavTab(selector: string): void {
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  const el = document.querySelector(selector);
  if (el) el.classList.add('active');
}

// ─── Coding challenge view ────────────────────────────────────────────────────

async function showCodingChallenge(cc: CodingChallengeData, savedAnswers?: Record<number, string>): Promise<void> {
  currentView = 'coding';
  currentCcId = cc.id;

  // Ensure run button is visible
  (document.getElementById('run-btn') as HTMLElement).style.display = '';

  setActiveNavTab(`[data-cc-id="${cc.id}"]`);

  // Update description
  (document.getElementById('problem-description') as HTMLElement).innerHTML =
    await Promise.resolve(marked.parse(cc.description || ''));

  // Show questions panel below description if questions exist
  renderQuestionsInPanel(savedAnswers);

  // Show editor panel
  const editorPanel = document.getElementById('editor-panel') as HTMLElement;
  editorPanel.style.display = '';
  (document.getElementById('lang-badge') as HTMLElement).textContent =
    cc.language.toUpperCase().slice(0, 4);

  // Init Monaco if needed, then swap to this challenge's model
  if (!theEditor) {
    await initMonaco(cc);
  } else {
    swapModel(cc);
  }
}

function selectCodingChallenge(ccId: number): void {
  if (isSubmitted) return;
  const cc = codingChallenges.find(c => c.id === ccId);
  if (cc) showCodingChallenge(cc);
}

// ─── Questions view ───────────────────────────────────────────────────────────

function showQuestionsView(savedAnswers?: Record<number, string>): void {
  currentView = 'questions';
  setActiveNavTab('[data-view="questions"]');

  (document.getElementById('problem-description') as HTMLElement).innerHTML = '';
  renderQuestionsInPanel(savedAnswers);

  // Hide run button when on questions view
  (document.getElementById('run-btn') as HTMLElement).style.display = 'none';

  // Hide editor panel when only showing questions
  if (codingChallenges.length === 0) {
    (document.getElementById('editor-panel') as HTMLElement).style.display = 'none';
    (document.getElementById('interview-layout') as HTMLElement).classList.add('questions-only');
  }
}

function selectQuestionsView(): void {
  if (isSubmitted) return;
  showQuestionsView();
}

function renderQuestionsInPanel(savedAnswers?: Record<number, string>): void {
  const section = document.getElementById('questions-section') as HTMLElement;
  if (!questions.length) { section.innerHTML = ''; return; }

  section.innerHTML = `
    <div class="questions-section">
      <h3>Questions</h3>
      ${questions.map((q, i) => `
        <div class="question-item">
          <div class="question-label"><span class="q-num">${i + 1}</span>${escHtml(q.text)}</div>
          <textarea class="question-textarea" id="q-answer-${q.id}"
            placeholder="Type your answer here…">${escHtml(savedAnswers?.[q.id] ?? '')}</textarea>
        </div>
      `).join('')}
    </div>
  `;

  section.querySelectorAll<HTMLTextAreaElement>('.question-textarea').forEach(ta => {
    ta.addEventListener('input', scheduleAutoSave);
  });
}

// ─── Monaco Editor ────────────────────────────────────────────────────────────

async function initMonaco(firstChallenge: CodingChallengeData): Promise<void> {
  await new Promise<void>(resolve => {
    require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.47.0/min/vs' } });
    require(['vs/editor/editor.main'], () => {
      monaco.editor.defineTheme('rh-dark', {
        base: 'vs-dark', inherit: true, rules: [],
        colors: {
          'editor.background': '#0f0f0f',
          'editor.lineHighlightBackground': '#1a1a1a',
          'editorLineNumber.foreground': '#404040',
          'editorLineNumber.activeForeground': '#8a8d90',
          'editor.selectionBackground': '#ee000033',
        },
      });

      // Create one model per coding challenge upfront
      codingChallenges.forEach(cc => {
        if (!editorModels.has(cc.id)) {
          editorModels.set(cc.id, monaco.editor.createModel(
            cc.starterCode || '',
            langMap[cc.language] ?? 'plaintext'
          ));
        }
      });

      theEditor = monaco.editor.create(
        document.getElementById('editor-container') as HTMLElement,
        {
          model: editorModels.get(firstChallenge.id)!,
          theme: 'rh-dark',
          fontSize: 14,
          fontFamily: "'Red Hat Mono', 'JetBrains Mono', monospace",
          fontLigatures: true,
          lineNumbers: 'on',
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          automaticLayout: true,
          padding: { top: 16, bottom: 16 },
          wordWrap: 'on',
          tabSize: 2,
        }
      );

      theEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyV, flashPasteWarning);
      theEditor.getDomNode()?.addEventListener('paste', (e: Event) => {
        e.preventDefault(); e.stopPropagation(); flashPasteWarning();
      }, true);
      theEditor.onDidChangeModelContent(scheduleAutoSave);

      resolve();
    });
  });
}

function swapModel(cc: CodingChallengeData): void {
  if (!theEditor) return;
  if (!editorModels.has(cc.id)) {
    editorModels.set(cc.id, monaco.editor.createModel(
      cc.starterCode || '',
      langMap[cc.language] ?? 'plaintext'
    ));
  }
  theEditor.setModel(editorModels.get(cc.id)!);
  theEditor.layout();
}

// ─── Anti-paste ───────────────────────────────────────────────────────────────

function blockPaste(): void {
  document.addEventListener('paste', (e: ClipboardEvent) => {
    e.preventDefault(); e.stopPropagation(); flashPasteWarning();
  }, true);

  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
      e.preventDefault(); e.stopPropagation(); flashPasteWarning();
    }
  }, true);

  document.addEventListener('contextmenu', (e: MouseEvent) => e.preventDefault(), true);
}

function flashPasteWarning(): void {
  const el = document.getElementById('paste-warning') as HTMLElement;
  el.classList.add('show');
  clearTimeout(warnTimer);
  warnTimer = setTimeout(() => el.classList.remove('show'), 2000);
}

// ─── Data collection ──────────────────────────────────────────────────────────

function getCodes(): Record<number, string> {
  const result: Record<number, string> = {};
  editorModels.forEach((model, id) => { result[id] = model.getValue(); });
  return result;
}

function getAnswers(): Record<number, string> {
  const result: Record<number, string> = {};
  questions.forEach(q => {
    const el = document.getElementById(`q-answer-${q.id}`) as HTMLTextAreaElement | null;
    if (el) result[q.id] = el.value;
  });
  return result;
}

// ─── Auto-save ────────────────────────────────────────────────────────────────

function scheduleAutoSave(): void {
  if (saveTimeout) clearTimeout(saveTimeout);
  setStatus('saving');
  saveTimeout = setTimeout(autoSave, 4000);
}

function startAutoSave(): void {
  autoSaveInterval = setInterval(autoSave, 30_000);
}

async function autoSave(): Promise<void> {
  if (isSubmitted) return;
  try {
    await fetch(`/api/interview/${TOKEN}/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codes: getCodes(), answers: getAnswers() }),
    });
    setStatus('saved');
  } catch { setStatus(''); }
}

function setStatus(s: SaveStatus): void {
  const el = document.getElementById('autosave-status') as HTMLElement;
  el.className = 'autosave-status ' + s;
  if (s === 'saving') el.textContent = '⏳ Saving…';
  else if (s === 'saved') el.textContent = '✓ Saved';
  else el.textContent = 'Auto-save on';
}

// ─── Submit ───────────────────────────────────────────────────────────────────

function submitCode(): void {
  (document.getElementById('confirm-modal') as HTMLElement).classList.add('open');
}
function closeConfirm(): void {
  (document.getElementById('confirm-modal') as HTMLElement).classList.remove('open');
}

async function confirmSubmit(): Promise<void> {
  if (isSubmitted) return;
  closeConfirm();
  await doSubmit(false);
}

async function forceSubmit(): Promise<void> {
  if (isSubmitted) return;
  await doSubmit(true);
}

async function doSubmit(timedOut: boolean): Promise<void> {
  try {
    const res = await fetch(`/api/interview/${TOKEN}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codes: getCodes(), answers: getAnswers() }),
    });
    if (res.ok) {
      isSubmitted = true;
      if (autoSaveInterval) clearInterval(autoSaveInterval);
      if (timerInterval) clearInterval(timerInterval);
      editorModels.forEach(m => m.dispose());
      theEditor?.dispose();
      if (timedOut) showTimedOutOverlay(); else showSubmittedOverlay();
    } else {
      const err = await res.json() as { error: string };
      toast(err.error || 'Submit failed', 'err');
    }
  } catch {
    if (timedOut) setTimeout(() => forceSubmit(), 2000);
    else toast('Network error — please try again', 'err');
  }
}

function showSubmittedOverlay(): void {
  (document.getElementById('loading-state') as HTMLElement).style.display = 'none';
  (document.getElementById('interview-app') as HTMLElement).style.display = '';
  (document.getElementById('submitted-overlay') as HTMLElement).classList.add('show');
  (document.getElementById('submit-btn') as HTMLButtonElement).disabled = true;
}

function showTimedOutOverlay(): void {
  const box = (document.getElementById('submitted-overlay') as HTMLElement)
    .querySelector('.submitted-box') as HTMLElement;
  box.innerHTML = `
    <div class="icon">⏱️</div>
    <h2>Time's up!</h2>
    <p>Your solution has been automatically submitted.</p>
    <p style="margin-top:12px;font-size:12px;color:var(--text-muted)">You may close this tab.</p>
  `;
  showSubmittedOverlay();
}

// ─── Timer ────────────────────────────────────────────────────────────────────

function startTimer(): void {
  startTime = Date.now();
  const timerEl = document.getElementById('timer') as HTMLElement;
  const labelEl = document.getElementById('timer-label') as HTMLElement;
  const isTimed = remainingSecondsAtLoad !== null;

  if (isTimed) { timerEl.classList.add('timed'); labelEl.style.display = ''; }

  timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const pad = (n: number) => String(n).padStart(2, '0');

    if (isTimed) {
      const rem = (remainingSecondsAtLoad as number) - elapsed;
      if (rem <= 0) {
        clearInterval(timerInterval!);
        timerEl.textContent = '00:00';
        timerEl.className = 'timer timed danger';
        forceSubmit();
        return;
      }
      const h = Math.floor(rem / 3600), m = Math.floor((rem % 3600) / 60), s = rem % 60;
      timerEl.textContent = h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
      timerEl.className = 'timer timed' + (rem <= DANGER_THRESHOLD ? ' danger' : rem <= WARN_THRESHOLD ? ' warning' : '');
    } else {
      const h = Math.floor(elapsed / 3600), m = Math.floor((elapsed % 3600) / 60), s = elapsed % 60;
      timerEl.textContent = h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
    }
  }, 1000);
}

// ─── Run code (Piston API) ────────────────────────────────────────────────────

const PISTON_API = 'https://emkc.org/api/v2/piston/execute';

const pistonLangMap: Record<string, { language: string; version: string }> = {
  javascript: { language: 'javascript', version: '*' },
  typescript: { language: 'typescript', version: '*' },
  python:     { language: 'python3',    version: '*' },
  java:       { language: 'java',       version: '*' },
  cpp:        { language: 'c++',        version: '*' },
  go:         { language: 'go',         version: '*' },
  rust:       { language: 'rust',       version: '*' },
};

let runCount = 0;

async function runCode(): Promise<void> {
  if (isSubmitted) return;

  const cc = codingChallenges.find(c => c.id === currentCcId);
  if (!cc) { toast('Select a coding challenge to run', 'err'); return; }

  const pistonLang = pistonLangMap[cc.language];
  if (!pistonLang) { toast(`Running ${cc.language} is not supported`, 'err'); return; }

  const code = theEditor ? theEditor.getValue() : '';
  if (!code.trim()) { toast('Write some code first', 'err'); return; }

  setRunning(true);
  showOutputPanel();
  setOutputRunning();

  try {
    const res = await fetch(PISTON_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: pistonLang.language,
        version: pistonLang.version,
        files: [{ content: code }],
      }),
    });

    if (!res.ok) throw new Error(`Code runner returned ${res.status}`);
    const data = await res.json() as {
      run: { stdout: string; stderr: string; output: string; code: number };
      compile?: { stdout: string; stderr: string; code: number };
    };

    runCount++;
    updateRunCountBadge();
    displayRunOutput(data);
  } catch (e) {
    setOutputError((e as Error).message);
  } finally {
    setRunning(false);
  }
}

function setRunning(running: boolean): void {
  const btn = document.getElementById('run-btn') as HTMLButtonElement;
  btn.classList.toggle('running', running);
  btn.textContent = running ? '⏳ Running…' : '▶ Run';
  btn.disabled = running;
}

function showOutputPanel(): void {
  const panel = document.getElementById('run-output-panel') as HTMLElement;
  panel.style.display = '';
}

function clearOutput(): void {
  (document.getElementById('run-output-panel') as HTMLElement).style.display = 'none';
  (document.getElementById('run-output') as HTMLElement).innerHTML = '';
}

function updateRunCountBadge(): void {
  const badge = document.getElementById('run-count-badge') as HTMLElement;
  badge.textContent = `Run ${runCount}`;
  badge.classList.add('show');
}

function setOutputRunning(): void {
  (document.getElementById('run-output') as HTMLElement).innerHTML =
    '<div class="output-running">Running your code…</div>';
}

function setOutputError(msg: string): void {
  (document.getElementById('run-output') as HTMLElement).innerHTML =
    `<pre class="output-stderr">Error: ${escHtml(msg)}</pre>
     <div class="output-exit err">✗ Could not execute code</div>`;
}

function displayRunOutput(data: {
  run: { stdout: string; stderr: string; code: number };
  compile?: { stdout: string; stderr: string; code: number };
}): void {
  const out = document.getElementById('run-output') as HTMLElement;
  const parts: string[] = [];

  // Show compiler errors/output first (for Java, C++, Rust, TypeScript)
  if (data.compile) {
    if (data.compile.stdout) {
      parts.push(`<pre class="output-stdout">${escHtml(data.compile.stdout)}</pre>`);
    }
    if (data.compile.stderr) {
      parts.push(`<pre class="output-stderr">${escHtml(data.compile.stderr)}</pre>`);
    }
    if (data.compile.code !== 0) {
      out.innerHTML = parts.join('') +
        `<div class="output-exit err">✗ Compilation failed (exit code ${data.compile.code})</div>`;
      return;
    }
  }

  // Runtime output
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
    `<div class="output-exit ${exitOk ? 'ok' : 'err'}">` +
    `${exitOk ? '✓' : '✗'} Process exited with code ${data.run.code}` +
    `</div>`
  );

  out.innerHTML = parts.join('');
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function escHtml(s: string): string {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function toast(msg: string, type: 'ok' | 'err' = 'ok'): void {
  const el = document.getElementById('toast') as HTMLElement;
  el.textContent = msg; el.className = 'show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = ''; }, 3000);
}

window.addEventListener('beforeunload', (e: BeforeUnloadEvent) => {
  if (!isSubmitted && editorModels.size > 0) { e.preventDefault(); e.returnValue = ''; }
});

// ─── Expose onclick handlers ──────────────────────────────────────────────────

declare global {
  interface Window {
    submitCode: typeof submitCode;
    closeConfirm: typeof closeConfirm;
    confirmSubmit: typeof confirmSubmit;
    selectCodingChallenge: typeof selectCodingChallenge;
    selectQuestionsView: typeof selectQuestionsView;
    runCode: typeof runCode;
    clearOutput: typeof clearOutput;
  }
}
Object.assign(window, { submitCode, closeConfirm, confirmSubmit, selectCodingChallenge, selectQuestionsView, runCode, clearOutput });
