import jsPDF from "jspdf";
import type { ChatMessage } from "@/components/chat/MessageBubble";

type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

function flattenContent(content: string | ContentPart[]): { text: string; images: string[] } {
  if (typeof content === "string") return { text: content, images: [] };
  const text = content.filter((c) => c.type === "text").map((c) => (c as any).text).join("\n");
  const images = content
    .filter((c) => c.type === "image_url")
    .map((c) => (c as any).image_url.url as string);
  return { text, images };
}

// Carrega imagem como dataURL pra incluir no PDF
async function imageToDataUrl(url: string): Promise<{ dataUrl: string; w: number; h: number } | null> {
  try {
    if (url.startsWith("data:")) {
      const img = await loadImage(url);
      return { dataUrl: url, w: img.width, h: img.height };
    }
    const resp = await fetch(url);
    const blob = await resp.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    const img = await loadImage(dataUrl);
    return { dataUrl, w: img.width, h: img.height };
  } catch {
    return null;
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function exportConversationToPdf(opts: {
  title: string;
  agentName: string;
  messages: ChatMessage[];
}) {
  const { title, agentName, messages } = opts;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  const maxLineW = pageW - margin * 2;
  let y = margin;

  // Cabeçalho
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageW, 60, "F");
  doc.setTextColor(56, 189, 248);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("KERA AI", margin, 38);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(148, 163, 184);
  doc.text(`Conversa: ${title}`, margin, 52);
  doc.text(
    new Date().toLocaleString("pt-BR"),
    pageW - margin,
    52,
    { align: "right" },
  );
  y = 90;

  doc.setTextColor(30, 41, 59);

  for (const m of messages) {
    const { text, images } = flattenContent(m.content);
    const isUser = m.role === "user";
    const author = isUser ? "Você" : agentName || "Kera";

    // Cabeçalho da mensagem
    if (y > pageH - 80) { doc.addPage(); y = margin; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(isUser ? 71 : 6, isUser ? 85 : 182, isUser ? 105 : 212);
    doc.text(author, margin, y);
    y += 16;

    // Texto (limpa markdown básico)
    if (text) {
      const cleaned = text
        .replace(/```[\s\S]*?```/g, (b) => b.replace(/```\w*\n?/g, "").replace(/```/g, ""))
        .replace(/`([^`]+)`/g, "$1")
        .replace(/\*\*([^*]+)\*\*/g, "$1")
        .replace(/\*([^*]+)\*/g, "$1")
        .replace(/^#{1,6}\s+/gm, "")
        .replace(/^>\s+/gm, "");

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(30, 41, 59);
      const lines = doc.splitTextToSize(cleaned, maxLineW);
      for (const line of lines) {
        if (y > pageH - margin) { doc.addPage(); y = margin; }
        doc.text(line, margin, y);
        y += 14;
      }
    }

    // Imagens
    for (const url of images) {
      const data = await imageToDataUrl(url);
      if (!data) continue;
      const ratio = data.h / data.w;
      const w = Math.min(maxLineW, 360);
      const h = w * ratio;
      if (y + h > pageH - margin) { doc.addPage(); y = margin; }
      try {
        doc.addImage(data.dataUrl, "PNG", margin, y, w, h);
        y += h + 8;
      } catch {
        // ignora se a imagem não puder ser embutida
      }
    }

    y += 14;
  }

  // Rodapé em todas as páginas
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Kera AI · página ${i} de ${pageCount}`,
      pageW / 2,
      pageH - 20,
      { align: "center" },
    );
  }

  const safeTitle = title.replace(/[^\w\s-]/g, "").replace(/\s+/g, "_").slice(0, 50) || "conversa";
  doc.save(`kera-${safeTitle}-${Date.now()}.pdf`);
}
