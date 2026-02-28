import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

interface ImageFullscreenPreviewProps {
  imageStr: string;
  format: string;
  onClose: () => void;
}

const ALLOWED_FORMATS = new Set(["png", "jpeg", "jpg", "webp", "gif", "bmp", "tiff"]);

export default function ImageFullscreenPreview({
  imageStr,
  format,
  onClose,
}: ImageFullscreenPreviewProps) {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const onCloseRef = useRef(onClose);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const isAllowed = ALLOWED_FORMATS.has(format.toLowerCase());

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!isAllowed) {
      console.error(`Blocked disallowed image format: "${format}"`);
      onClose();
      return;
    }

    previousFocusRef.current = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    requestAnimationFrame(() => setVisible(true));

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCloseRef.current();
      } else if (e.key === "Tab") {
        e.preventDefault();
        closeButtonRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
    };
  }, [isAllowed, format, onClose]);

  useEffect(() => {
    if (!isAllowed) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isAllowed]);

  if (!isAllowed) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Fullscreen image preview"
      className={`fixed inset-0 z-[9999] bg-black flex items-center justify-center transition-opacity duration-200 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      onClick={onClose}
    >
      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-[1000]">
          <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}

      {/* Close button */}
      <button
        ref={closeButtonRef}
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/25 text-white rounded-full transition-colors z-[10000]"
        aria-label="Close fullscreen preview (Escape)"
        title="Close (Esc)"
      >
        <X size={20} aria-hidden="true" />
      </button>

      <img
        src={`data:image/${format};base64,${imageStr}`}
        alt="Fullscreen preview"
        draggable={false}
        className="max-w-[95vw] max-h-[95vh] object-contain select-none"
        onClick={(e) => e.stopPropagation()}
        onLoad={() => setLoading(false)}
      />
    </div>
  );
}
