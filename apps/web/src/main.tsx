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
