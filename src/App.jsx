import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import Home from "./pages/Home.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Learn from "./pages/Learn.jsx";
import SolveProblem from "./pages/SolveProblem.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Lesson from "./pages/Lesson.jsx";
import Certificate from "./pages/Certificate.jsx";
import RequireAuth from "./components/RequireAuth";
import AiChat from "./components/AiChat";
import { useAuth } from "./context/AuthContext";

const getInitialTheme = () => {
  if (typeof window === "undefined") return "dark";

  try {
    const savedTheme = window.localStorage.getItem("pylearn-theme");
    if (savedTheme === "light" || savedTheme === "dark") return savedTheme;
  } catch (error) {
    console.warn("Theme preference is unavailable:", error);
  }

  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
};

function App() {
  const { user, logout } = useAuth();
  const [theme, setTheme] = useState(getInitialTheme);
  const isLightTheme = theme === "light";

  const handleLogout = () => {
    logout();
  };

  const toggleTheme = () => {
    setTheme((currentTheme) => (currentTheme === "dark" ? "light" : "dark"));
  };

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;

    try {
      window.localStorage.setItem("pylearn-theme", theme);
    } catch (error) {
      console.warn("Theme preference could not be saved:", error);
    }
  }, [theme]);

  return (
    <BrowserRouter>
      <nav className="fixed w-full top-0 left-0 z-50 bg-gray-950/90 backdrop-blur-xl border-b border-gray-800/50 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Логотип және Сілтемелер */}
            <div className="flex items-center gap-8">
              <Link
                to="/"
                className="relative text-2xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 
                     hover:from-blue-300 hover:via-purple-400 hover:to-pink-400 transition-all duration-300"
              >
                PyLearn
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-purple-400 to-pink-400 transition-all duration-500 hover:w-full"></span>
              </Link>

              <div className="hidden md:flex items-center gap-1">
                {[
                  { to: "/", label: "Басты бет" },
                  { to: "/learn", label: "Оқуды бастау" },
                  { to: "/dashboard", label: "Бақылау тақтасы" },
                  { to: "/solve-problem", label: "Тапсырмаларды шешу" },
                  { to: "/certificate", label: "Сертификат" },
                ].map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="relative px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-all duration-200 
                         before:absolute before:bottom-0 before:left-1/2 before:-translate-x-1/2 before:w-0 before:h-0.5 
                         before:bg-gradient-to-r before:from-purple-400 before:to-pink-400 before:transition-all before:duration-300
                         hover:before:w-3/4"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>

            {/* Авторизация батырмалары */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="theme-toggle"
                onClick={toggleTheme}
                aria-label={isLightTheme ? "Включить темную тему" : "Включить светлую тему"}
                aria-pressed={isLightTheme}
                title={isLightTheme ? "Темная тема" : "Светлая тема"}
              >
                <span className="theme-toggle__icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" focusable="false">
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 2v2.5M12 19.5V22M4.93 4.93l1.77 1.77M17.3 17.3l1.77 1.77M2 12h2.5M19.5 12H22M4.93 19.07l1.77-1.77M17.3 6.7l1.77-1.77" />
                  </svg>
                </span>
                <span className="theme-toggle__thumb" aria-hidden="true" />
                <span className="theme-toggle__icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" focusable="false">
                    <path d="M20.25 15.3A8.25 8.25 0 0 1 8.7 3.75a8.25 8.25 0 1 0 11.55 11.55Z" />
                  </svg>
                </span>
              </button>

              {!user ? (
                <>
                  <Link
                    to="/login"
                    className="px-5 py-2.5 text-sm font-medium text-gray-200 bg-white/5 border border-gray-700/50 rounded-xl 
                          hover:bg-white/10 hover:border-purple-500/50 hover:text-white transition-all duration-300 backdrop-blur-sm"
                  >
                    Кіру
                  </Link>
                  <Link
                    to="/register"
                    className="relative px-6 py-2.5 text-sm font-semibold text-white rounded-xl overflow-hidden
                          bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500
                          shadow-lg shadow-purple-500/20 hover:shadow-xl hover:shadow-purple-500/30
                          transition-all duration-300 transform hover:scale-105"
                  >
                    <span className="relative z-10">Тіркелу</span>
                    <div className="absolute inset-0 bg-white/20 translate-y-full transition-transform duration-300 group-hover:translate-y-0"></div>
                  </Link>
                </>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="text-gray-200 font-medium">Сәлем, {user.name}!</span>
                  <button
                    onClick={handleLogout}
                    className="px-6 py-2 bg-red-600 hover:bg-red-500 rounded-lg font-mono font-semibold transition-all duration-300 transform hover:scale-105 flex items-center gap-2"
                  >
                    <span>Шығу</span> 🚪
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Қосымша: төменгі жағында жарқыраған сызық */}
        <div className="h-px bg-gradient-to-r from-transparent via-purple-500/30 to-transparent"></div>
      </nav>
      <div className="pt-16">
        <Routes>
          <Route path="/" element={<Home />} />

          <Route
            path="/learn"
            element={
              <RequireAuth>
                <Learn />
              </RequireAuth>
            }
          />

          <Route
            path="/solve-problem"
            element={
              <RequireAuth>
                <SolveProblem />
              </RequireAuth>
            }
          />

          <Route
            path="/certificate"
            element={
              <RequireAuth>
                <Certificate />
              </RequireAuth>
            }
          />

          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/learn/:id" element={<Lesson />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Routes>
      </div>
      <AiChat user={user} />
    </BrowserRouter>
  );
}

export default App;
