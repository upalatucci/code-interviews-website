// Monaco + AMD require globals are declared in src/globals.d.ts
export {};

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChallengeData {
  title: string;
  description: string;
  starterCode: string;
  language: string;
  submitted: boolean;
  candidateName: string;
  questions: string[];
  savedAnswers: Record<number, string>;
  timeLimitMinutes: number | null;
  /** Seconds remaining when the page loaded; null = no limit; negative = already expired */
  remainingSeconds: number | null;
  /** true when a timed challenge hasn't been started yet */
  needsStart: boolean;
}

type SaveStatus = 'saving' | 'saved' | '';

// ─── Globals ──────────────────────────────────────────────────────────────────

const TOKEN = location.pathname.split('/').pop() ?? '';
let editor: ReturnType<typeof monaco.editor.create> | null = null;
let startTime = 0;
let remainingSecondsAtLoad: number | null = null; // null = no limit
let timerInterval: ReturnType<typeof setInterval> | null = null;
let autoSaveInterval: ReturnType<typeof setInterval> | null = null;
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let lastSavedCode = '';
let isSubmitted = false;
let questions: string[] = [];
let warnTimer: ReturnType<typeof setTimeout>;
let toastTimer: ReturnType<typeof setTimeout>;

const langMap: Record<string, string> = {
  javascript: 'javascript', typescript: 'typescript', python: 'python',
  java: 'java', cpp: 'cpp', go: 'go', rust: 'rust',
};

// ─── Boot ─────────────────────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', () => {
  loadChallenge();
  blockPaste();
});

async function loadChallenge(): Promise<void> {
  try {
    const res = await fetch(`/api/interview/${TOKEN}`);
    if (!res.ok) throw new Error('Not found');
    const data: ChallengeData = await res.json();

    if (data.submitted) { showSubmittedOverlay(); return; }

    document.title = data.title + ' — Code Interview';
    (document.getElementById('loading-state') as HTMLElement).style.display = 'none';

    // Timed challenge not yet started → show confirmation dialog
    if (data.needsStart) {
      showPrestartOverlay(data);
      return;
    }

    launchChallenge(data);
  } catch {
    (document.getElementById('loading-state') as HTMLElement).style.display = 'none';
    (document.getElementById('error-state') as HTMLElement).style.display = 'flex';
  }
}

function showPrestartOverlay(data: ChallengeData): void {
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
      launchChallenge({ ...data, remainingSeconds, needsStart: false });
    } catch {
      btn.disabled = false;
      btn.textContent = 'Start challenge →';
      toast('Could not start — please try again', 'err');
    }
  };
}

function launchChallenge(data: ChallengeData): void {
  (document.getElementById('problem-title') as HTMLElement).textContent = data.title;
  (document.getElementById('problem-description') as HTMLElement).innerHTML = marked.parse(data.description);
  (document.getElementById('lang-badge') as HTMLElement).textContent =
    data.language.toUpperCase().slice(0, 4);
  (document.getElementById('interview-app') as HTMLElement).style.display = '';

  questions = data.questions ?? [];
  renderQuestions(questions, data.savedAnswers ?? {});

  // Already expired on load → auto-submit immediately
  if (data.remainingSeconds !== null && data.remainingSeconds <= 0) {
    initEditor(data.starterCode || '', data.language);
    startAutoSave();
    setTimeout(() => forceSubmit(), 800);
    return;
  }

  remainingSecondsAtLoad = data.remainingSeconds;
  initEditor(data.starterCode || '', data.language);
  startTimer();
  startAutoSave();
}

// ─── Monaco Editor ────────────────────────────────────────────────────────────

function initEditor(code: string, language: string): void {
  require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.47.0/min/vs' } });

  require(['vs/editor/editor.main'], () => {
    const monacoLang = langMap[language] ?? 'plaintext';

    monaco.editor.defineTheme('dark-custom', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#0f1117',
        'editor.lineHighlightBackground': '#1a1d27',
        'editorLineNumber.foreground': '#3e4460',
        'editorLineNumber.activeForeground': '#8892a4',
      },
    });

    editor = monaco.editor.create(
      document.getElementById('editor-container') as HTMLElement,
      {
        value: code, language: monacoLang, theme: 'dark-custom',
        fontSize: 14, fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        fontLigatures: true, lineNumbers: 'on', minimap: { enabled: false },
        scrollBeyondLastLine: false, automaticLayout: true,
        padding: { top: 16, bottom: 16 }, wordWrap: 'on', tabSize: 2,
        suggestOnTriggerCharacters: true,
      }
    );

    lastSavedCode = code;

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyV, () => {
      flashPasteWarning();
    });

    editor.getDomNode()?.addEventListener('paste', (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      flashPasteWarning();
    }, true);

    editor.onDidChangeModelContent(() => {
      if (saveTimeout) clearTimeout(saveTimeout);
      setStatus('saving');
      saveTimeout = setTimeout(autoSave, 4000);
    });
  });
}

// ─── Questions ────────────────────────────────────────────────────────────────

function renderQuestions(qs: string[], saved: Record<number, string>): void {
  const section = document.getElementById('questions-section') as HTMLElement;
  if (!qs.length) { section.innerHTML = ''; return; }

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
            placeholder="Type your answer here…"
          >${escHtml(saved[i] ?? '')}</textarea>
        </div>
      `).join('')}
    </div>
  `;

  // Trigger auto-save when any answer changes
  section.querySelectorAll<HTMLTextAreaElement>('.question-textarea').forEach(ta => {
    ta.addEventListener('input', () => {
      if (saveTimeout) clearTimeout(saveTimeout);
      setStatus('saving');
      saveTimeout = setTimeout(autoSave, 4000);
    });
  });
}

function getAnswers(): Record<number, string> {
  const result: Record<number, string> = {};
  questions.forEach((_, i) => {
    const el = document.getElementById(`q-answer-${i}`) as HTMLTextAreaElement | null;
    if (el) result[i] = el.value;
  });
  return result;
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ─── Anti-paste ───────────────────────────────────────────────────────────────

function blockPaste(): void {
  document.addEventListener('paste', (e: ClipboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    flashPasteWarning();
  }, true);

  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
      e.preventDefault();
      e.stopPropagation();
      flashPasteWarning();
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

// ─── Auto-save ────────────────────────────────────────────────────────────────

function startAutoSave(): void {
  autoSaveInterval = setInterval(autoSave, 30_000);
}

async function autoSave(): Promise<void> {
  if (!editor || isSubmitted) return;
  const code = editor.getValue();
  const answers = getAnswers();
  if (code === lastSavedCode) { setStatus('saved'); return; }
  try {
    const res = await fetch(`/api/interview/${TOKEN}/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, answers }),
    });
    if (res.ok) { lastSavedCode = code; setStatus('saved'); }
  } catch {
    setStatus('');
  }
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
  if (!editor || isSubmitted) return;
  const code = editor.getValue();
  const answers = getAnswers();
  closeConfirm();
  try {
    const res = await fetch(`/api/interview/${TOKEN}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, answers }),
    });
    if (res.ok) {
      isSubmitted = true;
      if (autoSaveInterval) clearInterval(autoSaveInterval);
      if (timerInterval) clearInterval(timerInterval);
      editor.updateOptions({ readOnly: true });
      showSubmittedOverlay();
    } else {
      const err = await res.json() as { error: string };
      toast(err.error || 'Submit failed', 'err');
    }
  } catch {
    toast('Network error — please try again', 'err');
  }
}

function showSubmittedOverlay(): void {
  (document.getElementById('loading-state') as HTMLElement).style.display = 'none';
  (document.getElementById('interview-app') as HTMLElement).style.display = '';
  (document.getElementById('submitted-overlay') as HTMLElement).classList.add('show');
  (document.getElementById('submit-btn') as HTMLButtonElement).disabled = true;
}

// ─── Timer ────────────────────────────────────────────────────────────────────

const WARN_THRESHOLD = 5 * 60;  // 5 minutes
const DANGER_THRESHOLD = 60;    // 1 minute

function startTimer(): void {
  startTime = Date.now();
  const timerEl = document.getElementById('timer') as HTMLElement;
  const isTimed = remainingSecondsAtLoad !== null;

  if (isTimed) {
    timerEl.classList.add('timed');
    (document.getElementById('timer-label') as HTMLElement).style.display = '';
  }

  timerInterval = setInterval(() => {
    const elapsedSecs = Math.floor((Date.now() - startTime) / 1000);

    if (isTimed) {
      const remaining = (remainingSecondsAtLoad as number) - elapsedSecs;

      if (remaining <= 0) {
        clearInterval(timerInterval!);
        timerEl.textContent = '00:00';
        timerEl.className = 'timer timed danger';
        forceSubmit();
        return;
      }

      const h = Math.floor(remaining / 3600);
      const m = Math.floor((remaining % 3600) / 60);
      const s = remaining % 60;
      const pad = (n: number) => String(n).padStart(2, '0');
      timerEl.textContent = h > 0
        ? `${pad(h)}:${pad(m)}:${pad(s)}`
        : `${pad(m)}:${pad(s)}`;

      // Apply colour classes based on urgency
      if (remaining <= DANGER_THRESHOLD) {
        timerEl.className = 'timer timed danger';
      } else if (remaining <= WARN_THRESHOLD) {
        timerEl.className = 'timer timed warning';
      } else {
        timerEl.className = 'timer timed';
      }
    } else {
      // Elapsed mode (no time limit)
      const h = Math.floor(elapsedSecs / 3600);
      const m = Math.floor((elapsedSecs % 3600) / 60);
      const s = elapsedSecs % 60;
      const pad = (n: number) => String(n).padStart(2, '0');
      timerEl.textContent = h > 0
        ? `${pad(h)}:${pad(m)}:${pad(s)}`
        : `${pad(m)}:${pad(s)}`;
    }
  }, 1000);
}

/** Auto-submit without the confirm dialog (used when time expires) */
async function forceSubmit(): Promise<void> {
  if (isSubmitted) return;
  const code = editor ? editor.getValue() : '';
  const answers = getAnswers();
  try {
    const res = await fetch(`/api/interview/${TOKEN}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, answers }),
    });
    if (res.ok) {
      isSubmitted = true;
      if (autoSaveInterval) clearInterval(autoSaveInterval);
      if (timerInterval) clearInterval(timerInterval);
      editor?.updateOptions({ readOnly: true });
      showTimedOutOverlay();
    }
  } catch {
    // Retry once after 2 s
    setTimeout(forceSubmit, 2000);
  }
}

function showTimedOutOverlay(): void {
  const overlay = document.getElementById('submitted-overlay') as HTMLElement;
  const box = overlay.querySelector('.submitted-box') as HTMLElement;
  box.innerHTML = `
    <div class="icon">⏱️</div>
    <h2>Time's up!</h2>
    <p>Your solution has been automatically submitted.</p>
    <p style="margin-top:12px;font-size:12px;color:var(--text-muted)">You may close this tab.</p>
  `;
  showSubmittedOverlay();
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function toast(msg: string, type: 'ok' | 'err' = 'ok'): void {
  const el = document.getElementById('toast') as HTMLElement;
  el.textContent = msg;
  el.className = 'show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = ''; }, 3000);
}

// ─── Expose functions called from inline HTML onclick handlers ────────────────
declare global {
  interface Window {
    submitCode: typeof submitCode;
    closeConfirm: typeof closeConfirm;
    confirmSubmit: typeof confirmSubmit;
  }
}
Object.assign(window, { submitCode, closeConfirm, confirmSubmit });

// ─── Prevent accidental navigation ───────────────────────────────────────────
window.addEventListener('beforeunload', (e: BeforeUnloadEvent) => {
  if (!isSubmitted && editor && editor.getValue() !== lastSavedCode) {
    e.preventDefault();
    e.returnValue = '';
  }
});
