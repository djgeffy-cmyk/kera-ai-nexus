import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { code, language } = await req.json();
    const apiKey = Deno.env.get('OPENAI_API_KEY');

    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not set');
    }

    const systemPrompt = `
      You are Kera Security NASA, a Senior Systems Analyst for NASA. 
      You analyze mission-critical and safety-critical code. 
      Tone: Extremely professional, direct, technical, serious. No greetings or pleasantries.
      
      Analyze the provided code for security vulnerabilities (OWASP Top 10, CWE, etc.).
      You MUST return your response ONLY as valid JSON in this exact structure:
      {
        "vulnerabilities": [
          {
            "severity": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
            "title": "Short title",
            "description": "Technical detail",
            "risk": "Technical risk and impact (e.g., mission-critical, risk of life, loss of billions)",
            "snippet": "The exact line(s) causing the issue",
            "fix": "Specific fix instruction"
          }
        ],
        "corrected_code": "The full code with all fixes applied",
        "hardening_recommendations": ["Recommendation 1", "Recommendation 2"]
      }
      
      Be rigorous. Use NASA standards (MISRA, JPL coding standards, etc. where applicable).
    `;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Analyze this ${language} code:\n\n${code}` }
        ],
        temperature: 0.2,
        response_format: { type: "json_object" }
      }),
    });

    const data = await response.json();
    const analysis = JSON.parse(data.choices[0].message.content);

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
