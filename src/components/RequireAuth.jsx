import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function RequireAuth({ children }) {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 flex items-center justify-center text-white">
        <div className="max-w-2xl mx-auto bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-700 p-12 text-center">
          <div className="text-6xl mb-6">🔐</div>
          <h2 className="text-2xl font-bold mb-4 font-mono">
            Аутентификация қажет
          </h2>
          <p className="text-gray-400 mb-6">
            Бұл бетке кіру үшін жүйеге кіріңіз
          </p>
          <Link
            to="/login"
            className="inline-block px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg font-mono font-semibold hover:from-blue-500 hover:to-purple-500 transition-all"
          >
            Кіру →
          </Link>
        </div>
      </div>
    );
  }

  return children;
}
