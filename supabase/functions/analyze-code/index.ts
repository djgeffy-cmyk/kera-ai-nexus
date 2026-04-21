 import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
 import "https://deno.land/x/xhr@0.1.0/mod.ts";
 
 const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Headers":
     "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
 };
 
 serve(async (req) => {
   if (req.method === "OPTIONS") {
     return new Response(null, { headers: corsHeaders });
   }
 
   try {
     const { code, language } = await req.json();
 
     if (!code) {
       return new Response(JSON.stringify({ error: "No code provided" }), {
         status: 400,
         headers: { ...corsHeaders, "Content-Type": "application/json" },
       });
     }
 
     const openAiKey = Deno.env.get("OPENAI_API_KEY");
     if (!openAiKey) {
       throw new Error("OPENAI_API_KEY is not set");
     }
 
     const systemPrompt = `You are Kera Security NASA, a Senior Systems Analyst for NASA. You specialize in software that is mission-critical and safety-critical. Your tone is extremely professional, direct, technical, and serious. Never use a casual or friendly tone. You are rigorous and precise.
 
 Analyze the following code snippet for security vulnerabilities (OWASP Top 10 + CWE + language-specific issues).
 
 User-provided language: ${language || "Auto-detect"}
 
 For each vulnerability found, provide:
 - Title
 - Severity: CRITICAL | HIGH | MEDIUM | LOW
 - Description: Technical risk and potential impact (life-critical/mission-critical risks).
 - Problematic Snippet: The exact line or block.
 - Corrected Snippet: The complete fixed code for that section.
 
 Also provide:
 - Overall Recommendations: Extra hardening and NASA best practices.
 - Corrected Full Code: The entire code snippet with all fixes applied.
 
 Output strictly in JSON format:
 {
   "overall_severity": "CRITICAL",
   "findings": [
     {
       "title": "...",
       "severity": "...",
       "description": "...",
       "problematic_snippet": "...",
       "corrected_snippet": "..."
     }
   ],
   "recommendations": ["...", "..."],
   "corrected_full_code": "..."
 }`;
 
     const response = await fetch("https://api.openai.com/v1/chat/completions", {
       method: "POST",
       headers: {
         "Authorization": `Bearer ${openAiKey}`,
         "Content-Type": "application/json",
       },
       body: JSON.stringify({
         model: "gpt-4o",
         messages: [
           { role: "system", content: systemPrompt },
           { role: "user", content: `Code to analyze:\n\n${code}` },
         ],
         response_format: { type: "json_object" },
         temperature: 0.1,
       }),
     });
 
     if (!response.ok) {
       const error = await response.json();
       throw new Error(`OpenAI API error: ${JSON.stringify(error)}`);
     }
 
     const data = await response.json();
     const analysis = JSON.parse(data.choices[0].message.content);
 
     return new Response(JSON.stringify(analysis), {
       headers: { ...corsHeaders, "Content-Type": "application/json" },
     });
   } catch (error) {
     console.error("Error in analyze-code function:", error);
     return new Response(JSON.stringify({ error: error.message }), {
       status: 500,
       headers: { ...corsHeaders, "Content-Type": "application/json" },
     });
   }
 });