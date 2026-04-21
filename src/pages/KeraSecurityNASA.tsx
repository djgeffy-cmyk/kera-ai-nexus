import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ShieldAlert,
  Terminal,
  History as HistoryIcon,
  Copy,
  Check,
  FileCode,
  ArrowLeft,
  Loader2,
  ChevronRight,
  ShieldCheck,
  Cpu,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import CodeEditor from "@/components/CodeEditor";

type Vulnerability = {
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  title: string;
  description: string;
  risk: string;
  snippet: string;
  fix: string;
};

type AnalysisResult = {
  vulnerabilities: Vulnerability[];
  corrected_code: string;
  hardening_recommendations: string[];
  overall_severity: string;
  detected_language?: string;
};

type ScanRecord = {
  id: string;
  code: string;
  language: string;
  analysis_result: AnalysisResult;
  created_at: string;
};

const KeraSecurityNASA = () => {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("auto");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [history, setHistory] = useState<ScanRecord[]>([]);
  const [currentScan, setCurrentScan] = useState<ScanRecord | null>(null);
  const [copied, setCopied] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const languages = [
    { value: "auto", label: "Auto-detect" },
    { value: "python", label: "Python" },
    { value: "javascript", label: "JavaScript" },
    { value: "typescript", label: "TypeScript" },
    { value: "java", label: "Java" },
    { value: "cpp", label: "C / C++" },
    { value: "go", label: "Go" },
    { value: "rust", label: "Rust" },
    { value: "php", label: "PHP" },
    { value: "sql", label: "SQL" },
  ];

  useEffect(() => {
    document.title = "Kera Security NASA — Mission Critical Analysis";
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("scans")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching history:", error);
    } else {
      setHistory((data || []) as unknown as ScanRecord[]);
    }
  };

  const handleAnalyze = async () => {
    if (!code.trim()) {
      toast.error("MISSION ABORTED: No code provided for analysis.");
      return;
    }

    setIsAnalyzing(true);
    setCurrentScan(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Authentication required");

      const { data, error } = await supabase.functions.invoke("analyze-security", {
        body: { code, language },
      });

      if (error) throw error;

      const analysisResult = data as AnalysisResult;
      
      const { data: savedData, error: saveError } = await supabase
        .from("scans")
        .insert({
          user_id: user.id,
          code,
          language: analysisResult.detected_language || language,
          analysis_result: analysisResult,
        })
        .select()
        .single();

      if (saveError) throw saveError;

      const newScan = savedData as unknown as ScanRecord;
      setCurrentScan(newScan);
      setHistory([newScan, ...history]);
      toast.success("ANALYSIS COMPLETE: Security report generated.");
    } catch (err: any) {
      toast.error(`ANALYSIS FAILED: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Corrected code copied.");
  };

  const getSeverityStyles = (sev: string) => {
    switch (sev?.toUpperCase()) {
      case "CRITICAL": return "bg-red-950/40 text-red-500 border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.3)]";
      case "HIGH": return "bg-orange-950/40 text-orange-500 border-orange-500/50";
      case "MEDIUM": return "bg-yellow-950/40 text-yellow-500 border-yellow-500/50";
      case "LOW": return "bg-blue-950/40 text-blue-500 border-blue-500/50";
      default: return "bg-zinc-800 text-zinc-400 border-zinc-700";
    }
  };

  return (
    <div className="min-h-screen bg-black text-zinc-200 font-sans selection:bg-primary/30 relative overflow-hidden">
      {/* Background Decorative Grid */}
      <div className="absolute inset-0 z-0 opacity-10 pointer-events-none" 
           style={{ backgroundImage: 'linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      <div className="absolute inset-0 z-0 bg-gradient-to-tr from-primary/5 via-transparent to-red-500/5 pointer-events-none" />

      <div className="relative z-10 flex flex-col h-screen overflow-hidden">
        {/* NASA Style Header */}
        <header className="h-16 border-b border-zinc-800 bg-black/80 backdrop-blur-xl flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate("/")}
              className="hover:bg-zinc-900 transition-colors"
            >
              <ArrowLeft className="size-5" />
            </Button>
            <div className="flex flex-col">
              <h1 className="font-display text-xl tracking-tighter flex items-center gap-2">
                <ShieldAlert className="size-5 text-primary" />
                KERA SECURITY NASA
              </h1>
              <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-mono">
                Senior Security Analysis Agent – MISSION CRITICAL
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col items-end mr-4">
              <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-mono">Status</span>
              <span className="text-xs text-green-500 flex items-center gap-1">
                <div className="size-1.5 rounded-full bg-green-500 animate-pulse" />
                Protocol Active
              </span>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              className="border-zinc-800 bg-zinc-900/50 text-xs font-mono"
              onClick={() => setShowHistory(!showHistory)}
            >
              <HistoryIcon className="size-3 mr-2" />
              HISTORY
            </Button>
          </div>
        </header>

        <main className="flex-1 flex overflow-hidden">
          {/* Main Content Area */}
          <div className="flex-1 flex flex-col min-w-0 border-r border-zinc-800">
            {/* Toolbar */}
            <div className="p-4 border-b border-zinc-800 bg-zinc-950/30 flex items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Terminal className="size-4 text-zinc-500" />
                  <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider">Source Analysis Terminal</span>
                </div>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger className="w-[140px] h-8 bg-zinc-900 border-zinc-800 text-[10px] font-mono uppercase">
                    <SelectValue placeholder="Language" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    {languages.map(lang => (
                      <SelectItem key={lang.value} value={lang.value} className="text-[10px] font-mono">
                        {lang.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button 
                onClick={handleAnalyze} 
                disabled={isAnalyzing}
                className="h-8 bg-primary hover:bg-primary/90 text-primary-foreground font-display text-[10px] tracking-widest px-6 shadow-glow transition-all"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="size-3 mr-2 animate-spin" />
                    RUNNING HEURISTICS...
                  </>
                ) : (
                  "ANALYZE SECURITY – NASA LEVEL"
                )}
              </Button>
            </div>

            {/* Code Editor */}
            <div className="flex-1 overflow-auto p-6 bg-zinc-950/20">
              <div className="h-full min-h-[500px]">
                <CodeEditor 
                  code={code} 
                  setCode={setCode} 
                  language={language === 'auto' ? 'javascript' : language} 
                />
              </div>
            </div>
          </div>

          {/* Right Sidebar: Results */}
          <div className={`transition-all duration-300 ${showHistory ? 'w-[400px]' : (currentScan ? 'w-[450px]' : 'w-0 overflow-hidden')} bg-zinc-950/80 backdrop-blur-md overflow-hidden flex flex-col`}>
            {showHistory ? (
              <div className="h-full flex flex-col p-6">
                <div className="flex items-center justify-between mb-6 shrink-0">
                  <h2 className="font-display text-xs tracking-widest uppercase text-zinc-500">Scan Logs</h2>
                  <Button variant="ghost" size="sm" onClick={() => setShowHistory(false)}>✕</Button>
                </div>
                <ScrollArea className="flex-1">
                  <div className="space-y-3">
                    {history.map((scan) => (
                      <button
                        key={scan.id}
                        onClick={() => {
                          setCurrentScan(scan);
                          setCode(scan.code);
                          setShowHistory(false);
                        }}
                        className="w-full text-left p-4 rounded-lg bg-zinc-900/50 border border-zinc-800 hover:border-primary/50 transition-all group"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-mono text-zinc-300 uppercase truncate">
                            {scan.language} – {new Date(scan.created_at).toLocaleDateString()}
                          </span>
                          <Badge variant="outline" className={`text-[8px] h-3 px-1 ${getSeverityStyles(scan.analysis_result.overall_severity)}`}>
                            {scan.analysis_result.overall_severity}
                          </Badge>
                        </div>
                        <p className="text-[9px] font-mono text-zinc-600 line-clamp-1">{scan.code}</p>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            ) : currentScan && (
              <ScrollArea className="flex-1 h-full">
                <div className="p-6 space-y-8 pb-20">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <h2 className="font-display text-sm tracking-widest uppercase text-zinc-200">Security Report</h2>
                        <span className="text-[9px] font-mono text-zinc-600">ID: {currentScan.id.substring(0, 8)}</span>
                      </div>
                      <Badge className={`h-6 px-3 ${getSeverityStyles(currentScan.analysis_result.overall_severity)}`}>
                        {currentScan.analysis_result.overall_severity} THREAT LEVEL
                      </Badge>
                    </div>
                    
                    {currentScan.analysis_result.detected_language && (
                      <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-500 uppercase">
                        <Cpu className="size-3" />
                        Detected Language: <span className="text-zinc-300">{currentScan.analysis_result.detected_language}</span>
                      </div>
                    )}
                  </div>

                  {/* Vulnerabilities List */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
                      <ShieldAlert className="size-4 text-primary" />
                      <h3 className="font-display text-[10px] tracking-widest uppercase text-primary">Detected Vulnerabilities</h3>
                    </div>
                    
                    {currentScan.analysis_result.vulnerabilities.length === 0 ? (
                      <div className="p-6 bg-green-950/20 border border-green-500/30 rounded-lg text-center space-y-2">
                        <ShieldCheck className="size-8 text-green-500 mx-auto" />
                        <p className="text-xs font-mono text-green-400">No security vulnerabilities detected. Code follows mission-critical patterns.</p>
                      </div>
                    ) : (
                      currentScan.analysis_result.vulnerabilities.map((vuln, idx) => (
                        <Card key={idx} className="bg-zinc-900/40 border-zinc-800 overflow-hidden group hover:border-zinc-700 transition-all">
                          <div className={`h-1 w-full ${
                            vuln.severity === "CRITICAL" ? "bg-red-500" : 
                            vuln.severity === "HIGH" ? "bg-orange-500" : 
                            vuln.severity === "MEDIUM" ? "bg-yellow-500" : "bg-blue-500"
                          }`} />
                          <div className="p-4 space-y-4">
                            <div className="flex items-start justify-between gap-4">
                              <h4 className="text-xs font-bold text-zinc-100 uppercase tracking-tight leading-tight">
                                {vuln.title}
                              </h4>
                              <Badge className={`text-[8px] h-4 px-1 shrink-0 ${getSeverityStyles(vuln.severity)}`}>
                                {vuln.severity}
                              </Badge>
                            </div>

                            <div className="space-y-3">
                              <div className="space-y-1">
                                <span className="text-[9px] font-mono text-zinc-600 uppercase">Analysis</span>
                                <p className="text-xs text-zinc-400 leading-relaxed">{vuln.description}</p>
                              </div>
                              <div className="space-y-1 p-2 bg-red-950/10 rounded border border-red-900/20">
                                <span className="text-[9px] font-mono text-red-500/80 uppercase">Mission Risk & Impact</span>
                                <p className="text-[10px] text-zinc-400 font-medium">{vuln.risk}</p>
                              </div>
                              <div className="space-y-1">
                                <span className="text-[9px] font-mono text-zinc-600 uppercase">Vulnerable Snippet</span>
                                <pre className="p-2 bg-black border border-zinc-800 rounded text-[10px] font-mono text-red-400 overflow-x-auto">
                                  <code>{vuln.snippet}</code>
                                </pre>
                              </div>
                              <div className="space-y-1 pt-2 border-t border-zinc-800/50">
                                <span className="text-[9px] font-mono text-blue-400 uppercase">Remediation Protocol</span>
                                <p className="text-xs text-zinc-400 italic font-mono">{vuln.fix}</p>
                              </div>
                            </div>
                          </div>
                        </Card>
                      ))
                    )}
                  </div>

                  {/* Hardening Recommendations */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
                      <Zap className="size-4 text-yellow-500" />
                      <h3 className="font-display text-[10px] tracking-widest uppercase text-yellow-500">NASA Hardening Protocols</h3>
                    </div>
                    <ul className="space-y-2">
                      {currentScan.analysis_result.hardening_recommendations.map((rec, idx) => (
                        <li key={idx} className="text-xs text-zinc-400 flex gap-2 items-start">
                          <ChevronRight className="size-3 text-yellow-500 shrink-0 mt-0.5" />
                          <span className="font-mono">{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Corrected Code */}
                  <div className="space-y-4 pt-4 border-t border-zinc-800">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileCode className="size-4 text-green-500" />
                        <h3 className="font-display text-[10px] tracking-widest uppercase text-green-500">Corrected Source</h3>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="size-7 hover:bg-green-500/10"
                        onClick={() => handleCopy(currentScan.analysis_result.corrected_code)}
                      >
                        {copied ? <Check className="size-3 text-green-500" /> : <Copy className="size-3 text-zinc-400" />}
                      </Button>
                    </div>
                    <div className="rounded-lg border border-zinc-800 overflow-hidden bg-black">
                      <pre className="p-4 text-[11px] font-mono text-green-400/90 overflow-x-auto max-h-[600px] selection:bg-green-500/20">
                        <code>{currentScan.analysis_result.corrected_code}</code>
                      </pre>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            )}

            {!currentScan && !showHistory && (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4 opacity-40">
                <ShieldAlert className="size-16 text-zinc-800" />
                <div className="space-y-2">
                  <h3 className="font-display text-xs tracking-widest text-zinc-500 uppercase">No Data Transmission</h3>
                  <p className="text-[10px] text-zinc-700 font-mono max-w-xs mx-auto">
                    Initiate source code telemetry analysis to generate mission-critical security reports and remediation protocols.
                  </p>
                </div>
              </div>
            )}
          </div>
        </main>

        {/* Footer Status Bar */}
        <footer className="h-8 border-t border-zinc-800 bg-black flex items-center justify-between px-6 text-[10px] font-mono text-zinc-600 uppercase tracking-widest shrink-0">
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-1.5">
              <div className="size-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_5px_hsl(var(--primary))]" />
              Secure Link: Active
            </span>
            <span>Auth: NASA-SAML-2.0</span>
            <span>Agent: KERA-S-9000</span>
          </div>
          <div className="flex items-center gap-6">
            <span>Scan Count: {history.length}</span>
            <span>Latency: 45ms</span>
            <span className="text-zinc-400">© NASA SYSTEM REVISION 2024</span>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default KeraSecurityNASA;
