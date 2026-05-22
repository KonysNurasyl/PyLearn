const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "presentation_assets", "diploma_figures");
const HTML_DIR = path.join(OUT_DIR, "_html");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function resolveChromePath() {
  const candidates = [
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ].filter(Boolean);
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error("Chrome немесе Edge табылмады.");
  return found;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function readLines(relPath, start, end) {
  const filePath = path.join(ROOT, relPath);
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  return lines
    .slice(start - 1, end)
    .map((line, index) => ({ n: start + index, text: line }));
}

function maskEnv() {
  const envPath = path.join(ROOT, "backend", ".env");
  const sample = [
    "GEMINI_API_KEY=AIza...***",
    "JWT_SECRET=pylearn_jwt_secret_***",
    "DB_HOST=localhost",
    "DB_USER=root",
    "DB_PASSWORD=***",
    "DB_NAME=pylearn",
    "PORT=4000",
  ];

  if (!fs.existsSync(envPath)) return sample;

  return fs.readFileSync(envPath, "utf8").split(/\r?\n/).filter(Boolean).map((line) => {
    const [key] = line.split("=");
    if (!key) return line;
    if (key.includes("GEMINI")) return `${key}=AIza...***`;
    if (key.includes("JWT") || key.includes("SECRET")) return `${key}=pylearn_secret_***`;
    if (key.includes("PASSWORD")) return `${key}=***`;
    return line;
  });
}

function snippetHtml({ title, subtitle, fileLabel, lines, footer, fontSize = 17 }) {
  const rows = lines.map((line) => {
    const lineNo = typeof line.n === "number" ? line.n : "";
    const text = typeof line === "string" ? line : line.text;
    return `<div class="line"><span class="ln">${lineNo}</span><span class="code">${escapeHtml(text || " ")}</span></div>`;
  }).join("");

  return `<!doctype html>
<html lang="kk">
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0;
    width: 1365px;
    height: 768px;
    background: #f3f4f6;
    font-family: "Segoe UI", Arial, sans-serif;
    color: #111827;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .frame {
    width: 1180px;
    background: #ffffff;
    border: 1px solid #d1d5db;
    box-shadow: 0 18px 40px rgba(15, 23, 42, 0.18);
  }
  .header {
    padding: 22px 28px 14px;
    border-bottom: 1px solid #e5e7eb;
  }
  .title {
    margin: 0;
    font-weight: 750;
    font-size: 29px;
    letter-spacing: 0;
  }
  .subtitle {
    margin-top: 8px;
    color: #475569;
    font-size: 16px;
  }
  .editor {
    margin: 24px 28px 18px;
    overflow: hidden;
    border-radius: 9px;
    background: #0f172a;
    border: 1px solid #334155;
  }
  .tabs {
    height: 42px;
    display: flex;
    align-items: center;
    background: #1e293b;
    color: #cbd5e1;
    font-size: 15px;
    border-bottom: 1px solid #334155;
  }
  .dot { width: 12px; height: 12px; border-radius: 50%; margin-left: 12px; }
  .red { background: #ef4444; }
  .yellow { background: #f59e0b; }
  .green { background: #22c55e; margin-right: 18px; }
  .tab {
    padding: 10px 18px;
    height: 42px;
    background: #273449;
    border-right: 1px solid #334155;
    color: #e5e7eb;
    display: flex;
    align-items: center;
  }
  pre {
    margin: 0;
    padding: 18px 0 20px;
    max-height: 548px;
    overflow: hidden;
    font-family: Consolas, "Cascadia Mono", "Courier New", monospace;
    font-size: ${fontSize}px;
    line-height: 1.48;
    color: #e5e7eb;
  }
  .line {
    display: flex;
    min-height: 24px;
  }
  .ln {
    width: 70px;
    padding-right: 18px;
    text-align: right;
    color: #64748b;
    user-select: none;
  }
  .code { white-space: pre; }
  .code {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    word-break: break-word;
    max-width: 1010px;
  }
  .footer {
    padding: 0 28px 22px;
    color: #475569;
    font-size: 15px;
  }
</style>
</head>
<body>
  <main class="frame">
    <section class="header">
      <h1 class="title">${escapeHtml(title)}</h1>
      <div class="subtitle">${escapeHtml(subtitle)}</div>
    </section>
    <section class="editor">
      <div class="tabs"><span class="dot red"></span><span class="dot yellow"></span><span class="dot green"></span><span class="tab">${escapeHtml(fileLabel)}</span></div>
      <pre>${rows}</pre>
    </section>
    <section class="footer">${escapeHtml(footer)}</section>
  </main>
</body>
</html>`;
}

function screenshot(chromePath, source, output, { width = 1365, height = 768 } = {}) {
  const target = source.startsWith("http") ? source : `file:///${source.replace(/\\/g, "/")}`;
  const profileDir = path.join(HTML_DIR, `chrome-profile-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  ensureDir(profileDir);
  execFileSync(chromePath, [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--ignore-certificate-errors",
    "--no-first-run",
    "--disable-background-networking",
    "--disable-features=Translate",
    `--user-data-dir=${profileDir}`,
    `--window-size=${width},${height}`,
    "--virtual-time-budget=5000",
    `--screenshot=${output}`,
    target,
  ], { stdio: "ignore", timeout: 25000 });
}

function renderSnippet(chromePath, name, config) {
  const htmlPath = path.join(HTML_DIR, `${name}.html`);
  const outputPath = path.join(OUT_DIR, `${name}.png`);
  fs.writeFileSync(htmlPath, snippetHtml(config), "utf8");
  screenshot(chromePath, htmlPath, outputPath);
  return outputPath;
}

function copyExisting(srcRel, destName) {
  const src = path.join(ROOT, srcRel);
  const dest = path.join(OUT_DIR, destName);
  fs.copyFileSync(src, dest);
  return dest;
}

async function main() {
  ensureDir(OUT_DIR);
  ensureDir(HTML_DIR);
  const chromePath = resolveChromePath();

  const outputs = [];

  try {
    const fig1 = path.join(OUT_DIR, "01_google_ai_studio_api_key.png");
    screenshot(chromePath, "https://ai.google.dev/gemini-api/docs/api-key", fig1);
    outputs.push(fig1);
  } catch (error) {
    outputs.push(renderSnippet(chromePath, "01_google_ai_studio_api_key", {
      title: "Google AI Studio және Gemini API key",
      subtitle: "Gemini API кілтін алу кезеңі. Интернет қолжетімсіз болса, ресми бет орнына осы түсіндірме кадр жасалады.",
      fileLabel: "api-key.txt",
      lines: [
        "1. Google AI Studio немесе Gemini API documentation бетіне кіру",
        "2. Get API key / Create API key батырмасын таңдау",
        "3. Кілтті көшіріп, backend .env файлына сақтау",
      ],
      footer: `Fallback screenshot: ${error.message}`,
    }));
  }

  outputs.push(renderSnippet(chromePath, "02_env_api_key_masked", {
    title: "API кілтін .env файлына сақтау",
    subtitle: "Құпия кілттер код ішінде емес, backend .env файлында сақталады.",
    fileLabel: "backend/.env",
    lines: maskEnv(),
    footer: "Қауіпсіздік үшін нақты кілттер маскамен жабылды.",
    fontSize: 22,
  }));

  outputs.push(renderSnippet(chromePath, "03_backend_gemini_client", {
    title: "Backend ішінде Gemini API клиентін дайындау",
    subtitle: "server.js файлы .env ішіндегі GEMINI_API_KEY мәнін оқып, модель клиентін жасайды.",
    fileLabel: "backend/server.js",
    lines: readLines("backend/server.js", 499, 502),
    footer: "Бұл код PyLearn AI Chat қызметінің серверлік бастапқы нүктесі болып табылады.",
    fontSize: 21,
  }));

  outputs.push(renderSnippet(chromePath, "04_system_prompt_rules", {
    title: "PyLearn AI көмекшісінің жүйелік нұсқауы",
    subtitle: "SYSTEM_PROMPT модельге Python менторы рөлін және жауап беру ережелерін береді.",
    fileLabel: "backend/server.js",
    lines: readLines("backend/server.js", 503, 512),
    footer: "Нұсқау дайын шешімді көшіртпей, оқушыны бағыттауға арналған.",
    fontSize: 16,
  }));

  outputs.push(renderSnippet(chromePath, "05_ai_chat_route", {
    title: "/api/ai/chat маршруты арқылы AI сұрауын өңдеу",
    subtitle: "Қолданушы хабарламасы backend арқылы қабылданып, тарих пен контекст бірге өңделеді.",
    fileLabel: "backend/server.js",
    lines: readLines("backend/server.js", 514, 556),
    footer: "Маршрут JWT авторизациясымен қорғалған және Gemini моделіне сұрау дайындайды.",
    fontSize: 13,
  }));

  outputs.push(renderSnippet(chromePath, "06_stream_response_logic", {
    title: "AI жауабын stream форматында шығару",
    subtitle: "Backend Gemini жауабын бөліктермен жібереді, frontend оны біртіндеп чатқа қосады.",
    fileLabel: "backend/server.js + src/components/AiChat.jsx",
    lines: [
      ...readLines("backend/server.js", 560, 580),
      { n: "", text: "" },
      ...readLines("src/components/AiChat.jsx", 151, 176),
    ],
    footer: "Streaming тәсілі жауаптың тірі түрде жазылып жатқандай көрінуін қамтамасыз етеді.",
    fontSize: 12,
  }));

  outputs.push(copyExisting("presentation_assets/screenshots/09_ai_chat.png", "07_pylearn_ai_chat_interface.png"));

  outputs.push(renderSnippet(chromePath, "08_chat_sessions_history", {
    title: "AI Chat сессиялары мен чат тарихын сақтау",
    subtitle: "Сұрақтар мен AI жауаптары chat_history кестесіне user_id және session_id арқылы сақталады.",
    fileLabel: "backend/server.js",
    lines: [
      ...readLines("backend/server.js", 586, 618),
      { n: "", text: "" },
      ...readLines("backend/server.js", 627, 653),
    ],
    footer: "Бұл логика оқушыға бұрынғы диалогтарын қайта ашуға мүмкіндік береді.",
    fontSize: 12,
  }));

  console.log("Diploma figures created:");
  for (const output of outputs) console.log(path.relative(ROOT, output));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
