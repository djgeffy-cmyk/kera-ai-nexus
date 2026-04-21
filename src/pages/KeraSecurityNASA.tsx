 import { useState, useEffect } from "react";
 import { useNavigate } from "react-router-dom";
 import { supabase } from "@/integrations/supabase/client";
 import { Button } from "@/components/ui/button";
 import { Card } from "@/components/ui/card";
 import { Badge } from "@/components/ui/badge";
 import { Textarea } from "@/components/ui/textarea";
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
   ShieldCheck,
   Terminal,
   History,
   Copy,
   Check,
   AlertTriangle,
   FileCode,
   ArrowLeft,
   Loader2,
   ChevronRight,
 } from "lucide-react";
 import { toast } from "sonner";
 
 type Finding = {
   title: string;
   severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
   description: string;
   problematic_snippet: string;
   corrected_snippet: string;
 };
 
 type Analysis = {
   id: string;
   code: string;
   language: string;
   findings: Finding[];
   corrected_code: string;
   recommendations: string[];
   overall_severity: string;
   created_at: string;
 };
 
 const KeraSecurityNASA = () => {
   const navigate = useNavigate();
   const [code, setCode] = useState("");
   const [language, setLanguage] = useState("auto");
   const [isAnalyzing, setIsAnalyzing] = useState(false);
   const [history, setHistory] = useState<Analysis[]>([]);
   const [currentAnalysis, setCurrentAnalysis] = useState<Partial<Analysis> | null>(null);
   const [copied, setCopied] = useState(false);
 
   const languages = [
     { value: "auto", label: "Auto-detect" },
     { value: "python", label: "Python" },
     { value: "javascript", label: "JavaScript / Node.js" },
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
     const { data, error } = await supabase
       .from("analyses")
       .select("*")
       .order("created_at", { ascending: false });
 
     if (error) {
       console.error("Error fetching history:", error);
     } else {
       setHistory((data || []) as unknown as Analysis[]);
     }
   };
 
   const handleAnalyze = async () => {
     if (!code.trim()) {
       toast.error("MISSION ABORTED: No code provided for analysis.");
       return;
     }
 
     setIsAnalyzing(true);
     try {
       const { data: userData } = await supabase.auth.getUser();
       if (!userData?.user) throw new Error("Authentication required");
 
       const { data, error } = await supabase.functions.invoke("analyze-code", {
         body: { code, language },
       });
 
       if (error) throw error;
 
       const analysisData = data as any;
       
       // Save to database
       const { data: savedData, error: saveError } = await supabase
         .from("analyses")
         .insert({
           user_id: userData.user.id,
           code,
           language,
           findings: analysisData.findings,
           corrected_code: analysisData.corrected_full_code,
           recommendations: analysisData.recommendations,
           overall_severity: analysisData.overall_severity,
         })
         .select()
         .single();
 
       if (saveError) throw saveError;
 
       setCurrentAnalysis(savedData as unknown as Analysis);
       setHistory([savedData as unknown as Analysis, ...history]);
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
     toast.success("Code copied to clipboard.");
   };
 
   const getSeverityColor = (sev: string) => {
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
 
       <div className="relative z-10 flex flex-col min-h-screen">
       {/* NASA Style Header */}
       <header className="sticky top-0 z-50 h-16 border-b border-zinc-800 bg-black/80 backdrop-blur-xl flex items-center justify-between px-6">
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
             <h1 className="font-display text-xl tracking-tighter text-glow-primary flex items-center gap-2">
               <ShieldAlert className="size-5 text-primary" />
               KERA SECURITY NASA
             </h1>
             <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-mono">
               Mission Critical Code Security Scanner v4.0
             </span>
           </div>
         </div>
         
         <div className="flex items-center gap-6">
           <div className="hidden md:flex flex-col items-end">
             <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-mono">Status</span>
             <span className="text-xs text-green-500 flex items-center gap-1">
               <div className="size-1.5 rounded-full bg-green-500 animate-pulse" />
               System Operational
             </span>
           </div>
           <div className="h-8 w-px bg-zinc-800" />
           <Button 
             variant="ghost" 
             size="icon"
             className="relative group"
           >
             <History className="size-5 group-hover:text-primary transition-colors" />
           </Button>
         </div>
       </header>
 
       <main className="flex flex-col lg:flex-row h-[calc(100vh-4rem)]">
         {/* Left Side: Input Area */}
         <div className="flex-1 flex flex-col p-6 border-r border-zinc-800 overflow-hidden">
           <div className="mb-4 flex items-center justify-between shrink-0">
             <div className="flex items-center gap-2">
               <Terminal className="size-4 text-zinc-500" />
               <span className="text-sm font-mono uppercase text-zinc-400 tracking-wider">Source Analysis Interface</span>
             </div>
             <div className="flex items-center gap-3">
               <Select value={language} onValueChange={setLanguage}>
                 <SelectTrigger className="w-[180px] h-8 bg-zinc-900 border-zinc-700 text-xs font-mono">
                   <SelectValue placeholder="Language" />
                 </SelectTrigger>
                 <SelectContent className="bg-zinc-900 border-zinc-700">
                   {languages.map(lang => (
                     <SelectItem key={lang.value} value={lang.value} className="text-xs font-mono">
                       {lang.label}
                     </SelectItem>
                   ))}
                 </SelectContent>
               </Select>
               <Button 
                 onClick={handleAnalyze} 
                 disabled={isAnalyzing}
                 className="h-8 bg-primary hover:bg-primary/90 text-primary-foreground font-display text-[10px] tracking-widest px-4 shadow-glow active:scale-95 transition-all"
               >
                 {isAnalyzing ? (
                   <>
                     <Loader2 className="size-3 mr-2 animate-spin" />
                     SCANNING...
                   </>
                 ) : (
                   "ANALYZE SECURITY – NASA LEVEL"
                 )}
               </Button>
             </div>
           </div>
 
           <div className="relative flex-1 group min-h-0">
             <div className="absolute inset-0 bg-primary/5 rounded-lg opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none" />
             <Textarea
               placeholder="// Paste mission-critical code here for analysis..."
               className="w-full h-full bg-zinc-950/50 border-zinc-800 focus:border-primary/50 font-mono text-sm resize-none p-4 transition-all"
               value={code}
               onChange={(e) => setCode(e.target.value)}
             />
             <div className="absolute bottom-4 right-4 text-[10px] font-mono text-zinc-600 uppercase">
               Ready for transmission
             </div>
           </div>
         </div>
 
         {/* Right Side: Analysis Results or History */}
         <div className="w-full lg:w-1/3 xl:w-1/4 bg-zinc-950 overflow-hidden flex flex-col border-l border-zinc-800">
           {currentAnalysis ? (
             <ScrollArea className="flex-1">
               <div className="p-6 space-y-6">
                 <div className="space-y-2">
                   <div className="flex items-center justify-between">
                     <h2 className="font-display text-sm tracking-widest uppercase text-zinc-500">Analysis Report</h2>
                     <Badge className={getSeverityColor(currentAnalysis.overall_severity || "")}>
                       {currentAnalysis.overall_severity} THREAT LEVEL
                     </Badge>
                   </div>
                   <p className="text-[10px] font-mono text-zinc-600">
                     Timestamp: {currentAnalysis.created_at ? new Date(currentAnalysis.created_at).toISOString() : "NEW"}
                   </p>
                 </div>
 
                 <div className="space-y-4">
                   {currentAnalysis.findings?.map((finding, idx) => (
                     <Card key={idx} className="bg-zinc-900/50 border-zinc-800 overflow-hidden">
                       <div className={`h-1 w-full ${
                         finding.severity === "CRITICAL" ? "bg-red-500" : 
                         finding.severity === "HIGH" ? "bg-orange-500" : 
                         finding.severity === "MEDIUM" ? "bg-yellow-500" : "bg-blue-500"
                       }`} />
                       <div className="p-4 space-y-3">
                         <div className="flex items-start justify-between gap-2">
                           <h3 className="text-sm font-bold text-zinc-100 leading-tight">
                             {finding.title}
                           </h3>
                           <Badge variant="outline" className="text-[9px] h-4 border-zinc-700">
                             {finding.severity}
                           </Badge>
                         </div>
                         <p className="text-xs text-zinc-400 leading-relaxed">
                           {finding.description}
                         </p>
                         <div className="space-y-2">
                           <span className="text-[10px] font-mono text-zinc-600 uppercase">Vulnerable Section</span>
                           <pre className="p-2 bg-black border border-zinc-800 rounded text-[10px] font-mono text-red-400 overflow-x-auto">
                             <code>{finding.problematic_snippet}</code>
                           </pre>
                         </div>
                       </div>
                     </Card>
                   ))}
                 </div>
 
                 {currentAnalysis.recommendations && currentAnalysis.recommendations.length > 0 && (
                   <div className="space-y-3">
                     <h3 className="font-display text-[10px] tracking-widest uppercase text-primary">NASA Hardening Protocol</h3>
                     <ul className="space-y-2">
                       {currentAnalysis.recommendations.map((rec, idx) => (
                         <li key={idx} className="text-xs text-zinc-400 flex gap-2">
                           <ChevronRight className="size-3 text-primary shrink-0 mt-0.5" />
                           {rec}
                         </li>
                       ))}
                     </ul>
                   </div>
                 )}
 
                 {currentAnalysis.corrected_code && (
                   <div className="pt-4 border-t border-zinc-800">
                     <div className="flex items-center justify-between mb-2">
                       <h3 className="font-display text-[10px] tracking-widest uppercase text-green-500">Corrected Code</h3>
                       <Button 
                         variant="ghost" 
                         size="icon" 
                         className="size-7"
                         onClick={() => handleCopy(currentAnalysis.corrected_code!)}
                       >
                         {copied ? <Check className="size-3 text-green-500" /> : <Copy className="size-3" />}
                       </Button>
                     </div>
                     <pre className="p-3 bg-zinc-900 border border-zinc-800 rounded text-xs font-mono text-green-400/90 overflow-x-auto max-h-[400px]">
                       <code>{currentAnalysis.corrected_code}</code>
                     </pre>
                   </div>
                 )}
               </div>
             </ScrollArea>
           ) : (
             <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
               <div className="size-16 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                 <FileCode className="size-8 text-zinc-700" />
               </div>
               <div className="space-y-1">
                 <h3 className="font-display text-xs tracking-widest text-zinc-400 uppercase">Awaiting Transmission</h3>
                 <p className="text-[10px] text-zinc-600 font-mono leading-relaxed">
                   Input source code and initiate scan to generate mission-critical security report.
                 </p>
               </div>
               <div className="w-24 h-[1px] bg-zinc-800" />
               <ScrollArea className="w-full max-h-64 mt-4">
                 <div className="space-y-2 text-left">
                   <h4 className="text-[9px] font-mono uppercase text-zinc-500 px-2">Recent Scans</h4>
                   {history.map((item) => (
                     <button
                       key={item.id}
                       onClick={() => setCurrentAnalysis(item)}
                       className="w-full text-left p-2 rounded hover:bg-zinc-900 transition-colors group"
                     >
                       <div className="flex items-center justify-between mb-1">
                         <span className="text-[10px] font-mono text-zinc-300 truncate w-32">{item.language} source</span>
                         <Badge variant="outline" className={`text-[8px] h-3 px-1 border-zinc-700 ${
                           item.overall_severity === 'CRITICAL' ? 'text-red-500' : 
                           item.overall_severity === 'HIGH' ? 'text-orange-500' : 'text-zinc-500'
                         }`}>
                           {item.overall_severity}
                         </Badge>
                       </div>
                       <span className="text-[9px] font-mono text-zinc-600 block">
                         {new Date(item.created_at).toLocaleDateString()}
                       </span>
                     </button>
                   ))}
                 </div>
               </ScrollArea>
             </div>
           )}
         </div>
       </main>
 
       {/* Footer / Status Bar */}
       <footer className="h-8 border-t border-zinc-800 bg-zinc-950 flex items-center justify-between px-6 text-[10px] font-mono text-zinc-500 uppercase tracking-wider shrink-0">
         <div className="flex items-center gap-4">
           <span className="flex items-center gap-1.5">
             <div className="size-1 rounded-full bg-primary shadow-[0_0_5px_hsl(var(--primary))]" />
             SECURE_PROTOCOL: ACTIVE
           </span>
           <span>ENCRYPTION: AES-256</span>
         </div>
         <div className="flex items-center gap-4">
           <span>NASA_CSD_LEVEL_4_COMPLIANT</span>
           <span>© 2024 KERA_CORE</span>
         </div>
       </footer>
     </div>
   );
 };
 
 export default KeraSecurityNASA;