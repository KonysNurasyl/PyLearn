const fs = require("fs");
const http = require("http");
const net = require("net");
const path = require("path");
const { spawn } = require("child_process");
const PptxGenJS = require("pptxgenjs");

const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "presentation_assets");
const SHOT_DIR = path.join(OUT_DIR, "screenshots");
const LOGO_DIR = path.join(OUT_DIR, "tech_logos");
const OUTPUT = process.env.PYLEARN_PPTX_OUTPUT || path.join(ROOT, "PyLearn_10_bet_prezentatsiya.pptx");
const FRONTEND_PORT = 5173;
const API_PORT = 4000;
const FRONTEND_URL = `http://127.0.0.1:${FRONTEND_PORT}`;

const USER = {
  id: 1,
  name: "Aruzhan",
  email: "aruzhan@pylearn.kz",
  created_at: "2026-04-15T10:00:00.000Z",
};

const TOKEN = "demo-pylearn-token";

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isPortOpen(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(700);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => resolve(false));
    socket.connect(port, host);
  });
}

async function waitForHttp(url, timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(url, (res) => {
          res.resume();
          res.on("end", resolve);
        });
        req.on("error", reject);
        req.setTimeout(1000, () => {
          req.destroy(new Error("timeout"));
        });
      });
      return;
    } catch (_) {
      await wait(500);
    }
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function json(res, value, status = 200) {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  });
  res.end(body);
}

function notFound(res) {
  json(res, { message: "Not found" }, 404);
}

function createMockApi() {
  const levels = [
    { id: 1, level_number: 1, title: "Python негіздері", description: "Синтаксис, айнымалылар және алғашқы бағдарламалар" },
    { id: 2, level_number: 2, title: "Басқару құрылымдары", description: "if/else, циклдер және логикалық ойлау" },
    { id: 3, level_number: 3, title: "Функциялар", description: "Қайта қолданылатын код пен параметрлер" },
    { id: 4, level_number: 4, title: "Деректер құрылымдары", description: "list, dict, tuple және set" },
    { id: 5, level_number: 5, title: "Жобалық тәжірибе", description: "Практикалық есептер мен қорытынды нәтиже" },
  ];

  const lessons = [
    { id: 1, title: "Python-ға кіріспе", level_id: 1, lesson_number: 1, content: "Python тілі қарапайым синтаксисі және кең қолданылуы арқылы бағдарламалауды бастаушыларға ыңғайлы. Бұл сабақта print(), айнымалы және негізгі жазу ережелері қарастырылады." },
    { id: 2, title: "Айнымалылар және типтер", level_id: 1, lesson_number: 2, content: "Мәтін, сан, логикалық мән және типтерді түрлендіру Python кодын дұрыс жазуға көмектеседі." },
    { id: 3, title: "Шартты операторлар", level_id: 2, lesson_number: 1, content: "if, elif, else арқылы бағдарлама әртүрлі жағдайға жауап береді." },
    { id: 4, title: "for және while циклдері", level_id: 2, lesson_number: 2, content: "Қайталанатын әрекеттерді циклдер арқылы ықшам әрі түсінікті жазуға болады." },
    { id: 5, title: "Функциялар", level_id: 3, lesson_number: 1, content: "Функция кодты бөлімдерге бөліп, қайта қолдануға мүмкіндік береді." },
    { id: 6, title: "Параметр және нәтиже", level_id: 3, lesson_number: 2, content: "return және параметрлер функцияны нақты есеп шешуге бейімдейді." },
    { id: 7, title: "Тізімдер", level_id: 4, lesson_number: 1, content: "list бірнеше мәнді бір жерде сақтауға және өңдеуге мүмкіндік береді." },
    { id: 8, title: "Сөздіктер", level_id: 4, lesson_number: 2, content: "dict кілт пен мән арқылы құрылымды дерек сақтайды." },
    { id: 9, title: "Қате өңдеу", level_id: 5, lesson_number: 1, content: "try/except бағдарлама тұрақтылығын арттырады." },
    { id: 10, title: "Қорытынды жоба", level_id: 5, lesson_number: 2, content: "Оқушы алған білімін шағын жоба арқылы бекітеді." },
  ];

  const lessonDetail = {
    ...lessons[0],
    key_notes: "Python оқуда бастысы - теорияны бірден практикамен бекіту. Әр жолдың не істейтінін түсініп, нәтижені экраннан көру оқушының сенімін арттырады.",
    syntax: "name = 'PyLearn'\nprint('Сәлем, ' + name)\n\nfor i in range(3):\n    print(i)",
    important_questions: "1. Python не үшін қолданылады? 2. print() функциясы не істейді? 3. Айнымалыны қалай жариялаймыз?",
    youtube_link: "",
  };

  const problems = [
    {
      id: 1,
      title: "Сәлем, Python!",
      description: "Экранға 'Salem, PyLearn!' мәтінін шығаратын бағдарлама жазыңыз.",
      difficulty: "Жеңіл",
      template: "print('Salem, PyLearn!')",
      expected_output: "Salem, PyLearn!",
      test_cases: [{ input: "", expected: "Salem, PyLearn!" }],
    },
    {
      id: 2,
      title: "Екі санның қосындысы",
      description: "Екі санды оқып, олардың қосындысын шығарыңыз.",
      difficulty: "Жеңіл",
      template: "a = int(input())\nb = int(input())\nprint(a + b)",
      expected_output: "42",
      test_cases: [{ input: "20\n22", expected: "42" }],
    },
    {
      id: 3,
      title: "Жұп санды анықтау",
      description: "Берілген сан жұп болса 'jup', әйтпесе 'taq' деп шығарыңыз.",
      difficulty: "Орташа",
      template: "n = int(input())\nif n % 2 == 0:\n    print('jup')\nelse:\n    print('taq')",
      expected_output: "jup",
      test_cases: [{ input: "8", expected: "jup" }, { input: "7", expected: "taq" }],
    },
    {
      id: 4,
      title: "Сандар тізімі",
      description: "1-ден n-ге дейінгі сандарды шығарыңыз.",
      difficulty: "Орташа",
      template: "n = int(input())\nfor i in range(1, n + 1):\n    print(i)",
      expected_output: "1\n2\n3",
      test_cases: [{ input: "3", expected: "1\n2\n3" }],
    },
    {
      id: 5,
      title: "Максимум табу",
      description: "Үш санның ең үлкенін табыңыз.",
      difficulty: "Орташа",
      template: "a = int(input())\nb = int(input())\nc = int(input())\nprint(max(a, b, c))",
      expected_output: "27",
      test_cases: [{ input: "15\n27\n9", expected: "27" }],
    },
    {
      id: 6,
      title: "Функция құру",
      description: "square(n) функциясын жазып, санның квадратын шығарыңыз.",
      difficulty: "Орташа",
      template: "def square(n):\n    return n * n\n\nprint(square(int(input())))",
      expected_output: "25",
      test_cases: [{ input: "5", expected: "25" }],
    },
    {
      id: 7,
      title: "Тізім қосындысы",
      description: "Бос орынмен берілген сандардың қосындысын шығарыңыз.",
      difficulty: "Қиын",
      template: "nums = list(map(int, input().split()))\nprint(sum(nums))",
      expected_output: "15",
      test_cases: [{ input: "1 2 3 4 5", expected: "15" }],
    },
    {
      id: 8,
      title: "Сөз санау",
      description: "Берілген мәтіндегі сөз санын табыңыз.",
      difficulty: "Қиын",
      template: "text = input()\nprint(len(text.split()))",
      expected_output: "3",
      test_cases: [{ input: "Python өте қызық", expected: "3" }],
    },
    {
      id: 9,
      title: "Қате өңдеу",
      description: "Санды қауіпсіз оқып, қате болса 0 шығарыңыз.",
      difficulty: "Қиын",
      template: "try:\n    print(int(input()))\nexcept ValueError:\n    print(0)",
      expected_output: "0",
      test_cases: [{ input: "abc", expected: "0" }],
    },
    {
      id: 10,
      title: "Мини-жоба",
      description: "Қарапайым калькулятор логикасын құрыңыз.",
      difficulty: "Қиын",
      template: "a = int(input())\nop = input()\nb = int(input())\nif op == '+':\n    print(a + b)",
      expected_output: "9",
      test_cases: [{ input: "4\n+\n5", expected: "9" }],
    },
  ];

  const stats = {
    lessonsCompleted: 12,
    problemsSolved: 18,
    totalXP: 2450,
    level: 5,
    nextLevelXP: 2500,
    currentStreak: 7,
    hoursLearned: 24,
    levelProgress: [
      { level_id: 1, title: "Python негіздері", completed_lessons: 5, total_lessons: 5 },
      { level_id: 2, title: "Басқару құрылымдары", completed_lessons: 4, total_lessons: 5 },
      { level_id: 3, title: "Функциялар", completed_lessons: 3, total_lessons: 5 },
      { level_id: 4, title: "Деректер құрылымдары", completed_lessons: 2, total_lessons: 5 },
      { level_id: 5, title: "Жобалық тәжірибе", completed_lessons: 1, total_lessons: 5 },
    ],
    recentActivity: [
      { id: 1, type: "mcq", title: "Python-ға кіріспе quiz", score: 300, time: "2026-05-01T12:40:00.000Z" },
      { id: 2, type: "problem", title: "Екі санның қосындысы", score: 100, time: "2026-05-01T13:05:00.000Z" },
      { id: 3, type: "problem", title: "Жұп санды анықтау", score: 100, time: "2026-05-01T13:25:00.000Z" },
    ],
  };

  return http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      });
      res.end();
      return;
    }

    if (url.pathname === "/api/levels") return json(res, levels);
    if (url.pathname === "/api/lessons") return json(res, lessons);
    if (url.pathname === "/api/lessons/1") return json(res, lessonDetail);
    if (url.pathname === "/api/lessons/1/mcq") {
      return json(res, [
        { id: 1, question: "Python-да экранға мәтін шығару үшін қай функция қолданылады?", option_a: "print()", option_b: "echo()", option_c: "write()", option_d: "show()", correct_option: "A" },
        { id: 2, question: "Айнымалы мәнін сақтау үшін не қолданылады?", option_a: "function", option_b: "variable", option_c: "loop", option_d: "class", correct_option: "B" },
        { id: 3, question: "range(3) қандай мәндер береді?", option_a: "1,2,3", option_b: "0,1,2", option_c: "0,1,2,3", option_d: "3", correct_option: "B" },
      ]);
    }
    if (url.pathname === "/api/lessons/1/progress") return json(res, { max_score: 300, max_time: 420, total_questions: 3 });
    if (url.pathname === "/api/lessons/1/mcq/result" && req.method === "POST") return json(res, { id: 101, message: "Нәтиже сақталды" }, 201);
    if (url.pathname === "/api/problems") return json(res, problems);
    if (url.pathname === "/api/users/1/passed_lessons") return json(res, [1, 2, 3, 4, 5, 6, 7, 8]);
    if (url.pathname === "/api/users/1/solved_problems") return json(res, [1, 2, 3, 4, 5]);
    if (url.pathname === "/api/users/1/stats") return json(res, stats);
    if (/^\/api\/problems\/\d+\/attempt$/.test(url.pathname) && req.method === "POST") {
      return json(res, { id: 201, correct: true, score: 100, message: "Барлық тесттер өтті!" }, 201);
    }
    if (url.pathname === "/api/ai/sessions") {
      return json(res, [
        { session_id: "demo-1", title: "Циклдер туралы сұрақ" },
        { session_id: "demo-2", title: "Функциялар мысалы" },
      ]);
    }
    if (url.pathname.startsWith("/api/ai/history/")) {
      return json(res, [
        { role: "user", message: "Python-да цикл қалай жазылады?" },
        { role: "assistant", message: "Цикл қайталанатын әрекетті орындау үшін қолданылады. Мысалы:\n```python\nfor i in range(3):\n    print(i)\n```\nАлдымен диапазонды түсініп, содан кейін денесіне орындалатын әрекетті жазасыз." },
      ]);
    }
    if (url.pathname === "/api/ai/chat" && req.method === "POST") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*",
      });
      res.write(`data: ${JSON.stringify({ text: "Функция кодты қайта қолдануға көмектеседі. " })}\n\n`);
      res.write(`data: ${JSON.stringify({ text: "Мысалы, бір есепті бірнеше рет орындау қажет болса, оны функцияға бөлеміз." })}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }

    notFound(res);
  });
}

async function startMockApiIfNeeded() {
  if (await isPortOpen(API_PORT)) {
    console.log(`API port ${API_PORT} is already in use; using existing API.`);
    return null;
  }

  const server = createMockApi();
  await new Promise((resolve) => server.listen(API_PORT, "127.0.0.1", resolve));
  console.log(`Mock API listening on ${API_PORT}`);
  return server;
}

async function startViteIfNeeded() {
  if (await isPortOpen(FRONTEND_PORT)) {
    console.log(`Frontend port ${FRONTEND_PORT} is already in use; using existing app.`);
    return null;
  }

  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
  const child = spawn(npmCmd, ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(FRONTEND_PORT), "--strictPort"], {
    cwd: ROOT,
    env: { ...process.env, VITE_API_URL: `http://127.0.0.1:${API_PORT}` },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    shell: process.platform === "win32",
  });

  child.stdout.on("data", (data) => process.stdout.write(`[vite] ${data}`));
  child.stderr.on("data", (data) => process.stderr.write(`[vite] ${data}`));
  await waitForHttp(FRONTEND_URL, 45000);
  return child;
}

async function stopProcessTree(child) {
  if (!child || !child.pid) return;
  if (process.platform === "win32") {
    await new Promise((resolve) => {
      const killer = spawn("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true,
      });
      killer.on("exit", resolve);
      killer.on("error", resolve);
    });
  } else {
    try {
      child.kill("SIGTERM");
    } catch (_) {
      // ignore
    }
  }
}

async function closeServer(server) {
  if (!server) return;
  if (typeof server.closeIdleConnections === "function") server.closeIdleConnections();
  if (typeof server.closeAllConnections === "function") server.closeAllConnections();
  await Promise.race([
    new Promise((resolve) => server.close(resolve)),
    wait(2000),
  ]);
}

function resolveChromePath() {
  const candidates = [
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean);

  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error("Chrome/Edge executable was not found.");
  return found;
}

async function captureScreenshots() {
  ensureDir(SHOT_DIR);

  const { chromium } = require("playwright-core");
  const browser = await chromium.launch({
    executablePath: resolveChromePath(),
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  const context = await browser.newContext({
    viewport: { width: 1600, height: 900 },
    deviceScaleFactor: 1,
    locale: "kk-KZ",
  });

  await context.addInitScript(({ user, token }) => {
    try {
      localStorage.setItem("user", JSON.stringify(user));
      localStorage.setItem("token", token);
    } catch (_) {
      // ignore origins without localStorage
    }
  }, { user: USER, token: TOKEN });

  const page = await context.newPage();

  async function snap(name, route, afterLoad) {
    const file = path.join(SHOT_DIR, `${name}.png`);
    await page.goto(`${FRONTEND_URL}${route}`, { waitUntil: "networkidle", timeout: 45000 });
    await page.evaluate(({ user, token }) => {
      localStorage.setItem("user", JSON.stringify(user));
      localStorage.setItem("token", token);
    }, { user: USER, token: TOKEN });
    await wait(900);
    if (afterLoad) await afterLoad(page);
    await page.screenshot({ path: file, fullPage: false });
    console.log(`Captured ${path.relative(ROOT, file)}`);
    return file;
  }

  const shots = {};
  shots.home = await snap("01_home", "/");
  shots.login = await snap("02_login", "/login");
  shots.register = await snap("03_register", "/register");
  shots.learn = await snap("04_learn", "/learn");
  shots.lesson = await snap("05_lesson", "/learn/1");
  shots.solve = await snap("06_solve_problem", "/solve-problem");
  shots.dashboard = await snap("07_dashboard", "/dashboard");
  shots.certificate = await snap("08_certificate", "/certificate", async (p) => {
    const button = p.getByText("Генерациялау").first();
    if (await button.count()) {
      await button.click();
      await wait(1600);
    }
  });
  shots.ai = await snap("09_ai_chat", "/", async (p) => {
    const btn = p.getByTitle("AI Көмекші");
    if (await btn.count()) {
      await btn.click();
      await wait(1000);
    }
  });

  await browser.close();
  return shots;
}

function getExistingScreenshots() {
  const shots = {
    home: path.join(SHOT_DIR, "01_home.png"),
    login: path.join(SHOT_DIR, "02_login.png"),
    register: path.join(SHOT_DIR, "03_register.png"),
    learn: path.join(SHOT_DIR, "04_learn.png"),
    lesson: path.join(SHOT_DIR, "05_lesson.png"),
    solve: path.join(SHOT_DIR, "06_solve_problem.png"),
    dashboard: path.join(SHOT_DIR, "07_dashboard.png"),
    certificate: path.join(SHOT_DIR, "08_certificate.png"),
    ai: path.join(SHOT_DIR, "09_ai_chat.png"),
  };

  const missing = Object.values(shots).filter((file) => !fs.existsSync(file));
  if (missing.length) {
    throw new Error(`Missing screenshot assets: ${missing.map((file) => path.relative(ROOT, file)).join(", ")}`);
  }

  return shots;
}

function addBg(slide) {
  slide.background = { color: "070B16" };
  slide.addShape("rect", { x: 0, y: 0, w: 13.333, h: 7.5, fill: { color: "070B16" }, line: { color: "070B16" } });
  slide.addShape("rect", { x: 0, y: 0, w: 13.333, h: 0.08, fill: { color: "38BDF8", transparency: 15 }, line: { color: "38BDF8", transparency: 100 } });
}

function addTopLabel(slide, text) {
  slide.addShape("roundRect", { x: 0.55, y: 0.34, w: 2.35, h: 0.34, rectRadius: 0.06, fill: { color: "0B1220" }, line: { color: "2563EB", transparency: 25 } });
  slide.addText(text, { x: 0.72, y: 0.42, w: 2, h: 0.14, fontFace: "Consolas", fontSize: 8.5, color: "7DD3FC", margin: 0 });
}

function addFooter(slide, n) {
  slide.addText(`PyLearn | ${n}/10`, { x: 11.3, y: 7.05, w: 1.4, h: 0.18, fontFace: "Aptos", fontSize: 8.5, color: "94A3B8", align: "right", margin: 0 });
}

function addTitle(slide, title, subtitle) {
  slide.addText(title, { x: 0.55, y: 0.82, w: 5.65, h: 0.55, fontFace: "Aptos Display", bold: true, fontSize: 27, color: "F8FAFC", margin: 0, breakLine: false });
  if (subtitle) {
    slide.addText(subtitle, { x: 0.58, y: 1.47, w: 5.35, h: 0.55, fontFace: "Aptos", fontSize: 12.5, color: "CBD5E1", margin: 0.02, fit: "shrink" });
  }
}

function addBullets(slide, items, x, y, w, opts = {}) {
  const fontSize = opts.fontSize || 13.5;
  const gap = opts.gap || 0.46;
  const itemH = opts.itemH || 0.34;
  items.forEach((item, idx) => {
    const yy = y + idx * gap;
    slide.addShape("ellipse", { x, y: yy + 0.07, w: 0.13, h: 0.13, fill: { color: opts.dot || "38BDF8" }, line: { color: opts.dot || "38BDF8" } });
    slide.addText(item, { x: x + 0.25, y: yy, w, h: itemH, fontFace: "Aptos", fontSize, color: opts.color || "E2E8F0", margin: 0, fit: "shrink" });
  });
}

function addScreenshot(slide, img, x, y, w, h, label) {
  slide.addShape("roundRect", { x: x - 0.04, y: y - 0.04, w: w + 0.08, h: h + 0.08, rectRadius: 0.08, fill: { color: "111827" }, line: { color: "334155", transparency: 20 } });
  slide.addImage({ path: img, x, y, w, h });
  if (label) {
    slide.addShape("roundRect", { x: x + 0.12, y: y + 0.12, w: Math.min(2.8, label.length * 0.09 + 0.65), h: 0.3, rectRadius: 0.05, fill: { color: "020617", transparency: 8 }, line: { color: "38BDF8", transparency: 35 } });
    slide.addText(label, { x: x + 0.28, y: y + 0.19, w: 2.3, h: 0.1, fontFace: "Consolas", fontSize: 7.5, color: "BAE6FD", margin: 0 });
  }
}

function addStat(slide, value, label, x, y, color) {
  slide.addShape("roundRect", { x, y, w: 1.55, h: 0.78, rectRadius: 0.06, fill: { color: "0F172A" }, line: { color, transparency: 35 } });
  slide.addText(value, { x: x + 0.1, y: y + 0.11, w: 1.35, h: 0.22, fontFace: "Aptos Display", bold: true, fontSize: 17, color, align: "center", margin: 0 });
  slide.addText(label, { x: x + 0.12, y: y + 0.46, w: 1.31, h: 0.16, fontFace: "Aptos", fontSize: 7.5, color: "CBD5E1", align: "center", margin: 0 });
}

function addChip(slide, text, x, y, w, color = "38BDF8") {
  slide.addShape("roundRect", { x, y, w, h: 0.34, rectRadius: 0.06, fill: { color: "0F172A" }, line: { color, transparency: 30 } });
  slide.addText(text, { x: x + 0.1, y: y + 0.095, w: w - 0.2, h: 0.1, fontFace: "Aptos", bold: true, fontSize: 8.5, color: "E0F2FE", align: "center", margin: 0 });
}

function addTechCard(slide, tech) {
  const { x, y, w, h, name, role, logo, color } = tech;
  const iconSize = Math.min(0.52, Math.max(0.32, h - 0.18));
  const iconX = x + 0.28;
  const iconY = y + (h - iconSize) / 2;
  const logoSize = iconSize * 0.64;
  const logoX = iconX + (iconSize - logoSize) / 2;
  const logoY = iconY + (iconSize - logoSize) / 2;
  const nameFont = h < 0.7 ? 8.6 : 9.8;
  const roleFont = h < 0.7 ? 6.4 : 7.2;
  slide.addShape("roundRect", {
    x,
    y,
    w,
    h,
    rectRadius: 0.08,
    fill: { color: "0F172A", transparency: 2 },
    line: { color, transparency: 18, width: 1.2 },
  });
  slide.addShape("rect", {
    x: x + 0.12,
    y: y + 0.12,
    w: 0.06,
    h: h - 0.24,
    fill: { color, transparency: 0 },
    line: { color, transparency: 100 },
  });
  slide.addShape("ellipse", {
    x: iconX,
    y: iconY,
    w: iconSize,
    h: iconSize,
    fill: { color: "020617", transparency: 0 },
    line: { color, transparency: 25 },
  });
  slide.addImage({ path: logo, x: logoX, y: logoY, w: logoSize, h: logoSize });
  slide.addText(name, {
    x: x + 0.9,
    y: y + (h < 0.7 ? 0.12 : 0.2),
    w: w - 1.02,
    h: 0.22,
    fontFace: "Aptos",
    bold: true,
    fontSize: nameFont,
    color: "F8FAFC",
    margin: 0,
    fit: "shrink",
  });
  slide.addText(role, {
    x: x + 0.9,
    y: y + (h < 0.7 ? 0.34 : 0.5),
    w: w - 1.02,
    h: h < 0.7 ? 0.18 : 0.28,
    fontFace: "Aptos",
    fontSize: roleFont,
    color: "AAB4C5",
    margin: 0,
    fit: "shrink",
  });
}

function addStackPanel(slide, title, caption, x, y, w, h, color) {
  slide.addShape("roundRect", {
    x,
    y,
    w,
    h,
    rectRadius: 0.1,
    fill: { color: "0B1220", transparency: 0 },
    line: { color, transparency: 22, width: 1.2 },
  });
  slide.addText(title, {
    x: x + 0.22,
    y: y + 0.18,
    w: w - 0.44,
    h: 0.2,
    fontFace: "Consolas",
    bold: true,
    fontSize: 10.5,
    color,
    margin: 0,
  });
  slide.addText(caption, {
    x: x + 0.22,
    y: y + 0.48,
    w: w - 0.44,
    h: 0.28,
    fontFace: "Aptos",
    fontSize: 8.5,
    color: "94A3B8",
    margin: 0,
    fit: "shrink",
  });
}

function makePresentation(shots) {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "PyLearn";
  pptx.subject = "Бағдарламалау негіздерін оқытуға арналған цифрлық көмекші әзірлеу";
  pptx.title = "Бағдарламалау негіздерін оқытуға арналған цифрлық көмекші әзірлеу";
  pptx.company = "PyLearn";
  pptx.lang = "kk-KZ";
  pptx.theme = {
    headFontFace: "Aptos Display",
    bodyFontFace: "Aptos",
    lang: "kk-KZ",
  };

  let slide;
  const logo = (file) => path.join(LOGO_DIR, file);

  slide = pptx.addSlide();
  addBg(slide);
  slide.addImage({ path: shots.home, x: 6.8, y: 0.88, w: 5.8, h: 3.26 });
  slide.addShape("rect", { x: 6.8, y: 0.88, w: 5.8, h: 3.26, fill: { color: "020617", transparency: 58 }, line: { color: "334155", transparency: 100 } });
  addTopLabel(slide, ">>> pylearn_presentation");
  slide.addText("Бағдарламалау негіздерін оқытуға арналған\nцифрлық көмекші әзірлеу", { x: 0.62, y: 0.96, w: 5.62, h: 1.34, fontFace: "Aptos Display", bold: true, fontSize: 24, color: "F8FAFC", fit: "shrink", margin: 0, breakLine: false });
  slide.addShape("roundRect", { x: 0.66, y: 2.62, w: 2.1, h: 0.38, rectRadius: 0.06, fill: { color: "111827" }, line: { color: "8B5CF6", transparency: 20 } });
  slide.addText("Жоба: PyLearn", { x: 0.82, y: 2.72, w: 1.78, h: 0.11, fontFace: "Aptos", bold: true, fontSize: 10, color: "E9D5FF", margin: 0 });
  slide.addText("Python тілін қазақ тілінде үйренуге арналған интерактивті веб-платформа", { x: 0.66, y: 3.22, w: 5.2, h: 0.44, fontFace: "Aptos", fontSize: 13.4, color: "CBD5E1", fit: "shrink", margin: 0 });
  slide.addShape("roundRect", { x: 0.66, y: 4.08, w: 5.4, h: 1.05, rectRadius: 0.08, fill: { color: "0F172A", transparency: 4 }, line: { color: "334155", transparency: 10 } });
  slide.addText("Орындағандар: Қоныс Н.А., Нұрымбет Ә.М.\nҒылыми жетекші: ф.-м.ғ.к., доцент Ерекешева М.М.", { x: 0.92, y: 4.29, w: 4.9, h: 0.52, fontFace: "Aptos", bold: true, fontSize: 15.2, color: "CBD5E1", align: "center", fit: "shrink", margin: 0 });
  addStat(slide, "5", "деңгей", 0.66, 5.65, "38BDF8");
  addStat(slide, "25", "сабақ", 2.45, 5.65, "22C55E");
  addStat(slide, "100+", "тапсырма", 4.24, 5.65, "C084FC");
  addScreenshot(slide, shots.ai, 6.8, 4.58, 5.8, 2.12, "AI chat");
  addFooter(slide, 1);

  slide = pptx.addSlide();
  addBg(slide);
  addTopLabel(slide, ">>> relevance");
  addTitle(slide, "Жобаның Өзектілігі", "Қазақ тілінде Python-ды жүйелі әрі тәжірибеге жақын форматта үйрету қажеттілігі.");
  addBullets(slide, [
    "Бағдарламалау дағдысы білім беру мен еңбек нарығында маңызды құзыретке айналды.",
    "Қазақ тіліндегі интерактивті Python ресурстары әлі де аз.",
    "Оқушы теорияны оқып қана қоймай, код жазып, қатесін көріп, түзетуі керек.",
    "Автоматты тексеру мен AI көмекші мұғалімнің жұмысын жеңілдетеді.",
  ], 0.72, 2.25, 5.1, { dot: "22C55E", fontSize: 13.2, gap: 0.62 });
  addScreenshot(slide, shots.login, 6.65, 1.18, 5.72, 3.22, "login");
  addScreenshot(slide, shots.register, 6.65, 4.72, 5.72, 2.16, "register");
  addFooter(slide, 2);

  slide = pptx.addSlide();
  addBg(slide);
  addTopLabel(slide, ">>> goal_and_tasks");
  addTitle(slide, "Сайт Мүмкіндіктері", "PyLearn оқу процесін толық жүргізеді: тіркелу, сабақ оқу, практика, автоматты тексеру, прогресс, AI көмекші және сертификат.");
  addBullets(slide, [
    "Home беті жобаны таныстырып, қолданушыны сабаққа немесе практикалық тапсырмаларға бірден өткізеді.",
    "Login/Register бөлімдері аккаунт құрып, JWT арқылы қорғалған беттерге қауіпсіз кіруді қамтамасыз етеді.",
    "Learn және Lesson беттері деңгейлерді, теорияны, негізгі жазбаларды, синтаксис мысалдарын, сұрақтарды және quiz тексерісін біріктіреді.",
    "SolveProblem бөлімінде оқушы Python кодын браузерде жазады, stdin енгізеді, Pyodide арқылы орындайды және тест-кейстермен тексереді.",
    "Dashboard аяқталған сабақ, шешілген есеп, XP, деңгей, streak, оқу уақыты және соңғы әрекеттерді көрсетеді.",
    "AI Chat Python сұрақтарына түсініктеме беріп бағыттайды, ал Certificate бөлімі нәтижеге қарай PNG сертификат жасайды.",
  ], 0.72, 2.08, 4.95, { dot: "38BDF8", fontSize: 9.05, gap: 0.72, itemH: 0.58 });
  addScreenshot(slide, shots.learn, 6.08, 1.18, 6.45, 3.63, "learn");
  addScreenshot(slide, shots.lesson, 6.08, 5.08, 6.45, 1.82, "lesson");
  addFooter(slide, 3);

  slide = pptx.addSlide();
  addBg(slide);
  addTopLabel(slide, ">>> architecture");
  slide.addText("Жалпы Архитектура", {
    x: 0.65,
    y: 0.92,
    w: 5.4,
    h: 0.48,
    fontFace: "Aptos Display",
    bold: true,
    fontSize: 30,
    color: "F8FAFC",
    margin: 0,
  });
  slide.addShape("roundRect", {
    x: 0.72,
    y: 1.56,
    w: 11.9,
    h: 0.86,
    rectRadius: 0.08,
    fill: { color: "0F172A", transparency: 3 },
    line: { color: "334155", transparency: 18 },
  });
  slide.addText("PyLearn сайты оқушыға Python-ды нөлден бастап жүйелі меңгеруге жағдай жасайды. Платформада тіркелу/кіру, деңгейлік сабақтар, теориялық материал, quiz, практикалық код жазу алаңы, автоматты тестілеу, жеке Dashboard, AI көмекші және сертификат генерациясы бар. Нәтижелер backend арқылы өңделіп, деректер қорында сақталады, сондықтан оқушы өз прогресін жалғастырып бақылай алады.", {
    x: 0.98,
    y: 1.72,
    w: 11.38,
    h: 0.56,
    fontFace: "Aptos",
    fontSize: 8.7,
    color: "CBD5E1",
    margin: 0,
    fit: "shrink",
  });

  slide.addText("Технологиялық стек", {
    x: 0.72,
    y: 2.52,
    w: 3.4,
    h: 0.25,
    fontFace: "Consolas",
    bold: true,
    fontSize: 13,
    color: "BAE6FD",
    margin: 0,
  });

  addStackPanel(slide, "01 / FRONTEND", "Интерфейс және оқу беттері", 0.72, 2.9, 3.85, 2.43, "38BDF8");
  addStackPanel(slide, "02 / BACKEND", "API, авторизация және деректер қоры", 4.74, 2.9, 3.85, 2.43, "22C55E");
  addStackPanel(slide, "03 / RUNTIME + AI", "Python орындау және AI көмек", 8.76, 2.9, 3.85, 2.43, "C084FC");

  addTechCard(slide, { x: 1.02, y: 3.72, w: 3.22, h: 0.58, name: "React", role: "компоненттер мен маршруттар", logo: logo("react.svg"), color: "38BDF8" });
  addTechCard(slide, { x: 1.02, y: 4.42, w: 3.22, h: 0.58, name: "Vite", role: "жылдам dev/build ортасы", logo: logo("vite.svg"), color: "A78BFA" });

  addTechCard(slide, { x: 5.04, y: 3.66, w: 3.22, h: 0.5, name: "Express", role: "REST API және сервер логикасы", logo: logo("express.svg"), color: "F8FAFC" });
  addTechCard(slide, { x: 5.04, y: 4.24, w: 3.22, h: 0.5, name: "MySQL", role: "сабақ, нәтиже, чат деректері", logo: logo("mysql.svg"), color: "4479A1" });
  addTechCard(slide, { x: 5.04, y: 4.82, w: 3.22, h: 0.5, name: "JWT", role: "қорғалған беттерге кіру", logo: logo("jwt.svg"), color: "D63AFF" });

  addTechCard(slide, { x: 9.06, y: 3.72, w: 3.22, h: 0.58, name: "Pyodide", role: "браузер ішінде Python орындау", logo: logo("pyodide.svg"), color: "38BDF8" });
  addTechCard(slide, { x: 9.06, y: 4.42, w: 3.22, h: 0.58, name: "Gemini API", role: "оқушыға бағыт беретін AI ментор", logo: logo("gemini.svg"), color: "8AB4F8" });

  slide.addShape("rect", { x: 4.54, y: 4.1, w: 0.18, h: 0.04, fill: { color: "38BDF8" }, line: { color: "38BDF8", transparency: 100 } });
  slide.addShape("rect", { x: 8.56, y: 4.1, w: 0.18, h: 0.04, fill: { color: "22C55E" }, line: { color: "22C55E", transparency: 100 } });
  slide.addText("→", { x: 4.62, y: 3.94, w: 0.2, h: 0.12, fontFace: "Consolas", bold: true, fontSize: 13, color: "38BDF8", margin: 0 });
  slide.addText("→", { x: 8.64, y: 3.94, w: 0.2, h: 0.12, fontFace: "Consolas", bold: true, fontSize: 13, color: "22C55E", margin: 0 });

  slide.addShape("roundRect", { x: 0.88, y: 5.55, w: 11.5, h: 0.56, rectRadius: 0.08, fill: { color: "020617", transparency: 5 }, line: { color: "334155", transparency: 12 } });
  slide.addText("Қолданушы → React UI → Express API → MySQL → Pyodide / Gemini → Dashboard және Certificate", {
    x: 1.14,
    y: 5.74,
    w: 10.96,
    h: 0.13,
    fontFace: "Consolas",
    bold: true,
    fontSize: 10.6,
    color: "E0F2FE",
    align: "center",
    margin: 0,
  });

  addBullets(slide, [
    "React пен Vite сайттың көрінетін бөлігін құрады: басты бет, сабақтар, код жазу алаңы, dashboard, сертификат және AI чат интерфейсі осы қабатта жұмыс істейді.",
    "Express backend қолданушыны тіркеу, кіру, сабақтарды жүктеу, тапсырма нәтижесін сақтау, статистика шығару және AI сұрауларын өңдеу міндетін атқарады.",
    "MySQL барлық оқу деректерін сақтайды; JWT қорғалған беттерге кіруді тексереді; Pyodide Python кодын браузерде орындайды, ал Gemini API оқушыға түсіндіру мен бағыт береді.",
  ], 1.1, 6.28, 11.35, { dot: "C084FC", fontSize: 8.55, gap: 0.28 });
  addFooter(slide, 4);

  slide = pptx.addSlide();
  addBg(slide);
  addTopLabel(slide, ">>> home_page");
  addTitle(slide, "Басты Бет", "Home беті қолданушыны бірден оқу процесіне шақырады және бағдарламалау атмосферасын береді.");
  addScreenshot(slide, shots.home, 0.7, 2.18, 6.85, 3.85, "home");
  addBullets(slide, [
    "Басты бет жобаның атауын, Python оқу бағытын және негізгі әрекеттерді бір экранда көрсетеді.",
    "Оқуды бастау батырмасы сабақтар жүйесіне, тапсырмаларды шешу батырмасы практикалық есептерге апарады.",
    "Деңгей, сабақ және тапсырма саны сияқты индикаторлар платформа ауқымын бірден түсіндіреді.",
    "Жоғарғы навигация арқылы бақылау тақтасы, практикалық бөлім, сертификат және шығу әрекеті қолжетімді.",
  ], 8.18, 2.24, 4.05, { dot: "38BDF8", fontSize: 9.7, gap: 0.78, itemH: 0.62 });
  addFooter(slide, 5);

  slide = pptx.addSlide();
  addBg(slide);
  addTopLabel(slide, ">>> learning_flow");
  addTitle(slide, "Сабақтар Жүйесі", "Learn және Lesson беттері оқу жолын ретімен көрсетіп, әр тақырыпты бөлімдерге бөліп түсіндіреді.");
  addScreenshot(slide, shots.learn, 0.72, 2.18, 5.6, 3.15, "learn");
  addScreenshot(slide, shots.lesson, 7.0, 2.18, 5.35, 3.01, "lesson");
  addBullets(slide, [
    "Learn беті деңгейлерді және сабақтарды ретімен көрсетіп, оқушы қай тақырыптан бастау керегін нақтылайды.",
    "Lesson бетінде теориялық түсіндіру, негізгі жазбалар, синтаксис мысалдары және тақырыпқа арналған сұрақтар бір жерде беріледі.",
    "Quiz оқушының тақырыпты түсінуін тексеріп, нәтижені прогресс жүйесімен байланыстырады.",
    "Сабақ аяқталған сайын келесі материалға өту логикасы сақталып, оқу жолы үзілмейді.",
  ], 1.0, 5.66, 10.9, { dot: "22C55E", fontSize: 9.35, gap: 0.34, itemH: 0.29 });
  addFooter(slide, 6);

  slide = pptx.addSlide();
  addBg(slide);
  addTopLabel(slide, ">>> practice");
  addTitle(slide, "Практикалық Код Жазу", "SolveProblem беті оқушыны нақты есеп шығаруға, код орындауға және тест нәтижесін көруге үйретеді.");
  addScreenshot(slide, shots.solve, 0.72, 2.1, 6.9, 3.88, "solve-problem");
  addBullets(slide, [
    "SolveProblem бөлімінде тапсырма шарты, талаптар және тест-кейстер оқушыға бір экранда беріледі.",
    "Код редакторында Python шешімін жазып, stdin арқылы кіріс мәндерін енгізуге болады.",
    "Run әрекеті кодты браузер ішінде Pyodide арқылы орындап, stdout немесе қате хабарламасын көрсетеді.",
    "Submit тест-кейстерді тексеріп, дұрыс/қате нәтижені және өткен тест санын шығарады.",
    "Шешілген есептер прогресс пен Dashboard статистикасына қосылады.",
  ], 8.18, 2.16, 4.1, { dot: "FACC15", fontSize: 8.8, gap: 0.7, itemH: 0.55 });
  addFooter(slide, 7);

  slide = pptx.addSlide();
  addBg(slide);
  addTopLabel(slide, ">>> progress");
  addTitle(slide, "Dashboard Және Прогресс", "Бақылау тақтасы оқу нәтижесін көрнекі статистикаға айналдырады.");
  addScreenshot(slide, shots.dashboard, 0.72, 2.1, 6.9, 3.88, "dashboard");
  addStat(slide, "2450", "XP", 8.35, 2.18, "38BDF8");
  addStat(slide, "5", "деңгей", 10.12, 2.18, "FACC15");
  addStat(slide, "18", "тапсырма", 8.35, 3.25, "22C55E");
  addStat(slide, "7", "streak", 10.12, 3.25, "F97316");
  addBullets(slide, [
    "Dashboard оқушының XP, деңгей, шешілген тапсырма, streak және оқу уақытын жинақтап көрсетеді.",
    "Соңғы әрекеттер, сабақ прогресі және практикалық нәтижелер оқу қарқынын бақылауға көмектеседі.",
    "Мұғалім немесе жетекші нақты нәтижеге қарап, қай бөлімге қайта оралу керегін анықтай алады.",
    "Мотивациялық метрикалар күнделікті оқу әдетін қалыптастыруға бағытталған.",
  ], 8.35, 4.55, 4.0, { dot: "C084FC", fontSize: 8.9, gap: 0.58, itemH: 0.46 });
  addFooter(slide, 8);

  slide = pptx.addSlide();
  addBg(slide);
  addTopLabel(slide, ">>> ai_and_certificate");
  addTitle(slide, "AI Көмекші Және Сертификат", "Платформа оқушыға бағыт беретін менторлық қолдау және жетістікті рәсімдеу мүмкіндігін қосады.");
  addScreenshot(slide, shots.ai, 0.72, 2.18, 5.65, 3.18, "AI assistant");
  addScreenshot(slide, shots.certificate, 7.0, 2.18, 5.28, 2.97, "certificate");
  addBullets(slide, [
    "AI Chat Python бойынша сұраққа қазақ тілінде жауап беріп, қатені түсіндіреді, бағыт береді және оқушыға келесі қадам ұсынады.",
    "Чат бірнеше сессияны сақтайды: қолданушы бұрынғы диалогтарын көріп, қажет болса жаңа чат аша алады.",
    "Жүйе дайын шешімді бірден көшіртпей, ұғымды түсіндіруге және оқушыны өз бетімен ойландыруға бейімделген.",
    "Certificate бөлімі сабақ, есеп, XP және оқу уақыты сияқты нәтижелерді көрсетіп, PNG форматындағы сертификат қалыптастырады.",
  ], 0.98, 5.68, 10.8, { dot: "38BDF8", fontSize: 9.15, gap: 0.34, itemH: 0.3 });
  addFooter(slide, 9);

  slide = pptx.addSlide();
  addBg(slide);
  slide.addImage({ path: shots.certificate, x: 7.05, y: 1.16, w: 5.55, h: 3.12 });
  slide.addShape("rect", { x: 7.05, y: 1.16, w: 5.55, h: 3.12, fill: { color: "020617", transparency: 35 }, line: { color: "334155", transparency: 100 } });
  addTopLabel(slide, ">>> conclusion");
  slide.addText("Қорытынды", { x: 0.65, y: 1.03, w: 5.4, h: 0.55, fontFace: "Aptos Display", bold: true, fontSize: 34, color: "FFFFFF", margin: 0 });
  slide.addText("PyLearn қазақ тілінде бағдарламалау негіздерін үйрететін толық оқу платформасы ретінде ұсынылады. Ол теорияны, практиканы, автоматты тексеруді, прогресс аналитикасын, AI көмекшіні және сертификатты бір жүйеге біріктіреді.", { x: 0.68, y: 1.9, w: 5.55, h: 0.95, fontFace: "Aptos", fontSize: 12.5, color: "CBD5E1", fit: "shrink", margin: 0 });
  addBullets(slide, [
    "Қазақ тіліндегі теория, интерактивті сабақ, quiz және практика алаңы бір ортаға жинақталған.",
    "Оқушы браузерде Python кодын орындап, тест нәтижесін бірден көріп, қатесін түзету арқылы үйренеді.",
    "Dashboard XP, деңгей, streak, тапсырма және уақыт көрсеткіштерін сақтап, оқу барысын дерекке айналдырады.",
    "AI көмекші түсіндіру, бағыт беру және сұраққа жауап беру арқылы жеке қолдау қызметін атқарады.",
    "Сертификат оқуды аяқтау нәтижесін ресми көрнекі құжат ретінде шығарады.",
  ], 0.75, 3.18, 5.35, { dot: "22C55E", fontSize: 9.05, gap: 0.58, itemH: 0.46 });
  addScreenshot(slide, shots.home, 7.05, 4.72, 5.55, 2.08, "final view");
  addFooter(slide, 10);

  return pptx.writeFile({ fileName: OUTPUT });
}

async function main() {
  ensureDir(OUT_DIR);
  let apiServer = null;
  let viteProcess = null;
  const reuseScreenshots = process.argv.includes("--reuse-screenshots");

  try {
    let shots;
    if (reuseScreenshots) {
      shots = getExistingScreenshots();
    } else {
      apiServer = await startMockApiIfNeeded();
      viteProcess = await startViteIfNeeded();
      shots = await captureScreenshots();
    }
    await makePresentation(shots);
    console.log(`Presentation written: ${OUTPUT}`);
  } finally {
    if (viteProcess) await stopProcessTree(viteProcess);
    if (apiServer) await closeServer(apiServer);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
