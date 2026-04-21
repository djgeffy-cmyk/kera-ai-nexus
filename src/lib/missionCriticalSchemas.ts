import { z } from "zod";

/**
 * Padrões NASA: Rigor máximo em tipos, limites e sanitização.
 * Use sempre via .safeParse() para tratar erros sem quebrar a UI.
 */
export const MissionCriticalSchema = {
  // 1. Auth — signup com complexidade real
  authSignup: z.object({
    email: z.string().trim().toLowerCase().email("E-mail inválido").min(5).max(255),
    password: z
      .string()
      .min(12, "Segurança NASA exige mínimo de 12 caracteres")
      .max(128, "Senha muito longa")
      .regex(/[A-Z]/, "Requer letra maiúscula")
      .regex(/[a-z]/, "Requer letra minúscula")
      .regex(/[0-9]/, "Requer número")
      .regex(/[^A-Za-z0-9]/, "Requer caractere especial"),
  }),

  // Auth — signin (mais permissivo, só formato)
  authSignin: z.object({
    email: z.string().trim().toLowerCase().email("E-mail inválido").min(5).max(255),
    password: z.string().min(1, "Informe a senha").max(128),
  }),

  // 2. Agentes — anti-injeção + limite de buffer
  agent: z.object({
    name: z.string().trim().min(1, "Nome obrigatório").max(80, "Nome muito longo"),
    description: z
      .string()
      .max(500, "Descrição muito longa")
      .optional()
      .transform((v) => v?.trim() || ""),
    system_prompt: z
      .string()
      .min(1, "Prompt obrigatório")
      .max(8000, "Prompt excede limite de 8000 caracteres")
      .refine((v) => !/<script\b/i.test(v), "Tentativa de injeção detectada (<script>)")
      .transform((v) => v.replace(/[<>]/g, "")),
  }),

  // 3. Chat — anti-DoS
  chat: z.object({
    message: z
      .string()
      .min(1, "Mensagem vazia")
      .max(16000, "Mensagem excede 16.000 caracteres")
      .transform((v) => v.trim()),
  }),
};

export type AgentInput = z.infer<typeof MissionCriticalSchema.agent>;
export type ChatInput = z.infer<typeof MissionCriticalSchema.chat>;
