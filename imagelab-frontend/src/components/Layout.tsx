import { useState, useCallback, useRef, useEffect } from "react";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { useBlocklyWorkspace, svgResizePreservingScroll } from "../hooks/useBlocklyWorkspace";
import { usePipelineStore } from "../store/pipelineStore";
import { useDarkMode } from "../hooks/useDarkMode";
import Navbar from "./Navbar";
import Toolbar from "./Toolbar";
import Sidebar from "./Sidebar/Sidebar";
import PreviewPane from "./Preview/PreviewPane";
import InfoPane from "./InfoPane";
import { ErrorBoundary } from "./ErrorBoundary";

const DEFAULT_SIDEBAR_WIDTH = 320;
const MIN_SIDEBAR_WIDTH = 260;
const MAX_SIDEBAR_WIDTH = 600;

const DEFAULT_PREVIEW_WIDTH = 320;
const MIN_PREVIEW_WIDTH = 240;
const MAX_PREVIEW_WIDTH = 600;

const STORAGE_KEYS = {
  sidebarWidth: "imagelab-sidebar-width",
  sidebarCollapsed: "imagelab-sidebar-collapsed",
  previewWidth: "imagelab-preview-width",
  previewCollapsed: "imagelab-preview-collapsed",
} as const;

function loadStoredNumber(key: string, defaultVal: number, min: number, max: number): number {
  try {
    const v = localStorage.getItem(key);
    if (v != null) {
      const n = Number(v);
      if (Number.isFinite(n)) return Math.max(min, Math.min(max, n));
    }
  } catch {
    /* ignore */
  }
  return defaultVal;
}

function loadStoredBool(key: string): boolean {
  try {
    const v = localStorage.getItem(key);
    return v === "true";
  } catch {
    return false;
  }
}

// Detect macOS to show Cmd vs Ctrl in tooltips
const isMac =
  typeof navigator !== "undefined" &&
  /mac/i.test(
    (
      navigator as Navigator & {
        userAgentData?: { platform?: string };
      }
    ).userAgentData?.platform ?? navigator.userAgent,
  );
const modShift = isMac ? "⌘⇧" : "Ctrl+Shift+";

export default function Layout() {
  const [isDark, toggleDark] = useDarkMode();
  const { containerRef, workspace } = useBlocklyWorkspace({ isDark });
  const { reset } = usePipelineStore();
  const mainRowRef = useRef<HTMLDivElement>(null);
  const [resetKey, setResetKey] = useState(0);
  const [sidebarWidth, setSidebarWidth] = useState(() =>
    loadStoredNumber(
      STORAGE_KEYS.sidebarWidth,
      DEFAULT_SIDEBAR_WIDTH,
      MIN_SIDEBAR_WIDTH,
      MAX_SIDEBAR_WIDTH,
    ),
  );
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() =>
    loadStoredBool(STORAGE_KEYS.sidebarCollapsed),
  );
  const [isResizing, setIsResizing] = useState(false);
  const [previewWidth, setPreviewWidth] = useState(() =>
    loadStoredNumber(
      STORAGE_KEYS.previewWidth,
      DEFAULT_PREVIEW_WIDTH,
      MIN_PREVIEW_WIDTH,
      MAX_PREVIEW_WIDTH,
    ),
  );
  const [isPreviewCollapsed, setIsPreviewCollapsed] = useState(() =>
    loadStoredBool(STORAGE_KEYS.previewCollapsed),
  );
  const [isPreviewResizing, setIsPreviewResizing] = useState(false);

  // RAF-throttled pending values to avoid layout thrashing during fast drag
  const pendingPreviewWidth = useRef<number | null>(null);
  const rafIdRef = useRef<number | null>(null);

  const sidebarDragStartRef = useRef<{ x: number; width: number } | null>(null);
  const previewDragStartRef = useRef<{ x: number; width: number } | null>(null);

  const flushPendingWidths = useCallback(() => {
    if (pendingPreviewWidth.current !== null) {
      setPreviewWidth(pendingPreviewWidth.current);
      pendingPreviewWidth.current = null;
    }
    rafIdRef.current = null;
  }, []);

  const scheduleWidthUpdate = useCallback(() => {
    if (rafIdRef.current === null) {
      rafIdRef.current = requestAnimationFrame(() => {
        flushPendingWidths();
        rafIdRef.current = null;
      });
    }
  }, [flushPendingWidths]);

  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, []);

  const startResizing = useCallback(
    (e: React.MouseEvent) => {
      sidebarDragStartRef.current = { x: e.clientX, width: sidebarWidth };
      setIsResizing(true);
    },
    [sidebarWidth],
  );

  const stopResizing = useCallback(() => {
    setIsResizing(false);
    sidebarDragStartRef.current = null;
  }, []);

  const resize = useCallback((e: MouseEvent) => {
    if (!sidebarDragStartRef.current) return;
    const deltaX = e.clientX - sidebarDragStartRef.current.x;
    const w = Math.max(
      MIN_SIDEBAR_WIDTH,
      Math.min(MAX_SIDEBAR_WIDTH, sidebarDragStartRef.current.width + deltaX),
    );
    setSidebarWidth(w);
  }, []);

  const startPreviewResizing = useCallback(
    (e: React.MouseEvent) => {
      previewDragStartRef.current = { x: e.clientX, width: previewWidth };
      setIsPreviewResizing(true);
    },
    [previewWidth],
  );

  const stopPreviewResizing = useCallback(() => {
    setIsPreviewResizing(false);
    previewDragStartRef.current = null;
    flushPendingWidths();
  }, [flushPendingWidths]);

  const resizePreview = useCallback(
    (e: MouseEvent) => {
      if (!previewDragStartRef.current) return;
      const deltaX = previewDragStartRef.current.x - e.clientX;
      const w = Math.max(
        MIN_PREVIEW_WIDTH,
        Math.min(MAX_PREVIEW_WIDTH, previewDragStartRef.current.width + deltaX),
      );
      pendingPreviewWidth.current = w;
      scheduleWidthUpdate();
    },
    [scheduleWidthUpdate],
  );

  useEffect(() => {
    if (isResizing) {
      window.addEventListener("pointermove", resize);
      window.addEventListener("pointerup", stopResizing);
    }
    return () => {
      window.removeEventListener("pointermove", resize);
      window.removeEventListener("pointerup", stopResizing);
    };
  }, [isResizing, resize, stopResizing]);

  useEffect(() => {
    if (isPreviewResizing) {
      window.addEventListener("pointermove", resizePreview);
      window.addEventListener("pointerup", stopPreviewResizing);
    }
    return () => {
      window.removeEventListener("pointermove", resizePreview);
      window.removeEventListener("pointerup", stopPreviewResizing);
    };
  }, [isPreviewResizing, resizePreview, stopPreviewResizing]);

  useEffect(() => {
    if (!workspace) return;
    const raf = requestAnimationFrame(() => svgResizePreservingScroll(workspace));
    return () => cancelAnimationFrame(raf);
  }, [workspace, sidebarWidth, isSidebarCollapsed, previewWidth, isPreviewCollapsed]);

  const toggleSidebar = useCallback(() => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEYS.sidebarCollapsed, String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const togglePreview = useCallback(() => {
    setIsPreviewCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEYS.previewCollapsed, String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  // Persist sidebar/preview widths when they change (debounced via RAF)
  const lastSavedWidths = useRef({ sidebar: sidebarWidth, preview: previewWidth });
  useEffect(() => {
    if (!isSidebarCollapsed && Math.abs(sidebarWidth - lastSavedWidths.current.sidebar) >= 1) {
      lastSavedWidths.current.sidebar = sidebarWidth;
      try {
        localStorage.setItem(STORAGE_KEYS.sidebarWidth, String(sidebarWidth));
      } catch {
        /* ignore */
      }
    }
    if (!isPreviewCollapsed && Math.abs(previewWidth - lastSavedWidths.current.preview) >= 1) {
      lastSavedWidths.current.preview = previewWidth;
      try {
        localStorage.setItem(STORAGE_KEYS.previewWidth, String(previewWidth));
      } catch {
        /* ignore */
      }
    }
  }, [sidebarWidth, isSidebarCollapsed, previewWidth, isPreviewCollapsed]);

  const handleEditorReset = () => {
    setResetKey((prev) => prev + 1);
    reset();
  };

  const isAnyResizing = isResizing || isPreviewResizing;

  return (
    <div
      className={`h-screen flex flex-col bg-gray-50 dark:bg-gray-900 select-none overflow-hidden ${isAnyResizing ? "imagelab-resizing" : ""}`}
    >
      <Navbar isDark={isDark} onToggleDark={toggleDark} />
      <Toolbar
        workspace={workspace}
        isSidebarCollapsed={isSidebarCollapsed}
        isPreviewCollapsed={isPreviewCollapsed}
        onToggleSidebar={toggleSidebar}
        onTogglePreview={togglePreview}
      />
      <div className="flex flex-1 min-h-0 relative">
        <div
          id="sidebar-panel"
          role="complementary"
          aria-label="Blocks panel"
          className="flex h-full"
        >
          <Sidebar
            workspace={workspace}
            width={isSidebarCollapsed ? 0 : sidebarWidth}
            isCollapsed={isSidebarCollapsed}
            isResizing={isResizing}
          />
        </div>
        {!isSidebarCollapsed && (
          <div
            className={`w-1 cursor-col-resize hover:bg-blue-400 active:bg-blue-600 transition-colors z-30 flex-shrink-0 ${isResizing ? "bg-blue-500" : "bg-transparent"}`}
            onPointerDown={(e) => {
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              startResizing(e);
            }}
          />
        )}
        <ErrorBoundary key={resetKey} onReset={handleEditorReset}>
          <div ref={mainRowRef} className="flex-1 flex min-w-0 bg-white relative">
            <div className="flex-1 flex flex-col min-w-0">
              <div ref={containerRef} className="flex-1 min-w-0 min-h-0" />
              <InfoPane />
            </div>
            {!isPreviewCollapsed && (
              <div
                className={`w-1 cursor-col-resize hover:bg-blue-400 active:bg-blue-600 transition-colors z-30 flex-shrink-0 ${isPreviewResizing ? "bg-blue-500" : "bg-transparent"}`}
                onPointerDown={(e) => {
                  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                  startPreviewResizing(e);
                }}
              />
            )}

            <PreviewPane
              width={previewWidth}
              isCollapsed={isPreviewCollapsed}
              isResizing={isPreviewResizing}
            />
            {isPreviewCollapsed && (
              <button
                onClick={togglePreview}
                aria-expanded={!isPreviewCollapsed}
                aria-controls="preview-panel"
                aria-label="Expand Preview"
                className="absolute right-0 top-1/2 -translate-y-1/2 bg-white border border-gray-200 border-r-0 rounded-l-md p-1 shadow-sm hover:bg-gray-50 z-20 transition-shadow hover:shadow-md"
                title={`Expand Preview (${modShift}P)`}
              >
                <ChevronLeft size={16} className="text-gray-600" />
              </button>
            )}
          </div>
        </ErrorBoundary>

        {isSidebarCollapsed && (
          <button
            onClick={toggleSidebar}
            aria-expanded={!isSidebarCollapsed}
            aria-controls="sidebar-panel"
            aria-label="Show Sidebar"
            className="absolute left-0 top-0 bottom-0 w-6 flex items-center justify-center bg-gray-50 hover:bg-gray-100 border-r border-gray-200 z-20 transition-colors"
            title={`Show Sidebar (${modShift}S)`}
          >
            <ChevronRight size={14} className="text-gray-500" />
          </button>
        )}
      </div>
    </div>
  );
}
