import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const moduleCache = new Map();

function loadTsModule(filePath) {
  const absolute = path.resolve(filePath);
  if (moduleCache.has(absolute)) return moduleCache.get(absolute).exports;

  const source = fs.readFileSync(absolute, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022
    },
    fileName: absolute
  });
  const cjsModule = { exports: {} };
  moduleCache.set(absolute, cjsModule);
  const dirname = path.dirname(absolute);
  const localRequire = (request) => {
    if (request.startsWith("@/")) return loadTsModule(path.join(root, "src", `${request.slice(2)}.ts`));
    if (request.startsWith(".")) return loadTsModule(path.resolve(dirname, request.endsWith(".ts") ? request : `${request}.ts`));
    return require(request);
  };
  const fn = new Function("require", "module", "exports", "__dirname", "__filename", outputText);
  fn(localRequire, cjsModule, cjsModule.exports, dirname, absolute);
  return cjsModule.exports;
}

// --- Browser environment mock ---------------------------------------------------------------------
// The store modules only touch window at call time, so a minimal localStorage
// plus event plumbing is enough to exercise the durability paths.

function createMockStorage({ failWrites = false } = {}) {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => {
      if (failWrites) {
        const error = new Error("QuotaExceededError");
        error.name = "QuotaExceededError";
        throw error;
      }
      data.set(key, String(value));
    },
    removeItem: (key) => data.delete(key),
    clear: () => data.clear(),
    _dump: () => Object.fromEntries(data)
  };
}

const dispatchedEvents = [];

function installWindow(storage) {
  globalThis.window = {
    localStorage: storage,
    dispatchEvent: (event) => {
      dispatchedEvents.push(event.type);
      return true;
    },
    addEventListener: () => {},
    removeEventListener: () => {}
  };
  globalThis.CustomEvent = class CustomEvent {
    constructor(type, init) {
      this.type = type;
      this.detail = init?.detail;
    }
  };
}

let failures = 0;
let passes = 0;

function check(label, condition, detail = "") {
  if (condition) {
    passes += 1;
    console.log(`PASS ${label}`);
  } else {
    failures += 1;
    console.error(`FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const storage = createMockStorage();
installWindow(storage);

const {
  emptyState,
  loadState,
  parseState,
  saveState,
  RECOVERY_KEY,
  SAVE_ERROR_EVENT,
  STORAGE_KEY
} = loadTsModule(path.join(root, "src/lib/command-center-store.ts"));

// --- Corrupt-state quarantine ---------------------------------------------------------------------

storage.setItem(STORAGE_KEY, "{not json at all");
let loaded = loadState();
check("corrupt JSON loads as empty state", loaded.resumeVersions.length === 0 && loaded.lanes.length === 0);
check("corrupt JSON is quarantined to the recovery key", storage.getItem(RECOVERY_KEY) === "{not json at all");

storage.setItem(STORAGE_KEY, "[1,2,3]");
loadState();
check(
  "quarantine keeps the first corrupt snapshot (does not overwrite)",
  storage.getItem(RECOVERY_KEY) === "{not json at all"
);

storage.clear();
storage.setItem(STORAGE_KEY, "\"just a string\"");
loadState();
check("non-object JSON is quarantined too", storage.getItem(RECOVERY_KEY) === "\"just a string\"");

storage.clear();
const validState = emptyState();
validState.lanes.push({
  id: "lane-1",
  title: "Operations",
  status: "active",
  whyFit: "",
  resumeAngle: "",
  proof: [],
  gaps: [],
  keywords: [],
  source: "library",
  createdAt: "2026-07-01T00:00:00.000Z"
});
storage.setItem(STORAGE_KEY, JSON.stringify(validState));
loaded = loadState();
check("valid state loads intact", loaded.lanes.length === 1 && loaded.lanes[0].title === "Operations");
check("valid state is not quarantined", storage.getItem(RECOVERY_KEY) === null);

check("missing state loads as empty without quarantine", (() => {
  storage.clear();
  const fresh = loadState();
  return fresh.lanes.length === 0 && storage.getItem(RECOVERY_KEY) === null;
})());

// --- Save failure surfaces instead of vanishing ---------------------------------------------------

dispatchedEvents.length = 0;
saveState(validState);
check("successful save dispatches no error event", !dispatchedEvents.includes(SAVE_ERROR_EVENT));

const failingStorage = createMockStorage({ failWrites: true });
installWindow(failingStorage);
dispatchedEvents.length = 0;
saveState(validState);
check("quota-failed save dispatches the save-error event", dispatchedEvents.includes(SAVE_ERROR_EVENT));
check("quota-failed save does not throw", true);

// parseState stays pure — corrupt input returns empty state and never touches storage.
installWindow(createMockStorage());
const parsed = parseState("{broken");
check("parseState still degrades corrupt input to empty state", parsed.applications.length === 0);

// --- Interview session persistence ----------------------------------------------------------------

const sessionStorageMock = createMockStorage();
installWindow(sessionStorageMock);

const { clearInterviewSession, loadInterviewSession, saveInterviewSession, INTERVIEW_SESSION_KEY } = loadTsModule(
  path.join(root, "src/lib/interview-session-store.ts")
);

const freshSession = loadInterviewSession();
check("no stored session yields a fresh session", freshSession.messages.length === 1 && freshSession.currentStage === "role_targeting");

const { createUserInterviewMessage, updateInterviewDraftFromUserAnswer } = loadTsModule(
  path.join(root, "src/lib/interview-mode.ts")
);
const answered = updateInterviewDraftFromUserAnswer(
  freshSession,
  createUserInterviewMessage("I'm targeting a customer success role in software.")
);
saveInterviewSession(answered);
const restored = loadInterviewSession();
check("saved session round-trips with messages intact", restored.id === answered.id && restored.messages.length === answered.messages.length);
check(
  "restored session preserves the preview answer count",
  restored.messages.filter((message) => message.role === "user").length === 1
);

sessionStorageMock.setItem(INTERVIEW_SESSION_KEY, "{\"id\": 42}");
const recovered = loadInterviewSession();
check("implausible stored session falls back to a fresh session", recovered.messages.length === 1);

sessionStorageMock.setItem(INTERVIEW_SESSION_KEY, "corrupt{{{");
check("corrupt stored session falls back to a fresh session", loadInterviewSession().messages.length === 1);

saveInterviewSession(answered);
clearInterviewSession();
check("clearInterviewSession removes the stored session", sessionStorageMock.getItem(INTERVIEW_SESSION_KEY) === null);

// --- Result ----------------------------------------------------------------------------------------
console.log(`\n${passes} passed, ${failures} failed`);
if (failures > 0) process.exit(1);
