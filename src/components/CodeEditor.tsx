import React from 'react';
import Editor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-typescript';
import 'prismjs/themes/prism-tomorrow.css';

interface CodeEditorProps {
  code: string;
  setCode: (code: string) => void;
  language: string;
}

const CodeEditor: React.FC<CodeEditorProps> = ({ code, setCode, language }) => {
  const getPrismLanguage = (lang: string) => {
    switch (lang) {
      case 'javascript': return languages.js;
      case 'typescript': return languages.ts;
      case 'python': return languages.python;
      case 'java': return languages.java;
      case 'cpp': return languages.cpp;
      case 'rust': return languages.rust;
      case 'go': return languages.go;
      case 'sql': return languages.sql;
      default: return languages.js;
    }
  };

  return (
    <div className="w-full h-full font-mono text-sm rounded-lg overflow-hidden border border-zinc-800 bg-zinc-950/50">
      <Editor
        value={code}
        onValueChange={setCode}
        highlight={code => highlight(code, getPrismLanguage(language), language)}
        padding={20}
        style={{
          fontFamily: '"Fira code", "Fira Mono", monospace',
          fontSize: 14,
          minHeight: '100%',
        }}
        className="outline-none"
      />
    </div>
  );
};

export default CodeEditor;
