import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { setDesktopVideoCache } from "./lib/assetUrl";

try {
  const { pathname, search, hash, origin } = window.location;
  const isFileRequest = /\.[a-zA-Z0-9]+$/.test(pathname);
  const normalizedHashPath = hash.startsWith("#") ? hash.slice(1) : "";

  if (pathname !== "/" && !isFileRequest && normalizedHashPath !== pathname) {
    window.location.replace(`${origin}/#${pathname}${search}`);
  }
} catch {}

// Aplica o tema salvo antes de renderizar pra evitar flash
try {
  const saved = localStorage.getItem("kera:theme");
  if (saved === "light") document.documentElement.classList.add("light");
  else if (saved === "kera") document.documentElement.classList.add("kera");
  else if (saved === "kera-premium") document.documentElement.classList.add("kera-premium");
} catch {}

// No Kera Desktop, carrega o mapa de vídeos cacheados ANTES de renderizar
// para que <video src> já saia apontando pro arquivo local quando disponível.
async function bootstrap() {
  try {
    const w = window as unknown as { kera?: { videos?: { status: () => Promise<{ map: Record<string, string> }> } } };
    if (w.kera?.videos) {
      const s = await w.kera.videos.status();
      setDesktopVideoCache(s.map || {});
    }
  } catch {}

  createRoot(document.getElementById("root")!).render(<App />);
}

bootstrap();

