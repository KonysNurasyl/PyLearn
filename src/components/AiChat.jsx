import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_BASE } from '../config/api';

const SUGGESTED_QUESTIONS = [
    'Python-да цикл қалай жазылады?',
    'Функция деген не?',
    'Тізім (list) мен кортеж айырмашылығы',
    'try/except қалай жұмыс істейді?',
];

const normalizeHistory = (history) => {
    return [...(history || [])]
        .sort((a, b) => {
            const aTime = new Date(a.created_at || 0).getTime();
            const bTime = new Date(b.created_at || 0).getTime();
            if (aTime !== bTime) return aTime - bTime;
            return Number(a.id || 0) - Number(b.id || 0);
        })
        .map(h => ({ role: h.role, text: h.message }));
};

export default function AiChat({ context }) {
    const { user, token } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    
    // Сессияларды басқару
    const [sessions, setSessions] = useState([]);
    const [sessionId, setSessionId] = useState(Date.now().toString());

    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    // Төменге автоматты түрде айналдыру (скролл)
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, loading]);

    // Чат ашылғанда енгізу өрісіне фокус қою
    useEffect(() => {
        if (isOpen && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 200);
        }
    }, [isOpen]);

    // Сессияларды жүктеу
    const loadSessions = useCallback(async () => {
        if (!user?.id || !token) return;
        try {
            const res = await fetch(`${API_BASE}/api/ai/sessions`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setSessions(data);
            }
        } catch (e) {
            console.warn('Сессияларды жүктеу қатесі', e);
        }
    }, [token, user?.id]);

    useEffect(() => {
        if (isOpen) {
            loadSessions();
        }
    }, [isOpen, loadSessions]);

    // Ағымдағы сессияның хабарламаларын жүктеу
    useEffect(() => {
        if (!isOpen || !user?.id || !token) return;
        setLoading(false);
        let isMounted = true;
        (async () => {
            try {
                const res = await fetch(`${API_BASE}/api/ai/history/${user.id}?sessionId=${sessionId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const history = await res.json();
                    if (isMounted) {
                        setMessages(normalizeHistory(history));
                    }
                }
            } catch (e) {
                console.warn('Чат тарихын жүктеу қатесі', e);
            }
        })();
        return () => { isMounted = false; };
    }, [isOpen, sessionId, user, token]);

    const startNewChat = () => {
        setSessionId(Date.now().toString());
        setMessages([]);
        setInput('');
    };

    const deleteSession = async (delSessionId, e) => {
        e.stopPropagation();
        if (!window.confirm('Бұл чатты өшіргіңіз келетініне сенімдісіз бе?')) return;
        
        try {
            const res = await fetch(`${API_BASE}/api/ai/sessions/${delSessionId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                setSessions(prev => prev.filter(s => s.session_id !== delSessionId));
                if (sessionId === delSessionId) {
                    startNewChat();
                }
            }
        } catch (err) {
            console.warn('Сессияны өшіру қатесі', err);
        }
    };

    const sendMessage = async (text) => {
        if (!text.trim()) return;

        const isNewSession = messages.length === 0;
        const userMsg = { role: 'user', text: text.trim() };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            const res = await fetch(`${API_BASE}/api/ai/chat`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    message: text.trim(),
                    context: context || null,
                    session_id: sessionId,
                    history: messages.slice(-10).map(m => ({ role: m.role, message: m.text })),
                }),
            });

            if (!res.ok) throw new Error('AI жауап бермеді');

            setLoading(false);
            setMessages(prev => [...prev, { role: 'assistant', text: '' }]);

            const reader = res.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let doneReading = false;
            let buffer = '';

            while (!doneReading) {
                const { value, done } = await reader.read();
                if (done) break;
                
                buffer += decoder.decode(value, { stream: true });
                const parts = buffer.split('\n\n');
                buffer = parts.pop() || '';

                for (const part of parts) {
                    const lines = part.split('\n');
                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const dataStr = line.slice(6).trim();
                            if (dataStr === '[DONE]') {
                                doneReading = true;
                                break;
                            }
                            
                            try {
                                const parsed = JSON.parse(dataStr);
                                if (parsed.text) {
                                    setMessages(prev => {
                                        const latest = [ ...prev ];
                                        const lastIndex = latest.length - 1;
                                        latest[lastIndex] = {
                                            ...latest[lastIndex],
                                            text: latest[lastIndex].text + parsed.text
                                        };
                                        return latest;
                                    });
                                }
                            } catch {
                                // parse қатесін елемеу
                            }
                        }
                    }
                }
            }

            if (isNewSession) {
                loadSessions();
            }

        } catch (err) {
            console.error('AI chat қатесі:', err);
            setMessages(prev => [...prev, {
                role: 'assistant',
                text: '❌ Кешіріңіз, қате орын алды. Қайталап көріңіз.',
            }]);
            setLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage(input);
        }
    };

    // Хабарлама мәтініндегі код блоктарын форматтау
    const formatMessage = (text) => {
        const parts = text.split(/(```[\s\S]*?```)/g);
        return parts.map((part, i) => {
            if (part.startsWith('```') && part.endsWith('```')) {
                const code = part.replace(/^```\w*\n?/, '').replace(/\n?```$/, '');
                return (
                    <pre key={i} className="my-2 p-3 bg-black/50 rounded-lg overflow-x-auto border border-gray-700">
                        <code className="text-green-400 font-mono text-xs">{code}</code>
                    </pre>
                );
            }
            // Қалың мәтін (bold)
            const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
            return (
                <span key={i}>
                    {boldParts.map((bp, j) => {
                        if (bp.startsWith('**') && bp.endsWith('**')) {
                            return <strong key={j} className="text-white font-semibold">{bp.slice(2, -2)}</strong>;
                        }
                        return bp;
                    })}
                </span>
            );
        });
    };

    return (
        <>
            {/* Floating Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 transform hover:scale-110 ${isOpen
                        ? 'bg-gray-700 hover:bg-gray-600 rotate-0'
                        : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500'
                    }`}
                title="AI Көмекші"
            >
                {isOpen ? (
                    <span className="text-xl">✕</span>
                ) : (
                    <>
                        <span className="text-2xl">🤖</span>
                        <span className="absolute inset-0 rounded-full bg-purple-500 animate-ping opacity-20"></span>
                    </>
                )}
            </button>

            {/* Чат терезесі */}
            {isOpen && (
                <div
                    className="ai-chat-panel fixed bottom-24 right-6 z-50 w-[800px] max-w-[90vw] h-[600px] max-h-[80vh] flex flex-row rounded-2xl overflow-hidden border border-gray-700 shadow-2xl"
                    style={{
                        animation: 'chatSlideUp 0.3s ease-out',
                    }}
                >
                    {/* Бүйірлік тақта (Sidebar) */}
                    <div className="w-56 md:w-64 flex-none bg-gray-900/60 border-r border-gray-700/50 flex flex-col p-3 z-10 relative">
                        <button
                            onClick={startNewChat}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-purple-500/50 hover:bg-purple-600/20 text-purple-200 text-sm font-mono rounded-lg transition-all"
                        >
                            <span>➕</span> Жаңа чат
                        </button>

                        <div className="mt-4 flex-1 overflow-y-auto space-y-2 pr-1">
                            {sessions.map((s) => (
                                <div
                                    key={s.session_id}
                                    onClick={() => setSessionId(s.session_id)}
                                    className={`group flex items-center justify-between px-3 py-2.5 cursor-pointer rounded-lg transition-all ${
                                        sessionId === s.session_id ? 'bg-purple-600/30 border border-purple-500/50' : 'hover:bg-white/5 border border-transparent'
                                    }`}
                                >
                                    <div className="truncate text-xs font-mono text-gray-300 max-w-[150px]" title={s.title}>
                                        💬 {s.title || 'Жаңа сессия'}
                                    </div>
                                    <button
                                        onClick={(e) => deleteSession(s.session_id, e)}
                                        className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 text-gray-500 transition-all text-sm"
                                        title="Чатты өшіру"
                                    >
                                        🗑️
                                    </button>
                                </div>
                            ))}
                            {sessions.length === 0 && (
                                <p className="text-xs text-gray-500 p-2 text-center font-mono">Чат тарихы бос</p>
                            )}
                        </div>
                    </div>

                    {/* Чат аймағы */}
                    <div className="flex-1 min-w-0 flex flex-col bg-transparent">
                        {/* Тақырыпша (Header) */}
                        <div className="bg-gradient-to-r from-purple-600/90 to-pink-600/90 py-3 px-5 flex items-center gap-3 border-b border-white/10 shrink-0">
                            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-lg">🤖</div>
                            <div>
                                <div className="font-bold text-sm font-mono text-white">PyLearn AI</div>
                                <div className="text-xs text-purple-200 flex items-center gap-1">
                                    <span className="w-2 h-2 bg-green-400 rounded-full inline-block animate-pulse"></span>
                                    Онлайн
                                </div>
                            </div>
                        </div>

                        {/* Хабарламалар */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {messages.length === 0 && !loading && (
                                <div className="text-center py-6 h-full flex flex-col items-center justify-center">
                                    <div className="text-5xl mb-4">🐍</div>
                                    <div className="text-sm font-mono text-gray-300 mb-2">
                                        Сәлем! Мен PyLearn AI көмекшісімін
                                    </div>
                                    <div className="text-xs text-gray-400 mb-6">
                                        Python туралы кез келген сұрақ қойыңыз
                                    </div>

                                    {/* Ұсынылатын сұрақтар */}
                                    <div className="flex flex-wrap justify-center gap-2 max-w-md">
                                        {SUGGESTED_QUESTIONS.map((q, i) => (
                                            <button
                                                key={i}
                                                onClick={() => sendMessage(q)}
                                                className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-gray-700 rounded-lg text-xs font-mono text-gray-300 transition-all hover:border-purple-500/50"
                                            >
                                                {q}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {messages.map((msg, i) => (
                                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                                            msg.role === 'user'
                                                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-br-sm'
                                                : 'bg-gray-800/90 text-gray-200 border border-gray-700 rounded-bl-sm shadow-lg'
                                        }`}
                                    >
                                        {msg.role === 'assistant' ? (
                                            <div className="whitespace-pre-wrap break-words format-content">{formatMessage(msg.text)}</div>
                                        ) : (
                                            <div className="whitespace-pre-wrap break-words">{msg.text}</div>
                                        )}
                                    </div>
                                </div>
                            ))}

                            {loading && (
                                <div className="flex justify-start">
                                    <div className="bg-gray-800/90 border border-gray-700 px-5 py-4 rounded-2xl rounded-bl-sm shadow-lg">
                                        <div className="flex items-center gap-2">
                                            <div className="flex gap-1.5">
                                                <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                                <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                                <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                                            </div>
                                            <span className="text-xs text-gray-400 font-mono ml-1">ойлануда...</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div ref={messagesEndRef} className="h-1" />
                        </div>

                        {/* Хабарлама енгізу аймағы */}
                        <div className="shrink-0 p-4 border-t border-gray-700/50 bg-gray-900/40">
                            {context && (
                                <div className="mb-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-md">
                                    <div className="text-xs font-mono text-blue-400 truncate">
                                        📌 {context}
                                    </div>
                                </div>
                            )}
                            <div className="flex items-end gap-3">
                                <textarea
                                    ref={inputRef}
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Сұрағыңызды жазыңыз..."
                                    className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm font-mono text-white resize-none outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all placeholder-gray-500"
                                    rows={1}
                                    style={{ maxHeight: '120px' }}
                                    disabled={loading}
                                />
                                <button
                                    onClick={() => sendMessage(input)}
                                    disabled={loading || !input.trim()}
                                    className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all shadow-lg ${loading || !input.trim()
                                            ? 'bg-gray-700/50 cursor-not-allowed text-gray-500'
                                            : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 transform hover:scale-105 text-white'
                                        }`}
                                >
                                    <span className="text-xl">✈</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
        @keyframes chatSlideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        /* Чат үшін арнайы скроллбар */
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.2); }
      `}</style>
        </>
    );
}
