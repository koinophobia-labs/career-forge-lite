"use client";

export type ExtractedResumeFile = {
  filename: string;
  text: string;
  type: "pdf" | "docx" | "text";
};

export const MAX_IMPORT_FILES = 12;
export const MAX_FILE_BYTES = 12 * 1024 * 1024;
export const MAX_BATCH_BYTES = 48 * 1024 * 1024;
export const MAX_PDF_PAGES = 40;
export const MAX_PDF_PAGE_DIMENSION = 20_000;
export const MAX_PDF_PAGE_AREA = 100_000_000;
export const MAX_EXTRACTED_CHARACTERS = 250_000;
export const MAX_BATCH_EXTRACTED_CHARACTERS = 600_000;
export const MAX_CONCURRENT_PDF_PARSES = 2;
export const PDF_PARSE_TIMEOUT_MS = 15_000;
const MAX_PDF_IMAGE_PIXELS = 16_000_000;

export type ResumeImportErrorCode =
  | "unsupported-file-type"
  | "too-many-files"
  | "file-too-large"
  | "batch-too-large"
  | "invalid-pdf-header"
  | "corrupt-or-malformed-pdf"
  | "encrypted-or-password-protected-pdf"
  | "no-extractable-text"
  | "page-limit-exceeded"
  | "text-limit-exceeded"
  | "resource-limit-exceeded"
  | "worker-initialization-failed"
  | "parsing-timed-out"
  | "parsing-cancelled"
  | "unsafe-or-unsupported-pdf-content"
  | "unexpected-pdf-parser-failure";

export class ResumeImportError extends Error {
  readonly code: ResumeImportErrorCode;
  readonly filename: string;

  constructor(code: ResumeImportErrorCode, filename: string, message: string) {
    super(message);
    this.name = "ResumeImportError";
    this.code = code;
    this.filename = filename;
  }
}

export type ResumeImportFailure = {
  filename: string;
  code: ResumeImportErrorCode;
  message: string;
};

export type ResumeImportBatchResult = {
  files: ExtractedResumeFile[];
  failures: ResumeImportFailure[];
};

export type ResumeImportOptions = {
  signal?: AbortSignal;
  pdfTimeoutMs?: number;
  /** Test seam for proving that a real worker startup failure fails closed. */
  createPdfWorker?: (url: URL) => Worker;
};

function importError(code: ResumeImportErrorCode, filename: string, detail: string): ResumeImportError {
  return new ResumeImportError(code, filename, `${filename}: ${detail}`);
}

function cancelled(filename: string): ResumeImportError {
  return importError("parsing-cancelled", filename, "import was canceled. Choose the file again when you are ready.");
}

function throwIfCancelled(filename: string, signal?: AbortSignal): void {
  if (signal?.aborted) throw cancelled(filename);
}

function normalizeExtractedText(text: string): string {
  return text
    .replace(/\u0000/g, "")
    .replace(/[\t\f\v]+/g, " ")
    .replace(/ +\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function hasUnsafeValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (value instanceof Map || value instanceof Set) return value.size > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return Boolean(value);
}

function isOrdinaryResumeUri(value: unknown): boolean {
  return typeof value === "string" && /^(?:https?:|mailto:)/i.test(value.trim());
}

function annotationHasDisallowedAction(annotation: unknown): boolean {
  if (!annotation || typeof annotation !== "object") return false;
  const item = annotation as Record<string, unknown>;
  if (["action", "attachment", "file", "jsAction"].some((key) => hasUnsafeValue(item[key]))) return true;

  const uriValues = [item.url, item.unsafeUrl].filter((value) => value !== null && value !== undefined);
  return uriValues.some((value) => !isOrdinaryResumeUri(value));
}

function openActionIsUnsafe(value: unknown): boolean {
  if (!hasUnsafeValue(value)) return false;
  if (value instanceof Map) return [...value.keys()].some((key) => key !== "dest");
  if (typeof value === "object" && value !== null) return Object.keys(value).some((key) => key !== "dest");
  return true;
}

function parserFailure(error: unknown, filename: string): ResumeImportError {
  if (error instanceof ResumeImportError) return error;
  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : String(error);
  if (name === "PasswordException" || /password|encrypted/i.test(message)) {
    return importError("encrypted-or-password-protected-pdf", filename, "password-protected PDFs cannot be imported. Remove the password or use DOCX or TXT instead.");
  }
  if (name === "InvalidPDFException" || /invalid pdf|xref|cross-reference|object stream|bad stream|truncated/i.test(message)) {
    return importError("corrupt-or-malformed-pdf", filename, "the PDF is corrupt or malformed. Export a fresh PDF from the original editor, or use DOCX or TXT instead.");
  }
  return importError("unexpected-pdf-parser-failure", filename, "the local PDF parser could not safely read this file. Export a fresh PDF or use DOCX or TXT instead.");
}

async function extractPdf(file: File, options: ResumeImportOptions): Promise<string> {
  const filename = file.name;
  throwIfCancelled(filename, options.signal);
  const header = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  if (String.fromCharCode(...header) !== "%PDF-") {
    throw importError("invalid-pdf-header", filename, "the file does not begin with a valid PDF header. Choose a genuine PDF, DOCX, or TXT file.");
  }

  const pdfjs = await import("pdfjs-dist");
  throwIfCancelled(filename, options.signal);

  const timeoutMs = options.pdfTimeoutMs ?? PDF_PARSE_TIMEOUT_MS;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let abortListener: (() => void) | undefined;
  let workerErrorListener: ((event: ErrorEvent) => void) | undefined;
  let loadingTask: ReturnType<typeof pdfjs.getDocument> | undefined;
  let pdfWorker: InstanceType<typeof pdfjs.PDFWorker> | undefined;
  let nativeWorker: Worker | undefined;

  let rejectInterruption: ((reason: ResumeImportError) => void) | undefined;
  const interruption = new Promise<never>((_resolve, reject) => {
    rejectInterruption = reject;
  });
  const race = <T>(promise: Promise<T>): Promise<T> => Promise.race([promise, interruption]);

  try {
    timeoutId = setTimeout(() => {
      rejectInterruption?.(importError("parsing-timed-out", filename, `local parsing exceeded ${Math.ceil(timeoutMs / 1000)} seconds. Reduce the PDF size or use DOCX or TXT instead.`));
    }, timeoutMs);
    abortListener = () => rejectInterruption?.(cancelled(filename));
    options.signal?.addEventListener("abort", abortListener, { once: true });

    const workerUrl = new URL("/pdf.worker.min.mjs", window.location.origin);
    if (workerUrl.origin !== window.location.origin) {
      throw importError("worker-initialization-failed", filename, "the local PDF worker did not resolve to this site. Refresh and try again, or use DOCX or TXT.");
    }
    try {
      nativeWorker = options.createPdfWorker
        ? options.createPdfWorker(workerUrl)
        : new Worker(workerUrl, { type: "module", name: "career-forge-pdf-import" });
    } catch {
      throw importError("worker-initialization-failed", filename, "the local PDF worker could not start. Refresh and try again, or use DOCX or TXT.");
    }

    const workerFailure = new Promise<never>((_resolve, reject) => {
      workerErrorListener = () => reject(importError("worker-initialization-failed", filename, "the local PDF worker failed. Refresh and try again, or use DOCX or TXT."));
      nativeWorker?.addEventListener("error", workerErrorListener, { once: true });
    });
    pdfWorker = pdfjs.PDFWorker.create({ name: `career-forge-${filename}`, port: nativeWorker });
    await race(Promise.race([pdfWorker.promise, workerFailure]));

    const bytes = new Uint8Array(await file.arrayBuffer());
    throwIfCancelled(filename, options.signal);
    loadingTask = pdfjs.getDocument({
      data: bytes,
      worker: pdfWorker,
      stopAtErrors: true,
      enableXfa: false,
      useWorkerFetch: false,
      useWasm: false,
      disableFontFace: true,
      isOffscreenCanvasSupported: false,
      isImageDecoderSupported: false,
      maxImageSize: MAX_PDF_IMAGE_PIXELS,
      canvasMaxAreaInBytes: 16 * 1024 * 1024
    });
    const document = await race(Promise.race([loadingTask.promise, workerFailure]));

    if (document.numPages > MAX_PDF_PAGES) {
      throw importError("page-limit-exceeded", filename, `the PDF has ${document.numPages} pages; the local limit is ${MAX_PDF_PAGES}. Use a shorter résumé or split it into smaller files.`);
    }

    const [documentActions, openAction, attachments] = await race(Promise.all([
      document.getJSActions(),
      document.getOpenAction(),
      document.getAttachments()
    ]));
    if (hasUnsafeValue(documentActions) || openActionIsUnsafe(openAction) || hasUnsafeValue(attachments)) {
      throw importError("unsafe-or-unsupported-pdf-content", filename, "the PDF contains document actions or attachments that résumé import does not allow. Export a flattened, text-only PDF or use DOCX or TXT.");
    }

    const pages: string[] = [];
    let characterCount = 0;
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      throwIfCancelled(filename, options.signal);
      const page = await race(document.getPage(pageNumber));
      try {
        const width = Math.abs(page.view[2] - page.view[0]);
        const height = Math.abs(page.view[3] - page.view[1]);
        if (width > MAX_PDF_PAGE_DIMENSION || height > MAX_PDF_PAGE_DIMENSION || width * height > MAX_PDF_PAGE_AREA) {
          throw importError("resource-limit-exceeded", filename, `page ${pageNumber} exceeds the safe page-dimension limit. Export a standard page-sized PDF or use DOCX or TXT.`);
        }

        const [pageActions, annotations] = await race(Promise.all([
          page.getJSActions(),
          page.getAnnotations({ intent: "display" })
        ]));
        if (hasUnsafeValue(pageActions) || annotations.some(annotationHasDisallowedAction)) {
          throw importError("unsafe-or-unsupported-pdf-content", filename, "the PDF contains active or unsupported annotations that résumé import does not allow. Export a flattened, text-only PDF or use DOCX or TXT.");
        }

        const content = await race(page.getTextContent());
        const chunks: string[] = [];
        for (const item of content.items) {
          if (!("str" in item) || !item.str) continue;
          chunks.push(item.str, "hasEOL" in item && item.hasEOL ? "\n" : " ");
          characterCount += item.str.length + 1;
          if (characterCount > MAX_EXTRACTED_CHARACTERS) {
            throw importError("text-limit-exceeded", filename, `extracted text exceeds ${MAX_EXTRACTED_CHARACTERS.toLocaleString()} characters. Reduce the document or split it into smaller files.`);
          }
        }
        pages.push(chunks.join(""));
      } finally {
        page.cleanup();
      }
    }

    const text = normalizeExtractedText(pages.join("\n"));
    if (!text) {
      throw importError("no-extractable-text", filename, "no text layer was found. Use a text-enabled PDF, DOCX, or TXT; image-only scans need OCR, which is not performed here.");
    }
    return text;
  } catch (error) {
    throw parserFailure(error, filename);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    if (abortListener) options.signal?.removeEventListener("abort", abortListener);
    if (workerErrorListener && nativeWorker) nativeWorker.removeEventListener("error", workerErrorListener);
    try {
      await loadingTask?.destroy();
    } catch {
      // The authoritative parse result is already known; cleanup remains best-effort.
    }
    try {
      pdfWorker?.destroy();
    } catch {
      // A worker that failed during startup can already be terminated.
    }
    nativeWorker?.terminate();
  }
}

async function extractOne(file: File, options: ResumeImportOptions): Promise<ExtractedResumeFile> {
  throwIfCancelled(file.name, options.signal);
  if (file.size > MAX_FILE_BYTES) {
    throw importError("file-too-large", file.name, `the file is larger than ${MAX_FILE_BYTES / 1024 / 1024} MB. Reduce its size or split it into smaller files.`);
  }
  const lower = file.name.toLowerCase();
  if (file.type === "application/pdf" || lower.endsWith(".pdf")) {
    return { filename: file.name, text: await extractPdf(file, options), type: "pdf" };
  }
  if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || lower.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    const text = normalizeExtractedText(result.value);
    if (!text) throw importError("no-extractable-text", file.name, "no readable text was found. Export a fresh DOCX or use TXT instead.");
    if (text.length > MAX_EXTRACTED_CHARACTERS) throw importError("text-limit-exceeded", file.name, `extracted text exceeds ${MAX_EXTRACTED_CHARACTERS.toLocaleString()} characters. Split it into smaller files.`);
    return { filename: file.name, text, type: "docx" };
  }
  if (file.type.startsWith("text/") || lower.endsWith(".txt")) {
    const text = normalizeExtractedText(await file.text());
    if (!text) throw importError("no-extractable-text", file.name, "the text file is empty. Choose a résumé containing readable text.");
    if (text.length > MAX_EXTRACTED_CHARACTERS) throw importError("text-limit-exceeded", file.name, `text exceeds ${MAX_EXTRACTED_CHARACTERS.toLocaleString()} characters. Split it into smaller files.`);
    return { filename: file.name, text, type: "text" };
  }
  throw importError("unsupported-file-type", file.name, "this is not a supported PDF, DOCX, or TXT file.");
}

export async function extractLocalResumeFileBatch(files: File[], options: ResumeImportOptions = {}): Promise<ResumeImportBatchResult> {
  if (!files.length) return { files: [], failures: [] };
  if (files.length > MAX_IMPORT_FILES) {
    throw importError("too-many-files", files[MAX_IMPORT_FILES]?.name ?? files[0].name, `choose no more than ${MAX_IMPORT_FILES} résumé files at once.`);
  }
  let totalBytes = 0;
  for (const file of files) {
    totalBytes += file.size;
    if (totalBytes > MAX_BATCH_BYTES) {
      throw importError("batch-too-large", file.name, `this selection exceeds the ${MAX_BATCH_BYTES / 1024 / 1024} MB batch limit. Choose fewer or smaller files.`);
    }
  }

  const settled: Array<{ index: number; file?: ExtractedResumeFile; failure?: ResumeImportFailure }> = [];
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < files.length) {
      const index = nextIndex;
      nextIndex += 1;
      const file = files[index];
      try {
        settled.push({ index, file: await extractOne(file, options) });
      } catch (error) {
        const typed = parserFailure(error, file.name);
        settled.push({ index, failure: { filename: typed.filename, code: typed.code, message: typed.message } });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENT_PDF_PARSES, files.length) }, worker));
  settled.sort((a, b) => a.index - b.index);

  const extracted: ExtractedResumeFile[] = [];
  const failures: ResumeImportFailure[] = [];
  let totalCharacters = 0;
  for (const result of settled) {
    if (result.failure) {
      failures.push(result.failure);
      continue;
    }
    if (!result.file) continue;
    totalCharacters += result.file.text.length;
    if (totalCharacters > MAX_BATCH_EXTRACTED_CHARACTERS) {
      failures.push({
        filename: result.file.filename,
        code: "text-limit-exceeded",
        message: `${result.file.filename}: this file would exceed the ${MAX_BATCH_EXTRACTED_CHARACTERS.toLocaleString()}-character batch limit. Choose fewer or smaller files.`
      });
      continue;
    }
    extracted.push(result.file);
  }
  return { files: extracted, failures };
}

/** Compatibility wrapper for callers that require all selected files to succeed. */
export async function extractLocalResumeFiles(files: File[], options: ResumeImportOptions = {}): Promise<ExtractedResumeFile[]> {
  const result = await extractLocalResumeFileBatch(files, options);
  if (result.failures.length) {
    const first = result.failures[0];
    throw new ResumeImportError(first.code, first.filename, first.message);
  }
  return result.files;
}
