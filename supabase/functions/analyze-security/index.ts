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
      You specialize in mission-critical and safety-critical software security. 
      Tone: Extremely professional, direct, technical, serious. Never use a casual tone.
      
      Analyze the provided code for security vulnerabilities using OWASP Top 10, CWE, and language-specific security best practices (e.g., MISRA for C/C++, JPL standards).
      
      You MUST return your response ONLY as valid JSON in this exact structure:
      {
        "vulnerabilities": [
          {
            "severity": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
            "title": "Short technical title",
            "description": "In-depth technical explanation of the flaw.",
            "risk": "Detailed risk and impact. For CRITICAL/HIGH, emphasize potential loss of mission, loss of life, or billions of dollars in hardware.",
            "snippet": "The exact line(s) of code causing the issue",
            "fix": "Specific instruction to remediate the vulnerability"
          }
        ],
        "corrected_code": "The complete source code with all security flaws corrected.",
        "hardening_recommendations": ["Recommendation 1 following NASA standards", "Recommendation 2"],
        "overall_severity": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
        "detected_language": "The detected language name"
      }
      
      If the user specified language 'auto', identify it first.
      Be extremely rigorous. If the code is secure, return an empty vulnerabilities array but provide hardening recommendations.
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
          { role: 'user', content: `Analyze this ${language === 'auto' ? 'code (detect language)' : language + ' code'}:\n\n${code}` }
        ],
        temperature: 0.1,
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`OpenAI API error: ${err}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    return new Response(content, {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in analyze-security:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
