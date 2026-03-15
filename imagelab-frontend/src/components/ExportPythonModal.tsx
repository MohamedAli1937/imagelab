import { useState, useEffect, useRef } from "react";
import { X, Copy, Download, Check } from "lucide-react";
import { downloadPythonFile } from "../utils/pythonExport";

interface ExportPythonModalProps {
  code: string;
  onClose: () => void;
}

export default function ExportPythonModal({ code, onClose }: ExportPythonModalProps) {
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleKeyDownGlobally = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDownGlobally);
    return () => {
      document.removeEventListener("keydown", handleKeyDownGlobally);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, [onClose]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
      alert("Failed to copy to clipboard. Please select and copy the code manually.");
    }
  };

  const handleDownload = () => {
    downloadPythonFile(code);
  };

  const lineCount = code.split("\n").length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Export Python Code"
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-[700px] max-w-[92vw] max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200 flex-shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Export Pipeline to Python</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {lineCount} lines • Ready to run with OpenCV
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-auto bg-gray-900 min-h-0">
          <pre className="p-5 text-[13px] leading-relaxed font-mono text-gray-100 whitespace-pre overflow-x-auto">
            {code.split("\n").map((line, i) => (
              <div key={i} className="flex">
                <span className="select-none text-gray-600 w-8 text-right mr-4 flex-shrink-0">
                  {i + 1}
                </span>
                <span
                  className={
                    line.trimStart().startsWith("#") || line.trimStart().startsWith('"""')
                      ? "text-green-400"
                      : line.includes("import ")
                        ? "text-purple-300"
                        : ""
                  }
                >
                  {line || "\u00A0"}
                </span>
              </div>
            ))}
          </pre>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
            {copied ? "Copied!" : "Copy to Clipboard"}
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-500 rounded-md hover:bg-indigo-600 transition-colors"
          >
            <Download size={14} />
            Download .py
          </button>
        </div>
      </div>
    </div>
  );
}
