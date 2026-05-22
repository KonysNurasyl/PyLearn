const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

dotenv.config({ path: path.join(__dirname, '.env') });

const db = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? null : 'dev_only_pylearn_secret');
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is required in production');
}

// Рұқсат етілген сұраулар санын шектеу
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { message: 'Сұраулар тым көп, кішкене күте тұрыңыз' }
});

// Авторизацияны тексеру (міндетті)
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ message: 'Авторизация токені қажет' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Токен жарамсыз немесе мерзімі біткен' });
    req.user = user;
    next();
  });
}

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/', apiLimiter);

const PORT = process.env.PORT || 4000;
const HOST = process.env.HOST || '0.0.0.0';

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Барлық деңгейлерді алу
app.get('/api/levels', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT id, level_number, title FROM levels ORDER BY level_number');
    return res.json(rows);
  } catch (err) {
    console.error('Деңгейлерді алу қатесі:', err);
    return res.status(500).json({ message: 'Сервер қатесі' });
  }
});

// Тапсырмалар тізімін алу (қосымша ?limit=&offset=)
app.get('/api/problems', async (req, res) => {
  try {
    const requestedLimit = Number(req.query.limit);
    const requestedOffset = Number(req.query.offset);
    const limit = Number.isInteger(requestedLimit) && requestedLimit > 0
      ? Math.min(requestedLimit, 100)
      : 100;
    const offset = Number.isInteger(requestedOffset) && requestedOffset >= 0
      ? requestedOffset
      : 0;
    const [rows] = await db.query(`SELECT id, title, description, difficulty, expected_output, template, test_cases FROM problems ORDER BY id LIMIT ${limit} OFFSET ${offset}`);
    // test_cases JSON-ды parse ету
    for (const row of rows) {
      if (row.test_cases && typeof row.test_cases === 'string') {
        try { row.test_cases = JSON.parse(row.test_cases); } catch { row.test_cases = []; }
      }
    }
    return res.json(rows);
  } catch (err) {
    console.error('Тапсырмаларды алу қатесі:', err);
    return res.status(500).json({ message: 'Сервер қатесі' });
  }
});

// ID бойынша бір тапсырманы алу
app.get('/api/problems/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const [rows] = await db.execute('SELECT id, title, description, difficulty, expected_output, template, test_cases FROM problems WHERE id = ?', [id]);
    if (rows[0] && rows[0].test_cases && typeof rows[0].test_cases === 'string') {
      try { rows[0].test_cases = JSON.parse(rows[0].test_cases); } catch { rows[0].test_cases = []; }
    }
    if (!rows.length) return res.status(404).json({ message: 'Тапсырма табылмады' });
    return res.json(rows[0]);
  } catch (err) {
    console.error('Тапсырмаларды алу қатесі:', err);
    return res.status(500).json({ message: 'Сервер қатесі' });
  }
});

// Тапсырма әрекетін/нәтижесін сақтау
app.post('/api/problems/:id/attempt', authenticateToken, async (req, res) => {
  try {
    const problemId = req.params.id;
    const { outputs, submission, timeSpent } = req.body;
    const userId = req.user.id;
    const timeToSave = typeof timeSpent === 'number' ? timeSpent : 0;

    // Тапсырманы дерекқордан алу
    const [problemRows] = await db.execute('SELECT expected_output, test_cases FROM problems WHERE id = ?', [problemId]);
    if (!problemRows.length) return res.status(404).json({ message: 'Тапсырма табылмады' });

    let testCases = [];
    try {
      testCases = typeof problemRows[0].test_cases === 'string'
        ? JSON.parse(problemRows[0].test_cases)
        : (problemRows[0].test_cases || []);
    } catch { testCases = []; }

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

    // Барлық тест-кейстерді тексеру
    let score = 0;
    let correct = false;
    let passedCount = 0;
    let totalTests = testCases.length;
    const results = [];

    if (totalTests > 0 && Array.isArray(outputs) && outputs.length === totalTests) {
      let allPassed = true;
      for (let i = 0; i < totalTests; i++) {
        const expected = (testCases[i].expected || '').trim();
        const actual = (outputs[i] || '').trim();
        const passed = smartCompare(actual, expected);
        results.push({ test: i + 1, passed, expected, actual });
        if (passed) passedCount++;
        else allPassed = false;
      }
      if (allPassed) {
        score = 100;
        correct = true;
      }
    } else if (!totalTests) {
      // Тест-кейс жоқ болса, expected_output-пен салыстыру
      const expected = (problemRows[0].expected_output || '').trim();
      const actual = Array.isArray(outputs) ? (outputs[0] || '').trim() : '';
      if (expected && smartCompare(actual, expected)) {
        score = 100;
        correct = true;
      }
      totalTests = 1;
      passedCount = correct ? 1 : 0;
    }

    try {
      const [result] = await db.execute('INSERT INTO problem_results (user_id, problem_id, score, submission, time_spent) VALUES (?, ?, ?, ?, ?)', [userId, problemId, score, submission || null, timeToSave]);
      return res.status(201).json({
        id: result.insertId, correct, score,
        passedCount, totalTests, results,
        message: correct ? `Барлық тесттер өтті! (${passedCount}/${totalTests})` : `Кейбір тесттер сәтсіз (${passedCount}/${totalTests})`
      });
    } catch (e) {
      console.warn('Жіберу кезінде жазу сәтсіз аяқталды:', e.message);
      const [result] = await db.execute('INSERT INTO problem_results (user_id, problem_id, score, time_spent) VALUES (?, ?, ?, ?)', [userId, problemId, score, timeToSave]);
      return res.status(201).json({
        id: result.insertId, correct, score,
        passedCount, totalTests,
        message: correct ? 'Дұрыс шешім!' : 'Қате шешім'
      });
    }
  } catch (err) {
    console.error('Мәселені сақтау әрекеті қатесі:', err);
    return res.status(500).json({ message: 'Сервер қатесі' });
  }
});

// Сабақтарды алу (қосымша сұрау параметрі: ?level=1)
app.get('/api/lessons', async (req, res) => {
  try {
    const level = req.query.level;
    if (level) {
      const [rows] = await db.execute('SELECT id, level_id, lesson_number, title, content, youtube_link, document_link FROM lessons WHERE level_id = ? ORDER BY lesson_number', [level]);
      return res.json(rows);
    }
    const [rows] = await db.execute('SELECT id, level_id, lesson_number, title, content, youtube_link, document_link FROM lessons ORDER BY level_id, lesson_number');
    return res.json(rows);
  } catch (err) {
    console.error('Сабақтарды алу қатесі:', err);
    return res.status(500).json({ message: 'Сервер қатесі' });
  }
});

// ID бойынша бір сабақты алу
app.get('/api/lessons/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const [rows] = await db.execute('SELECT id, level_id, lesson_number, title, content, key_notes, syntax, important_questions, youtube_link, document_link FROM lessons WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ message: 'Сабақ табылмады' });
    return res.json(rows[0]);
  } catch (err) {
    console.error('Сабақтарды алу қатесі:', err);
    return res.status(500).json({ message: 'Сервер қатесі' });
  }
});

// Сабақ үшін тест (MCQ) сұрақтарын алу
app.get('/api/lessons/:id/mcq', async (req, res) => {
  try {
    const id = req.params.id;
    const [rows] = await db.execute('SELECT id, lesson_id, question, option_a, option_b, option_c, option_d, correct_option FROM lesson_mcq WHERE lesson_id = ?', [id]);
    return res.json(rows);
  } catch (err) {
    console.error('Сабақтың сұрақтарын алу қатесі:', err);
    return res.status(500).json({ message: 'Сервер қатесі' });
  }
});

// Сабақ бойынша пайдаланушы прогресін алу
app.get('/api/lessons/:id/progress', authenticateToken, async (req, res) => {
  try {
    const lessonId = req.params.id;
    const userId = req.user.id;
    const [rows] = await db.execute('SELECT MAX(score) as max_score, MAX(time_spent) as max_time FROM mcq_results WHERE user_id = ? AND lesson_id = ?', [userId, lessonId]);
    const [qRows] = await db.execute('SELECT COUNT(*) as total_questions FROM lesson_mcq WHERE lesson_id = ?', [lessonId]);
    
    return res.json({
       max_score: rows[0].max_score !== null ? rows[0].max_score : null,
       max_time: rows[0].max_time !== null ? rows[0].max_time : null,
       total_questions: qRows[0].total_questions || 0
    });
  } catch (err) {
    console.error('Прогресс алу қатесі:', err);
    return res.status(500).json({ message: 'Сервер қатесі' });
  }
});

// Сабаққа тест (MCQ) нәтижесін сақтау
app.post('/api/lessons/:id/mcq/result', authenticateToken, async (req, res) => {
  try {
    const lessonId = req.params.id;
    const { score, timeSpent } = req.body;
    const userId = req.user.id;
    if (typeof score !== 'number') return res.status(400).json({ message: 'Балл (сан) міндетті' });
    const timeToSave = typeof timeSpent === 'number' ? timeSpent : 0;

    const [result] = await db.execute('INSERT INTO mcq_results (user_id, lesson_id, score, time_spent) VALUES (?, ?, ?, ?)', [userId, lessonId, score, timeToSave]);
    return res.status(201).json({ id: result.insertId, message: 'Нәтиже сақталды' });
  } catch (err) {
    console.error('Сұрақ нәтижесін сақтау қатесі:', err);
    return res.status(500).json({ message: 'Сервер қатесі' });
  }
});

// Пайдаланушының жалпы статистикасын алу (аяқталған сабақтар, шешілген тапсырмалар, XP, соңғы белсенділік)
app.get('/api/users/:id/stats', authenticateToken, async (req, res) => {
  try {
    // Токенге сәйкес келетін пайдаланушы ID
    const userId = req.user.id;
    // негізгі санақтар
    const [lessonsRows] = await db.execute('SELECT COUNT(DISTINCT lesson_id) AS lessonsCompleted FROM mcq_results WHERE user_id = ? AND score > 0', [userId]);
    const lessonsCompleted = lessonsRows && lessonsRows[0] ? lessonsRows[0].lessonsCompleted || 0 : 0;

    // Тек балы > 0 болған тапсырмаларды ғана дұрыс шешілген деп санау
    const [problemsRows] = await db.execute('SELECT COUNT(DISTINCT problem_id) AS problemsSolved FROM problem_results WHERE user_id = ? AND score > 0', [userId]);
    const problemsSolved = problemsRows && problemsRows[0] ? problemsRows[0].problemsSolved || 0 : 0;

    const [mcqScoreRows] = await db.execute('SELECT COALESCE(SUM(score),0) AS mcqScore FROM mcq_results WHERE user_id = ?', [userId]);
    const mcqScore = mcqScoreRows && mcqScoreRows[0] ? mcqScoreRows[0].mcqScore || 0 : 0;

    const [probScoreRows] = await db.execute('SELECT COALESCE(SUM(score),0) AS problemScore FROM problem_results WHERE user_id = ?', [userId]);
    const problemScore = probScoreRows && probScoreRows[0] ? probScoreRows[0].problemScore || 0 : 0;

    const totalXP = Number(mcqScore) + Number(problemScore);

    const [levelsRows] = await db.execute('SELECT COUNT(DISTINCT l.level_id) AS levelsCompleted FROM mcq_results m JOIN lessons l ON m.lesson_id = l.id WHERE m.user_id = ? AND m.score > 0', [userId]);
    const levelsCompleted = levelsRows && levelsRows[0] ? levelsRows[0].levelsCompleted || 0 : 0;

    // currentStreak: қатарынан белсенді күндерді есептеу
    const [streakDataRows] = await db.execute(
      `SELECT DISTINCT DATEDIFF(CURDATE(), dt) AS diff FROM (
         SELECT DATE(attempted_at) AS dt FROM mcq_results WHERE user_id = ?
         UNION ALL
         SELECT DATE(submitted_at) AS dt FROM problem_results WHERE user_id = ?
       ) t ORDER BY diff ASC`,
      [userId, userId]
    );

    let currentStreak = 0;
    if (streakDataRows && streakDataRows.length > 0) {
      let firstDiff = Number(streakDataRows[0].diff);
      if (firstDiff === 0 || firstDiff === 1) {
        currentStreak = 1;
        let expectedDiff = firstDiff + 1;
        for (let i = 1; i < streakDataRows.length; i++) {
          if (Number(streakDataRows[i].diff) === expectedDiff) {
            currentStreak++;
            expectedDiff++;
          } else {
            break;
          }
        }
      }
    }

    // соңғы белсенділік: mcq_results және problem_results ішінен тақырыптары бар соңғы 8 жазба
    const [recentRows] = await db.execute(
      `SELECT type, id, title, score, time FROM (
         SELECT 'mcq' AS type, m.id AS id, l.title AS title, m.score AS score, m.attempted_at AS time
         FROM mcq_results m
         JOIN lessons l ON m.lesson_id = l.id
         WHERE m.user_id = ?
         UNION ALL
         SELECT 'problem' AS type, pr.id AS id, p.title AS title, pr.score AS score, pr.submitted_at AS time
         FROM problem_results pr
         JOIN problems p ON pr.problem_id = p.id
         WHERE pr.user_id = ?
       ) sq
       ORDER BY time DESC
       LIMIT 8`,
      [userId, userId]
    );

    // тест пен тапсырмалардан есептелген секундтарды пайдаланып, оқуға кеткен дәл сағаттар
    const [mcqTimeRows] = await db.execute('SELECT COALESCE(SUM(time_spent), 0) AS mcqTime FROM mcq_results WHERE user_id = ?', [userId]);
    const [probTimeRows] = await db.execute('SELECT COALESCE(SUM(time_spent), 0) AS probTime FROM problem_results WHERE user_id = ?', [userId]);
    
    const totalSecondsSpent = Number(mcqTimeRows[0].mcqTime) + Number(probTimeRows[0].probTime);
    let hoursLearned = (totalSecondsSpent / 3600).toFixed(1);
    
    // Егер уақыт мүлдем есептелмесе, әр сабаққа 0.5 сағатдан есептеу
    if (totalSecondsSpent === 0 && Number(lessonsCompleted) > 0) {
        hoursLearned = (Number(lessonsCompleted) * 0.5).toFixed(1);
    }

    // XP-ден деңгейді шығару (қарапайым карта: 0-499 -> 1, 500-999 ->2, т.б.)
    const level = Math.max(1, Math.floor(totalXP / 500) + 1);
    const nextLevelXP = (level * 500);

    // деңгей прогресін сұрау
    const [levelProgress] = await db.execute(`
      SELECT l.id as level_id, l.title,
        (SELECT COUNT(*) FROM lessons WHERE level_id = l.id) as total_lessons,
        (SELECT COUNT(DISTINCT m.lesson_id) FROM mcq_results m JOIN lessons les ON m.lesson_id = les.id WHERE les.level_id = l.id AND m.user_id = ? AND m.score > 0) as completed_lessons
      FROM levels l
      ORDER BY l.level_number
    `, [userId]);

    return res.json({
      lessonsCompleted,
      problemsSolved,
      totalXP,
      levelsCompleted,
      currentStreak,
      hoursLearned,
      level,
      nextLevelXP,
      levelProgress: levelProgress || [],
      recentActivity: recentRows || []
    });
  } catch (err) {
    console.error('Пайдаланушы статистикасының қатесін алу:', err);
    return res.status(500).json({ message: 'Сервер қатесі' });
  }
});

// Бұғаттауларды басқару үшін пайдаланушының өткен сабақтарын алу (>= 80% балл)
app.get('/api/users/:id/passed_lessons', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const [rows] = await db.execute(`
      SELECT l.id as lesson_id, 
        (SELECT COUNT(*) FROM lesson_mcq WHERE lesson_id = l.id) as total_questions,
        (SELECT MAX(score) FROM mcq_results WHERE lesson_id = l.id AND user_id = ?) as max_score
      FROM lessons l
      ORDER BY l.level_id ASC, l.lesson_number ASC
    `, [userId]);
    
    const passed = [];
    for (let r of rows) {
      if (r.total_questions > 0) {
         let correct = (r.max_score || 0) / 100;
         if ((correct / r.total_questions) >= 0.8) {
            passed.push(r.lesson_id);
         }
      } else {
         passed.push(r.lesson_id);
      }
    }
    return res.json(passed);
  } catch(err) {
    console.error('Passed lessons қатесі:', err);
    return res.status(500).json({message: 'Қате'});
  }
});

// Пайдаланушының дұрыс шешілген тапсырмаларын алу (score > 0)
app.get('/api/users/:id/solved_problems', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const [rows] = await db.execute(
      'SELECT DISTINCT problem_id FROM problem_results WHERE user_id = ? AND score > 0 ORDER BY problem_id',
      [userId]
    );
    return res.json(rows.map(r => r.problem_id));
  } catch(err) {
    console.error('Solved problems қатесі:', err);
    return res.status(500).json({ message: 'Қате' });
  }
});

app.post('/api/register', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Электрондық пошта және құпиясөз қажет' });

  try {
    // Мұндай электрондық пошта бар-жоғын тексеру
    const [existing] = await db.execute('SELECT id, created_at FROM users WHERE email = ?', [email]);
    if (existing.length) {
      return res.status(409).json({
        id: existing[0].id,
        created_at: existing[0].created_at,
        message: 'Электрондық пошта тіркелген'
      });
    }

    // Құпиясөзді хэштеп, жаңа пайдаланушыны қосу
    const hash = await bcrypt.hash(password, 10);
    const [result] = await db.execute(
      'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
      [name || null, email, hash]
    );

    // created_at алу үшін пайдаланушыны енгізгеннен кейін бірден оқу
    const [userRows] = await db.execute('SELECT id, name, email, created_at FROM users WHERE id = ?', [result.insertId]);
    const token = jwt.sign({ id: userRows[0].id, email: userRows[0].email }, JWT_SECRET, { expiresIn: '7d' });

    return res.status(201).json({ ...userRows[0], token, message: 'Тіркелу сәтті жасалды' });
  } catch (err) {
    console.error('Тіркеу қатесі:', err);
    return res.status(500).json({ message: 'Сервер қатесі' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Электрондық пошта және құпиясөз қажет' });

  try {
    // Пайдаланушыны created_at мәнімен бірге алу
    const [rows] = await db.execute('SELECT id, name, email, password, created_at FROM users WHERE email = ?', [email]);
    if (!rows.length) return res.status(401).json({ message: 'Жарамсыз тіркелу деректері' });

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: 'Жарамсыз тіркелу деректері' });

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    return res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      created_at: user.created_at, // ✅ тіркелу күні
      token,
      message: 'Сәтті кіру'
    });
  } catch (err) {
    console.error('Кіру қатесі:', err);
    return res.status(500).json({ message: 'Сервер қатесі' });
  }
});

// ─── AI Chat ─────────────────────────────────────────────────────────────────

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : null;

const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

const SYSTEM_PROMPT = `Сен — PyLearn AI көмекшісісің. Сен Python бағдарламалау тілін үйретуге көмектесесің.
Ережелер:
1. Әрқашан қазақ тілінде жауап бер (пайдаланушы орысша жазса — орысша жауап бер).
2. Дайын шешімдер берме — оқушыны дұрыс бағытта бағытта, кеңестер бер.
3. Түсіндірмені қарапайым, түсінікті сөздермен жаз.
4. Код мысалдарын бер, бірақ тапсырмалардың толық шешімін берме.
5. Қате кодты талдауға көмектес — қатені түсіндір, түзету жолын көрсет.
6. Оқушыны ынталандыр, позитивті бол.
7. Тек Python-ға қатысты сұрақтарға жауап бер. Басқа тақырыптарда "Мен тек Python бойынша көмектесе аламын" деп жауап бер.`;

// POST /api/ai/chat — нейрондық желіге хабарлама жіберу
app.post('/api/ai/chat', authenticateToken, async (req, res) => {
  try {
    const { message, context, history, session_id } = req.body;
    const userId = req.user.id;
    const sessionId = session_id || 'default-session';
    if (!message) return res.status(400).json({ message: 'Хабарлама қажет' });

    if (!genAI) {
      return res.status(500).json({ message: 'GEMINI_API_KEY конфигурацияланбаған' });
    }

    // Gemini үшін сөйлесу мазмұнын құру
    const contents = [];

    // Контекст үшін алдыңғы сөйлесу тарихын қосу (соңғы 10 хабарлама)
    if (history && Array.isArray(history)) {
      const recent = history.slice(-10);
      for (const h of recent) {
        contents.push({
          role: h.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: h.message }]
        });
      }
    }

    // Контекстпен пайдаланушы хабарламасын құру
    let userMessage = message;
    if (context) {
      userMessage = `[Контекст: ${context}]\n\nСұрақ: ${message}`;
    }

    contents.push({
      role: 'user',
      parts: [{ text: userMessage }]
    });

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        maxOutputTokens: 2048,
      }
    });

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let fullReply = '';

    try {
      const result = await model.generateContentStream({ contents });

      for await (const chunk of result.stream) {
        const text = chunk.text();
        fullReply += text;
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }
      res.write('data: [DONE]\n\n');
      res.end();
    } catch (streamErr) {
      console.error('Gemini Stream Error:', streamErr);
      if (!fullReply) {
        res.write(`data: ${JSON.stringify({ text: '\n\n❌ AI жауап беру кезінде қателік туындады.' })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
        return;
      }
    }

    // chat_history ішіне сақтау (артқы фонда)
    if (userId && fullReply) {
      try {
        await db.execute(
          'INSERT INTO chat_history (user_id, session_id, role, message, context) VALUES (?, ?, ?, ?, ?)',
          [userId, sessionId, 'user', message, context || null]
        );
        await db.execute(
          'INSERT INTO chat_history (user_id, session_id, role, message, context) VALUES (?, ?, ?, ?, ?)',
          [userId, sessionId, 'assistant', fullReply, context || null]
        );
      } catch (e) {
        console.warn('Чат тарихын сақтау қатесі:', e.message);
      }
    }
  } catch (err) {
    console.error('AI chat қатесі:', err);
    if (!res.headersSent) {
      return res.status(500).json({ message: 'Сервер қатесі' });
    }
  }
});

// GET /api/ai/history/:userId — сеансқа арналған чат тарихын алу
app.get('/api/ai/history/:userId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const sessionId = req.query.sessionId || 'default-session';

    const [rows] = await db.execute(
      'SELECT id, role, message, context, created_at FROM chat_history WHERE user_id = ? AND session_id = ? ORDER BY created_at DESC, id DESC LIMIT 50',
      [userId, sessionId]
    );
    return res.json(rows.reverse()); // ең ескісі бірінші
  } catch (err) {
    console.error('Чат тарихын алу қатесі:', err);
    return res.json([]);
  }
});

// GET /api/ai/sessions — чат сеанстарының тізімін алу
app.get('/api/ai/sessions', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    // Бірінші хабарламаны тақырып ретінде, ал ең ерте created_at күнін алып, жалғыз сеанстарды алу
    const [rows] = await db.execute(`
      SELECT session_id, MIN(created_at) as created_at,
      (SELECT message FROM chat_history c2 WHERE c2.session_id = c1.session_id AND c2.user_id = ? AND c2.role = 'user' ORDER BY id ASC LIMIT 1) as title
      FROM chat_history c1
      WHERE user_id = ?
      GROUP BY session_id
      ORDER BY created_at DESC
    `, [userId, userId]);

    return res.json(rows);
  } catch (err) {
    console.error('Сессия тізімін алу қатесі:', err);
    return res.status(500).json({ message: 'Қате орын алды' });
  }
});

// DELETE /api/ai/sessions/:sessionId
app.delete('/api/ai/sessions/:sessionId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { sessionId } = req.params;
    await db.execute('DELETE FROM chat_history WHERE user_id = ? AND session_id = ?', [userId, sessionId]);
    return res.json({ success: true });
  } catch (err) {
    console.error('Сессияны өшіру қатесі:', err);
    return res.status(500).json({ message: 'Қате орын алды' });
  }
});

// ─── AI Code Review ──────────────────────────────────────────────────────────

// POST /api/problems/:id/ai-review — пайдаланушы кодын AI арқылы тексеру
app.post('/api/problems/:id/ai-review', authenticateToken, async (req, res) => {
  try {
    const { code, description, title, testCases } = req.body;

    if (!code || !code.trim()) {
      return res.status(400).json({ message: 'Код қажет' });
    }

    if (!genAI) {
      // Gemini жоқ болса — тест-кейстер ғана тексеріледі
      return res.json({ approved: true, cheatDetected: false, reason: 'AI тексеру өшірілген — тек тесттер тексерілді.' });
    }

    const testCasesText = Array.isArray(testCases) && testCases.length > 0
      ? testCases.map((tc, i) => `Тест ${i+1}: Кіріс="${tc.input || '(жоқ)'}", Күтілетін шығыс="${tc.expected || ''}"`).join('\n')
      : '(Тест-кейстер жоқ)';

    const reviewPrompt = `Сен Python кодтарын тексеретін AI сарапшысысың. Пайдаланушы мына тапсырманы шешуге тырысты:

ТАПСЫРМА АТАУЫ: ${title || '(атауы жоқ)'}
ТАПСЫРМА СИПАТТАМАСЫ: ${description || '(сипаттамасы жоқ)'}
ТЕСТ-КЕЙСТЕР:
${testCasesText}

ПАЙДАЛАНУШЫ ЖАЗҒАН КОД:
\`\`\`python
${code}
\`\`\`

Мына сұрақтарға жауап бер:
1. Бұл код тапсырманы ШЫНЫМЕН шешуге тырысты ма, әлде жай ғана hardcode (тікелей жауапты print() арқылы жазды) жасады ма?
2. Код тапсырма сипаттамасына сай алгоритм іске асырды ма?
3. Чит жасалды ма? (Мысалы: print("42"), print("Hello") сияқты тікелей шығыс — алгоритмсіз)

ЕСКЕРТУ 1: Егер тапсырма "Hello, World!" немесе қарапайым мәтін шығару болса — print() пайдалану ДҰРЫС, чит емес.
Егер тапсырма есеп шығару, цикл, шарт қолдануды талап етсе — тікелей жауап (мәліметтерді өңдемей) беру ЧИТ.
ЕСКЕРТУ 2: Пайдаланушы print ішінде түсіндірме мәтін жазса (мысалы: print("Жауап:", x)) немесе float түрінде шығарса (27.0) — БҰЛ ҚАТЕ ЕМЕС! Егер алгоритм (мысалы, max табу, қосу) дұрыс болса, оны қабылда (approved: true). Форматтың дәл сәйкестігін тексерме.

Тек JSON форматында жауап бер (басқа ешнәрсе жазба):
{
  "approved": true немесе false,
  "cheatDetected": true немесе false,
  "reason": "қысқаша түсіндірме қазақ тілінде"
}`;

    const reviewModel = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        temperature: 0.1,
        topP: 0.9,
        maxOutputTokens: 512,
      }
    });

    const result = await reviewModel.generateContent(reviewPrompt);
    const rawText = result.response.text().trim();

    // JSON-ды parse ету
    let reviewResult;
    try {
      // Markdown code block болса тазарту
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        reviewResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('JSON табылмады');
      }
    } catch (parseErr) {
      console.warn('AI review JSON parse қатесі:', parseErr.message, 'Raw:', rawText);
      // Parse сәтсіз болса — approved деп санаймыз
      reviewResult = { approved: true, cheatDetected: false, reason: 'AI жауабын талдау мүмкін болмады.' };
    }

    return res.json({
      approved: !!reviewResult.approved,
      cheatDetected: !!reviewResult.cheatDetected,
      reason: reviewResult.reason || ''
    });

  } catch (err) {
    console.error('AI review қатесі:', err);
    // Қате болса — блоктамаймыз
    return res.json({ approved: true, cheatDetected: false, reason: 'AI тексеру уақытша қолжетімсіз.' });
  }
});

const clientDistPath = path.resolve(__dirname, '..', 'dist');
const clientIndexPath = path.join(clientDistPath, 'index.html');

if (fs.existsSync(clientIndexPath)) {
  app.use(express.static(clientDistPath));

  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ message: 'API route not found' });
    }

    return res.sendFile(clientIndexPath);
  });
} else {
  app.get('/', (req, res) => {
    res.json({
      message: 'PyLearn API is running. Run npm run build in the project root to serve the React site from this server.'
    });
  });
}

app.listen(PORT, HOST, () => {
  console.log(`PyLearn backend осы портта жұмыс жасауда ${PORT}`);
});
