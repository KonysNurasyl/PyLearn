import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { API_BASE } from "../config/api";

const LOGIN_CODE_SNIPPETS = [
  "import auth",
  "def login():",
  "user.auth()",
  "return True",
  "class User:",
  "if valid:",
  "pass",
  "except:",
];

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [floatingCode, setFloatingCode] = useState([]);

  useEffect(() => {
    // Кездейсоқ қалқымалы код элементтерін жасау (Floating code)
    const elements = Array.from({ length: 15 }, (_, i) => ({
      id: i,
      text: LOGIN_CODE_SNIPPETS[Math.floor(Math.random() * LOGIN_CODE_SNIPPETS.length)],
      left: Math.random() * 100,
      delay: Math.random() * 5,
      duration: 10 + Math.random() * 10,
    }));
    setFloatingCode(elements);
  }, []);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const text = await res.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = { message: text };
      }

      if (!res.ok) throw new Error((data && data.message) || 'Кіру сәтсіз аяқталды');

      if (data && data.token) {
        login(data, data.token);
      }

      // Тіркелген күнді қарапайым ескерту орнына көрсету
      alert(`Кіру сәтті өтті!\nҚолданушы: ${data.name}\nEmail: ${data.email}\nТіркелген күн: ${new Date(data.created_at).toLocaleString()}`);

      window.location.href = '/dashboard';
    } catch (err) {
      alert(err.message || 'Кіру сәтсіз аяқталды');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email || !password) return;
    handleLogin();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 flex items-center justify-center p-4 relative overflow-hidden">
      
      {/* Animated Background Grid */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `linear-gradient(#1e293b 1px, transparent 1px),
                           linear-gradient(90deg, #1e293b 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
          animation: 'gridMove 20s linear infinite'
        }}></div>
      </div>

      {/* Floating Code Snippets */}
      {floatingCode.map((item) => (
        <div
          key={item.id}
          className="absolute text-blue-400/20 font-mono text-xs pointer-events-none"
          style={{
            left: `${item.left}%`,
            animation: `floatUp ${item.duration}s linear infinite`,
            animationDelay: `${item.delay}s`,
          }}
        >
          {item.text}
        </div>
      ))}

      {/* Login Card */}
      <div className="w-full max-w-md relative z-10">
        {/* Glowing Effect */}
        <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-2xl blur opacity-20 animate-pulse"></div>
        
        <div className="relative bg-gray-800/90 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-700 overflow-hidden">
          
          {/* Terminal Header */}
          <div className="bg-gray-900 px-4 py-3 flex items-center gap-2 border-b border-gray-700">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="ml-4 text-gray-400 text-sm font-mono">authentication.py</span>
          </div>

          {/* Content */}
          <div className="p-8">
            {/* Title with typing effect */}
            <div className="mb-8">
              <div className="text-sm font-mono text-green-400 mb-2">
                <span className="text-purple-400">class</span>{" "}
                <span className="text-yellow-300">UserAuth</span>
                <span className="text-green-400">:</span>
              </div>
              <h2 className="text-3xl font-bold text-white mb-1 font-mono">
                <span className="text-gray-400">&gt;&gt;&gt; </span>
                Қош келдіңіз!
              </h2>
              <p className="text-gray-400 text-sm font-mono ml-10">
                # Жалғастыру үшін жүйеге кіріңіз
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email Input */}
              <div>
                <label className="block text-gray-400 text-sm font-mono mb-2">
                  <span className="text-purple-400">def</span> email<span className="text-yellow-300">()</span>:
                </label>
                <div className="relative">
                  <input
                    type="email"
                    placeholder="user@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 pl-10 rounded-lg bg-gray-900 border border-gray-600 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition font-mono"
                  />
                  <span className="absolute left-3 top-3.5 text-gray-500">@</span>
                </div>
              </div>

              {/* Password Input */}
              <div>
                <label className="block text-gray-400 text-sm font-mono mb-2">
                  <span className="text-purple-400">def</span> password<span className="text-yellow-300">()</span>:
                </label>
                <div className="relative">
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 pl-10 rounded-lg bg-gray-900 border border-gray-600 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition font-mono"
                  />
                  <span className="absolute left-3 top-3.5 text-gray-500">#</span>
                </div>
              </div>

              {/* Login Button */}
              <button
                type="submit"
                disabled={loading || !email || !password}
                className={`w-full py-3 rounded-lg font-mono font-semibold text-white transition-all duration-300 transform ${
                  loading || !email || !password
                    ? "bg-gray-700 cursor-not-allowed"
                    : "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 hover:scale-105 hover:shadow-lg hover:shadow-blue-500/50 active:scale-95"
                }`}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin">⚙</span>
                    <span>Аутентификация жүргізілуде...</span>
                  </span>
                ) : (
                  <span>
                    <span className="text-yellow-300">execute</span>
                    <span className="text-green-400">(</span>
                    login
                    <span className="text-green-400">)</span>
                  </span>
                )}
              </button>

              {/* Forgot Password */}
              <div className="text-center">
                <a href="#" className="text-sm text-blue-400 hover:text-blue-300 transition font-mono">
                  # Құпиясөзді ұмыттыңыз ба?
                </a>
              </div>
            </form>

            {/* Sign Up Link */}
            <div className="mt-8 pt-6 border-t border-gray-700">
              <p className="text-center text-sm text-gray-400 font-mono">
                <span className="text-gray-500"># Жаңа қолданушысыз ба?</span>{" "}
                <a href="/register" className="text-green-400 hover:text-green-300 transition font-semibold">
                  register()
                </a>
              </p>
            </div>
          </div>

          {/* Terminal Footer */}
          <div className="bg-gray-900 px-4 py-2 border-t border-gray-700">
            <div className="flex items-center gap-2 text-xs font-mono text-gray-500">
              <span className="text-green-400">●</span>
              <span>PyLearn Auth серверіне қосылды</span>
            </div>
          </div>
        </div>

        {/* Security Badge */}
        <div className="mt-4 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800/50 backdrop-blur-sm rounded-full border border-gray-700 text-xs font-mono text-gray-400">
            <span className="text-green-400">🔒</span>
            <span>256-биттік SSL шифрлауы</span>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes gridMove {
          0% { transform: translate(0, 0); }
          100% { transform: translate(40px, 40px); }
        }
        
        @keyframes floatUp {
          0% {
            transform: translateY(100vh) rotate(0deg);
            opacity: 0;
          }
          10% {
            opacity: 0.3;
          }
          90% {
            opacity: 0.3;
          }
          100% {
            transform: translateY(-100vh) rotate(360deg);
            opacity: 0;
          }
        }
      `}} />
    </div>
  );
}
