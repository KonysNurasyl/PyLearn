import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { API_BASE } from "../config/api";

const Learn = () => {
  const { user, token } = useAuth();
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [levels, setLevels] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [passedLessons, setPassedLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedLesson, setExpandedLesson] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [lvRes, lsRes] = await Promise.all([
          fetch(`${API_BASE}/api/levels`),
          fetch(`${API_BASE}/api/lessons`),
        ]);
        if (!lvRes.ok) throw new Error('Деңгейлерді жүктеу мүмкін болмады');
        if (!lsRes.ok) throw new Error('Сабақтарды жүктеу мүмкін болмады');
        const lvJson = await lvRes.json();
        const lsJson = await lsRes.json();
        setLevels(lvJson || []);
        const normalized = (lsJson || []).map((l) => ({
          id: l.id,
          title: l.title,
          level: l.level_id,
          lesson_number: l.lesson_number,
          content: l.content
        }));
        setLessons(normalized);

        // Авторизацияланған болса, өткен сабақтарды жүктеу
        if (token && user) {
          try {
            const pRes = await fetch(`${API_BASE}/api/users/${user.id}/passed_lessons`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            if (pRes.ok) {
              setPassedLessons(await pRes.json());
            }
          } catch(e) {
             console.warn("Passed lessons жүктелмеді", e);
          }
        }
      } catch (err) {
        console.error(err);
        setError(err.message || 'Контентті жүктеу қатесі');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user, token]);

  const filteredLessons = selectedLevel
    ? lessons.filter((l) => Number(l.level) === Number(selectedLevel))
    : lessons;

  const getLevelIcon = (levelNumber) => {
    const icons = ['🌱', '🌿', '🌳', '🚀', '⭐', '💎'];
    return icons[levelNumber - 1] || '📚';
  };

  const getLevelColor = (levelNumber) => {
    const colors = [
      'from-green-600 to-emerald-600',
      'from-blue-600 to-cyan-600',
      'from-purple-600 to-pink-600',
      'from-orange-600 to-red-600',
      'from-yellow-600 to-orange-600',
      'from-indigo-600 to-purple-600'
    ];
    return colors[levelNumber - 1] || 'from-gray-600 to-gray-700';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400 font-mono">Контент жүктелуде…</p>
        </div>
      </div>
    );
  }

  // Бұғаттан шығарылған мәртебені ғаламдық түрде анықтау
  const unlockedMap = {};
  if (lessons.length > 0) {
    unlockedMap[lessons[0].id] = true; // Бірінші сабақ әрқашан ашық
    for (let i = 1; i < lessons.length; i++) {
       const prevLessonId = lessons[i-1].id;
       unlockedMap[lessons[i].id] = passedLessons.includes(prevLessonId);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 text-white">

      {/* Анимациялық фондық тор */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `linear-gradient(#1e293b 1px, transparent 1px),
                           linear-gradient(90deg, #1e293b 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
          animation: 'gridMove 30s linear infinite'
        }}></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-12">

        {/* Басты тақырып */}
        <div className="mb-12 text-center">
          <div className="inline-block mb-4 px-4 py-2 bg-blue-500/10 border border-blue-500/30 rounded-full text-blue-400 text-sm font-mono animate-fade-in">
            {'>>> python_learning_path = True'}
          </div>

          <h1 className="text-5xl md:text-6xl font-bold mb-6 animate-slide-up">
            <span className="text-gray-400 font-mono">&gt;&gt;&gt; </span>
            <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 text-transparent bg-clip-text">
              Python тілін меңгеру
            </span>
          </h1>

          <p className="text-xl text-gray-300 max-w-2xl mx-auto animate-slide-up-delayed">
            Python бағдарламалауды меңгеруге көмектесетін құрылымдық сабақтар мен практикалық жаттығулар.
          </p>

          {/* Статистика тақтасы */}
          <div className="flex items-center justify-center gap-8 mt-8 animate-fade-in-delayed">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400">{levels.length}</div>
              <div className="text-sm text-gray-400 font-mono">Деңгей</div>
            </div>
            <div className="w-px h-8 bg-gray-700"></div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">{lessons.length}</div>
              <div className="text-sm text-gray-400 font-mono">Сабақтар</div>
            </div>
            <div className="w-px h-8 bg-gray-700"></div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-400">100+</div>
              <div className="text-sm text-gray-400 font-mono">Жаттығулар</div>
            </div>
          </div>
        </div>

        {/* Қатені көрсету */}
        {error && (
          <div className="mb-8 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-center font-mono">
            ⚠️ {error}
          </div>
        )}

        {/* Деңгейді таңдау */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-3xl font-bold font-mono">
              <span className="text-green-400"># </span>
              Деңгейді таңдаңыз
            </h2>
            {selectedLevel && (
              <button
                onClick={() => setSelectedLevel(null)}
                className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg font-mono text-sm hover:bg-gray-700 transition-all duration-300"
              >
                Фильтрді тазалау ✕
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {levels.map((lvl, index) => (
              <button
                key={lvl.id}
                onClick={() => setSelectedLevel(selectedLevel === lvl.id ? null : lvl.id)}
                className={`group relative overflow-hidden text-left p-6 rounded-xl border-2 transition-all duration-300 transform hover:scale-105 ${selectedLevel === lvl.id
                    ? `bg-gradient-to-br ${getLevelColor(lvl.level_number || index + 1)} border-transparent shadow-lg`
                    : 'bg-gray-800/50 backdrop-blur-sm border-gray-700 hover:border-gray-600'
                  }`}
              >
                {/* Фондық градиент әсері */}
                {selectedLevel !== lvl.id && (
                  <div className={`absolute inset-0 bg-gradient-to-br ${getLevelColor(lvl.level_number || index + 1)} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}></div>
                )}

                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-3">
                    <div className={`text-4xl ${selectedLevel === lvl.id ? '' : 'group-hover:scale-110 transition-transform'}`}>
                      {getLevelIcon(lvl.level_number || index + 1)}
                    </div>
                    {selectedLevel === lvl.id && (
                      <div className="px-2 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs font-mono">
                        Таңдалды ✓
                      </div>
                    )}
                  </div>

                  <h3 className="text-xl font-bold font-mono mb-2">{lvl.title}</h3>
                  <p className="text-sm text-gray-300 line-clamp-2">
                    {lvl.description || `Деңгей ${lvl.level_number || lvl.id}`}
                  </p>

                  {/* Сабақтар саны */}
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <div className="text-xs font-mono text-gray-300">
                      {lessons.filter(l => Number(l.level) === Number(lvl.id)).length} сабақ
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Сабақтар торы */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-3xl font-bold font-mono">
              <span className="text-blue-400"># </span>
              {selectedLevel ? 'Таңдалған сабақтар' : 'Барлық сабақтар'}
            </h2>
            <div className="px-4 py-2 bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-700 font-mono text-sm text-gray-400">
              {filteredLessons.length} сабақ көрсетілуде
            </div>
          </div>

          {filteredLessons.length === 0 ? (
            <div className="text-center py-16 bg-gray-800/30 backdrop-blur-sm rounded-lg border border-gray-700">
              <div className="text-6xl mb-4">📚</div>
              <p className="text-gray-400 font-mono">Әзірге сабақтар жоқ</p>
              <p className="text-sm text-gray-500 font-mono mt-2">Жақында жаңа сабақтар қосылады!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredLessons.map((ls, index) => {
                const isUnlocked = unlockedMap[ls.id];
                return (
                <div
                  key={ls.id}
                  className={`group bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-700 overflow-hidden transition-all duration-300 ${isUnlocked ? 'hover:border-blue-500/50' : 'opacity-60 grayscale'}`}
                >
                  {/* Сабақтың тақырыбы */}
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-mono font-bold text-lg ${isUnlocked ? 'bg-gradient-to-br from-blue-500 to-purple-600' : 'bg-gray-700 text-gray-500'}`}>
                          {isUnlocked ? (ls.lesson_number || index + 1) : '🔒'}
                        </div>
                        <div>
                          <h3 className={`text-lg font-bold font-mono transition-colors ${isUnlocked ? 'group-hover:text-blue-400' : 'text-gray-400'}`}>
                            {ls.title}
                          </h3>
                          <div className="text-xs text-gray-400 font-mono mt-1">
                            Деңгей {ls.level} • Сабақ {ls.lesson_number || index + 1}
                            {passedLessons.includes(ls.id) && <span className="ml-2 text-green-400">✓ Өтілді</span>}
                          </div>
                        </div>
                      </div>

                      {isUnlocked && (
                        <button
                          onClick={() => setExpandedLesson(expandedLesson === ls.id ? null : ls.id)}
                          className="text-gray-400 hover:text-white transition-colors"
                        >
                          <span className={`transform transition-transform ${expandedLesson === ls.id ? 'rotate-180' : ''}`}>
                            ▼
                          </span>
                        </button>
                      )}
                    </div>

                    {/* Мазмұнды алдын ала қарау */}
                    {ls.content && (
                      <p className="text-sm text-gray-400 line-clamp-2 mb-4">
                        {isUnlocked ? ls.content : 'Бұл сабақты ашу үшін алдыңғы сабақтың тестінен 80% жинау қажет.'}
                      </p>
                    )}

                    {/* Әрекет батырмалары */}
                    <div className="flex items-center gap-2">
                        {isUnlocked ? (
                          <Link
                            to={`/learn/${ls.id}`}
                            className="flex-1 py-2 px-4 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg font-mono text-sm font-semibold text-center hover:from-blue-500 hover:to-purple-500 transition-all duration-300"
                          >
                            Оқуды бастау →
                          </Link>
                        ) : (
                          <button disabled className="flex-1 py-2 px-4 bg-gray-700 rounded-lg font-mono text-sm font-semibold text-center text-gray-500 cursor-not-allowed">
                            Жабық 🔒
                          </button>
                        )}
                        <Link
                          to="/solve-problem"
                          className="px-4 py-2 bg-gray-700 rounded-lg font-mono text-sm font-semibold hover:bg-gray-600 transition-all duration-300"
                        >
                          Жаттығулар ⚡
                        </Link>
                    </div>
                  </div>

                  {/* Кеңейтілген мазмұн */}
                  {isUnlocked && expandedLesson === ls.id && ls.content && (
                    <div className="px-5 pb-5 border-t border-gray-700 pt-4 animate-slideDown">
                      <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700">
                        <h4 className="font-mono text-sm text-gray-400 mb-2">Сабаққа шолу:</h4>
                        <p className="text-sm text-gray-300 font-mono leading-relaxed">
                          {ls.content}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )})}
            </div>
          )}
        </section>

        {/* Мүмкіндік карталары */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold font-mono mb-6">
            <span className="text-purple-400"># </span>
            Оқу ресурстары
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="group p-6 bg-gradient-to-br from-blue-600/20 to-cyan-600/20 border border-blue-500/30 rounded-lg backdrop-blur-sm hover:scale-105 transition-all duration-300">
              <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">⚡</div>
              <h4 className="text-xl font-bold font-mono mb-2">Интерактивті жаттығулар</h4>
              <p className="text-sm text-gray-300">
                Біліміңізді тексеру үшін практикалық зертханалар мен тест тапсырмаларын орындаңыз және бірден кері байланыс алыңыз
              </p>
            </div>

            <div className="group p-6 bg-gradient-to-br from-purple-600/20 to-pink-600/20 border border-purple-500/30 rounded-lg backdrop-blur-sm hover:scale-105 transition-all duration-300">
              <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">📖</div>
              <h4 className="text-xl font-bold font-mono mb-2">Қадамдық нұсқаулықтар</h4>
              <p className="text-sm text-gray-300">
                Бастапқы деңгейден жетілдірілген концепцияларға дейінгі толыққанды оқулықтар
              </p>
            </div>

            <div className="group p-6 bg-gradient-to-br from-green-600/20 to-emerald-600/20 border border-green-500/30 rounded-lg backdrop-blur-sm hover:scale-105 transition-all duration-300">
              <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">👥</div>
              <h4 className="text-xl font-bold font-mono mb-2">Қауымдастық қолдауы</h4>
              <p className="text-sm text-gray-300">
                Мәселелерді талқылаңыз, шешімдермен бөлісіңіз және әріптестерден көмек алыңыз
              </p>
            </div>
          </div>
        </section>

        {/* Әрекетке шақыру бөлімі */}
        <section className="mb-12 bg-gradient-to-r from-purple-600/20 to-pink-600/20 border border-purple-500/30 rounded-lg p-8 text-center backdrop-blur-sm">
          <h3 className="text-3xl font-bold mb-3">Кодтауға дайынсыз ба?</h3>
          <p className="text-gray-300 mb-6 font-mono max-w-2xl mx-auto">
            Біздің интерактивті кодтау ортасына кіріп, нақты жобаларды жасауға кірісіңіз
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <a
              href="/solve-problem"
              className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg font-mono font-semibold hover:from-purple-500 hover:to-pink-500 transition-all duration-300 transform hover:scale-105"
            >
              Жаттығуды бастаңыз ⚡
            </a>
            <a
              href="/dashboard"
              className="px-8 py-3 bg-gray-800 border border-gray-700 rounded-lg font-mono font-semibold hover:bg-gray-700 transition-all duration-300"
            >
              Бақылау тақтасына өту
            </a>
          </div>
        </section>

        {/* Төменгі деректеме (Footer) */}
        <footer className="text-center py-6 border-t border-gray-800">
          <p className="text-sm text-gray-500 font-mono">
            © {new Date().getFullYear()} PyLearn — Кодтаудан ләззат алыңыз! 🐍
          </p>
        </footer>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes gridMove {
          0% { transform: translate(0, 0); }
          100% { transform: translate(60px, 60px); }
        }
        
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes slideUp {
          from { 
            opacity: 0;
            transform: translateY(30px);
          }
          to { 
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        .animate-slideDown {
          animation: slideDown 0.3s ease-out;
        }
        
        .animate-slide-up {
          animation: slideUp 0.8s ease-out;
        }
        
        .animate-slide-up-delayed {
          animation: slideUp 0.8s ease-out 0.2s backwards;
        }
        
        .animate-fade-in {
          animation: fadeIn 1s ease-out;
        }
        
        .animate-fade-in-delayed {
          animation: fadeIn 1s ease-out 0.4s backwards;
        }

        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}} />
    </div>
  );
};

export default Learn;
