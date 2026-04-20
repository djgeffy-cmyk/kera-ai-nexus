// Tools que a LLM pode chamar quando a Kera está rodando no Electron (desktop).
// Definição OpenAI-compat + executor que chama window.kera.*.
// Todas as ações sensíveis já abrem diálogo nativo de confirmação no main process.

import { getKera, isKeraDesktop } from "./keraDesktop";

// Schema passado pro gateway (formato OpenAI tools).
export const DESKTOP_TOOLS = [
  {
    type: "function",
    function: {
      name: "list_folder",
      description:
        "Lista arquivos e subpastas de uma pasta do PC do usuário. SÓ funciona dentro das pastas autorizadas (allow-list). Use antes de read_file quando não souber o nome exato.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Caminho absoluto da pasta (ex: /home/user/Documentos)" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description:
        "Lê o conteúdo de um arquivo de texto do PC do usuário. SÓ funciona dentro das pastas autorizadas. Retorna texto UTF-8.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Caminho absoluto do arquivo" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description:
        "Cria ou sobrescreve um arquivo de texto no PC do usuário. Abre confirmação nativa antes de escrever. SÓ dentro das pastas autorizadas.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Caminho absoluto do arquivo" },
          content: { type: "string", description: "Conteúdo UTF-8 a escrever" },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_path",
      description:
        "Apaga um arquivo ou pasta do PC. Abre confirmação nativa. SÓ dentro das pastas autorizadas. Irreversível.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Caminho absoluto a deletar" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "system_status",
      description:
        "Retorna info do PC: CPU, RAM usada/total, load average, uptime, disco do home. Só leitura, sem risco.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "read_clipboard",
      description: "Lê o conteúdo atual da área de transferência do SO.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "write_clipboard",
      description: "Escreve texto na área de transferência do SO.",
      parameters: {
        type: "object",
        properties: { text: { type: "string" } },
        required: ["text"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "take_screenshot",
      description:
        "Captura a tela primária do usuário. Abre confirmação nativa. Retorna URL de dados base64 (PNG). Use com moderação — imagens são grandes.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "open_path",
      description:
        "Abre um arquivo/pasta com o app padrão do SO ou uma URL (http/https/mailto) no navegador. Confirmação nativa. Paths locais precisam estar na allow-list.",
      parameters: {
        type: "object",
        properties: {
          target: { type: "string", description: "Caminho absoluto OU URL http(s)/mailto" },
        },
        required: ["target"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "open_app",
      description:
        "Abre um programa pelo nome (ex: firefox, code, gedit, chrome). Confirmação nativa. No Windows usa 'start', no macOS 'open -a', no Linux chama direto.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Nome do executável/app" },
          args: { type: "array", items: { type: "string" }, description: "Args opcionais" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_command",
      description:
        "Executa um comando shell no PC do usuário. PODEROSO E ARRISCADO. Abre confirmação nativa mostrando o comando exato. Timeout 30s. Saída truncada em 20k caracteres. Use SÓ quando necessário e prefira comandos não destrutivos.",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "Comando shell completo (ex: 'ls -la ~/Downloads')" },
        },
        required: ["command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "install_flatpak",
      description:
        "Instala um aplicativo via Flatpak no modo user-level (SEM senha sudo). Ideal pra apps populares: Spotify (com.spotify.Client), Discord (com.discordapp.Discord), VSCode (com.visualstudio.code), OBS (com.obsproject.Studio), Firefox (org.mozilla.firefox), Chrome (com.google.Chrome). Passe o App ID completo do Flathub. PREFIRA ESTA TOOL ao instalar programas — não precisa de senha.",
      parameters: {
        type: "object",
        properties: {
          app_id: { type: "string", description: "App ID Flathub (ex: com.spotify.Client)" },
        },
        required: ["app_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_flatpak",
      description:
        "Busca apps no Flathub pra achar o App ID certo antes de install_flatpak. Use quando o usuário pedir um programa e você não souber o App ID exato.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Nome ou palavra-chave (ex: 'spotify', 'editor de video')" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "install_apt",
      description:
        "Instala um pacote via apt abrindo um TERMINAL VISÍVEL onde o usuário digita a senha sudo manualmente. Use SÓ quando o pacote não existir no Flathub (ex: ferramentas CLI como htop, curl, git, build-essential). Linux/Ubuntu apenas.",
      parameters: {
        type: "object",
        properties: {
          package: { type: "string", description: "Nome do pacote apt (ex: 'htop', 'git')" },
        },
        required: ["package"],
      },
    },
  },

// Nomes das tools desktop (pra distinguir de tools server-side como ipm_query).
export const DESKTOP_TOOL_NAMES = new Set(DESKTOP_TOOLS.map((t) => t.function.name));

// Executa uma tool desktop chamando window.kera.*.
// Retorna string (content pra mensagem role:"tool"). Se falhar, devolve JSON de erro.
export async function executeDesktopTool(
  name: string,
  args: Record<string, unknown>,
): Promise<string> {
  const k = getKera();
  if (!k) return JSON.stringify({ error: "Kera Desktop não está ativo neste cliente." });

  try {
    switch (name) {
      case "list_folder": {
        const entries = await k.fs.list(String(args.path));
        return JSON.stringify({ ok: true, entries });
      }
      case "read_file": {
        const text = await k.fs.read(String(args.path));
        const truncated = text.length > 30_000 ? text.slice(0, 30_000) + "\n[...truncado]" : text;
        return JSON.stringify({ ok: true, content: truncated, size: text.length });
      }
      case "write_file": {
        const r = await k.fs.write(String(args.path), String(args.content ?? ""));
        return JSON.stringify(r);
      }
      case "delete_path": {
        const r = await k.fs.delete(String(args.path));
        return JSON.stringify(r);
      }
      case "system_status": {
        const s = await k.system.status();
        return JSON.stringify({ ok: true, ...s });
      }
      case "read_clipboard": {
        const text = await k.clipboard.read();
        return JSON.stringify({ ok: true, text });
      }
      case "write_clipboard": {
        const r = await k.clipboard.write(String(args.text ?? ""));
        return JSON.stringify(r);
      }
      case "take_screenshot": {
        const r = await k.screenshot();
        // Não devolve dataURL completo pra LLM — é gigante. Só confirma.
        if (r.ok) return JSON.stringify({ ok: true, note: "Screenshot capturada e exibida ao usuário." });
        return JSON.stringify(r);
      }
      case "open_path": {
        const r = await k.open.path(String(args.target));
        return JSON.stringify(r);
      }
      case "open_app": {
        const r = await k.open.app(String(args.name), (args.args as string[]) ?? []);
        return JSON.stringify(r);
      }
      case "run_command": {
        const r = await k.exec(String(args.command));
        return JSON.stringify(r);
      }
      case "install_flatpak": {
        const r = await k.install.flatpak(String(args.app_id));
        return JSON.stringify(r);
      }
      case "search_flatpak": {
        const r = await k.install.searchFlatpak(String(args.query));
        return JSON.stringify(r);
      }
      case "install_apt": {
        const r = await k.install.apt(String(args.package));
        return JSON.stringify(r);
      }
      default:
        return JSON.stringify({ error: `Tool desconhecida: ${name}` });
    }
  } catch (e) {
    return JSON.stringify({
      error: e instanceof Error ? e.message : String(e),
      tool: name,
    });
  }
}

// Só expõe tools desktop se Kera estiver rodando no Electron.
export function getAvailableDesktopTools() {
  return isKeraDesktop() ? DESKTOP_TOOLS : null;
}
