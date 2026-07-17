import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const DATA_DIR = new URL("../data/", import.meta.url);
const QUESTIONS_DIR = new URL("../data/questions/", import.meta.url);

const GRADES = [
  { id: "foundation", label: "Foundation", band: "primary", level: 0 },
  ...Array.from({ length: 12 }, (_, index) => {
    const year = index + 1;
    return {
      id: `year-${year}`,
      label: `Year ${year}`,
      band: year <= 6 ? "primary" : "secondary",
      level: year,
    };
  }),
];

const SUBJECTS = [
  { id: "english", label: "English" },
  { id: "mathematics", label: "Mathematics" },
  { id: "science", label: "Science" },
  { id: "hass", label: "Humanities and Social Sciences" },
  { id: "health-pe", label: "Health and Physical Education" },
  { id: "technologies", label: "Technologies" },
  { id: "the-arts", label: "The Arts" },
  { id: "languages", label: "Languages" },
];

const DIFFICULTIES = [
  { id: "easy", label: "Easy" },
  { id: "medium", label: "Medium" },
  { id: "hard", label: "Hard" },
];

const dateArg = process.argv.find((arg) => arg.startsWith("--date="));
const runDate = dateArg ? dateArg.slice("--date=".length) : todayInBrisbane();
const checkOnly = process.argv.includes("--check");

function todayInBrisbane() {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Brisbane",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function hashSeed(input) {
  let value = 2166136261;
  for (const char of input) {
    value ^= char.charCodeAt(0);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function makeRng(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rng, items) {
  return items[Math.floor(rng() * items.length)];
}

function number(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

function makeQuestion(grade, subject, difficulty, sequence) {
  const rng = makeRng(hashSeed(`${runDate}:${grade.id}:${subject.id}:${difficulty.id}:${sequence}`));
  const id = String(sequence).padStart(3, "0");
  const common = {
    id,
    createdAt: runDate,
    grade: grade.id,
    gradeLabel: grade.label,
    subject: subject.id,
    subjectLabel: subject.label,
    difficulty: difficulty.id,
    difficultyLabel: difficulty.label,
    source: "StudyTrack AU template generator",
    curriculum: "Australian Curriculum aligned practice",
  };

  if (subject.id === "mathematics") {
    const base = Math.max(grade.level, 1);
    const difficultyBoost = difficulty.id === "hard" ? 2 : difficulty.id === "medium" ? 1 : 0;
    const a = number(rng, 2 + base, 8 + base * (4 + difficultyBoost));
    const b = number(rng, 2, 6 + base * (3 + difficultyBoost));
    const useMultiply = grade.level >= 3 && difficulty.id !== "easy";
    const answer = useMultiply ? a * b : a + b;
    return {
      ...common,
      type: "short-answer",
      prompt: useMultiply ? `${a} x ${b} = ?` : `${a} + ${b} = ?`,
      answer: String(answer),
      explanation: useMultiply ? `Multiply ${a} by ${b}.` : `Add ${a} and ${b}.`,
    };
  }

  if (subject.id === "english") {
    const vocabulary = [
      ["calm", "peaceful"],
      ["brave", "courageous"],
      ["rapid", "quick"],
      ["tiny", "small"],
      ["ancient", "old"],
      ["observe", "notice"],
      ["explain", "describe"],
      ["compare", "contrast"],
    ];
    const pair = pick(rng, vocabulary);
    return {
      ...common,
      type: "short-answer",
      prompt:
        grade.level <= 2 || difficulty.id === "easy"
          ? `Write a word that means almost the same as "${pair[0]}".`
          : difficulty.id === "medium"
            ? `Give one synonym for "${pair[0]}" and use it in a short sentence.`
            : `Explain the difference in tone between "${pair[0]}" and "${pair[1]}" in one sentence.`,
      answer: pair[1],
      acceptableAnswers: pair,
      explanation: `"${pair[1]}" is a close synonym of "${pair[0]}".`,
    };
  }

  if (subject.id === "science") {
    const bank = [
      ["What force pulls objects toward Earth?", "gravity"],
      ["What gas do humans breathe in to survive?", "oxygen"],
      ["What process do plants use to make food from sunlight?", "photosynthesis"],
      ["What is water called in its solid state?", "ice"],
      ["Which organ pumps blood around the body?", "heart"],
      ["What is the centre of an atom called?", "nucleus"],
    ];
    const item = pick(rng, bank);
    return {
      ...common,
      type: "short-answer",
      prompt: item[0],
      answer: item[1],
      explanation: `${item[1]} is the key concept being tested.`,
    };
  }

  if (subject.id === "hass") {
    const bank = [
      ["What is the capital city of Australia?", "Canberra"],
      ["Name one Australian state or territory.", "Queensland"],
      ["What word describes a system where citizens vote for leaders?", "democracy"],
      ["What is a map legend used for?", "symbols"],
      ["Which level of government runs local councils?", "local government"],
    ];
    const item = pick(rng, bank);
    return {
      ...common,
      type: "short-answer",
      prompt: item[0],
      answer: item[1],
      explanation: `This checks core Australian civics, geography, or history knowledge.`,
    };
  }

  if (subject.id === "health-pe") {
    const bank = [
      ["Name one healthy drink choice for school.", "water"],
      ["What should you do before exercise to prepare your body?", "warm up"],
      ["Name one way to show fair play in a game.", "take turns"],
      ["What is one benefit of getting enough sleep?", "more energy"],
      ["Name one protective item used when riding a bike.", "helmet"],
    ];
    const item = pick(rng, bank);
    return {
      ...common,
      type: "short-answer",
      prompt: item[0],
      answer: item[1],
      explanation: `This checks practical health, safety, and movement understanding.`,
    };
  }

  if (subject.id === "technologies") {
    const bank = [
      ["What is an algorithm?", "a set of steps"],
      ["Name one material that can be recycled.", "paper"],
      ["What device is commonly used to type text into a computer?", "keyboard"],
      ["Why should passwords be kept private?", "security"],
      ["What is a prototype used for?", "testing an idea"],
    ];
    const item = pick(rng, bank);
    return {
      ...common,
      type: "short-answer",
      prompt: item[0],
      answer: item[1],
      explanation: `This checks design, digital systems, or technology process knowledge.`,
    };
  }

  if (subject.id === "the-arts") {
    const bank = [
      ["Name one primary colour.", "red"],
      ["What do actors use to show a character's feelings?", "expression"],
      ["What is rhythm in music?", "a pattern of beats"],
      ["Name one material used to make a sculpture.", "clay"],
      ["What is a rehearsal for?", "practice"],
    ];
    const item = pick(rng, bank);
    return {
      ...common,
      type: "short-answer",
      prompt: item[0],
      answer: item[1],
      explanation: `This checks arts language, making, and responding skills.`,
    };
  }

  const languageBank = [
    ["What does 'hello' usually mean?", "a greeting"],
    ["Why is listening important when learning a language?", "to understand pronunciation"],
    ["Translate the idea of 'thank you' into another language you know.", "thanks"],
    ["What is a bilingual dictionary used for?", "finding word meanings"],
    ["Name one culture where another language is spoken.", "Japan"],
  ];
  const item = pick(rng, languageBank);
  return {
    ...common,
    type: "short-answer",
    prompt: item[0],
    answer: item[1],
    explanation: `This checks language-learning strategies and intercultural understanding.`,
  };
}

async function writeJsonIfChanged(url, value) {
  const next = `${JSON.stringify(value, null, 2)}\n`;
  if (existsSync(url)) {
    const current = await readFile(url, "utf8");
    if (current === next) return false;
  }
  if (!checkOnly) await writeFile(url, next);
  return true;
}

async function nextSequenceForBucket(url) {
  await mkdir(url, { recursive: true });
  const files = await readdir(url);
  const sequences = files
    .map((file) => file.match(/^(\d{3,})\.json$/)?.[1])
    .filter(Boolean)
    .map(Number);
  return sequences.length ? Math.max(...sequences) + 1 : 1;
}

async function validateExistingData() {
  const manifestPath = new URL("manifest.json", DATA_DIR);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

  if (!manifest.bucketCounts || typeof manifest.bucketCounts !== "object") {
    throw new Error("manifest.json is missing bucketCounts.");
  }

  for (const [bucket, count] of Object.entries(manifest.bucketCounts)) {
    const maxId = Number(count);
    if (!Number.isInteger(maxId) || maxId < 0) {
      throw new Error(`Invalid count for ${bucket}.`);
    }

    for (let id = 1; id <= maxId; id += 1) {
      const questionUrl = new URL(`questions/${bucket}/${String(id).padStart(3, "0")}.json`, DATA_DIR);
      const question = JSON.parse(await readFile(questionUrl, "utf8"));
      for (const field of ["id", "prompt", "answer", "explanation", "grade", "subject", "difficulty"]) {
        if (!question[field]) throw new Error(`${questionUrl.pathname} is missing ${field}.`);
      }
    }
  }
}

function bucketPath(grade, subject, difficulty) {
  return `${grade.id}/${subject.id}/${difficulty.id}`;
}

await mkdir(QUESTIONS_DIR, { recursive: true });

if (checkOnly) {
  await validateExistingData();
  console.log("Question data is valid.");
  process.exit(0);
}

const manifestPath = new URL("manifest.json", DATA_DIR);
const generatedAt = new Date(`${runDate}T00:00:00.000Z`).toISOString();
const counts = {};
let questionCount = 0;
let changed = false;

for (const grade of GRADES) {
  for (const subject of SUBJECTS) {
    for (const difficulty of DIFFICULTIES) {
      const relativeBucket = bucketPath(grade, subject, difficulty);
      const bucketUrl = new URL(`questions/${relativeBucket}/`, DATA_DIR);
      const sequence = await nextSequenceForBucket(bucketUrl);
      const question = makeQuestion(grade, subject, difficulty, sequence);
      const questionUrl = new URL(`${String(sequence).padStart(3, "0")}.json`, bucketUrl);
      changed = (await writeJsonIfChanged(questionUrl, question)) || changed;
      counts[relativeBucket] = sequence;
      questionCount += 1;
    }
  }
}

const manifest = {
  schemaVersion: 1,
  title: "StudyTrack AU Question Source",
  description: "Australian primary and secondary practice questions stored by grade, subject, and difficulty.",
  generatedAt,
  latestDate: runDate,
  baseUrl: "questions/",
  grades: GRADES,
  subjects: SUBJECTS,
  difficulties: DIFFICULTIES,
  newQuestionsPerGradeSubjectPerRun: 3,
  bucketCounts: counts,
};

changed = (await writeJsonIfChanged(manifestPath, manifest)) || changed;

if (checkOnly && changed) {
  throw new Error("Generated question data is out of date.");
}

console.log(`Generated ${questionCount} questions for ${runDate}.`);
