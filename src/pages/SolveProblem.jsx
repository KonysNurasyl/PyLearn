import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { API_BASE } from "../config/api";

export default function SolveProblem() {
  const { user, token } = useAuth();
  const [stageIndex, setStageIndex] = useState(0);
  const [stages, setStages] = useState([]);
  const [selected, setSelected] = useState(null);
  const [code, setCode] = useState('');
  const [lang, setLang] = useState('py');
  const [output, setOutput] = useState('');
  const [lastResultStatus, setLastResultStatus] = useState(null); // 'дұрыс' | 'қате' | бос
  const [fontSize, setFontSize] = useState(14);
  const [isRunning, setIsRunning] = useState(false);
  const [userInput, setUserInput] = useState(''); // Пайдаланушы озі енгізетін мәндердің енгізу мәні
  const iframeRef = useRef(null);
  const pyodideRef = useRef(null);
  const [pyodideLoading, setPyodideLoading] = useState(false);
  const [showHints, setShowHints] = useState(false);
  const [problemStartTime, setProblemStartTime] = useState(Date.now());
  const [solvedProblemIds, setSolvedProblemIds] = useState(new Set());
  const textareaRef = useRef(null);

  // Барлық тапсырмалардың жалпы тізімін алу (құлыптау/ашу үшін)
  const allProblems = stages.flatMap(s => s.problems);

  const isProblemUnlocked = (problemId) => {
    const idx = allProblems.findIndex(p => p.id === problemId);
    if (idx === 0) return true; // Бірінші тапсырма әрқашан ашық
    if (idx < 0) return false;
    const prevProblem = allProblems[idx - 1];
    return solvedProblemIds.has(Number(prevProblem.id));
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(`${API_BASE}/api/problems?limit=200`, { signal: controller.signal });
        clearTimeout(timeout);
        if (!res.ok) throw new Error('Тапсырмалар жүктелмеді');
        const problems = await res.json();

        if (cancelled) return;
        
        const perStage = Math.max(1, Math.ceil(problems.length / 5));
        const stageIcons = ['🌱', '📚', '🔀', '📦', '🚀'];
        const newStages = Array.from({ length: 5 }).map((_, i) => ({
          id: i + 1,
          icon: stageIcons[i],
          title: ['Бастаушы','Негіздер','Басқару ағыны','Деректер құрылымдары','Жетілдірілген'][i] || `Кезең ${i+1}`,
          problems: problems.slice(i * perStage, (i + 1) * perStage).map(p => ({ 
            id: String(p.id), 
            title: p.title, 
            desc: p.description || '', 
            template: p.template || '# Мұнда Python кодын жазыңыз\n', 
            lang: 'py',
            difficulty: p.difficulty || 'Жеңіл',
            expected: p.expected_output || null,
            testCases: p.test_cases || []
          }))
        }));
        setStages(newStages);
        setStageIndex(0);
        
        if (newStages[0] && newStages[0].problems[0]) {
          setSelected(newStages[0].problems[0]);
          setCode(newStages[0].problems[0].template || '');
          setLang('py');
        }

        // Шешілген тапсырмаларды жүктеу
        if (user && token) {
          try {
            const solvedRes = await fetch(`${API_BASE}/api/users/${user.id}/solved_problems`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            if (solvedRes.ok) {
              const solvedIds = await solvedRes.json();
              setSolvedProblemIds(new Set(solvedIds));
            }
          } catch(e) { console.warn('Шешілген тапсырмалар жүктелмеді', e); }
        }
      } catch (err) {
        console.error(err);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [user, token]);

  useEffect(() => {
    if (!selected) return;
    // Template жоқ — пайдаланушы нөлден өзі жазады
    setCode('# Мұнда Python кодын жазыңыз\n');
    setLang(selected.lang || 'py');
    setOutput('');
    setLastResultStatus(null);
    setProblemStartTime(Date.now());
  }, [selected]);

  // Pyodide-ді тек қажет болғанда жүктеу (lazy load) — беттің жүктелу жылдамдығана
  const loadPyodideIfNeeded = async () => {
    if (pyodideRef.current) return pyodideRef.current;
    setPyodideLoading(true);
    try {
      // Бұрыннан жүктелген скрипт бар ма тексеру
      const existing = document.querySelector('script[src*="pyodide"]');
      if (!existing) {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js';
        script.async = true;
        document.body.appendChild(script);
        await new Promise((res, rej) => { script.onload = res; script.onerror = rej; });
      } else if (!window.loadPyodide) {
        await new Promise(res => { existing.addEventListener('load', res); });
      }
      const pyodide = await window.loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.23.4/full/' });
      pyodideRef.current = pyodide;
      return pyodide;
    } catch (e) {
      console.error('Pyodide жүктеу сәтсіз аяқталды', e);
      throw e;
    } finally {
      setPyodideLoading(false);
    }
  };

  // Тест салыстыру үшін ақылды салыстыру (флоат/инт, префикс, бос орын)
  const smartCompare = (actual, expected) => {
    const a = (actual || '').trim();
    const e = (expected || '').trim();
    if (a === e) return true;

    // Сандық нәтиже болса — флоат/инт салыстыру (27.0 == 27)
    const aNum = parseFloat(a);
    const eNum = parseFloat(e);
    if (!isNaN(aNum) && !isNaN(eNum) && Math.abs(aNum - eNum) < 1e-9) return true;

    // Көп жолды шығыс немесе input() prompt-тары болса
    const aLines = a.split('\n').map(l => l.trim()).filter(l => l !== '');
    const eLines = e.split('\n').map(l => l.trim()).filter(l => l !== '');
    
    if (aLines.length >= eLines.length && eLines.length > 0) {
      // Экранға шыққан соңғы eLines.length жолды ғана тексереміз
      const lastALines = aLines.slice(aLines.length - eLines.length);
      const match = lastALines.every((aLine, i) => {
        const eLine = eLines[i];
        if (aLine === eLine) return true;
        // Жолдың соңында күтілген мән бар ма? (Мысалы: "Үлкен сан: 27.0" ішінде "27" бар)
        const lastWord = aLine.split(/\s+/).pop();
        const aWordNum = parseFloat(lastWord);
        const eLineNum = parseFloat(eLine);
        if (!isNaN(aWordNum) && !isNaN(eLineNum) && Math.abs(aWordNum - eLineNum) < 1e-9) return true;
        // Тікелей сан үшін тікелей салыстыру
        if (eLine !== '' && aLine.endsWith(eLine)) return true;
        return false;
      });
      if (match) return true;
    }
    return false;
  };

  // Pyodide-де кодты іске қосу (стандартты енгізуді қолдаумен)
  const executePython = async (inputString, userCode) => {
    const pyodide = pyodideRef.current;
    const indented = (userCode || '').split('\n').map(line => '    ' + line).join('\n');
    
    // input() функциясын бөгетсіз (non-blocking) симуляциялау үшін StringIO қолданамыз
    const wrapper = `
import sys, io, traceback, builtins

# Енгізу және шығару буферлерін дайындау
input_data = ${JSON.stringify(inputString || '')}
sys.stdin = io.StringIO(input_data)
sys.stdout = io.StringIO()

# input() функциясын қайта анықтау (readline арқылы)
def mock_input(prompt=''):
    sys.stdout.write(str(prompt))
    line = sys.stdin.readline()
    if not line:
        raise EOFError('EOF when reading a line')
    
    # Эхо жасау (Пайдаланушы тергендей көрсету үшін)
    sys.stdout.write(line)
    if not line.endswith('\\n'):
        sys.stdout.write('\\n')
        
    return line.rstrip('\\r\\n')

builtins.input = mock_input

try:
${indented}
except Exception:
    traceback.print_exc()

result = sys.stdout.getvalue()
`;
    // Wrapper-ді орындау және нәтижені алу
    await pyodide.runPythonAsync(wrapper);
    const result = pyodide.globals.get('result');
    return (result || '').toString().trim();
  };

  const runCode = async () => {
    setIsRunning(true);
    setOutput('🔄 Кодты іске қосу...\n');

    if (lang !== 'py') {
      setOutput('⚠️ Бұл ортада тек Python-ға қолдау көрсетіледі.');
      setIsRunning(false);
      return;
    }

    try {
      setOutput('⏳ Python жүктелуде... (бірінші рет 20-30 сек уақыт алуы мүмкін)\n');
      await loadPyodideIfNeeded();
    } catch {
      setOutput('❌ Python жүктеу сәтсіз аяқталды. Интернет қосылымын тексеріңіз.');
      setIsRunning(false);
      return;
    }

    try {
      const userCode = code || '';
      // Пайдаланушы енгізген мәнді қолдану, егер бос болса — бірінші тест-кейстің input-ы
      const inputToUse = userInput.trim()
        || ((selected.testCases && selected.testCases.length > 0) ? (selected.testCases[0].input || '') : '');
      const normalized = await executePython(inputToUse, userCode);

      let previewText;
      if (inputToUse) {
        previewText = `📥 Енгізілді:\n${inputToUse}\n\n📤 Шығарылды:\n${normalized || '(нәтиже жоқ)'}\n\n💡 Тапсырманы шешу үшін "✓ Жіберу" батырмасын басыңыз`;
      } else {
        previewText = normalized || '✅ Код сәтті орындалды (нәтиже жоқ)';
      }
      setOutput(previewText);
      setLastResultStatus(null);
    } catch (err) {
      console.error(err);
      setOutput('❌ Қате:\n' + (err.message || String(err)));
      setLastResultStatus('preview_fail');
    } finally {
      setIsRunning(false);
    }
  };

  const submitAttempt = async () => {
    if (!user || !token) {
      setOutput('⚠️ Жіберу үшін жүйеге кіру қажет.');
      return;
    }

    if (!pyodideRef.current) {
      // Жүктелмеген болса, жүктеуге тырысамыз
      try {
        setOutput('⏳ Python жүктелуде... (бірінші рет 20-30 сек уақыт алуы мүмкін)');
        await loadPyodideIfNeeded();
      } catch {
        setOutput('❌ Python жүктеу сәтсіз аяқталды.');
        return;
      }
    }

    const userCode = (code || '').trim();
    if (!userCode || userCode === '# Мұнда Python кодын жазыңыз') {
      setOutput('⚠️ Алдымен код жазыңыз!');
      return;
    }

    setIsRunning(true);
    const testCases = (selected.testCases && selected.testCases.length > 0)
      ? selected.testCases
      : [{ input: '', expected: selected.expected || '' }];
    const totalTests = testCases.length;

    setOutput(`🔄 ${totalTests} тест-кейс тексерілуде...\n`);

    const outputs = [];
    const localResults = [];

    try {
      // ── 1. Тест-кейстерді іске қосу ──────────────────────────────────────
      for (let i = 0; i < totalTests; i++) {
        const tc = testCases[i];
        try {
          const result = await executePython(tc.input || '', userCode);
          outputs.push(result);
          const expected = (tc.expected || '').trim();
          const passed = smartCompare(result, expected);
          localResults.push({ test: i + 1, passed, expected, actual: result, input: tc.input });
        } catch (err) {
          outputs.push('ERROR: ' + err.message);
          localResults.push({ test: i + 1, passed: false, expected: (tc.expected || '').trim(), actual: 'Қате: ' + err.message, input: tc.input });
        }
      }

      const passedLocal = localResults.filter(r => r.passed).length;
      const allTestsPassed = passedLocal === totalTests;

      let displayOutput = `📋 Тест нәтижелері:\n${'─'.repeat(40)}\n`;
      for (const r of localResults) {
        displayOutput += `${r.passed ? '✅' : '❌'} Тест #${r.test}: ${r.passed ? 'Өтті' : 'Сәтсіз'}\n`;
        if (r.input) {
          const formattedInput = r.input.replace(/\n/g, ' ↵ ');
          displayOutput += `   Кіріс (input): [ ${formattedInput} ]\n`;
        }
        if (!r.passed) {
          displayOutput += `   Күтілген: "${r.expected}"\n`;
          displayOutput += `   Алынған:  "${r.actual}"\n`;
        }
      }
      displayOutput += `${'─'.repeat(40)}\nНәтиже: ${passedLocal}/${totalTests} тест өтті\n`;
      setOutput(displayOutput);
      setIsRunning(false);

      if (!allTestsPassed) {
        setLastResultStatus('wrong');
        return;
      }

      // ── 2. Барлығы өтті → серверге жіберу ───────────────────────────────
      const timeSpentSeconds = Math.floor((Date.now() - problemStartTime) / 1000);

      const res = await fetch(`${API_BASE}/api/problems/${selected.id}/attempt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          outputs,
          submission: userCode,
          timeSpent: timeSpentSeconds
        })
      });

      if (!res.ok) {
        setOutput(prev => prev + '\n⚠️ Серверге жіберу сәтсіз аяқталды.');
        setLastResultStatus('wrong');
        return;
      }

      const data = await res.json();
      if (data.correct) {
        setLastResultStatus('correct');
        setSolvedProblemIds(prev => new Set([...prev, Number(selected.id)]));
        setOutput(prev =>
          prev + `\n\n✅ ${'─'.repeat(38)}\n🎉 ${data.message}\n`
        );
      } else {
        setLastResultStatus('wrong');
        setOutput(prev => prev + `\n❌ ${data.message}`);
      }
    } catch (err) {
      console.error('Жіберу қатесі:', err);
      setOutput(prev => prev + '\n⚠️ Қате орын алды: ' + err.message);
      setLastResultStatus('wrong');
    } finally {
      setIsRunning(false);
    }
  };

  // Редакторда Tab және автоматты шегіністі басқару
  const handleKeyDown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const { selectionStart, selectionEnd } = e.target;
      const newCode = code.substring(0, selectionStart) + "    " + code.substring(selectionEnd);
      setCode(newCode);
      
      // Курсорды орнына қайтару (state жаңарғаннан кейін)
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = selectionStart + 4;
        }
      }, 0);
    }

    if (e.key === 'Enter') {
      const { selectionStart } = e.target;
      const beforeCursor = code.substring(0, selectionStart);
      const afterCursor = code.substring(selectionStart);
      const lines = beforeCursor.split('\n');
      const currentLine = lines[lines.length - 1];
      
      // Қазіргі жолдың шегінісін анықтау
      const indentMatch = currentLine.match(/^\s*/);
      const currentIndent = indentMatch ? indentMatch[0] : "";
      
      // Егер жол қос нүктемен аяқталса, қосымша шегініс қосу
      if (currentLine.trim().endsWith(':')) {
        e.preventDefault();
        const newIndent = currentIndent + "    ";
        const newCode = beforeCursor + "\n" + newIndent + afterCursor;
        setCode(newCode);
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.selectionStart = textareaRef.current.selectionEnd = selectionStart + newIndent.length + 1;
          }
        }, 0);
      } else if (currentIndent) {
        // Жай ғана жаңа жолға өткенде алдыңғы шегіністі сақтау
        e.preventDefault();
        const newCode = beforeCursor + "\n" + currentIndent + afterCursor;
        setCode(newCode);
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.selectionStart = textareaRef.current.selectionEnd = selectionStart + currentIndent.length + 1;
          }
        }, 0);
      }
    }
  };

  const getDifficultyColor = (difficulty) => {
    switch(difficulty) {
      case 'Жеңіл': return 'text-green-400 bg-green-500/10 border-green-500/30';
      case 'Орташа': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
      case 'Қиын': return 'text-red-400 bg-red-500/10 border-red-500/30';
      default: return 'text-gray-400 bg-gray-500/10 border-gray-500/30';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 text-white">
      
      {/* Фондық тор */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `linear-gradient(#1e293b 1px, transparent 1px),
                           linear-gradient(90deg, #1e293b 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }}></div>
      </div>

      <div className="relative z-10 h-screen flex flex-col">
        
        {/* Жоғарғы жолақ */}
        <div className="bg-gray-900/90 backdrop-blur-sm border-b border-gray-800 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold font-mono">
                <span className="text-gray-400">&gt;&gt;&gt; </span>
                <span className="bg-gradient-to-r from-blue-400 to-purple-400 text-transparent bg-clip-text">
                  Кодтау алаңы
                </span>
              </h1>
              {pyodideLoading && (
                <div className="flex items-center gap-2 px-3 py-1 bg-yellow-500/20 border border-yellow-500/30 rounded-full text-xs font-mono text-yellow-400">
                  <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
                  <span>Python жүктелуде...</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button className="p-2 hover:bg-gray-800 rounded-lg transition-all" title="Баптаулар">
                <span className="text-xl">⚙️</span>
              </button>
              <a href="/learn" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg font-mono text-sm transition-all">
                ← Сабақтар бетіне оралу
              </a>
            </div>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          
          {/* Сол жақ бүйірлік тақта */}
          <aside className="w-80 bg-gray-900/50 backdrop-blur-sm border-r border-gray-800 overflow-y-auto">
            
            {/* Кезеңдер */}
            <div className="p-4 border-b border-gray-800">
              <h3 className="font-mono font-bold mb-3 flex items-center gap-2">
                <span className="text-xl">🎯</span>
                <span>Жетістік жолы</span>
              </h3>
              <div className="space-y-2">
                {stages.length === 0 ? (
                  <div className="text-sm text-gray-400 text-center py-4">Кезеңдер жүктелуде...</div>
                ) : (
                  stages.map((s, idx) => (
                    <button 
                      key={s.id} 
                      onClick={() => setStageIndex(idx)} 
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                        idx === stageIndex 
                          ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg' 
                          : 'bg-gray-800/50 text-gray-300 hover:bg-gray-800'
                      }`}
                    >
                      <span className="text-2xl">{s.icon}</span>
                      <div className="flex-1 text-left">
                        <div className="font-mono font-semibold">{s.title}</div>
                        <div className="text-xs text-gray-400">{s.problems.length} тапсырма</div>
                      </div>
                      {idx === stageIndex && <span>✓</span>}
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Тапсырмалар тізімі */}
            <div className="p-4">
              <h3 className="font-mono font-bold mb-3 flex items-center gap-2">
                <span className="text-xl">📝</span>
                <span>Тапсырма</span>
              </h3>
              <div className="space-y-2">
                {stages.length === 0 ? (
                  <div className="text-sm text-gray-400 text-center py-4">Тапсырмалар жүктелуде...</div>
                ) : (
                  (stages[stageIndex]?.problems || []).map(p => {
                    const unlocked = isProblemUnlocked(p.id);
                    const solved = solvedProblemIds.has(Number(p.id));
                    return (
                      <button 
                        key={p.id} 
                        onClick={() => { if (unlocked) setSelected(p); }} 
                        disabled={!unlocked}
                        className={`w-full text-left p-3 rounded-lg transition-all ${
                          !unlocked
                            ? 'bg-gray-800/30 text-gray-600 cursor-not-allowed opacity-60'
                            : selected && selected.id === p.id 
                              ? 'bg-green-600 text-white shadow-lg' 
                              : solved
                                ? 'bg-green-600/20 text-green-300 border border-green-500/30 hover:bg-green-600/30'
                                : 'bg-gray-800/50 text-gray-300 hover:bg-gray-800'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-1">
                          <div className="font-mono font-semibold text-sm flex items-center gap-2">
                            {!unlocked ? '🔒' : solved ? '✅' : '🟢'}
                            {p.title}
                          </div>
                          {selected && selected.id === p.id && <span className="text-xs">●</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded border ${!unlocked ? 'text-gray-600 bg-gray-700/30 border-gray-700' : getDifficultyColor(p.difficulty)}`}>
                            {p.difficulty}
                          </span>
                          <span className="text-xs text-gray-500">#{p.id}</span>
                          {solved && <span className="text-xs text-green-400 ml-auto font-semibold">✔ Шешілді</span>}
                          {!unlocked && <span className="text-xs text-gray-500 ml-auto">Құлыпталған</span>}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </aside>

          {/* Негізгі мазмұн */}
          <main className="flex-1 flex flex-col overflow-hidden">
            
            {!selected ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-8xl mb-6">🚀</div>
                  <h2 className="text-3xl font-bold font-mono mb-3">Тапсырмаларды шешуге дайынсыз ба?</h2>
                  <p className="text-gray-400 font-mono">Бастау үшін бүйірлік тақтадан тапсырманы таңдаңыз</p>
                </div>
              </div>
            ) : (
              <>
                {/* Тапсырма тақырыбы */}
                <div className="bg-gray-900/50 backdrop-blur-sm border-b border-gray-800 p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h2 className="text-2xl font-bold font-mono">{selected.title}</h2>
                        <span className={`text-xs px-3 py-1 rounded-full border ${getDifficultyColor(selected.difficulty)}`}>
                          {selected.difficulty}
                        </span>
                        {selected.testCases && selected.testCases.length > 0 && (
                          <span className="ml-2 text-xs px-3 py-1 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-400 font-mono">
                            🧪 {selected.testCases.length} тест
                          </span>
                        )}
                        {lastResultStatus === 'correct' && (
                          <span className="ml-3 text-xs px-3 py-1 rounded-full bg-green-600 text-white font-mono">✔ Барлық тесттер өтті</span>
                        )}
                        {lastResultStatus === 'wrong' && (
                          <span className="ml-3 text-xs px-3 py-1 rounded-full bg-red-600 text-white font-mono">✖ Сәтсіз</span>
                        )}
                        {lastResultStatus === 'cheat' && (
                          <span className="ml-3 text-xs px-3 py-1 rounded-full bg-orange-500 text-white font-mono animate-pulse">🚨 Читтеу анықталды</span>
                        )}
                        {lastResultStatus === 'preview_ok' && (
                          <span className="ml-3 text-xs px-3 py-1 rounded-full bg-blue-600 text-white font-mono">👁 Алдын ала: дұрыс</span>
                        )}
                        {lastResultStatus === 'preview_fail' && (
                          <span className="ml-3 text-xs px-3 py-1 rounded-full bg-orange-600 text-white font-mono">👁 Алдын ала: қате</span>
                        )}

                      </div>
                      <div className="text-sm text-gray-400 font-mono">Тапсырма ID: {selected.id}</div>
                    </div>
                    
                    <button 
                      onClick={() => setShowHints(!showHints)}
                      className="px-4 py-2 bg-yellow-600/20 border border-yellow-500/30 text-yellow-400 rounded-lg hover:bg-yellow-600/30 transition-all font-mono text-sm"
                    >
                      {showHints ? '🔒 Кеңестерді жасыру' : '💡 Кеңестерді көрсету'}
                    </button>
                  </div>

                  {/* Тапсырма сипаттамасы */}
                  <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-4">
                    <h3 className="font-mono font-bold mb-2 text-sm text-gray-400">Тапсырманың сипаттамасы:</h3>
                    <p className="text-gray-300 whitespace-pre-wrap text-sm leading-relaxed">
                      {selected.desc || 'Бұл тапсырма үшін сипаттама берілмеген.'}
                    </p>
                  </div>

                  {showHints && (
                    <div className="mt-4 bg-yellow-600/10 border border-yellow-500/30 rounded-lg p-4 animate-fadeIn">
                      <h3 className="font-mono font-bold mb-2 text-sm text-yellow-400">💡 Кеңестер:</h3>
                      <ul className="text-gray-300 text-sm space-y-1 list-disc list-inside">
                        <li>Мәселені кішігірім қадамдарға бөліңіз</li>
                        <li>Барлық ерекше жағдайлар мен енгізулерді тексеріп көріңіз.</li>
                        <li>Кодты үлгі кірістерімен тексеріңіз</li>
                      </ul>
                    </div>
                  )}
                </div>

                {/* Код редакторы және шығыс (Output) */}
                <div className="flex-1 grid lg:grid-cols-2 overflow-hidden">
                  
                  {/* Код редакторы */}
                  <div className="flex flex-col border-r border-gray-800 overflow-hidden">
                    <div className="bg-gray-900/50 backdrop-blur-sm px-4 py-3 flex items-center justify-between border-b border-gray-800">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-red-500"></div>
                          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                          <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        </div>
                        <span className="text-sm font-mono text-gray-400">solution.py</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={fontSize}
                          onChange={(e) => setFontSize(Number(e.target.value))}
                          className="bg-gray-800 px-2 py-1 rounded text-xs font-mono"
                        >
                          <option value="12">12px</option>
                          <option value="14">14px</option>
                          <option value="16">16px</option>
                          <option value="18">18px</option>
                        </select>
                        <select
                          value={lang}
                          onChange={(e) => setLang(e.target.value)}
                          className="bg-gray-800 px-3 py-1 rounded text-sm font-mono"
                        >
                          <option value="py">🐍 Python</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex-1 overflow-hidden">
                      <textarea
                        ref={textareaRef}
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="w-full h-full bg-gray-900 p-6 font-mono text-green-400 resize-none outline-none"
                        style={{ fontSize: `${fontSize}px`, lineHeight: '1.6' }}
                        spellCheck="false"
                        placeholder="# Python кодын осы жерге жазыңыз..."
                      />
                    </div>

                    {/* Пайдаланушы енгізу панелі */}
                    <div className="border-t border-gray-800 bg-gray-900/70">
                      <div className="px-4 py-2 flex items-center justify-between">
                        <span className="text-xs font-mono text-gray-400 flex items-center gap-2">
                          <span>📥</span> stdin — өз енгізуіңіз (әр мән жаңа жолда)
                        </span>
                        <button
                          onClick={() => setUserInput('')}
                          className="text-xs text-gray-600 hover:text-gray-400 font-mono"
                        >
                          Тазалау
                        </button>
                      </div>
                      <textarea
                        value={userInput}
                        onChange={(e) => setUserInput(e.target.value)}
                        className="w-full bg-gray-950 px-4 pb-3 font-mono text-yellow-300 resize-none outline-none text-sm"
                        style={{ height: '72px', fontSize: `${fontSize - 1}px` }}
                        placeholder="Мысалы:\n15\n27\n9\n(әр мән жаңа жолда болуы тиіс)"
                        spellCheck="false"
                      />
                    </div>

                    {/* Редактор әрекеттері */}
                    <div className="bg-gray-900/50 backdrop-blur-sm px-4 py-3 flex items-center gap-3 border-t border-gray-800">
                      <button
                        onClick={runCode}
                        disabled={isRunning}
                        className={`flex-1 px-6 py-2 rounded-lg font-mono font-semibold transition-all flex items-center justify-center gap-2 ${
                          isRunning
                            ? 'bg-gray-700 cursor-not-allowed'
                            : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 transform hover:scale-105'
                        }`}
                      >
                        {isRunning ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            <span>Орындалуда...</span>
                          </>
                        ) : (
                          <>
                            <span>▶️</span>
                            <span>Кодты орындау</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={submitAttempt}
                        disabled={isRunning}
                        className={`px-6 py-2 rounded-lg font-mono font-semibold transition-all flex items-center gap-2 ${
                          isRunning
                            ? 'bg-gray-700 cursor-not-allowed'
                            : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 transform hover:scale-105'
                        }`}
                      >
                        <span>✓ Жіберу</span>
                      </button>

                      <button
                        onClick={() => { setCode('# Мұнда Python кодын жазыңыз\n'); setOutput(''); }}
                        className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg font-mono transition-all"
                        title="Кодты тазалау"
                      >
                        🔄
                      </button>
                    </div>
                  </div>



                  {/* Шығыс панелі (Output) */}
                  <div className="flex flex-col overflow-hidden">
                    <div className="bg-gray-900/50 backdrop-blur-sm px-4 py-3 flex items-center justify-between border-b border-gray-800">
                      <span className="text-sm font-mono text-gray-400">📤 Шығару</span>
                      <button 
                        onClick={() => setOutput('')}
                        className="text-xs px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded font-mono transition-all"
                      >
                        Тазарту
                      </button>
                    </div>

                    <div className="flex-1 overflow-auto">
                      <pre className="h-full bg-black p-6 font-mono text-sm text-green-300 whitespace-pre-wrap" style={{ fontSize: `${fontSize}px` }}>
                        {output || '// Кодты іске қосқаннан кейін нәтиже осында пайда болады\n// Орындау үшін "Кодты іске қосу" батырмасын басыңыз'}
                      </pre>
                      {lastResultStatus === 'wrong' && selected && selected.expected && (
                        <div className="p-4 mt-2 bg-red-900/40 rounded border border-red-700 text-sm">
                          <div className="font-mono font-semibold text-sm text-red-200 mb-1">Күтілетін өнім:</div>
                          <pre className="whitespace-pre-wrap text-red-100 text-sm">{String(selected.expected)}</pre>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </main>
        </div>

        {/* Төменгі күй жолағы */}
        <div className="bg-gray-900/90 backdrop-blur-sm border-t border-gray-800 px-6 py-2 flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-4 text-gray-400">
            <span>
              Python: {pyodideLoading
                ? '⏳ Жүктелуде...'
                : pyodideRef.current
                  ? '✅ Дайын'
                  : '⚡ Алғаш орындауда жүктеледі'}
            </span>
            <span>•</span>
            <span>Тіл: Python 3</span>
          </div>
          <div className="text-gray-500">
            💡 Кеңес: Кодты тексеру үшін print() функциясын қолданыңыз.
          </div>
        </div>
      </div>

      <iframe ref={iframeRef} title="runner" className="hidden" sandbox="allow-scripts"></iframe>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}} />
    </div>
  );
}
