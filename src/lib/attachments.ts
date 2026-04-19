// Helpers para anexos no chat (imagens + arquivos de texto).
// Imagens viram { type:"image_url", image_url:{ url: dataURI } } no formato OpenAI multimodal.
// Arquivos de texto viram bloco markdown anexado ao texto da mensagem.

export type Attachment =
  | { kind: "image"; name: string; dataUrl: string; size: number }
  | { kind: "text"; name: string; text: string; size: number };

const TEXT_EXTS = [
  "txt", "md", "markdown", "json", "csv", "tsv", "log", "yml", "yaml", "toml", "ini",
  "html", "htm", "xml", "css", "scss", "js", "jsx", "ts", "tsx", "py", "rb", "go",
  "rs", "java", "kt", "php", "sh", "bash", "zsh", "sql", "env", "conf", "c", "cpp",
  "h", "hpp", "cs", "swift", "dart", "vue", "svelte", "lua", "r",
];

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_TEXT_BYTES = 200 * 1024;       // 200KB
const MAX_TEXT_CHARS = 30_000;           // ~30k chars no prompt

export function isImage(file: File | Blob): boolean {
  return file.type.startsWith("image/");
}

export function isLikelyText(file: File): boolean {
  if (file.type.startsWith("text/")) return true;
  if (file.type === "application/json" || file.type === "application/xml") return true;
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  return TEXT_EXTS.includes(ext);
}

export async function fileToAttachment(file: File): Promise<Attachment> {
  if (isImage(file)) {
    if (file.size > MAX_IMAGE_BYTES) {
      throw new Error(`Imagem muito grande (máx 5MB): ${file.name}`);
    }
    const dataUrl = await blobToDataUrl(file);
    return { kind: "image", name: file.name, dataUrl, size: file.size };
  }
  if (isLikelyText(file)) {
    if (file.size > MAX_TEXT_BYTES) {
      throw new Error(`Arquivo de texto muito grande (máx 200KB): ${file.name}`);
    }
    let text = await file.text();
    if (text.length > MAX_TEXT_CHARS) text = text.slice(0, MAX_TEXT_CHARS) + "\n\n[... truncado ...]";
    return { kind: "text", name: file.name, text, size: file.size };
  }
  throw new Error(`Tipo de arquivo não suportado: ${file.name}. Use imagens (PNG/JPG/WEBP) ou texto/código.`);
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

// Constrói o `content` da mensagem do usuário no formato OpenAI multimodal.
// Se houver imagens: array de partes. Senão: string simples (compatível com qualquer provedor).
export function buildUserContent(text: string, attachments: Attachment[]): string | Array<any> {
  const textParts = attachments.filter(a => a.kind === "text") as Extract<Attachment, { kind: "text" }>[];
  const images = attachments.filter(a => a.kind === "image") as Extract<Attachment, { kind: "image" }>[];

  let combinedText = text.trim();
  if (textParts.length) {
    const blocks = textParts.map(t => `\n\n--- Anexo: ${t.name} ---\n\`\`\`\n${t.text}\n\`\`\``).join("");
    combinedText = (combinedText ? combinedText : "Analise o(s) arquivo(s) anexo(s):") + blocks;
  }

  if (images.length === 0) {
    return combinedText || "(arquivo anexado)";
  }

  return [
    { type: "text", text: combinedText || "Analise a(s) imagem(ns) anexa(s):" },
    ...images.map(img => ({ type: "image_url", image_url: { url: img.dataUrl } })),
  ];
}
