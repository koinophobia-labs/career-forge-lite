"use client";

export type ExtractedResumeFile = {
  filename: string;
  text: string;
  type: "pdf" | "docx" | "text";
};

const MAX_FILE_BYTES = 12 * 1024 * 1024;

async function extractPdf(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const document = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => "str" in item ? item.str : "").join(" "));
  }
  return pages.join("\n");
}

async function extractDocx(file: File): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return result.value;
}

export async function extractLocalResumeFiles(files: File[]): Promise<ExtractedResumeFile[]> {
  if (!files.length) return [];
  if (files.length > 12) throw new Error("Choose no more than 12 résumé files at once.");
  return Promise.all(files.map(async (file) => {
    if (file.size > MAX_FILE_BYTES) throw new Error(`${file.name} is larger than 12 MB.`);
    const lower = file.name.toLowerCase();
    if (file.type === "application/pdf" || lower.endsWith(".pdf")) {
      return { filename: file.name, text: await extractPdf(file), type: "pdf" as const };
    }
    if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || lower.endsWith(".docx")) {
      return { filename: file.name, text: await extractDocx(file), type: "docx" as const };
    }
    if (file.type.startsWith("text/") || lower.endsWith(".txt")) {
      return { filename: file.name, text: await file.text(), type: "text" as const };
    }
    throw new Error(`${file.name} is not a supported PDF, DOCX, or text file.`);
  }));
}
