import { type FormEvent, StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";

const API = "http://localhost:4000/api/v1";
type User = { id: string; email: string; displayName: string };
type Subject = { _id: string; name: string };
type Material = { _id: string; title: string; characterCount: number };
type Summary = {
  overview: string;
  keyPoints: string[];
  definitions: Array<{ term: string; meaning: string }>;
  rememberThis: string[];
};
type QuizQuestion = { id: string; prompt: string; options: string[] };
type Quiz = { id: string; title: string; questions: QuizQuestion[] };
type SavedAnswer = { questionId: string; selectedIndex: number };
type WeakConcept = { concept: string; incorrectCount: number; totalQuestions: number };
type Review = {
  questionId: string;
  prompt: string;
  selectedIndex: number | null;
  correctIndex: number;
  explanation: string;
  concept: string;
  isCorrect: boolean;
};
type Attempt = {
  id: string;
  quizId?: string;
  status?: string;
  score?: number;
  correctCount?: number;
  answers?: SavedAnswer[];
  weakConcepts?: WeakConcept[];
  submittedAt?: string;
  explanations?: Review[];
};
type HistoryItem = Attempt & {
  quiz: { id: string; title: string; difficulty: string; questionCount: number };
};

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error?.message ?? "Something went wrong.");
  return payload.data as T;
}

export function App() {
  const [token, setToken] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [booting, setBooting] = useState(true);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [mode, setMode] = useState<"login" | "register">("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [subjectName, setSubjectName] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [materialTitle, setMaterialTitle] = useState("");
  const [materialText, setMaterialText] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [savingAnswers, setSavingAnswers] = useState(false);
  useEffect(() => {
    void request<{ accessToken: string }>("/auth/refresh", { method: "POST" })
      .then(async ({ accessToken }) => {
        setToken(accessToken);
        const profile = await request<{ user: User }>("/auth/me", {}, accessToken);
        setUser(profile.user);
      })
      .catch(() => undefined)
      .finally(() => setBooting(false));
  }, []);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  useEffect(() => {
    if (token)
      void request<Subject[]>("/subjects", {}, token)
        .then(setSubjects)
        .catch((e: Error) => setError(e.message));
  }, [token]);
  const loadHistory = () => {
    if (token)
      void request<HistoryItem[]>("/practice/history", {}, token)
        .then(setHistory)
        .catch((e: Error) => setError(e.message));
  };
  useEffect(loadHistory, [token]);
  useEffect(() => {
    if (!attempt || attempt.status === "submitted") return;
    const timer = window.setTimeout(() => {
      setSavingAnswers(true);
      void request<Attempt>(
        `/attempts/${attempt.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            answers: Object.entries(answers).map(([questionId, selectedIndex]) => ({
              questionId,
              selectedIndex
            }))
          })
        },
        token
      )
        .then(setAttempt)
        .catch((e: Error) => setError(e.message))
        .finally(() => setSavingAnswers(false));
    }, 500);
    return () => window.clearTimeout(timer);
  }, [answers, attempt?.id, attempt?.status, token]);
  useEffect(() => {
    if (token)
      void request<Material[]>("/materials", {}, token)
        .then(setMaterials)
        .catch((e: Error) => setError(e.message));
  }, [token]);
  async function authenticate(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const data = await request<{ user: User; accessToken: string }>(`/auth/${mode}`, {
        method: "POST",
        body: JSON.stringify(
          mode === "register" ? { email, password, displayName } : { email, password }
        )
      });
      setUser(data.user);
      setToken(data.accessToken);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function createSubject(event: FormEvent) {
    event.preventDefault();
    try {
      const data = await request<Subject>(
        "/subjects",
        { method: "POST", body: JSON.stringify({ name: subjectName }) },
        token
      );
      setSubjects((items) => [data, ...items]);
      setSubjectName("");
      setSelectedSubject(data._id);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function createMaterial(event: FormEvent) {
    event.preventDefault();
    try {
      const data = await request<Material>(
        "/materials",
        {
          method: "POST",
          body: JSON.stringify({
            subjectId: selectedSubject,
            title: materialTitle,
            text: materialText
          })
        },
        token
      );
      setMaterials((items) => [data, ...items]);
      setMaterialTitle("");
      setMaterialText("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function summarize(materialId: string) {
    setSummaryLoading(true);
    setError("");
    try {
      setSummary(
        await request<Summary>(
          `/materials/${materialId}/summaries`,
          { method: "POST", body: JSON.stringify({ style: "concise" }) },
          token
        )
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSummaryLoading(false);
    }
  }
  async function makeQuiz(materialId: string) {
    setError("");
    try {
      const next = await request<Quiz>(
        `/materials/${materialId}/quizzes`,
        { method: "POST", body: JSON.stringify({ questionCount: 5, difficulty: "mixed" }) },
        token
      );
      const started = await request<Attempt>(
        `/quizzes/${next.id}/attempts`,
        { method: "POST" },
        token
      );
      setQuiz(next);
      setAttempt(started);
      setAnswers(
        Object.fromEntries((started.answers ?? []).map((answer) => [answer.questionId, answer.selectedIndex]))
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function submitQuiz() {
    if (!quiz || !attempt) return;
    try {
      const saved = await request<Attempt>(
        `/attempts/${attempt.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            answers: Object.entries(answers).map(([questionId, selectedIndex]) => ({
              questionId,
              selectedIndex
            }))
          })
        },
        token
      );
      const result = await request<Attempt>(
        `/attempts/${attempt.id}/submit`,
        { method: "POST" },
        token
      );
      setAttempt({ ...saved, ...result, status: "submitted" });
      loadHistory();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function retryIncorrect() {
    if (!attempt) return;
    try {
      const next = await request<{ quiz: Quiz; attempt: Attempt }>(
        `/attempts/${attempt.id}/retry`,
        { method: "POST" },
        token
      );
      setQuiz(next.quiz);
      setAttempt(next.attempt);
      setAnswers({});
    } catch (e) {
      setError((e as Error).message);
    }
  }
  if (booting)
    return (
      <main className="mx-auto flex min-h-screen max-w-lg items-center justify-center px-5">
        <p className="text-slate-500">Restoring your study session...</p>
      </main>
    );
  if (!user)
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-5 py-10">
        <span className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">
          Study assistant
        </span>
        <h1 className="mt-3 text-4xl font-bold tracking-tight">
          Study smarter from your own notes.
        </h1>
        <p className="mt-3 text-slate-600">
          Create a private library for summaries, quizzes, and tutor conversations.
        </p>
        <form
          onSubmit={authenticate}
          className="mt-8 space-y-3 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
        >
          <h2 className="text-xl font-semibold">
            {mode === "register" ? "Create your account" : "Welcome back"}
          </h2>
          {mode === "register" && (
            <input
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Display name"
              className="field"
            />
          )}
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="field"
          />
          <input
            required
            minLength={8}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (8+ characters)"
            className="field"
          />
          {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <button className="w-full rounded-2xl bg-brand px-5 py-4 font-semibold text-white">
            {mode === "register" ? "Get started" : "Sign in"}
          </button>
          <button
            type="button"
            onClick={() => setMode(mode === "register" ? "login" : "register")}
            className="w-full py-2 text-sm font-semibold text-brand"
          >
            {mode === "register" ? "I already have an account" : "Create an account"}
          </button>
        </form>
      </main>
    );
  return (
    <main className="mx-auto min-h-screen max-w-lg px-5 pb-10 pt-10">
      <header className="flex items-start justify-between">
        <div>
          <span className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">
            Study assistant
          </span>
          <h1 className="mt-2 text-3xl font-bold">Hi, {user.displayName}</h1>
        </div>
        <button
          onClick={() => {
            setUser(null);
            setToken("");
          }}
          className="text-sm font-semibold text-slate-500"
        >
          Sign out
        </button>
      </header>
      {!online && (
        <p role="status" className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          You are offline. Existing data is available, but saving requires a connection.
        </p>
      )}
      <section className="mt-7 rounded-3xl bg-brand p-5 text-white">
        <p className="text-sm text-blue-100">Your study library</p>
        <p className="mt-1 text-3xl font-bold">{subjects.length} subjects</p>
        <p className="mt-1 text-blue-100">{materials.length} saved materials</p>
      </section>
      <section className="mt-6">
        <h2 className="text-xl font-semibold">Subjects</h2>
        <form onSubmit={createSubject} className="mt-3 flex gap-2">
          <input
            required
            value={subjectName}
            onChange={(e) => setSubjectName(e.target.value)}
            placeholder="New subject name"
            className="field flex-1"
          />
          <button className="rounded-2xl bg-slate-900 px-4 font-semibold text-white">Add</button>
        </form>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {subjects.length === 0 && (
            <p className="col-span-2 rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
              No subjects yet. Add your first subject above.
            </p>
          )}
          {subjects.map((subject) => (
            <button
              key={subject._id}
              onClick={() => setSelectedSubject(subject._id)}
              className={`rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-200 ${selectedSubject === subject._id ? "ring-2 ring-brand" : ""}`}
            >
              <span className="font-semibold">{subject.name}</span>
            </button>
          ))}
        </div>
      </section>
      <section className="mt-8 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-xl font-semibold">Add study material</h2>
        <p className="mt-1 text-sm text-slate-500">
          Choose a subject, then paste at least 100 characters of notes.
        </p>
        <form onSubmit={createMaterial} className="mt-4 space-y-3">
          <select
            required
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="field"
          >
            <option value="">Choose a subject</option>
            {subjects.map((subject) => (
              <option key={subject._id} value={subject._id}>
                {subject.name}
              </option>
            ))}
          </select>
          <input
            required
            value={materialTitle}
            onChange={(e) => setMaterialTitle(e.target.value)}
            placeholder="Material title"
            className="field"
          />
          <textarea
            required
            minLength={100}
            value={materialText}
            onChange={(e) => setMaterialText(e.target.value)}
            placeholder="Paste your lecture notes here..."
            rows={7}
            className="field resize-none"
          />
          <button className="w-full rounded-2xl bg-brand px-5 py-4 font-semibold text-white">
            Save material
          </button>
        </form>
      </section>
      {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <section className="mt-8">
        <h2 className="text-xl font-semibold">Recent materials</h2>
        <div className="mt-3 space-y-2">
          {materials.length === 0 && (
            <p className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
              No materials yet. Save pasted notes to start studying.
            </p>
          )}
          {materials.map((material) => (
            <div key={material._id} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold">{material.title}</p>
                <button
                  onClick={() => void summarize(material._id)}
                  className="rounded-xl bg-brand px-3 py-2 text-sm font-semibold text-white"
                >
                  Summarize
                </button>
                <button
                  onClick={() => void makeQuiz(material._id)}
                  className="ml-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
                >
                  Quiz
                </button>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {material.characterCount.toLocaleString()} characters
              </p>
            </div>
          ))}
        </div>
      </section>
      {summary && (
        <section className="mt-8 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Summary</h2>
            <button
              onClick={() =>
                void navigator.clipboard?.writeText(
                  `${summary.overview}\n\n${summary.keyPoints.join("\n")}`
                )
              }
              className="text-sm font-semibold text-brand"
            >
              Copy
            </button>
          </div>
          <p className="mt-3 text-slate-700">{summary.overview}</p>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-slate-700">
            {summary.keyPoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
          {summaryLoading && <p className="mt-3 text-sm text-slate-500">Generating…</p>}
        </section>
      )}
      {quiz && attempt && (
        <section className="mt-8 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-xl font-semibold">{quiz.title}</h2>
          <div className="mt-4 space-y-5">
            {quiz.questions.map((question, index) => (
              <fieldset key={question.id}>
                <legend className="font-semibold">
                  {index + 1}. {question.prompt}
                </legend>
                <div className="mt-2 space-y-2">
                  {question.options.map((option, optionIndex) => (
                    <label key={option} className="flex gap-2 rounded-xl bg-slate-50 p-3">
                      <input
                        type="radio"
                        name={question.id}
                        disabled={attempt.status === "submitted"}
                        checked={answers[question.id] === optionIndex}
                        onChange={() =>
                          setAnswers((current) => ({ ...current, [question.id]: optionIndex }))
                        }
                      />
                      {option}
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
          {attempt.status === "submitted" ? (
            <>
              <p className="mt-5 rounded-xl bg-emerald-50 p-3 font-semibold text-emerald-800">
                Score: {attempt.score}% ({attempt.correctCount} of {quiz.questions.length} correct)
              </p>
              {(attempt.weakConcepts?.length ?? 0) > 0 && (
                <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-amber-950">
                  <h3 className="font-semibold">Focus on these concepts</h3>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                    {attempt.weakConcepts?.map((concept) => (
                      <li key={concept.concept}>
                        {concept.concept}: {concept.incorrectCount} missed
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="mt-4 space-y-3">
                {attempt.explanations?.map((review, index) => (
                  <article
                    key={review.questionId}
                    className={`rounded-2xl p-4 text-sm ${review.isCorrect ? "bg-emerald-50" : "bg-red-50"}`}
                  >
                    <p className="font-semibold">{index + 1}. {review.isCorrect ? "Correct" : "Review this"}</p>
                    <p className="mt-1">{review.explanation}</p>
                    {!review.isCorrect && <p className="mt-1">Correct answer: {quiz.questions.find((question) => question.id === review.questionId)?.options[review.correctIndex]}</p>}
                  </article>
                ))}
              </div>
              {(attempt.weakConcepts?.length ?? 0) > 0 && (
                <button
                  onClick={() => void retryIncorrect()}
                  className="mt-4 w-full rounded-2xl bg-slate-900 px-5 py-4 font-semibold text-white"
                >
                  Retry incorrect questions
                </button>
              )}
            </>
          ) : (
            <>
              <p className="mt-4 text-sm text-slate-500">{savingAnswers ? "Saving answers…" : "Answers save automatically."}</p>
              <button
                onClick={() => void submitQuiz()}
                className="mt-3 w-full rounded-2xl bg-brand px-5 py-4 font-semibold text-white"
              >
                Submit quiz
              </button>
            </>
          )}
        </section>
      )}
      <section className="mt-8">
        <h2 className="text-xl font-semibold">Practice history</h2>
        <div className="mt-3 space-y-2">
          {history.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
              Complete a quiz to see your progress here.
            </p>
          ) : (
            history.map((item) => (
              <article key={item.id} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{item.quiz.title}</p>
                    <p className="mt-1 text-sm text-slate-500">{item.quiz.difficulty} · {item.quiz.questionCount} questions</p>
                  </div>
                  <p className="font-semibold text-brand">{item.score}%</p>
                </div>
                {(item.weakConcepts?.length ?? 0) > 0 && <p className="mt-2 text-sm text-slate-600">Review: {item.weakConcepts?.map((concept) => concept.concept).join(", ")}</p>}
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
const root = document.getElementById("root");
if (root)
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
