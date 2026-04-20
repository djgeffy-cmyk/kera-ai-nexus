import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Aplica o tema salvo antes de renderizar pra evitar flash
try {
  const saved = localStorage.getItem("kera:theme");
  if (saved === "light") document.documentElement.classList.add("light");
} catch {}

createRoot(document.getElementById("root")!).render(<App />);

