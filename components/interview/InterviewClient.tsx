'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import type { editor } from 'monaco-editor';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

// ─── Types ────────────────────────────────────────────────────────────────────

interface CodingChallengeData { id: number; title: string; description: string; starterCode: string; language: string; position: number }
interface QuestionData { id: number; text: string; position: number }
interface InterviewData {
  title: string; submitted: boolean;
  timeLimitMinutes: number | null; remainingSeconds: number | null; needsStart: boolean;
  codingChallenges: CodingChallengeData[]; questions: QuestionData[];
  savedAnswers: Record<number, string>;
}

interface PistonResult { run: { stdout: string; stderr: string; code: number }; compile?: { stdout: string; stderr: string; code: number } }

const PISTON_API = 'https://emkc.org/api/v2/piston/execute';
const PISTON_LANGS: Record<string, { language: string; version: string }> = {
  javascript: { language: 'javascript', version: '*' },
  typescript: { language: 'typescript', version: '*' },
  python:     { language: 'python3',    version: '*' },
  java:       { language: 'java',       version: '*' },
  cpp:        { language: 'c++',        version: '*' },
  go:         { language: 'go',         version: '*' },
  rust:       { language: 'rust',       version: '*' },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function InterviewClient({ token }: { token: string }) {
  const [phase, setPhase] = useState<'loading' | 'error' | 'prestart' | 'interview' | 'submitted'>('loading');
  const [data, setData] = useState<InterviewData | null>(null);

  // Interview state
  const [currentCcIdx, setCurrentCcIdx] = useState(0);
  const [view, setView] = useState<'coding' | 'questions'>('coding');
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [runCount, setRunCount] = useState(0);
  const [runOutput, setRunOutput] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  // Timer
  const [elapsedSecs, setElapsedSecs] = useState(0);
  const [remainingSecs, setRemainingSecs] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(Date.now());

  // Monaco model map: challengeId → model value kept in editorValues
  const editorValues = useRef<Record<number, string>>({});
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof import('monaco-editor') | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSaveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Load ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`/api/interview/${token}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((d: InterviewData) => {
        if (d.submitted) { setPhase('submitted'); return; }
        setData(d);
        // Pre-fill editor values from saved codes
        d.codingChallenges.forEach(cc => { editorValues.current[cc.id] = cc.starterCode || ''; });
        setAnswers(d.savedAnswers ?? {});
        if (d.needsStart) { setPhase('prestart'); return; }
        setRemainingSecs(d.remainingSeconds);
        setPhase('interview');
        startTimer(d.remainingSeconds);
        startAutoSave();
      })
      .catch(() => setPhase('error'));
    blockPaste();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (autoSaveIntervalRef.current) clearInterval(autoSaveIntervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // ── Paste blocking ──────────────────────────────────────────────────────────
  function blockPaste() {
    document.addEventListener('paste', e => { e.preventDefault(); e.stopPropagation(); }, true);
    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') { e.preventDefault(); e.stopPropagation(); }
    }, true);
    document.addEventListener('contextmenu', e => e.preventDefault(), true);
  }

  // ── Timer ───────────────────────────────────────────────────────────────────
  function startTimer(remaining: number | null) {
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setElapsedSecs(elapsed);
      if (remaining !== null) {
        const rem = remaining - elapsed;
        setRemainingSecs(rem);
        if (rem <= 0) {
          clearInterval(timerRef.current!);
          doSubmit(true);
        }
      }
    }, 1000);
  }

  function fmtTime(secs: number): string {
    const abs = Math.max(0, secs);
    const h = Math.floor(abs / 3600), m = Math.floor((abs % 3600) / 60), s = abs % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  }

  // ── Auto-save ───────────────────────────────────────────────────────────────
  function startAutoSave() {
    autoSaveIntervalRef.current = setInterval(() => autoSave(), 30_000);
  }

  const autoSave = useCallback(async () => {
    setAutoSaveStatus('saving');
    try {
      await fetch(`/api/interview/${token}/save`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codes: { ...editorValues.current }, answers }),
      });
      setAutoSaveStatus('saved');
    } catch { setAutoSaveStatus('idle'); }
  }, [token, answers]);

  function scheduleAutoSave() {
    setAutoSaveStatus('saving');
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(autoSave, 4000);
  }

  // ── Start ───────────────────────────────────────────────────────────────────
  async function handleStart() {
    const r = await fetch(`/api/interview/${token}/start`, { method: 'POST' });
    if (!r.ok) return;
    const { remainingSeconds } = await r.json() as { remainingSeconds: number };
    setRemainingSecs(remainingSeconds);
    setPhase('interview');
    startTimer(remainingSeconds);
    startAutoSave();
  }

  // ── Submit ──────────────────────────────────────────────────────────────────
  async function doSubmit(timedOut = false) {
    if (phase === 'submitted') return;
    clearInterval(autoSaveIntervalRef.current!);
    clearInterval(timerRef.current!);
    try {
      await fetch(`/api/interview/${token}/submit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codes: { ...editorValues.current }, answers }),
      });
    } catch { /* submit best-effort */ }
    setPhase('submitted');
  }

  // ── Monaco mount ────────────────────────────────────────────────────────────
  function handleEditorMount(ed: editor.IStandaloneCodeEditor, mon: typeof import('monaco-editor')) {
    editorRef.current = ed;
    monacoRef.current = mon;

    // Block paste inside Monaco
    ed.addCommand(mon.KeyMod.CtrlCmd | mon.KeyCode.KeyV, () => {});
    ed.getDomNode()?.addEventListener('paste', e => { e.preventDefault(); e.stopPropagation(); }, true);

    ed.onDidChangeModelContent(() => {
      const cc = data?.codingChallenges[currentCcIdx];
      if (cc) editorValues.current[cc.id] = ed.getValue();
      scheduleAutoSave();
    });
  }

  function handleCcSwitch(idx: number) {
    // Persist current model value
    const prevCc = data?.codingChallenges[currentCcIdx];
    if (prevCc && editorRef.current) editorValues.current[prevCc.id] = editorRef.current.getValue();
    setCurrentCcIdx(idx);
    setView('coding');
    setRunOutput(null);
    // Load new model value into editor after re-render
    setTimeout(() => {
      const newCc = data?.codingChallenges[idx];
      if (newCc && editorRef.current) editorRef.current.setValue(editorValues.current[newCc.id] ?? newCc.starterCode ?? '');
    }, 0);
  }

  // ── Run code ────────────────────────────────────────────────────────────────
  async function runCode() {
    const cc = data?.codingChallenges[currentCcIdx];
    if (!cc || view !== 'coding') return;
    const pistonLang = PISTON_LANGS[cc.language];
    if (!pistonLang) { setRunOutput(`<span style="color:#f87171">Running ${cc.language} is not supported</span>`); return; }
    const code = editorRef.current?.getValue() ?? '';
    if (!code.trim()) return;
    setRunning(true);
    setRunCount(n => n + 1);
    setRunOutput('<span style="color:#8a8d90">Running…</span>');
    try {
      const r = await fetch(PISTON_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ language: pistonLang.language, version: pistonLang.version, files: [{ content: code }] }) });
      if (!r.ok) throw new Error(`Status ${r.status}`);
      const result: PistonResult = await r.json();
      let html = '';
      if (result.compile?.stderr) html += `<pre style="color:#f87171;margin:0">${esc(result.compile.stderr)}</pre>`;
      if (result.compile?.code !== 0 && result.compile) { html += `<div style="color:#f87171;margin-top:8px">✗ Compilation failed</div>`; setRunOutput(html); return; }
      if (result.run.stdout) html += `<pre style="color:#e8e8e8;margin:0">${esc(result.run.stdout)}</pre>`;
      if (result.run.stderr) html += `<pre style="color:#f87171;margin:0">${esc(result.run.stderr)}</pre>`;
      if (!result.run.stdout && !result.run.stderr) html += `<span style="color:#8a8d90;font-style:italic">(no output)</span>`;
      const exitOk = result.run.code === 0;
      html += `<div style="color:${exitOk ? '#22c55e' : '#f87171'};margin-top:8px;padding-top:8px;border-top:1px solid #333">${exitOk ? '✓' : '✗'} Exit code ${result.run.code}</div>`;
      setRunOutput(html);
    } catch (e) { setRunOutput(`<span style="color:#f87171">Error: ${esc((e as Error).message)}</span>`); }
    finally { setRunning(false); }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────
  function esc(s: string) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  const timerClass = () => {
    if (remainingSecs === null) return {};
    if (remainingSecs <= 60) return { color: '#f87171', animation: 'pulse 1s infinite' };
    if (remainingSecs <= 300) return { color: '#f0ab00' };
    return {};
  };

  // ── Render phases ────────────────────────────────────────────────────────────
  if (phase === 'loading') return (
    <div className="interview-root" style={{ display:'flex',alignItems:'center',justifyContent:'center',gap:12 }}>
      <div style={{ width:32,height:32,border:'3px solid #333',borderTopColor:'#ee0000',borderRadius:'50%',animation:'spin .7s linear infinite' }} />
      <span style={{ color:'#8a8d90' }}>Loading interview…</span>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (phase === 'error') return (
    <div className="interview-root" style={{ display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:12 }}>
      <div style={{ fontSize:48 }}>⚠️</div>
      <h2>Link not found</h2>
      <p style={{ color:'#8a8d90' }}>This interview link is invalid or has expired.</p>
    </div>
  );

  if (phase === 'submitted') return (
    <div className="interview-root" style={{ display:'flex',alignItems:'center',justifyContent:'center' }}>
      <div style={{ background:'#1a1a1a',border:'1px solid #22c55e',borderRadius:16,padding:'48px 40px',textAlign:'center',maxWidth:400 }}>
        <div style={{ fontSize:48,marginBottom:16 }}>✅</div>
        <h2 style={{ marginBottom:8 }}>Solution submitted!</h2>
        <p style={{ color:'#8a8d90' }}>Your code and answers have been saved. The interviewer will review them shortly.</p>
        <p style={{ marginTop:12,fontSize:12,color:'#8a8d90' }}>You may close this tab.</p>
      </div>
    </div>
  );

  if (phase === 'prestart') return (
    <div className="interview-root" style={{ display:'flex',alignItems:'center',justifyContent:'center' }}>
      <div style={{ background:'#1a1a1a',border:'1px solid #333',borderRadius:18,padding:'44px 40px',width:'min(520px,96vw)',boxShadow:'0 24px 80px rgba(0,0,0,.6)' }}>
        <div style={{ textAlign:'center',marginBottom:20 }}>
          <span style={{ fontWeight:700,fontSize:17,color:'#ee0000' }}>Red Hat</span>
          <span style={{ fontSize:13,color:'#8a8d90',marginLeft:6 }}>· Interview Platform</span>
        </div>
        <h2 style={{ fontSize:22,fontWeight:700,marginBottom:8,textAlign:'center' }}>{data?.title}</h2>
        <div style={{ textAlign:'center',color:'#f0ab00',fontWeight:600,fontSize:15,marginBottom:28 }}>
          ⏱ {data?.timeLimitMinutes} minute{data?.timeLimitMinutes !== 1 ? 's' : ''} time limit
        </div>
        <div style={{ borderTop:'1px solid #333',borderBottom:'1px solid #333',padding:'20px 0',marginBottom:28,display:'flex',flexDirection:'column',gap:12 }}>
          {[
            ['⏱','Once you click Start, the countdown begins and cannot be paused.'],
            ['⛔','Copy & paste is disabled for the duration of the interview.'],
            ['💾','Your code and answers are auto-saved every 30 seconds.'],
            ['✅','Submit manually when done, or your work is submitted automatically when time runs out.'],
          ].map(([icon, text]) => (
            <div key={icon} style={{ display:'flex',alignItems:'flex-start',gap:12,fontSize:14,color:'#8a8d90' }}>
              <span style={{ width:24,textAlign:'center',flexShrink:0 }}>{icon}</span>
              <span dangerouslySetInnerHTML={{ __html: text.replace(/Start/, '<strong style="color:#e8e8e8">Start</strong>').replace(/cannot be paused/, '<strong style="color:#e8e8e8">cannot be paused</strong>') }} />
            </div>
          ))}
        </div>
        <button onClick={handleStart} style={{ width:'100%',padding:14,fontSize:16,background:'#22c55e',color:'#fff',border:'none',borderRadius:6,cursor:'pointer',fontWeight:600 }}>
          Start interview →
        </button>
      </div>
    </div>
  );

  // ── Main interview view ──────────────────────────────────────────────────────
  const currentCc = data?.codingChallenges[currentCcIdx];
  const displayTime = remainingSecs !== null ? fmtTime(remainingSecs) : fmtTime(elapsedSecs);

  return (
    <div className="interview-root" style={{ display:'grid',gridTemplateColumns:'420px 1fr',height:'100vh',overflow:'hidden' }}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
        * { box-sizing: border-box; }
        ::-webkit-scrollbar{width:6px;height:6px}
        ::-webkit-scrollbar-track{background:#1a1a1a}
        ::-webkit-scrollbar-thumb{background:#333;border-radius:3px}
        pre{margin:0}
        .interview-root h1,h2,h3{color:#e8e8e8}
        .prose h1,.prose h2,.prose h3{font-weight:700;line-height:1.3;margin:1em 0 .4em}
        .prose h2{font-size:1.2em}.prose h3{font-size:1.05em}
        .prose p{margin:.6em 0}.prose ul,.prose ol{padding-left:1.5em;margin:.5em 0}
        .prose li{margin:.2em 0}.prose code{font-family:monospace;background:#1a1a1a;padding:1px 5px;border-radius:3px;font-size:.9em}
        .prose pre{background:#1a1a1a;border:1px solid #333;border-radius:6px;padding:12px;overflow-x:auto;margin:.6em 0}
        .prose pre code{background:none;padding:0}
        .prose strong{font-weight:700;color:#e8e8e8}
      `}</style>

      {/* ── Left panel ── */}
      <div style={{ background:'#1a1a1a',borderRight:'1px solid #333',display:'flex',flexDirection:'column',overflow:'hidden',borderTop:'3px solid #ee0000' }}>
        {/* Header */}
        <div style={{ padding:'10px 16px',borderBottom:'1px solid #333',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0 }}>
          <div style={{ display:'flex',alignItems:'center',gap:8 }}>
            <span style={{ fontWeight:700,color:'#ee0000',fontSize:13 }}>Red Hat</span>
            <div style={{ width:1,height:16,background:'#333' }}/>
            <span style={{ fontSize:11,color:'#8a8d90',textTransform:'uppercase',letterSpacing:'.3px' }}>{data?.title}</span>
          </div>
          <div style={{ display:'flex',alignItems:'center',gap:6 }}>
            {remainingSecs !== null && <span style={{ fontSize:10,color:'#8a8d90' }}>TIME LEFT</span>}
            <span style={{ fontFamily:'monospace',fontSize:13,background:'#242424',borderRadius:6,padding:'3px 8px',...timerClass() }}>
              {displayTime}
            </span>
          </div>
        </div>

        {/* Nav tabs */}
        {((data?.codingChallenges.length ?? 0) > 1 || (data?.questions.length ?? 0) > 0) && (
          <div style={{ display:'flex',gap:2,padding:'6px 10px',borderBottom:'1px solid #333',overflowX:'auto',flexShrink:0 }}>
            {data?.codingChallenges.map((cc, i) => (
              <button key={cc.id} onClick={() => handleCcSwitch(i)} style={{ display:'flex',alignItems:'center',gap:6,padding:'5px 10px',borderRadius:6,border:'1px solid transparent',background: view==='coding'&&currentCcIdx===i ? '#ee0000':'none',color: view==='coding'&&currentCcIdx===i ? '#fff':'#8a8d90',cursor:'pointer',fontSize:12,fontWeight:500,whiteSpace:'nowrap' }}>
                <span style={{ background:'rgba(255,255,255,.2)',borderRadius:'50%',width:16,height:16,display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:10 }}>{i+1}</span>
                {cc.title || `Challenge ${i+1}`}
              </button>
            ))}
            {(data?.questions.length ?? 0) > 0 && (
              <button onClick={() => { setView('questions'); setCurrentCcIdx(-1); }} style={{ display:'flex',alignItems:'center',gap:6,padding:'5px 10px',borderRadius:6,border:'1px solid transparent',background:view==='questions'?'#ee0000':'none',color:view==='questions'?'#fff':'#8a8d90',cursor:'pointer',fontSize:12,fontWeight:500,whiteSpace:'nowrap' }}>
                Questions <span style={{ background:'rgba(255,255,255,.2)',borderRadius:99,padding:'1px 5px',fontSize:10,fontWeight:700 }}>{data?.questions.length}</span>
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div style={{ flex:1,overflowY:'auto',padding:20 }}>
          {view === 'coding' && currentCc && (
            <MarkdownBody html={''} markdownSrc={currentCc.description} />
          )}
          {view === 'questions' && data?.questions && (
            <div>
              <h3 style={{ fontSize:12,fontWeight:700,textTransform:'uppercase',letterSpacing:'.6px',color:'#8a8d90',marginBottom:16 }}>Questions</h3>
              {data.questions.map((q, i) => (
                <div key={q.id} style={{ marginBottom:16 }}>
                  <div style={{ fontSize:13,fontWeight:600,color:'#e8e8e8',marginBottom:6,display:'flex',alignItems:'flex-start',gap:8 }}>
                    <span style={{ display:'inline-flex',alignItems:'center',justifyContent:'center',width:20,height:20,background:'#ee0000',color:'#fff',borderRadius:'50%',fontSize:11,fontWeight:700,flexShrink:0 }}>{i+1}</span>
                    {q.text}
                  </div>
                  <textarea
                    value={answers[q.id] ?? ''}
                    onChange={e => { setAnswers(a => ({ ...a, [q.id]: e.target.value })); scheduleAutoSave(); }}
                    placeholder="Type your answer here…"
                    rows={4}
                    style={{ width:'100%',background:'#242424',border:'1px solid #333',color:'#e8e8e8',borderRadius:6,padding:'8px 10px',fontSize:13,fontFamily:'inherit',resize:'vertical',outline:'none' }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Right panel: editor ── */}
      <div style={{ display:'flex',flexDirection:'column',overflow:'hidden' }}>
        {/* Toolbar */}
        <div style={{ background:'#1a1a1a',borderBottom:'1px solid #333',padding:'8px 14px',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0,gap:12 }}>
          <div style={{ display:'flex',alignItems:'center',gap:10 }}>
            <span style={{ fontSize:11,fontWeight:700,fontFamily:'monospace',color:'#06c',background:'rgba(0,102,204,.1)',borderRadius:4,padding:'2px 7px',textTransform:'uppercase',letterSpacing:'.5px' }}>
              {currentCc?.language ?? ''}
            </span>
            <span style={{ fontSize:12,color: autoSaveStatus==='saving'?'#f0ab00':autoSaveStatus==='saved'?'#22c55e':'#8a8d90' }}>
              {autoSaveStatus==='saving'?'⏳ Saving…':autoSaveStatus==='saved'?'✓ Saved':'Auto-save on'}
            </span>
          </div>
          <div style={{ display:'flex',alignItems:'center',gap:8 }}>
            {view === 'coding' && (
              <button onClick={runCode} disabled={running} style={{ padding:'5px 12px',background:'transparent',border:'1px solid #333',color: running?'#555':'#e8e8e8',borderRadius:6,cursor: running?'not-allowed':'pointer',fontSize:13,fontWeight:500 }}>
                {running ? '⏳ Running…' : `▶ Run${runCount > 0 ? ` (${runCount})` : ''}`}
              </button>
            )}
            <button onClick={() => doSubmit(false)} style={{ padding:'6px 16px',background:'#22c55e',color:'#fff',border:'none',borderRadius:6,cursor:'pointer',fontSize:13,fontWeight:600 }}>
              Submit ↗
            </button>
          </div>
        </div>

        {/* Monaco editor */}
        <div style={{ flex:1,overflow:'hidden' }}>
          {view === 'coding' && currentCc && (
            <MonacoEditor
              height="100%"
              language={currentCc.language}
              value={editorValues.current[currentCc.id] ?? currentCc.starterCode ?? ''}
              onMount={handleEditorMount}
              options={{
                theme: 'vs-dark',
                fontSize: 14,
                fontFamily: "'Red Hat Mono','JetBrains Mono',monospace",
                minimap: { enabled: false },
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
                padding: { top: 16, bottom: 16 },
                wordWrap: 'on',
                tabSize: 2,
              }}
            />
          )}
          {view === 'questions' && (
            <div style={{ padding:20,color:'#8a8d90',fontSize:14 }}>
              ← Use the Questions panel on the left to type your answers.
            </div>
          )}
        </div>

        {/* Run output panel */}
        {runOutput !== null && (
          <div style={{ flexShrink:0,height:200,borderTop:'2px solid #333',background:'#0a0a0a',display:'flex',flexDirection:'column',overflow:'hidden' }}>
            <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'5px 12px',borderBottom:'1px solid #333',background:'#1a1a1a',flexShrink:0 }}>
              <span style={{ fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'.5px',color:'#8a8d90' }}>
                Output — Run {runCount}
              </span>
              <button onClick={() => setRunOutput(null)} style={{ background:'transparent',border:'none',color:'#8a8d90',cursor:'pointer',fontSize:13 }}>Clear</button>
            </div>
            <div style={{ flex:1,overflow:'auto',padding:'10px 14px',fontFamily:'monospace',fontSize:13,lineHeight:1.6 }} dangerouslySetInnerHTML={{ __html: runOutput }} />
          </div>
        )}
      </div>

      {/* Confirm submit modal */}
      <ConfirmModal onConfirm={() => doSubmit(false)} />
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MarkdownBody({ markdownSrc }: { html: string; markdownSrc: string }) {
  const [rendered, setRendered] = useState('');
  useEffect(() => {
    if (!markdownSrc) return;
    import('marked').then(({ marked }) =>
      Promise.resolve(marked.parse(markdownSrc)).then(h => setRendered(h))
    );
  }, [markdownSrc]);
  return <div className="prose" dangerouslySetInnerHTML={{ __html: rendered }} />;
}

function ConfirmModal({ onConfirm }: { onConfirm: () => void }) {
  const [open, setOpen] = useState(false);
  // Expose via custom event so the main component can trigger it
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('interview:confirm-submit', handler);
    return () => window.removeEventListener('interview:confirm-submit', handler);
  }, []);
  if (!open) return null;
  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100 }}>
      <div style={{ background:'#1a1a1a',border:'1px solid #333',borderRadius:12,padding:28,width:'min(400px,95vw)' }}>
        <h3 style={{ marginBottom:8 }}>Submit your solution?</h3>
        <p style={{ color:'#8a8d90',fontSize:14,marginBottom:20 }}>Once submitted you can no longer edit. Make sure you're done with all challenges and questions!</p>
        <div style={{ display:'flex',gap:10,justifyContent:'flex-end' }}>
          <button onClick={() => setOpen(false)} style={{ padding:'7px 16px',background:'transparent',border:'1px solid #333',color:'#e8e8e8',borderRadius:6,cursor:'pointer' }}>Keep editing</button>
          <button onClick={() => { setOpen(false); onConfirm(); }} style={{ padding:'7px 16px',background:'#22c55e',color:'#fff',border:'none',borderRadius:6,cursor:'pointer',fontWeight:600 }}>Yes, submit</button>
        </div>
      </div>
    </div>
  );
}
