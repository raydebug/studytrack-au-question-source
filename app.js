const SUBJECTS = {
  english: "英语",
  mathematics: "数学",
  science: "科学",
  hass: "人文社科",
  "health-pe": "健康体育",
  technologies: "科技",
  "the-arts": "艺术",
  languages: "语言",
};

const GRADES = {
  foundation: "Foundation",
  "year-1": "Year 1",
  "year-2": "Year 2",
  "year-3": "Year 3",
  "year-4": "Year 4",
  "year-5": "Year 5",
  "year-6": "Year 6",
  "year-7": "Year 7",
  "year-8": "Year 8",
  "year-9": "Year 9",
  "year-10": "Year 10",
  "year-11": "Year 11",
  "year-12": "Year 12",
};

const STORAGE_KEY = "studytrack-au-history";
const LOG_REFRESH_MS = 60 * 1000;
const QUESTION_SOURCE_URL = "data/questions/latest.json";

const state = {
  questions: [],
  questionBank: [],
  sourceMeta: null,
  history: loadHistory(),
  lastLogXml: "",
};

const elements = {
  gradeSelect: document.querySelector("#gradeSelect"),
  countInput: document.querySelector("#countInput"),
  subjectGrid: document.querySelector("#subjectGrid"),
  generateBtn: document.querySelector("#generateBtn"),
  submitBtn: document.querySelector("#submitBtn"),
  resetBtn: document.querySelector("#resetBtn"),
  quizList: document.querySelector("#quizList"),
  quizMeta: document.querySelector("#quizMeta"),
  levelLabel: document.querySelector("#levelLabel"),
  latestScore: document.querySelector("#latestScore"),
  sessionsCount: document.querySelector("#sessionsCount"),
  averageScore: document.querySelector("#averageScore"),
  historyList: document.querySelector("#historyList"),
  progressRing: document.querySelector("#progressRing"),
  ringScore: document.querySelector("#ringScore"),
  logSize: document.querySelector("#logSize"),
  lastLogAge: document.querySelector("#lastLogAge"),
  logGeneratedAt: document.querySelector("#logGeneratedAt"),
  questionSource: document.querySelector("#questionSource"),
};

async function loadQuestionSource() {
  try {
    const response = await fetch(`${QUESTION_SOURCE_URL}?v=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    state.questionBank = Array.isArray(payload.questions) ? payload.questions : [];
    state.sourceMeta = {
      date: payload.date,
      count: state.questionBank.length,
      remote: true,
    };
    renderQuestionSource();
  } catch {
    state.questionBank = [];
    state.sourceMeta = {
      date: new Date().toISOString().slice(0, 10),
      count: 0,
      remote: false,
    };
    renderQuestionSource();
  }
}

function selectedSubjects() {
  const checked = [...elements.subjectGrid.querySelectorAll("input:checked")].map((input) => input.value);
  return checked.length ? checked : ["mathematics"];
}

function selectedGrade() {
  return elements.gradeSelect.value || "year-5";
}

function generateQuiz() {
  const grade = selectedGrade();
  const count = clamp(Number(elements.countInput.value) || 10, 3, 30);
  const subjects = selectedSubjects();

  elements.countInput.value = count;
  elements.levelLabel.textContent = GRADES[grade] || grade;

  const pool = state.questionBank.filter((question) => question.grade === grade && subjects.includes(question.subject));
  const sourceQuestions = pool.length ? shuffle(pool).slice(0, count) : makeFallbackQuestions(grade, subjects, count);

  state.questions = sourceQuestions.map((question) => ({
    ...question,
    answer: String(question.answer ?? ""),
    acceptableAnswers: question.acceptableAnswers || [question.answer],
  }));

  elements.quizMeta.textContent = `${state.questions.length} 题 · ${subjects.map((key) => SUBJECTS[key]).join(" / ")}`;
  renderQuestionSource();
  renderQuiz();
}

function renderQuiz() {
  elements.quizList.innerHTML = state.questions
    .map(
      (question, index) => `
        <article class="question-card">
          <div class="question-head">
            <span>第 ${index + 1} 题</span>
            <span>${GRADES[question.grade] || question.gradeLabel || ""} · ${SUBJECTS[question.subject] || question.subjectLabel}</span>
          </div>
          <p>${escapeHtml(question.prompt)}</p>
          <input class="answer-input" data-index="${index}" autocomplete="off" placeholder="输入答案" />
          <div class="feedback" data-feedback="${index}"></div>
        </article>
      `,
    )
    .join("");
}

function submitQuiz() {
  if (!state.questions.length) generateQuiz();

  let correct = 0;
  state.questions.forEach((question, index) => {
    const input = document.querySelector(`[data-index="${index}"]`);
    const feedback = document.querySelector(`[data-feedback="${index}"]`);
    const isCorrect = checkAnswer(input.value, question);
    correct += isCorrect ? 1 : 0;
    feedback.className = `feedback ${isCorrect ? "correct" : "incorrect"}`;
    feedback.textContent = isCorrect ? "正确" : `答案：${question.answer}`;
  });

  const score = Math.round((correct / state.questions.length) * 100);
  const subjects = [...new Set(state.questions.map((question) => SUBJECTS[question.subject] || question.subjectLabel))].join(" / ");
  const grade = selectedGrade();
  const record = {
    score,
    correct,
    total: state.questions.length,
    subjects,
    grade,
    date: new Date().toLocaleString("zh-CN", { dateStyle: "medium", timeStyle: "short" }),
    loggedAt: new Date().toISOString(),
    sourceDate: state.sourceMeta?.date || "",
  };

  state.history.unshift(record);
  state.history = state.history.slice(0, 12);
  saveHistory();
  renderStats();
}

function checkAnswer(value, question) {
  const clean = normalize(value);
  if (!clean) return false;
  if (normalize(question.answer) === clean) return true;
  return question.acceptableAnswers?.some((answer) => normalize(answer) === clean) ?? false;
}

function renderStats() {
  const latest = state.history[0];
  elements.sessionsCount.textContent = state.history.length;
  renderLogStatus();

  if (!latest) {
    elements.averageScore.textContent = "--";
    elements.latestScore.textContent = "未开始";
    elements.ringScore.textContent = "--";
    elements.progressRing.style.setProperty("--score", 0);
    elements.historyList.innerHTML = `<div class="history-item"><strong>还没有练习记录</strong><span>提交一次评分后会自动追踪</span></div>`;
    return;
  }

  const average = Math.round(state.history.reduce((sum, item) => sum + item.score, 0) / state.history.length);
  elements.averageScore.textContent = `${average}%`;
  elements.latestScore.textContent = `最新 ${latest.score}%`;
  elements.ringScore.textContent = `${latest.score}%`;
  elements.progressRing.style.setProperty("--score", latest.score);
  elements.historyList.innerHTML = state.history
    .map(
      (item) => `
        <div class="history-item">
          <strong>${item.score}% · ${item.correct}/${item.total}</strong>
          <span>${item.subjects}</span>
          <span>${item.date} · ${GRADES[item.grade] || item.grade || "Year 5"}</span>
        </div>
      `,
    )
    .join("");
}

function renderQuestionSource() {
  if (!elements.questionSource) return;
  if (!state.sourceMeta) {
    elements.questionSource.textContent = "题库源: 加载中";
    return;
  }
  const mode = state.sourceMeta.remote ? "GitHub Pages JSON" : "本地备用模板";
  elements.questionSource.textContent = `题库源: ${mode} · ${state.sourceMeta.date} · ${state.sourceMeta.count || "fallback"} 题`;
}

function renderLogStatus() {
  state.lastLogXml = createHistoryXml();
  const latest = state.history[0];
  const bytes = new Blob([state.lastLogXml]).size;

  elements.logSize.textContent = formatBytes(bytes);
  elements.lastLogAge.textContent = latest ? formatAge(latest.loggedAt || latest.date) : "无记录";
  elements.logGeneratedAt.textContent = `XML: ${new Date().toISOString()}`;
}

function createHistoryXml() {
  const generatedAt = new Date().toISOString();
  const entries = state.history
    .map(
      (item, index) => `  <entry index="${index + 1}" loggedAt="${escapeXml(item.loggedAt || "")}">
    <score>${item.score}</score>
    <correct>${item.correct}</correct>
    <total>${item.total}</total>
    <grade>${escapeXml(item.grade || "")}</grade>
    <subjects>${escapeXml(item.subjects)}</subjects>
    <sourceDate>${escapeXml(item.sourceDate || "")}</sourceDate>
  </entry>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<studyLog generatedAt="${generatedAt}" entries="${state.history.length}">
${entries}
</studyLog>`;
}

function makeFallbackQuestions(grade, subjects, count) {
  return Array.from({ length: count }, (_, index) => {
    const subject = subjects[index % subjects.length];
    const level = Math.max(1, Number(grade.replace("year-", "")) || 1);
    return makeFallbackQuestion(grade, subject, level, index);
  });
}

function makeFallbackQuestion(grade, subject, level, index) {
  const seed = Date.now() + index * 37 + subject.length * 11;
  const n = (offset, min, span) => min + ((seed + offset * 97) % span);

  if (subject === "mathematics") {
    const a = n(1, 4 * level, 12 * level);
    const b = n(2, 3 * level, 10 * level);
    const op = level >= 4 && index % 2 ? "x" : "+";
    const answer = op === "x" ? a * b : a + b;
    return { grade, subject, prompt: `${a} ${op} ${b} = ?`, answer: String(answer) };
  }

  const fallback = {
    english: ["Write a synonym for \"quick\".", "rapid"],
    science: ["What force pulls objects toward Earth?", "gravity"],
    hass: ["What is the capital city of Australia?", "Canberra"],
    "health-pe": ["Name one healthy drink choice for school.", "water"],
    technologies: ["What is an algorithm?", "a set of steps"],
    "the-arts": ["Name one primary colour.", "red"],
    languages: ["What does 'hello' usually mean?", "a greeting"],
  };
  const [prompt, answer] = fallback[subject] || fallback.english;
  return { grade, subject, prompt, answer };
}

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatAge(timestamp) {
  const time = Date.parse(timestamp);
  if (Number.isNaN(time)) return "时间未知";

  const diffSeconds = Math.max(0, Math.floor((Date.now() - time) / 1000));
  if (diffSeconds < 60) return "刚刚";

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes} 分钟前`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} 小时前`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} 天前`;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function resetAnswers() {
  document.querySelectorAll(".answer-input").forEach((input) => {
    input.value = "";
  });
  document.querySelectorAll(".feedback").forEach((feedback) => {
    feedback.textContent = "";
    feedback.className = "feedback";
  });
}

function normalize(value) {
  return String(value).trim().toLowerCase().replace(/\s+/g, " ");
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function loadHistory() {
  try {
    const history = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    return history.map((item) => ({
      ...item,
      grade: item.grade || "year-5",
      loggedAt: item.loggedAt || new Date().toISOString(),
    }));
  } catch {
    return [];
  }
}

function saveHistory() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.history));
}

elements.generateBtn.addEventListener("click", generateQuiz);
elements.submitBtn.addEventListener("click", submitQuiz);
elements.resetBtn.addEventListener("click", resetAnswers);
elements.gradeSelect.addEventListener("change", () => {
  elements.levelLabel.textContent = GRADES[selectedGrade()] || selectedGrade();
});

await loadQuestionSource();
generateQuiz();
renderStats();
setInterval(renderLogStatus, LOG_REFRESH_MS);
