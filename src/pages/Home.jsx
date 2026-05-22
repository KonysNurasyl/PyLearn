import { Link } from "react-router-dom";
import { useState, useEffect } from "react";

const HOME_CODE_SNIPPETS = [
  "def hello_world():",
  "    print('Hello, World!')",
  "",
  "for i in range(10):",
  "    print(i)",
];

const Home = () => {
  const [code, setCode] = useState("");
  const [cursorVisible, setCursorVisible] = useState(true);

  useEffect(() => {
    let currentLine = 0;
    let currentChar = 0;
    let currentCode = "";

    const typeCode = setInterval(() => {
      if (currentLine < HOME_CODE_SNIPPETS.length) {
        if (currentChar < HOME_CODE_SNIPPETS[currentLine].length) {
          currentCode += HOME_CODE_SNIPPETS[currentLine][currentChar];
          setCode(currentCode);
          currentChar++;
        } else {
          currentCode += "\n";
          setCode(currentCode);
          currentLine++;
          currentChar = 0;
        }
      } else {
        clearInterval(typeCode);
      }
    }, 50);

    const cursorBlink = setInterval(() => {
      setCursorVisible(v => !v);
    }, 530);

    return () => {
      clearInterval(typeCode);
      clearInterval(cursorBlink);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white flex flex-col relative overflow-hidden">

      {/* Анимациялық фондық тор */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `linear-gradient(#1e293b 1px, transparent 1px),
                           linear-gradient(90deg, #1e293b 1px, transparent 1px)`,
          backgroundSize: '50px 50px',
          animation: 'gridMove 20s linear infinite'
        }}></div>
      </div>

      {/* Қалқымалы код блоктары */}
      <div className="absolute top-20 left-10 opacity-20 text-blue-400 font-mono text-sm animate-float">
        {'</>'}
      </div>
      <div className="absolute top-40 right-20 opacity-20 text-green-400 font-mono text-sm animate-float-delayed">
        {'def func():'}
      </div>
      <div className="absolute bottom-40 left-20 opacity-20 text-yellow-400 font-mono text-sm animate-float">
        {'import pandas'}
      </div>
      <div className="absolute bottom-20 right-40 opacity-20 text-purple-400 font-mono text-sm animate-float-delayed">
        {'while True:'}
      </div>

      {/* БАСТЫ БӨЛІМ */}
      <div className="flex-1 flex flex-col lg:flex-row items-center justify-center px-4 py-12 gap-12 relative z-10">

        {/* Сол жақ - Мәтіндік мазмұн */}
        <div className="flex-1 max-w-xl text-center lg:text-left">
          <div className="inline-block mb-4 px-4 py-2 bg-blue-500/10 border border-blue-500/30 rounded-full text-blue-400 text-sm font-mono animate-fade-in">
            {'>>> python_learning = True'}
          </div>

          <h1 className="text-5xl font-bold md:text-6xl mb-6 animate-slide-up">
            Қош келдіңіз!{" "}
            <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 text-transparent bg-clip-text">
              PyLearn
            </span>
          </h1>

          <p className="mt-4 text-gray-300 text-lg leading-relaxed animate-slide-up-delayed">
            Python-ды нөлден үйрен, код жазып тәжірибе жаса, тапсырмаларды шеш,
            жетістіктеріңді бақылап, нағыз шеберге айнал!
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start animate-fade-in-delayed">
            <Link
              to="/learn"
              className="group bg-gradient-to-r from-blue-600 to-blue-500 px-8 py-4 rounded-lg font-semibold hover:from-blue-500 hover:to-blue-400 transition-all duration-300 transform hover:scale-105 hover:shadow-lg hover:shadow-blue-500/50"
            >
              Оқуды бастау
              <span className="inline-block ml-2 group-hover:translate-x-1 transition-transform">→</span>
            </Link>

            <Link
              to="/Solve-problem"
              className="group border-2 border-gray-600 px-8 py-4 rounded-lg font-semibold hover:bg-gray-800 hover:border-gray-500 transition-all duration-300 transform hover:scale-105"
            >
              Тапсырмаларды шешу
              <span className="inline-block ml-2 group-hover:translate-x-1 transition-transform">⚡</span>
            </Link>
          </div>

          {/* Статистика */}
          <div className="mt-12 grid grid-cols-3 gap-6 text-center animate-fade-in-delayed">
            <div>
              <div className="text-3xl font-bold text-blue-400">5</div>
              <div className="text-sm text-gray-400 mt-1">Деңгей</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-green-400">25</div>
              <div className="text-sm text-gray-400 mt-1">Сабақтар</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-purple-400">100+</div>
              <div className="text-sm text-gray-400 mt-1">Тапсырмалар</div>
            </div>
          </div>
        </div>

        {/* Оң жақ - Код редакторының макеті */}
        <div className="flex-1 max-w-xl w-full animate-fade-in-delayed">
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-700 shadow-2xl overflow-hidden">
            {/* Редактор тақырыбы */}
            <div className="bg-gray-800 px-4 py-3 flex items-center gap-2 border-b border-gray-700">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="ml-4 text-gray-400 text-sm font-mono">негізгі.py</span>
            </div>

            {/* Код мазмұны */}
            <div className="p-6 font-mono text-sm">
              <div className="flex gap-4">
                <div className="text-gray-600 select-none">
                  {code.split('\n').map((_, i) => (
                    <div key={i}>{i + 1}</div>
                  ))}
                </div>
                <pre className="flex-1">
                  <code className="text-green-400">
                    {code.split('\n').map((line, i) => (
                      <div key={i}>
                        {line.startsWith('def') || line.startsWith('for') ? (
                          <span className="text-purple-400">{line}</span>
                        ) : line.includes('print') ? (
                          <>
                            <span className="text-purple-400">{line.split('(')[0]}</span>
                            <span className="text-green-400">(</span>
                            <span className="text-yellow-300">{line.split('(')[1]}</span>
                          </>
                        ) : line.includes('range') ? (
                          <>
                            <span>    </span>
                            <span className="text-purple-400">print</span>
                            <span className="text-green-400">(</span>
                            <span className="text-blue-300">i</span>
                            <span className="text-green-400">)</span>
                          </>
                        ) : (
                          line
                        )}
                      </div>
                    ))}
                    <span className={`${cursorVisible ? 'opacity-100' : 'opacity-0'} transition-opacity`}>▊</span>
                  </code>
                </pre>
              </div>
            </div>

            {/* Терминал шығысы */}
            <div className="bg-black/50 px-6 py-4 border-t border-gray-700">
              <div className="text-gray-400 text-xs font-mono mb-2">Шығыс:</div>
              <div className="text-green-400 font-mono text-sm">
                Hello, World!<br />
                0<br />
                1<br />
                2<br />
                ...
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ТӨМЕНГІ ДЕРЕКТЕМЕ */}
      <footer className="py-6 text-center text-gray-500 border-t border-gray-800 relative z-10">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 px-4">
          <div className="font-mono text-sm">
            © {new Date().getFullYear()} PyLearn
          </div>
          <div className="text-sm font-mono text-gray-300">{'{ Код жазу • Үйрену • Шебер болу }'}</div>
        </div>
      </footer>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes gridMove {
          0% { transform: translate(0, 0); }
          100% { transform: translate(50px, 50px); }
        }
        
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
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
        
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        
        .animate-float-delayed {
          animation: float 6s ease-in-out infinite;
          animation-delay: 3s;
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
      `}} />
    </div>
  );
};

export default Home;
