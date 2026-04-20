import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Aplica o tema salvo antes de renderizar pra evitar flash
try {
  const saved = localStorage.getItem("kera:theme");
  if (saved === "light") document.documentElement.classList.add("light");
  else if (saved === "kera") document.documentElement.classList.add("kera");
  else if (saved === "kera-premium") document.documentElement.classList.add("kera-premium");
} catch {}

createRoot(document.getElementById("root")!).render(<App />);

