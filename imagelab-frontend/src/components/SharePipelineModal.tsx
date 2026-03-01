import { useState } from "react";
import * as Blockly from "blockly";
import { X, Copy, Check, Share2, Upload } from "lucide-react";

interface SharePipelineModalProps {
  workspace: Blockly.WorkspaceSvg | null;
  onClose: () => void;
}

function compressToCode(workspace: Blockly.WorkspaceSvg): string {
  const state = Blockly.serialization.workspaces.save(workspace);
  const json = JSON.stringify(state);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

function decompressFromCode(code: string): object {
  const binary = atob(code.trim());
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const json = new TextDecoder().decode(bytes);
  return JSON.parse(json);
}

export default function SharePipelineModal({ workspace, onClose }: SharePipelineModalProps) {
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [inputCode, setInputCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadSuccess, setLoadSuccess] = useState(false);

  const handleGenerate = () => {
    if (!workspace) return;
    const blocks = workspace.getAllBlocks(false);
    if (blocks.length === 0) {
      setGeneratedCode("");
      return;
    }
    const code = compressToCode(workspace);
    setGeneratedCode(code);
  };

  const handleCopy = async () => {
    if (!generatedCode) return;
    await navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLoad = () => {
    if (!workspace || !inputCode.trim()) return;
    setLoadError(null);
    setLoadSuccess(false);
    try {
      const state = decompressFromCode(inputCode.trim());
      workspace.clear();
      Blockly.serialization.workspaces.load(state, workspace);

      const readImageBlocks = workspace.getBlocksByType("basic_readimage", false);
      readImageBlocks.forEach((block) => {
        const field = block.getField("filename_label");
        if (field) field.setValue("No image");
      });

      setLoadSuccess(true);
      setTimeout(() => onClose(), 800);
    } catch {
      setLoadError("Invalid code. Please check and try again.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Share2 size={18} className="text-indigo-500" />
            <h2 className="text-sm font-semibold text-gray-800">Share Pipeline</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-6">
          {/* Generate section */}
          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                Generate Code
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                Share your current pipeline with others using a code.
              </p>
            </div>

            <button
              onClick={handleGenerate}
              disabled={!workspace}
              className="w-full py-2 px-3 rounded-lg text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Generate shareable pipeline code"
            >
              Generate Code
            </button>

            {generatedCode !== null && (
              <div className="space-y-2">
                {generatedCode === "" ? (
                  <p className="text-xs text-gray-500 italic">
                    No blocks in workspace. Add some blocks first.
                  </p>
                ) : (
                  <>
                    <div className="flex gap-2">
                      <input
                        readOnly
                        value={generatedCode}
                        aria-label="Generated pipeline code"
                        placeholder="Generated code will appear here"
                        className="flex-1 text-xs font-mono bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-700 truncate"
                      />
                      <button
                        onClick={handleCopy}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-gray-200 hover:bg-gray-50 transition-colors text-gray-600"
                        title="Copy code to clipboard"
                      >
                        {copied ? (
                          <Check size={14} className="text-green-500" />
                        ) : (
                          <Copy size={14} />
                        )}
                        {copied ? "Copied!" : "Copy"}
                      </button>
                    </div>
                    <p className="text-[11px] text-gray-400">
                      Anyone with this code can load your pipeline.
                    </p>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-gray-100" />

          {/* Load section */}
          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                Load from Code
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                Paste a pipeline code to load it into your workspace.
              </p>
            </div>

            <textarea
              value={inputCode}
              onChange={(e) => {
                setInputCode(e.target.value);
                setLoadError(null);
                setLoadSuccess(false);
              }}
              aria-label="Paste pipeline code here"
              placeholder="Paste pipeline code here..."
              rows={3}
              className="w-full text-xs font-mono bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent"
            />

            {loadError && <p className="text-xs text-red-500">{loadError}</p>}
            {loadSuccess && <p className="text-xs text-green-600">Pipeline loaded successfully!</p>}

            <button
              onClick={handleLoad}
              disabled={!inputCode.trim() || !workspace}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Load pipeline from code"
            >
              <Upload size={14} />
              Load Pipeline
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
