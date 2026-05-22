import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { API_BASE } from "../config/api";

const REGISTER_CODE_SNIPPETS = [
  "user = User()",
  "create_account()",
  "new_user.save()",
  "class NewUser:",
  "def __init__():",
  "self.email = ''",
  "return user",
  "user.register()",
];

export default function Register() {
  const { login } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [floatingCode, setFloatingCode] = useState([]);
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    // Қалқымалы код элементтерін жасау (Floating code)
    const codeElements = Array.from({ length: 12 }, (_, i) => ({
      id: i,
      text: REGISTER_CODE_SNIPPETS[Math.floor(Math.random() * REGISTER_CODE_SNIPPETS.length)],
      left: Math.random() * 100,
      delay: Math.random() * 5,
      duration: 12 + Math.random() * 8,
    }));
    setFloatingCode(codeElements);

    // Бөлшектер әсерін жасау (Particle effects)
    const particleElements = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      size: 2 + Math.random() * 3,
      left: Math.random() * 100,
      top: Math.random() * 100,
      delay: Math.random() * 3,
      duration: 3 + Math.random() * 4,
    }));
    setParticles(particleElements);
  }, []);

  const handleRegister = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const text = await res.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = { message: text };
      }
      if (!res.ok) throw new Error((data && data.message) || 'Тіркелу сәтсіз аяқталды');
      if (data && data.token) {
        login(data, data.token);
      }
      alert('Есептік жазба сәтті құрылды! 🎉 Бақылау тақтасына бағытталуда…');
      window.location.href = '/dashboard';
    } catch (err) {
      alert(err.message || 'Тіркелу сәтсіз аяқталды');
    } finally {
      setLoading(false);
    }
  };

  // handle form submit so Enter works
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email || !password) return;
    handleRegister();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-black flex items-center justify-center p-4 relative overflow-hidden">
      
      {/* Animated Background Grid */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `linear-gradient(#1e293b 1px, transparent 1px),
                           linear-gradient(90deg, #1e293b 1px, transparent 1px)`,
          backgroundSize: '50px 50px',
          animation: 'gridMove 25s linear infinite'
        }}></div>
      </div>

      {/* Floating Code Snippets */}
      {floatingCode.map((item) => (
        <div
          key={item.id}
          className="absolute text-purple-400/20 font-mono text-sm pointer-events-none"
          style={{
            left: `${item.left}%`,
            animation: `floatUp ${item.duration}s linear infinite`,
            animationDelay: `${item.delay}s`,
          }}
        >
          {item.text}
        </div>
      ))}

      {/* Particle Effects */}
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute rounded-full bg-purple-500/30 pointer-events-none"
          style={{
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            left: `${particle.left}%`,
            top: `${particle.top}%`,
            animation: `pulse ${particle.duration}s ease-in-out infinite`,
            animationDelay: `${particle.delay}s`,
          }}
        ></div>
      ))}

      {/* Register Card */}
      <div className="w-full max-w-md relative z-10">
        {/* Glowing Effect */}
        <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 rounded-2xl blur opacity-25 animate-pulse"></div>
        
        <div className="relative bg-gray-800/90 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-700 overflow-hidden">
          
          {/* Terminal Header */}
          <div className="bg-gray-900 px-4 py-3 flex items-center gap-2 border-b border-gray-700">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="ml-4 text-gray-400 text-sm font-mono">registration.py</span>
          </div>

          {/* Content */}
          <div className="p-8">
            {/* Title with code style */}
            <div className="mb-8">
              <div className="text-sm font-mono text-green-400 mb-2">
                <span className="text-purple-400">class</span>{" "}
                <span className="text-yellow-300">NewUser</span>
                <span className="text-green-400">(</span>
                <span className="text-blue-300">BaseUser</span>
                <span className="text-green-400">):</span>
              </div>
              <h2 className="text-3xl font-bold text-white mb-1 font-mono">
                <span className="text-gray-400">&gt;&gt;&gt; </span>
                Есептік жазба құру
              </h2>
              <p className="text-gray-400 text-sm font-mono ml-10">
                # Оқу сапарыңызды бастаңыз
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Name Input (optional) */}
              <div>
                <label className="block text-gray-400 text-sm font-mono mb-2">
                  <span className="text-purple-400">self</span>
                  <span className="text-green-400">.</span>
                  name <span className="text-gray-500">=</span>
                </label>
                <div className="relative group">
                  <input
                    type="text"
                    placeholder="Аты-жөні"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 pl-10 rounded-lg bg-gray-900 border border-gray-600 text-white placeholder-gray-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition font-mono group-hover:border-gray-500"
                  />
                  <span className="absolute left-3 top-3.5 text-purple-400">👤</span>
                </div>
              </div>

              {/* Email Input */}
              <div>
                <label className="block text-gray-400 text-sm font-mono mb-2">
                  <span className="text-purple-400">self</span>
                  <span className="text-green-400">.</span>
                  email <span className="text-gray-500">=</span>
                </label>
                <div className="relative group">
                  <input
                    type="email"
                    placeholder="user@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 pl-10 rounded-lg bg-gray-900 border border-gray-600 text-white placeholder-gray-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition font-mono group-hover:border-gray-500"
                  />
                  <span className="absolute left-3 top-3.5 text-purple-400">✉</span>
                </div>
              </div>

              {/* Password Input */}
              <div>
                <label className="block text-gray-400 text-sm font-mono mb-2">
                  <span className="text-purple-400">self</span>
                  <span className="text-green-400">.</span>
                  password <span className="text-gray-500">=</span>
                </label>
                <div className="relative group">
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 pl-10 rounded-lg bg-gray-900 border border-gray-600 text-white placeholder-gray-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition font-mono group-hover:border-gray-500"
                  />
                  <span className="absolute left-3 top-3.5 text-purple-400">🔐</span>
                </div>
              </div>

              {/* Password Strength Indicator */}
              {password && (
                <div className="space-y-2">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((level) => (
                      <div
                        key={level}
                        className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                          password.length >= level * 2
                            ? level <= 2
                              ? "bg-red-500"
                              : level === 3
                              ? "bg-yellow-500"
                              : "bg-green-500"
                            : "bg-gray-700"
                        }`}
                      ></div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 font-mono">
                    # Қауіпсіздік деңгейі: {password.length < 4 ? "Әлсіз" : password.length < 6 ? "Орташа" : password.length < 8 ? "Жақсы" : "Сенімді"}
                  </p>
                </div>
              )}

              {/* Register Button */}
              <button
                type="submit"
                disabled={loading || !email || !password}
                className={`w-full py-3 rounded-lg font-mono font-semibold text-white transition-all duration-300 transform ${
                  loading || !email || !password
                    ? "bg-gray-700 cursor-not-allowed"
                    : "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 hover:scale-105 hover:shadow-lg hover:shadow-purple-500/50 active:scale-95"
                }`}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin">⚙</span>
                    <span>Қолданушы профилі құрылуда…</span>
                  </span>
                ) : (
                  <span>
                    <span className="text-yellow-300">User</span>
                    <span className="text-green-400">.</span>
                    <span className="text-blue-300">create</span>
                    <span className="text-green-400">()</span>
                  </span>
                )}
              </button>

              {/* Terms */}
              <p className="text-xs text-gray-500 text-center font-mono">
                # Тіркелу арқылы сіз біздің{" "}
                <a href="#" className="text-purple-400 hover:text-purple-300">
                  пайдалану шарттарымен
                </a>{" "}
                келісесіз
              </p>
            </form>

            {/* Login Link */}
            <div className="mt-8 pt-6 border-t border-gray-700">
              <p className="text-center text-sm text-gray-400 font-mono">
                <span className="text-gray-500"># Тіркелгенсіз бе?</span>{" "}
                <a href="/login" className="text-green-400 hover:text-green-300 transition font-semibold">
                  login()
                </a>
              </p>
            </div>
          </div>

          {/* Terminal Footer */}
          <div className="bg-gray-900 px-4 py-2 border-t border-gray-700">
            <div className="flex items-center justify-between text-xs font-mono text-gray-500">
              <div className="flex items-center gap-2">
                <span className="text-green-400">●</span>
                <span>PyLearn тіркеу API интерфейсі</span>
              </div>
              <span className="text-gray-600">v2.0</span>
            </div>
          </div>
        </div>

        {/* Feature Pills */}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <div className="px-4 py-2 bg-gray-800/50 backdrop-blur-sm rounded-full border border-gray-700 text-xs font-mono text-gray-400 flex items-center gap-2">
            <span className="text-green-400">✓</span>
            <span>Әрқашан тегін</span>
          </div>
          <div className="px-4 py-2 bg-gray-800/50 backdrop-blur-sm rounded-full border border-gray-700 text-xs font-mono text-gray-400 flex items-center gap-2">
            <span className="text-blue-400">⚡</span>
            <span>Лезде қолжетімді</span>
          </div>
          <div className="px-4 py-2 bg-gray-800/50 backdrop-blur-sm rounded-full border border-gray-700 text-xs font-mono text-gray-400 flex items-center gap-2">
            <span className="text-purple-400">🎓</span>
            <span>100+ Тапсырмалар</span>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes gridMove {
          0% { transform: translate(0, 0); }
          100% { transform: translate(50px, 50px); }
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

        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
            opacity: 0.3;
          }
          50% {
            transform: scale(1.5);
            opacity: 0.1;
          }
        }
      `}} />
    </div>
  );
}
