import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { BookOpen, FileUp, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { parseBook, type ParsedBook, type Chapter, BOOK_MAX_WORDS } from "@/lib/bookParser";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onTranslateChapter: (chapter: Chapter, totalChapters: number, bookName: string) => Promise<void>;
  onAllDone?: () => void;
};

type Phase = "idle" | "parsing" | "ready" | "translating" | "done" | "cancelled";

export function BookTranslateDialog({ open, onOpenChange, onTranslateChapter, onAllDone }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [book, setBook] = useState<ParsedBook | null>(null);
  const [progress, setProgress] = useState(0); // 0..N
  const [currentTitle, setCurrentTitle] = useState<string>("");
  const cancelRef = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setPhase("idle");
    setBook(null);
    setProgress(0);
    setCurrentTitle("");
    cancelRef.current = false;
  };

  const handleFile = async (f: File) => {
    setPhase("parsing");
    try {
      const parsed = await parseBook(f);
      setBook(parsed);
      setPhase("ready");
      toast.success(`Livro processado: ${parsed.chapters.length} capítulo(s) detectado(s).`);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao ler o livro.");
      setPhase("idle");
    }
  };

  const startTranslation = async () => {
    if (!book) return;
    setPhase("translating");
    cancelRef.current = false;
    const total = book.chapters.length;
    for (let i = 0; i < total; i++) {
      if (cancelRef.current) {
        setPhase("cancelled");
        toast.info(`Tradução interrompida em ${i}/${total}.`);
        return;
      }
      const ch = book.chapters[i];
      setCurrentTitle(`${ch.index}. ${ch.title}`);
      try {
        await onTranslateChapter(ch, total, book.fileName);
        setProgress(i + 1);
      } catch (e: any) {
        toast.error(`Falha no capítulo ${ch.index}: ${e?.message || "erro"}`);
        setPhase("cancelled");
        return;
      }
    }
    setPhase("done");
    toast.success("Livro traduzido inteiro! 🎉");
    onAllDone?.();
  };

  const close = () => {
    if (phase === "translating") {
      const ok = window.confirm("Tradução em andamento. Deseja cancelar e fechar?");
      if (!ok) return;
      cancelRef.current = true;
    }
    onOpenChange(false);
    setTimeout(reset, 300);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(v) : close())}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="size-5 text-amber-400" />
            Traduzir livro inteiro (EN → PT-BR)
          </DialogTitle>
          <DialogDescription>
            Faça upload de um <strong>PDF, EPUB ou TXT</strong>. A Kera Tradutora detecta os capítulos
            automaticamente e traduz cada um como uma mensagem aqui no chat. Limite:{" "}
            <strong>{BOOK_MAX_WORDS.toLocaleString("pt-BR")} palavras</strong>.
          </DialogDescription>
        </DialogHeader>

        {phase === "idle" && (
          <div
            className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border/60 bg-muted/20 p-8 text-center cursor-pointer hover:border-primary/50 transition"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) handleFile(f);
            }}
          >
            <FileUp className="size-10 text-muted-foreground" />
            <div>
              <p className="font-medium">Clique ou arraste um livro aqui</p>
              <p className="text-xs text-muted-foreground mt-1">PDF, EPUB, TXT ou Markdown</p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.epub,.txt,.md,.markdown,application/pdf,application/epub+zip,text/plain,text/markdown"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) handleFile(f);
              }}
            />
          </div>
        )}

        {phase === "parsing" && (
          <div className="flex flex-col items-center gap-3 py-10">
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Processando arquivo e detectando capítulos…</p>
          </div>
        )}

        {(phase === "ready" || phase === "translating" || phase === "done" || phase === "cancelled") && book && (
          <div className="space-y-3">
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-sm">
              <p className="font-medium truncate">{book.fileName}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {book.format.toUpperCase()} · {book.chapters.length} capítulo(s) ·{" "}
                {book.totalWords.toLocaleString("pt-BR")} palavras
              </p>
            </div>

            <ScrollArea className="h-48 rounded-lg border border-border/60 p-2">
              <ul className="space-y-1">
                {book.chapters.map((c, i) => {
                  const translated = phase !== "ready" && i < progress;
                  const current = phase === "translating" && i === progress;
                  return (
                    <li
                      key={c.index}
                      className={`flex items-center justify-between gap-2 rounded px-2 py-1.5 text-xs ${
                        current ? "bg-primary/10 text-primary" : translated ? "text-muted-foreground line-through" : ""
                      }`}
                    >
                      <span className="truncate">
                        <span className="font-mono mr-2">{String(c.index).padStart(2, "0")}.</span>
                        {c.title}
                      </span>
                      <span className="shrink-0 text-muted-foreground">{c.wordCount.toLocaleString("pt-BR")}p</span>
                    </li>
                  );
                })}
              </ul>
            </ScrollArea>

            {(phase === "translating" || phase === "done" || phase === "cancelled") && (
              <div className="space-y-1">
                <Progress value={(progress / book.chapters.length) * 100} />
                <p className="text-xs text-muted-foreground">
                  {progress}/{book.chapters.length} traduzido(s){currentTitle && phase === "translating" ? ` · ${currentTitle}` : ""}
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {phase === "ready" && (
            <>
              <Button variant="ghost" onClick={reset}>
                Trocar arquivo
              </Button>
              <Button onClick={startTranslation} className="gap-2">
                <BookOpen className="size-4" />
                Traduzir {book?.chapters.length} capítulo(s)
              </Button>
            </>
          )}
          {phase === "translating" && (
            <Button
              variant="destructive"
              onClick={() => {
                cancelRef.current = true;
                toast.info("Cancelando ao fim do capítulo atual…");
              }}
              className="gap-2"
            >
              <X className="size-4" />
              Cancelar
            </Button>
          )}
          {(phase === "done" || phase === "cancelled") && (
            <Button onClick={close}>Fechar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
