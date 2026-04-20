import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, Image as ImageIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";

type GalleryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
};

type GalleryItem = {
  url: string;
  caption: string;
  conversationId: string;
  createdAt: string;
};

export const GalleryDialog = ({ open, onOpenChange, userId }: GalleryDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<GalleryItem[]>([]);

  useEffect(() => {
    if (!open || !userId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("messages")
          .select("id, content, conversation_id, created_at, role")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(500);
        if (error) throw error;
        const collected: GalleryItem[] = [];
        for (const m of data ?? []) {
          const raw = m.content;
          if (typeof raw !== "string") continue;
          if (!raw.includes('"image_url"')) continue;
          try {
            const parts = JSON.parse(raw);
            if (!Array.isArray(parts)) continue;
            const text = parts.find((p: any) => p?.type === "text")?.text ?? "";
            for (const p of parts) {
              if (p?.type === "image_url" && p?.image_url?.url) {
                collected.push({
                  url: p.image_url.url,
                  caption: text || "Imagem",
                  conversationId: m.conversation_id,
                  createdAt: m.created_at,
                });
              }
            }
          } catch {
            // ignore unparseable
          }
        }
        if (!cancelled) setItems(collected);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Erro ao carregar galeria";
        toast.error(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, userId]);

  const handleDownload = async (url: string, idx: number) => {
    try {
      // dataURL ou http(s) — ambos funcionam com fetch
      const res = await fetch(url);
      const blob = await res.blob();
      const ext = blob.type.split("/")[1] || "png";
      const a = document.createElement("a");
      const obj = URL.createObjectURL(blob);
      a.href = obj;
      a.download = `kera-imagem-${idx + 1}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(obj);
    } catch {
      toast.error("Não foi possível baixar a imagem");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="size-5 text-primary" />
            Galeria de imagens
          </DialogTitle>
          <DialogDescription>
            Todas as imagens geradas e anexadas nas suas conversas.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[70vh] pr-3">
          {loading && (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="size-6 animate-spin mr-2" /> Carregando...
            </div>
          )}
          {!loading && items.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <ImageIcon className="size-10 mb-3 opacity-50" />
              <p className="text-sm">Nenhuma imagem ainda. Peça à Kera para gerar uma!</p>
            </div>
          )}
          {!loading && items.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {items.map((it, idx) => (
                <div
                  key={`${it.url.slice(0, 40)}-${idx}`}
                  className="group relative rounded-lg overflow-hidden border border-border bg-secondary/40"
                >
                  <img
                    src={it.url}
                    alt={it.caption}
                    className="w-full h-44 object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-background/95 to-transparent opacity-0 group-hover:opacity-100 transition">
                    <p className="text-xs text-foreground line-clamp-2 mb-1">{it.caption}</p>
                    <button
                      onClick={() => handleDownload(it.url, idx)}
                      className="inline-flex items-center gap-1 text-[11px] text-primary hover:text-primary/80"
                    >
                      <Download className="size-3" /> Baixar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
