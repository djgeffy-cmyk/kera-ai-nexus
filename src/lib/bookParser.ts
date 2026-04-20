// Parser de livros: PDF, EPUB, TXT/Markdown — extrai texto e detecta capítulos.
// Tudo client-side, sem upload pra servidor.
import JSZip from "jszip";

export type Chapter = {
  index: number;
  title: string;
  text: string;
  wordCount: number;
};

export type ParsedBook = {
  format: "pdf" | "epub" | "txt";
  fileName: string;
  totalWords: number;
  chapters: Chapter[];
};

const MAX_WORDS = 150_000;

function countWords(s: string): number {
  return (s.trim().match(/\S+/g) || []).length;
}

function clean(s: string): string {
  return s.replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

// ===== Detecção genérica de capítulos por heading/marcador =====
// Aceita: "Chapter 1", "CHAPTER I", "Capítulo 1", "# Heading", linhas TODAS MAIÚSCULAS curtas.
const CHAPTER_RE = /^\s*(?:#{1,3}\s+.+|(?:chapter|cap[ií]tulo|part[e]?|book)\s+(?:[ivxlcdm]+|\d+)(?:\s*[:.\-—–]\s*.+)?|[A-Z][A-Z0-9 ,'’\-—–:]{3,60})\s*$/i;

function splitByChapterHeadings(text: string): Chapter[] {
  const lines = text.split("\n");
  const chapters: Chapter[] = [];
  let currentTitle = "Início";
  let buffer: string[] = [];
  const flush = () => {
    const body = clean(buffer.join("\n"));
    if (body.length > 200) {
      chapters.push({
        index: chapters.length + 1,
        title: currentTitle.slice(0, 100),
        text: body,
        wordCount: countWords(body),
      });
    }
    buffer = [];
  };
  for (const raw of lines) {
    const line = raw.trim();
    // Heading curto e isolado (linha vazia antes/depois é heurística, mas usamos só o regex)
    if (line.length > 0 && line.length < 80 && CHAPTER_RE.test(line)) {
      flush();
      currentTitle = line.replace(/^#+\s*/, "").trim();
      continue;
    }
    buffer.push(raw);
  }
  flush();
  return chapters;
}

// Fallback: divide em blocos de ~3000 palavras se nenhum capítulo for detectado
function splitBySize(text: string, wordsPerChunk = 3000): Chapter[] {
  const words = text.split(/(\s+)/);
  const chapters: Chapter[] = [];
  let buf: string[] = [];
  let count = 0;
  for (const tok of words) {
    buf.push(tok);
    if (/\S/.test(tok)) count++;
    if (count >= wordsPerChunk) {
      const body = clean(buf.join(""));
      chapters.push({
        index: chapters.length + 1,
        title: `Parte ${chapters.length + 1}`,
        text: body,
        wordCount: countWords(body),
      });
      buf = [];
      count = 0;
    }
  }
  if (buf.length) {
    const body = clean(buf.join(""));
    if (body) {
      chapters.push({
        index: chapters.length + 1,
        title: `Parte ${chapters.length + 1}`,
        text: body,
        wordCount: countWords(body),
      });
    }
  }
  return chapters;
}

function autoSplit(text: string): Chapter[] {
  const byHeading = splitByChapterHeadings(text);
  // Se detectou pelo menos 2 capítulos com tamanho razoável, usa.
  if (byHeading.length >= 2) return byHeading;
  return splitBySize(text);
}

// ===== TXT / Markdown =====
async function parseTxt(file: File): Promise<ParsedBook> {
  const text = clean(await file.text());
  const chapters = autoSplit(text);
  return {
    format: "txt",
    fileName: file.name,
    totalWords: chapters.reduce((s, c) => s + c.wordCount, 0),
    chapters,
  };
}

// ===== PDF =====
async function parsePdf(file: File): Promise<ParsedBook> {
  // Carrega pdfjs sob demanda
  const pdfjs: any = await import("pdfjs-dist/build/pdf.mjs");
  // Worker via CDN (mesma versão da lib)
  pdfjs.GlobalWorkerOptions.workerSrc =
    `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((it: any) => ("str" in it ? it.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    pages.push(pageText);
  }
  const fullText = clean(pages.join("\n\n"));
  const chapters = autoSplit(fullText);
  return {
    format: "pdf",
    fileName: file.name,
    totalWords: chapters.reduce((s, c) => s + c.wordCount, 0),
    chapters,
  };
}

// ===== EPUB =====
async function parseEpub(file: File): Promise<ParsedBook> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());

  // Encontra container.xml -> rootfile (.opf)
  const containerFile = zip.file("META-INF/container.xml");
  if (!containerFile) throw new Error("EPUB inválido: META-INF/container.xml ausente");
  const containerXml = await containerFile.async("string");
  const opfPath = containerXml.match(/full-path="([^"]+)"/)?.[1];
  if (!opfPath) throw new Error("EPUB inválido: rootfile não encontrado");

  const opfFile = zip.file(opfPath);
  if (!opfFile) throw new Error("EPUB inválido: OPF ausente");
  const opfXml = await opfFile.async("string");

  // Mapa id -> href do manifest
  const manifest: Record<string, string> = {};
  for (const m of opfXml.matchAll(/<item\s+[^>]*id="([^"]+)"[^>]*href="([^"]+)"[^>]*media-type="application\/xhtml\+xml"[^>]*\/?>/g)) {
    manifest[m[1]] = m[2];
  }
  // Ordem de leitura (spine)
  const spine: string[] = [];
  for (const s of opfXml.matchAll(/<itemref\s+[^>]*idref="([^"]+)"/g)) {
    if (manifest[s[1]]) spine.push(manifest[s[1]]);
  }

  const opfDir = opfPath.includes("/") ? opfPath.replace(/\/[^/]+$/, "/") : "";
  const chapters: Chapter[] = [];
  const parser = new DOMParser();

  for (let i = 0; i < spine.length; i++) {
    const href = spine[i];
    const path = (opfDir + href).replace(/^\//, "");
    const f = zip.file(path) || zip.file(decodeURIComponent(path));
    if (!f) continue;
    const html = await f.async("string");
    const doc = parser.parseFromString(html, "text/html");
    // Remove tags de script/style
    doc.querySelectorAll("script, style").forEach((n) => n.remove());
    // Tenta título do arquivo (h1/h2/title)
    const title =
      doc.querySelector("h1, h2, h3")?.textContent?.trim() ||
      doc.querySelector("title")?.textContent?.trim() ||
      `Capítulo ${i + 1}`;
    const body = clean(doc.body?.textContent || "");
    if (body.length < 200) continue;
    chapters.push({
      index: chapters.length + 1,
      title: title.slice(0, 100),
      text: body,
      wordCount: countWords(body),
    });
  }

  // Se EPUB tem 1 só "capítulo" gigante, tenta subdividir
  const finalChapters = chapters.length >= 2 ? chapters : autoSplit(chapters.map((c) => c.text).join("\n\n"));

  return {
    format: "epub",
    fileName: file.name,
    totalWords: finalChapters.reduce((s, c) => s + c.wordCount, 0),
    chapters: finalChapters,
  };
}

// ===== Entry point =====
export async function parseBook(file: File): Promise<ParsedBook> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  let book: ParsedBook;
  if (ext === "pdf" || file.type === "application/pdf") {
    book = await parsePdf(file);
  } else if (ext === "epub" || file.type === "application/epub+zip") {
    book = await parseEpub(file);
  } else if (["txt", "md", "markdown"].includes(ext) || file.type.startsWith("text/")) {
    book = await parseTxt(file);
  } else {
    throw new Error(`Formato não suportado: .${ext}. Use PDF, EPUB ou TXT/MD.`);
  }
  if (book.chapters.length === 0) throw new Error("Não consegui extrair texto do arquivo.");
  if (book.totalWords > MAX_WORDS) {
    throw new Error(
      `Livro muito grande: ${book.totalWords.toLocaleString("pt-BR")} palavras. Limite: ${MAX_WORDS.toLocaleString("pt-BR")}.`,
    );
  }
  return book;
}

export const BOOK_MAX_WORDS = MAX_WORDS;
