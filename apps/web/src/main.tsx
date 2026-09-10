import { type FormEvent, StrictMode, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api/v1";
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
type Theme = "light" | "dark";
type User = {
  id: string;
  email: string;
  displayName: string;
  preferences?: { theme?: "system" | Theme };
  isAdmin?: boolean;
};
type Subject = { _id: string; name: string };
type Material = { _id: string; subjectId: string; title: string; characterCount: number };
type MaterialDetail = Material & { rawText: string };
type Summary = {
  materialId?: string;
  overview: string;
  keyPoints: string[];
  definitions: Array<{ term: string; meaning: string }>;
  rememberThis: string[];
};
type QuizQuestion = { id: string; prompt: string; options: string[] };
type Quiz = { id: string; materialId: string; title: string; questions: QuizQuestion[] };
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
  quiz: {
    id: string;
    materialId?: string;
    title: string;
    difficulty: string;
    questionCount: number;
  };
};
type Citation = { materialId: string; chunkId: string; label: string };
type TutorMessage = {
  id?: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
};
type Conversation = { id: string; title: string; materialIds: string[]; messages?: TutorMessage[] };
type SourceExcerpt = { label: string; text: string };
type DailyUsage = { limit: number; used: number; remaining: number };
type AdminUser = {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
};
function recommendedQuestionCount(characterCount: number): 5 | 10 | 15 {
  if (characterCount >= 7_500) return 15;
  if (characterCount >= 2_500) return 10;
  return 5;
}

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
  const [theme, setTheme] = useState<Theme>(() => {
    const savedTheme = localStorage.getItem("study-assistant-theme");
    if (savedTheme === "dark" || savedTheme === "light") return savedTheme;
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const [booting, setBooting] = useState(true);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [dailyUsage, setDailyUsage] = useState<DailyUsage | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminActionUserId, setAdminActionUserId] = useState("");
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [updateReady, setUpdateReady] = useState(false);
  const serviceWorkerRegistration = useRef<ServiceWorkerRegistration | null>(null);
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
  const [removingAttemptId, setRemovingAttemptId] = useState("");
  const [savingAnswers, setSavingAnswers] = useState(false);
  const [removingMaterialId, setRemovingMaterialId] = useState("");
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [editMaterialTitle, setEditMaterialTitle] = useState("");
  const [editMaterialText, setEditMaterialText] = useState("");
  const [savingMaterialEdit, setSavingMaterialEdit] = useState(false);
  const [openMaterialMenuId, setOpenMaterialMenuId] = useState("");
  const [openHistoryMenuId, setOpenHistoryMenuId] = useState("");
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [tutorQuestion, setTutorQuestion] = useState("");
  const [tutorBusy, setTutorBusy] = useState(false);
  const [sourceExcerpt, setSourceExcerpt] = useState<SourceExcerpt | null>(null);
  const tutorAbort = useRef<AbortController | null>(null);
  const settingsDialog = useRef<HTMLElement | null>(null);
  const privacyDialog = useRef<HTMLElement | null>(null);
  const visibleMaterials = selectedSubject
    ? materials.filter((material) => material.subjectId === selectedSubject)
    : materials;
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
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("study-assistant-theme", theme);
  }, [theme]);
  useEffect(() => {
    const savedTheme = user?.preferences?.theme;
    if (savedTheme === "dark" || savedTheme === "light") setTheme(savedTheme);
  }, [user?.preferences?.theme]);
  useEffect(() => {
    const dialog = settingsOpen
      ? settingsDialog.current
      : privacyOpen
        ? privacyDialog.current
        : null;
    dialog?.focus();
  }, [settingsOpen, privacyOpen]);
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setSettingsOpen(false);
      setPrivacyOpen(false);
      setAdminOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);
  useEffect(() => {
    const onInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstallPrompt(null);
    window.addEventListener("beforeinstallprompt", onInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    if ("serviceWorker" in navigator)
      void navigator.serviceWorker
        .register("/service-worker.js")
        .then((registration) => {
          serviceWorkerRegistration.current = registration;
          if (registration.waiting) setUpdateReady(true);
          registration.addEventListener("updatefound", () => {
            const worker = registration.installing;
            worker?.addEventListener("statechange", () => {
              if (worker.state === "installed" && navigator.serviceWorker.controller)
                setUpdateReady(true);
            });
          });
        })
        .catch(() => undefined);
    return () => {
      window.removeEventListener("beforeinstallprompt", onInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  async function installApp() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    if ((await installPrompt.userChoice).outcome === "accepted") setInstallPrompt(null);
  }
  function applyUpdate() {
    const registration = serviceWorkerRegistration.current;
    if (!registration?.waiting) return window.location.reload();
    registration.waiting.postMessage({ type: "SKIP_WAITING" });
    navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload(), {
      once: true
    });
  }
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
  const loadUsage = () => {
    if (token)
      void request<DailyUsage>("/usage", {}, token)
        .then(setDailyUsage)
        .catch(() => undefined);
  };
  useEffect(() => {
    if (!token) return;
    loadUsage();
    const refreshWhenActive = () => loadUsage();
    const timer = window.setInterval(loadUsage, 30_000);
    window.addEventListener("focus", refreshWhenActive);
    window.addEventListener("online", refreshWhenActive);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshWhenActive);
      window.removeEventListener("online", refreshWhenActive);
    };
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
  async function exportAccountData() {
    try {
      const data = await request<unknown>("/auth/me/export", {}, token);
      const file = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const downloadUrl = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `study-assistant-export-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(downloadUrl);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function deleteAccount() {
    const confirmation = window.prompt(
      "This permanently deletes your account and all study data. Type DELETE to continue."
    );
    if (confirmation !== "DELETE") return;
    const accountPassword = window.prompt("Enter your password to permanently delete the account.");
    if (!accountPassword) return;
    try {
      await request<null>(
        "/auth/me",
        { method: "DELETE", body: JSON.stringify({ password: accountPassword }) },
        token
      );
      setUser(null);
      setToken("");
      setSubjects([]);
      setMaterials([]);
      setHistory([]);
      setSummary(null);
      setQuiz(null);
      setConversation(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function signOut() {
    try {
      await request<null>("/auth/logout", { method: "POST" }, token);
    } catch {
      /* Clear this device even if it is offline. */
    }
    setSettingsOpen(false);
    setAdminOpen(false);
    setUser(null);
    setToken("");
  }
  async function openAdminUsers() {
    setAdminOpen(true);
    setAdminLoading(true);
    try {
      setAdminUsers(await request<AdminUser[]>("/admin/users", {}, token));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAdminLoading(false);
    }
  }
  async function resetUserPassword(account: AdminUser) {
    const nextPassword = window.prompt(
      `Enter a new password for ${account.email} (at least 8 characters).`
    );
    if (!nextPassword) return;
    if (nextPassword.length < 8) {
      setError("The new password must contain at least 8 characters.");
      return;
    }
    const repeatPassword = window.prompt("Enter the new password again to confirm it.");
    if (nextPassword !== repeatPassword) {
      setError("The passwords do not match. No password was changed.");
      return;
    }
    setAdminActionUserId(account.id);
    try {
      await request<AdminUser>(
        `/admin/users/${account.id}/password`,
        { method: "PATCH", body: JSON.stringify({ password: nextPassword }) },
        token
      );
      window.alert(`Password changed for ${account.email}. Their refresh sessions were revoked.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAdminActionUserId("");
    }
  }
  async function deleteUserAsAdmin(account: AdminUser) {
    const phrase = `DELETE ${account.email}`;
    const confirmation = window.prompt(
      `This permanently deletes ${account.email} and all of their study data. Type exactly: ${phrase}`
    );
    if (confirmation !== phrase) return;
    setAdminActionUserId(account.id);
    try {
      await request<null>(
        `/admin/users/${account.id}`,
        { method: "DELETE", body: JSON.stringify({ confirmation }) },
        token
      );
      setAdminUsers((items) => items.filter((item) => item.id !== account.id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAdminActionUserId("");
    }
  }
  async function toggleTheme() {
    const nextTheme: Theme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    if (!token) return;
    try {
      const result = await request<{ user: User }>(
        "/auth/me",
        { method: "PATCH", body: JSON.stringify({ theme: nextTheme }) },
        token
      );
      setUser(result.user);
    } catch {
      // The current device still remembers the chosen appearance if the API is unavailable.
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
  async function removeMaterial(material: Material) {
    if (
      !window.confirm(
        `Remove “${material.title}” permanently? Its summaries, quizzes, and practice attempts will also be deleted.`
      )
    )
      return;
    setRemovingMaterialId(material._id);
    try {
      await request<void>(`/materials/${material._id}`, { method: "DELETE" }, token);
      setMaterials((items) => items.filter((item) => item._id !== material._id));
      if (quiz?.materialId === material._id) {
        setQuiz(null);
        setAttempt(null);
        setAnswers({});
      }
      if (summary?.materialId === material._id) setSummary(null);
      setHistory((items) => items.filter((item) => item.quiz.materialId !== material._id));
      if (conversation?.materialIds.includes(material._id)) setConversation(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRemovingMaterialId("");
    }
  }
  async function openMaterialEditor(material: Material) {
    setError("");
    try {
      const detail = await request<MaterialDetail>(`/materials/${material._id}`, {}, token);
      setEditingMaterial(material);
      setEditMaterialTitle(detail.title);
      setEditMaterialText(detail.rawText);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function saveMaterialEdit(event: FormEvent) {
    event.preventDefault();
    if (!editingMaterial) return;
    setSavingMaterialEdit(true);
    setError("");
    try {
      const updated = await request<Material>(
        `/materials/${editingMaterial._id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ title: editMaterialTitle, text: editMaterialText })
        },
        token
      );
      setMaterials((items) =>
        items.map((material) => (material._id === updated._id ? updated : material))
      );
      if (summary?.materialId === updated._id) setSummary(null);
      if (quiz?.materialId === updated._id) {
        setQuiz(null);
        setAttempt(null);
        setAnswers({});
      }
      if (conversation?.materialIds.includes(updated._id)) setConversation(null);
      setEditingMaterial(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingMaterialEdit(false);
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
      loadUsage();
    }
  }
  async function makeQuiz(material: Material) {
    setError("");
    const questionCount = recommendedQuestionCount(material.characterCount);
    try {
      const next = await request<Quiz>(
        `/materials/${material._id}/quizzes`,
        { method: "POST", body: JSON.stringify({ questionCount, difficulty: "mixed" }) },
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
        Object.fromEntries(
          (started.answers ?? []).map((answer) => [answer.questionId, answer.selectedIndex])
        )
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      loadUsage();
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
  async function removePracticeAttempt(attemptId: string) {
    if (!window.confirm("Remove this practice attempt permanently? This cannot be undone.")) return;
    setRemovingAttemptId(attemptId);
    try {
      await request<void>(`/practice/history/${attemptId}`, { method: "DELETE" }, token);
      setHistory((items) => items.filter((item) => item.id !== attemptId));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRemovingAttemptId("");
    }
  }
  async function reviewPracticeHistory(item: HistoryItem) {
    setOpenHistoryMenuId("");
    setError("");
    try {
      const result = await request<{ quiz: Quiz; attempt: Attempt }>(
        `/practice/history/${item.id}`,
        {},
        token
      );
      setQuiz(result.quiz);
      setAttempt(result.attempt);
      setAnswers(
        Object.fromEntries(
          (result.attempt.answers ?? []).map((answer) => [answer.questionId, answer.selectedIndex])
        )
      );
      window.setTimeout(
        () => document.getElementById("quiz-review")?.scrollIntoView({ behavior: "smooth" }),
        0
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function openTutor(material: Material) {
    setError("");
    try {
      const next = await request<Conversation>(
        "/conversations",
        {
          method: "POST",
          body: JSON.stringify({
            subjectId: material.subjectId,
            materialIds: [material._id],
            title: `Tutor: ${material.title}`
          })
        },
        token
      );
      setConversation({ ...next, messages: [] });
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function askTutor(event: FormEvent) {
    event.preventDefault();
    if (!conversation || !tutorQuestion.trim() || tutorBusy) return;
    const question = tutorQuestion.trim();
    const localUser: TutorMessage = { role: "user", content: question };
    const localAssistant: TutorMessage = { role: "assistant", content: "" };
    setConversation((current) =>
      current
        ? { ...current, messages: [...(current.messages ?? []), localUser, localAssistant] }
        : current
    );
    setTutorQuestion("");
    setTutorBusy(true);
    setError("");
    try {
      const abort = new AbortController();
      tutorAbort.current = abort;
      const response = await fetch(`${API}/conversations/${conversation.id}/messages`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          content: question,
          clientMessageId: crypto.randomUUID(),
          allowGeneralKnowledge: false
        }),
        signal: abort.signal
      });
      if (!response.ok || !response.body) throw new Error("Tutor request could not be started.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const event of events) {
          const name = event.match(/^event: (.+)$/m)?.[1];
          const raw = event.match(/^data: (.+)$/m)?.[1];
          if (!name || !raw) continue;
          const data = JSON.parse(raw) as { text?: string; items?: Citation[]; message?: string };
          if (name === "delta")
            setConversation((current) =>
              current
                ? {
                    ...current,
                    messages: (current.messages ?? []).map((message, index, all) =>
                      index === all.length - 1
                        ? { ...message, content: message.content + (data.text ?? "") }
                        : message
                    )
                  }
                : current
            );
          if (name === "citations")
            setConversation((current) =>
              current
                ? {
                    ...current,
                    messages: (current.messages ?? []).map((message, index, all) =>
                      index === all.length - 1
                        ? { ...message, citations: data.items ?? [] }
                        : message
                    )
                  }
                : current
            );
          if (name === "error") throw new Error(data.message ?? "Tutor unavailable.");
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        const message = (e as Error).message;
        setError(message);
        setConversation((current) =>
          current
            ? {
                ...current,
                messages: (current.messages ?? []).map((item, index, all) =>
                  index === all.length - 1 && item.role === "assistant" && !item.content
                    ? { ...item, content: `Sorry, I could not answer that. ${message}` }
                    : item
                )
              }
            : current
        );
      }
    } finally {
      tutorAbort.current = null;
      setTutorBusy(false);
      loadUsage();
    }
  }
  async function openCitation(citation: Citation) {
    try {
      setSourceExcerpt(
        await request<SourceExcerpt>(
          `/materials/${citation.materialId}/chunks/${citation.chunkId}`,
          {},
          token
        )
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  if (booting)
    return (
      <main className="app-page mx-auto flex min-h-screen max-w-lg items-center justify-center px-5">
        <p className="text-slate-500">Restoring your study session...</p>
      </main>
    );
  if (!user)
    return (
      <main className="app-page mx-auto flex min-h-screen max-w-lg flex-col justify-center px-5 py-10 sm:py-16">
        <div className="flex items-center gap-3">
          <img
            src="/learnloop-logo.png"
            alt=""
            aria-hidden="true"
            className="h-11 w-11 rounded-2xl object-contain shadow-sm"
          />
          <span className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">
            Study assistant
          </span>
        </div>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
          Study smarter from your own notes.
        </h1>
        <p className="mt-3 text-slate-600">
          Create a private library for summaries, quizzes, and tutor conversations.
        </p>
        <form
          onSubmit={authenticate}
          className="mt-8 space-y-3 rounded-3xl bg-white p-5 shadow-xl shadow-slate-200/60 ring-1 ring-slate-200 sm:p-6"
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
    <>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <main
        id="main-content"
        className="app-page mx-auto min-h-screen max-w-7xl px-5 pb-12 pt-0 sm:px-7 sm:pt-0 lg:px-10"
      >
        <section className="hero-banner relative left-1/2 w-screen -translate-x-1/2 overflow-hidden px-5 pb-10 pt-8 sm:px-7 sm:pb-14 sm:pt-12 lg:px-10 lg:pb-16">
          <div className="mx-auto max-w-7xl">
            <header className="relative z-10 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <img
                    src="/learnloop-logo.png"
                    alt=""
                    aria-hidden="true"
                    className="h-10 w-10 rounded-2xl object-contain shadow-sm"
                  />
                  <span className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">
                    Study assistant
                  </span>
                </div>
              </div>
              <button
                type="button"
                aria-label="Open settings"
                aria-expanded={settingsOpen}
                onClick={() => setSettingsOpen(true)}
                className="grid h-11 w-11 place-items-center rounded-2xl border border-slate-200/70 bg-white/65 text-xl text-slate-700 shadow-sm backdrop-blur-sm"
              >
                ⚙
              </button>
            </header>
            <div className="relative z-10 mt-16 max-w-2xl sm:mt-20 lg:mt-24">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">
                Your personal study space
              </p>
              <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
                Turn your notes into smarter study sessions!
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-8 text-slate-700 sm:text-xl">
                summaries, quizzes, and AI support in one place.
              </p>
            </div>
          </div>
        </section>
        {settingsOpen && (
          <div
            role="presentation"
            onMouseDown={() => {
              setSettingsOpen(false);
              setAdminOpen(false);
            }}
            className="fixed inset-0 z-50 flex items-end bg-slate-950/30 p-4 sm:items-center sm:justify-center"
          >
            <section
              ref={settingsDialog}
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-labelledby="settings-title"
              onMouseDown={(event) => event.stopPropagation()}
              className="w-full max-w-md rounded-3xl bg-white p-5 shadow-xl"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 id="settings-title" className="text-xl font-bold">
                    Settings
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Manage this device and your account.
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Close settings"
                  onClick={() => {
                    setSettingsOpen(false);
                    setAdminOpen(false);
                  }}
                  className="grid h-11 w-11 place-items-center rounded-2xl text-xl text-slate-500"
                >
                  ×
                </button>
              </div>
              <div className="mt-5 rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Signed-in account
                </p>
                <p className="mt-1 font-semibold text-slate-900">{user.displayName}</p>
                <p className="break-all text-sm text-slate-600">{user.email}</p>
              </div>
              {dailyUsage && (
                <p className="mt-5 rounded-2xl bg-blue-50 p-3 text-sm text-blue-950">
                  AI points today:{" "}
                  <strong>
                    {dailyUsage.remaining} of {dailyUsage.limit} remaining
                  </strong>
                </p>
              )}
              <div className="mt-4 space-y-2">
                <button
                  type="button"
                  aria-pressed={theme === "dark"}
                  onClick={() => void toggleTheme()}
                  className="flex w-full items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-left font-semibold text-slate-800"
                >
                  <span>Dark mode</span>
                  <span className="text-sm font-medium text-slate-500">
                    {theme === "dark" ? "On" : "Off"}
                  </span>
                </button>
                {installPrompt && (
                  <button
                    type="button"
                    onClick={() => void installApp()}
                    className="w-full rounded-2xl bg-brand px-4 py-3 text-left font-semibold text-white"
                  >
                    Install Study Assistant
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setSettingsOpen(false);
                    setPrivacyOpen(true);
                  }}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-left font-semibold text-slate-800"
                >
                  Privacy &amp; AI use
                </button>
                {user.isAdmin && (
                  <button
                    type="button"
                    onClick={() => void openAdminUsers()}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-left font-semibold text-slate-800"
                  >
                    Manage users
                  </button>
                )}
                {adminOpen && (
                  <section
                    className="rounded-2xl border border-slate-200 p-3"
                    aria-label="User administration"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-slate-900">User administration</h3>
                        <p className="mt-1 text-xs text-slate-500">
                          Password resets revoke refresh sessions. User deletion is permanent.
                        </p>
                      </div>
                      <button
                        type="button"
                        aria-label="Close user administration"
                        onClick={() => setAdminOpen(false)}
                        className="grid h-9 w-9 place-items-center rounded-xl text-lg text-slate-500"
                      >
                        ×
                      </button>
                    </div>
                    {adminLoading ? (
                      <p className="mt-3 text-sm text-slate-500">Loading users…</p>
                    ) : (
                      <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
                        {adminUsers.map((account) => (
                          <article key={account.id} className="rounded-xl bg-slate-50 p-3">
                            <p className="break-all text-sm font-semibold text-slate-900">
                              {account.displayName}
                              {account.id === user.id ? " (you)" : ""}
                            </p>
                            <p className="break-all text-xs text-slate-500">{account.email}</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                type="button"
                                disabled={adminActionUserId === account.id}
                                onClick={() => void resetUserPassword(account)}
                                className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 disabled:opacity-50"
                              >
                                Reset password
                              </button>
                              {account.id !== user.id && (
                                <button
                                  type="button"
                                  disabled={adminActionUserId === account.id}
                                  onClick={() => void deleteUserAsAdmin(account)}
                                  className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-50"
                                >
                                  {adminActionUserId === account.id ? "Working…" : "Delete user"}
                                </button>
                              )}
                            </div>
                          </article>
                        ))}
                        {adminUsers.length === 0 && (
                          <p className="text-sm text-slate-500">No users found.</p>
                        )}
                      </div>
                    )}
                  </section>
                )}
                <button
                  type="button"
                  onClick={() => void exportAccountData()}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-left font-semibold text-slate-800"
                >
                  Export my data
                </button>
                <button
                  type="button"
                  onClick={() => void signOut()}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-left font-semibold text-slate-800"
                >
                  Sign out
                </button>
                <a
                  href="mailto:janninobansag@gmail.com"
                  className="block w-full rounded-2xl border border-slate-200 px-4 py-3 text-left font-semibold text-brand"
                >
                  Contact support
                </a>
                <button
                  type="button"
                  onClick={() => void deleteAccount()}
                  className="w-full rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-left font-semibold text-red-700"
                >
                  Delete account permanently
                </button>
              </div>
            </section>
          </div>
        )}
        {privacyOpen && (
          <div
            role="presentation"
            onMouseDown={() => setPrivacyOpen(false)}
            className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/30 p-4 sm:flex sm:items-center sm:justify-center"
          >
            <section
              ref={privacyDialog}
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-labelledby="privacy-title"
              onMouseDown={(event) => event.stopPropagation()}
              className="mx-auto my-8 w-full max-w-md rounded-3xl bg-white p-5 shadow-xl"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 id="privacy-title" className="text-xl font-bold">
                    Privacy &amp; AI use
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    How Study Assistant handles your study data.
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Close privacy information"
                  onClick={() => setPrivacyOpen(false)}
                  className="grid h-11 w-11 place-items-center rounded-2xl text-xl text-slate-500"
                >
                  ×
                </button>
              </div>
              <div className="mt-5 space-y-4 text-sm leading-6 text-slate-700">
                <section>
                  <h3 className="font-semibold text-slate-950">What we store</h3>
                  <p>
                    We store your account details, subjects, notes, generated summaries, quizzes,
                    practice history, and tutor conversations so your study library works across
                    sessions.
                  </p>
                </section>
                <section>
                  <h3 className="font-semibold text-slate-950">How AI is used</h3>
                  <p>
                    AI is used only when you ask for a summary, quiz, or tutor answer. The necessary
                    part of your selected study material is sent to the configured AI provider to
                    create that response. Always check important information against your original
                    notes.
                  </p>
                </section>
                <section>
                  <h3 className="font-semibold text-slate-950">Your choices</h3>
                  <p>
                    You can export your stored data, sign out, or permanently delete your account
                    from Settings. Account deletion removes your account and related study data from
                    this application.
                  </p>
                </section>
                <section>
                  <h3 className="font-semibold text-slate-950">Important</h3>
                  <p>
                    Study Assistant is for learning support. It is not medical, legal, financial, or
                    professional advice.
                  </p>
                </section>
                <p className="rounded-2xl bg-amber-50 p-3 text-amber-900">
                  Questions about your data or this service? Contact janninobansag@gmail.com.
                </p>
              </div>
            </section>
          </div>
        )}
        {!online && (
          <p role="status" className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
            You are offline. Existing data is available, but saving requires a connection.
          </p>
        )}
        {updateReady && (
          <p
            role="status"
            className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-blue-50 p-3 text-sm text-blue-950"
          >
            A newer version is ready.
            <button
              type="button"
              onClick={applyUpdate}
              className="font-semibold text-brand underline"
            >
              Refresh
            </button>
          </p>
        )}
        <div className="mt-7 grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-10">
          <div className="space-y-6">
            <section className="overflow-hidden rounded-3xl bg-brand p-5 text-white shadow-xl shadow-brand/20 sm:p-6">
              <p className="text-sm text-blue-100">Your study library</p>
              <p className="mt-1 text-3xl font-bold">{subjects.length} subjects</p>
              <p className="mt-1 text-blue-100">{materials.length} saved materials</p>
              {dailyUsage && (
                <div className="mt-4">
                  <div className="flex items-center justify-between gap-3 text-sm text-blue-100">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_10px_rgb(110,231,183)]" />
                      Live AI points
                    </span>
                    <span className="font-semibold text-white">
                      {dailyUsage.remaining} of {dailyUsage.limit} remaining
                    </span>
                  </div>
                  <div
                    className="mt-2 h-2 overflow-hidden rounded-full bg-white/25"
                    aria-label={`${dailyUsage.remaining} of ${dailyUsage.limit} AI points remaining`}
                  >
                    <div
                      className="h-full rounded-full bg-white transition-all"
                      style={{
                        width: `${dailyUsage.limit > 0 ? Math.max(0, Math.min(100, (dailyUsage.remaining / dailyUsage.limit) * 100)) : 0}%`
                      }}
                    />
                  </div>
                </div>
              )}
            </section>
            <section>
              <h2 className="text-xl font-semibold">Subjects</h2>
              <form onSubmit={createSubject} className="mt-3 flex gap-2">
                <label className="sr-only" htmlFor="subject-name">
                  New subject name
                </label>
                <input
                  id="subject-name"
                  required
                  value={subjectName}
                  onChange={(e) => setSubjectName(e.target.value)}
                  placeholder="New subject name"
                  className="field flex-1"
                />
                <button className="rounded-2xl bg-slate-900 px-4 font-semibold text-white">
                  Add
                </button>
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
          </div>
          <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
            <h2 className="text-xl font-semibold">Add study material</h2>
            <p className="mt-1 text-sm text-slate-500">
              Choose a subject, then paste at least 100 characters of notes.
            </p>
            <form onSubmit={createMaterial} className="mt-4 space-y-3">
              <label className="sr-only" htmlFor="material-subject">
                Subject
              </label>
              <select
                id="material-subject"
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
              <label className="sr-only" htmlFor="material-title">
                Material title
              </label>
              <input
                id="material-title"
                required
                value={materialTitle}
                onChange={(e) => setMaterialTitle(e.target.value)}
                placeholder="Material title"
                className="field"
              />
              <label className="sr-only" htmlFor="material-text">
                Study notes
              </label>
              <textarea
                id="material-text"
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
        </div>
        {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <section className="mt-10">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">
              {selectedSubject
                ? `${subjects.find((subject) => subject._id === selectedSubject)?.name ?? "Subject"} materials`
                : "Recent materials"}
            </h2>
            {selectedSubject && (
              <button
                type="button"
                onClick={() => setSelectedSubject("")}
                className="text-sm font-semibold text-brand"
              >
                Show all
              </button>
            )}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {visibleMaterials.length === 0 && (
              <p className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                {selectedSubject
                  ? "No materials in this subject yet."
                  : "No materials yet. Save pasted notes to start studying."}
              </p>
            )}
            {visibleMaterials.map((material) => (
              <div key={material._id} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{material.title}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {material.characterCount.toLocaleString()} characters
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      aria-label={`Edit ${material.title}`}
                      onClick={() => void openMaterialEditor(material)}
                      className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-lg font-semibold text-brand"
                    >
                      <span aria-hidden="true">✎</span>
                    </button>
                    <div className="relative">
                      <button
                        type="button"
                        aria-label={`Actions for ${material.title}`}
                        aria-expanded={openMaterialMenuId === material._id}
                        aria-haspopup="menu"
                        onClick={() =>
                          setOpenMaterialMenuId((openId) =>
                            openId === material._id ? "" : material._id
                          )
                        }
                        className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-xl font-bold leading-none text-slate-700"
                      >
                        <span aria-hidden="true">⋮</span>
                      </button>
                      {openMaterialMenuId === material._id && (
                        <div
                          role="menu"
                          aria-label={`Actions for ${material.title}`}
                          className="absolute right-0 top-12 z-20 w-44 rounded-xl border border-slate-200 bg-white p-1 shadow-lg"
                        >
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setOpenMaterialMenuId("");
                              void summarize(material._id);
                            }}
                            className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-brand hover:bg-slate-50"
                          >
                            Summarize
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setOpenMaterialMenuId("");
                              void makeQuiz(material);
                            }}
                            className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-900 hover:bg-slate-50"
                          >
                            Create {recommendedQuestionCount(material.characterCount)}-question quiz
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setOpenMaterialMenuId("");
                              void openTutor(material);
                            }}
                            className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-900 hover:bg-slate-50"
                          >
                            Ask tutor
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            disabled={removingMaterialId === material._id}
                            onClick={() => {
                              setOpenMaterialMenuId("");
                              void removeMaterial(material);
                            }}
                            className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                          >
                            {removingMaterialId === material._id ? "Removing…" : "Remove material"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
        {editingMaterial && (
          <div
            role="presentation"
            onMouseDown={() => !savingMaterialEdit && setEditingMaterial(null)}
            className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/40 p-4 sm:flex sm:items-center sm:justify-center"
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="edit-material-title"
              onMouseDown={(event) => event.stopPropagation()}
              className="mx-auto my-8 w-full max-w-2xl rounded-3xl bg-white p-5 shadow-xl sm:p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 id="edit-material-title" className="text-xl font-bold">
                    Edit study material
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Add or revise your notes, then save your changes.
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Close material editor"
                  disabled={savingMaterialEdit}
                  onClick={() => setEditingMaterial(null)}
                  className="grid h-11 w-11 place-items-center rounded-2xl text-xl text-slate-500 disabled:opacity-50"
                >
                  ×
                </button>
              </div>
              <form onSubmit={saveMaterialEdit} className="mt-5 space-y-3">
                <label className="sr-only" htmlFor="edit-material-title-input">
                  Material title
                </label>
                <input
                  id="edit-material-title-input"
                  required
                  maxLength={120}
                  value={editMaterialTitle}
                  onChange={(event) => setEditMaterialTitle(event.target.value)}
                  className="field"
                />
                <label className="sr-only" htmlFor="edit-material-text">
                  Study notes
                </label>
                <textarea
                  id="edit-material-text"
                  required
                  minLength={100}
                  maxLength={50000}
                  rows={13}
                  value={editMaterialText}
                  onChange={(event) => setEditMaterialText(event.target.value)}
                  className="field resize-y"
                />
                <p className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">
                  Saving changed notes removes older summaries, quizzes, and attempts for this
                  material. You can generate fresh ones afterward.
                </p>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    disabled={savingMaterialEdit}
                    onClick={() => setEditingMaterial(null)}
                    className="rounded-2xl border border-slate-200 px-5 py-3 font-semibold text-slate-700 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={savingMaterialEdit || editMaterialText.trim().length < 100}
                    className="rounded-2xl bg-brand px-5 py-3 font-semibold text-white disabled:opacity-50"
                  >
                    {savingMaterialEdit ? "Saving…" : "Save changes"}
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}
        {summary && (
          <section className="mt-8 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Summary</h2>
              <div className="flex items-center gap-3">
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
                <button
                  type="button"
                  onClick={() => setSummary(null)}
                  aria-label="Close summary"
                  title="Close summary"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-xl leading-none text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                >
                  ×
                </button>
              </div>
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
          <section
            id="quiz-review"
            className="mt-8 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-xl font-semibold">{quiz.title}</h2>
              <button
                type="button"
                onClick={() => {
                  setQuiz(null);
                  setAttempt(null);
                  setAnswers({});
                }}
                aria-label="Close quiz"
                title="Close quiz"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xl leading-none text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              >
                ×
              </button>
            </div>
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
                  Score: {attempt.score}% ({attempt.correctCount} of {quiz.questions.length}{" "}
                  correct)
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
                      <p className="font-semibold">
                        {index + 1}. {review.isCorrect ? "Correct" : "Review this"}
                      </p>
                      <p className="mt-1">{review.explanation}</p>
                      {!review.isCorrect && (
                        <p className="mt-1">
                          Correct answer:{" "}
                          {
                            quiz.questions.find((question) => question.id === review.questionId)
                              ?.options[review.correctIndex]
                          }
                        </p>
                      )}
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
                <p className="mt-4 text-sm text-slate-500">
                  {savingAnswers ? "Saving answers…" : "Answers save automatically."}
                </p>
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
        {conversation && (
          <section className="mt-8 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">{conversation.title}</h2>
                <p className="mt-1 text-sm text-slate-500">Answers are limited to this material.</p>
              </div>
              <button
                onClick={() => setConversation(null)}
                className="text-sm font-semibold text-slate-500"
              >
                Close
              </button>
            </div>
            <div className="mt-4 space-y-3" aria-live="polite">
              {conversation.messages?.length === 0 && (
                <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                  Ask about a definition, example, or difficult concept in your notes.
                </p>
              )}
              {conversation.messages?.map((message, index) => (
                <article
                  key={index}
                  className={`rounded-2xl p-4 text-sm ${message.role === "user" ? "ml-8 bg-brand text-white" : "mr-4 bg-slate-50 text-slate-800"}`}
                >
                  <p className="whitespace-pre-wrap">
                    {message.content || (tutorBusy ? "Thinking…" : "")}
                  </p>
                  {message.citations && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {message.citations.map((citation) => (
                        <button
                          type="button"
                          key={citation.chunkId}
                          onClick={() => void openCitation(citation)}
                          className="rounded-full bg-white px-2 py-1 text-xs text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"
                        >
                          Source: {citation.label}
                        </button>
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </div>
            {sourceExcerpt && (
              <aside className="mt-4 rounded-2xl bg-blue-50 p-4 text-sm text-slate-800">
                <div className="flex justify-between gap-3">
                  <h3 className="font-semibold">{sourceExcerpt.label}</h3>
                  <button
                    type="button"
                    onClick={() => setSourceExcerpt(null)}
                    className="font-semibold text-slate-500"
                  >
                    Close
                  </button>
                </div>
                <p className="mt-2 whitespace-pre-wrap">{sourceExcerpt.text}</p>
              </aside>
            )}
            <form onSubmit={askTutor} className="mt-4 space-y-2">
              <label className="sr-only" htmlFor="tutor-question">
                Ask the tutor
              </label>
              <textarea
                id="tutor-question"
                value={tutorQuestion}
                onChange={(event) => setTutorQuestion(event.target.value)}
                maxLength={2000}
                placeholder="Ask a question about this material…"
                rows={3}
                className="field resize-none"
                disabled={tutorBusy}
              />
              <div className="flex gap-2">
                <button
                  disabled={tutorBusy || !tutorQuestion.trim()}
                  className="flex-1 rounded-2xl bg-brand px-5 py-3 font-semibold text-white disabled:opacity-50"
                >
                  {tutorBusy ? "Answering…" : "Send"}
                </button>
                {tutorBusy && (
                  <button
                    type="button"
                    onClick={() => tutorAbort.current?.abort()}
                    className="rounded-2xl border border-red-300 px-5 py-3 font-semibold text-red-700"
                  >
                    Stop
                  </button>
                )}
              </div>
            </form>
          </section>
        )}
        <section className="mt-8">
          <h2 className="text-xl font-semibold">Practice history</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {history.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                Complete a quiz to see your progress here.
              </p>
            ) : (
              history.map((item) => (
                <article key={item.id} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold">{item.quiz.title}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {item.quiz.difficulty} · {item.quiz.questionCount} questions
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <p className="font-semibold text-brand">{item.score}%</p>
                      <div className="relative">
                        <button
                          type="button"
                          aria-label={`Actions for ${item.quiz.title}`}
                          aria-expanded={openHistoryMenuId === item.id}
                          aria-haspopup="menu"
                          onClick={() =>
                            setOpenHistoryMenuId((openId) => (openId === item.id ? "" : item.id))
                          }
                          className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-xl font-bold leading-none text-slate-700"
                        >
                          <span aria-hidden="true">⋮</span>
                        </button>
                        {openHistoryMenuId === item.id && (
                          <div
                            role="menu"
                            aria-label={`Actions for ${item.quiz.title}`}
                            className="absolute right-0 top-12 z-20 w-40 rounded-xl border border-slate-200 bg-white p-1 shadow-lg"
                          >
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => void reviewPracticeHistory(item)}
                              className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-brand hover:bg-slate-50"
                            >
                              Review results
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              disabled={removingAttemptId === item.id}
                              onClick={() => {
                                setOpenHistoryMenuId("");
                                void removePracticeAttempt(item.id);
                              }}
                              className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                            >
                              {removingAttemptId === item.id ? "Removing…" : "Remove history"}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  {(item.weakConcepts?.length ?? 0) > 0 && (
                    <p className="mt-2 text-sm text-slate-600">
                      Review: {item.weakConcepts?.map((concept) => concept.concept).join(", ")}
                    </p>
                  )}
                </article>
              ))
            )}
          </div>
        </section>
        <footer className="mt-12 border-t border-slate-200 py-7 text-center text-sm text-slate-500">
          <p>Study Assistant helps you learn from your own notes.</p>
          <a
            href="mailto:janninobansag@gmail.com"
            className="mt-2 inline-block font-semibold text-brand"
          >
            Contact: janninobansag@gmail.com
          </a>
        </footer>
      </main>
    </>
  );
}
const root = document.getElementById("root");
if (root)
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
