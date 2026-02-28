import { useState } from "react";
import ImageModal from "./ImageModal";

interface ImageDisplayProps {
  image: string;
  format: string;
  zoomWidth?: number | null;
}

const ALLOWED_FORMATS = new Set(["png", "jpeg", "jpg", "webp", "gif", "bmp", "tiff"]);

export default function ImageDisplay({ image, format, zoomWidth }: ImageDisplayProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (!ALLOWED_FORMATS.has(format.toLowerCase())) {
    console.error(`Blocked disallowed image format: "${format}"`);
    return null;
  }

  const imageSrc = `data:image/${format};base64,${image}`;

  return (
    <>
      <img
        src={imageSrc}
        alt="Preview"
        className={
          zoomWidth
            ? "cursor-zoom-in"
            : "max-w-full max-h-full object-contain cursor-zoom-in hover:opacity-90 transition-opacity"
        }
        style={zoomWidth ? { width: `${zoomWidth}px` } : undefined}
        onClick={() => setIsModalOpen(true)}
      />
      <ImageModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} imageSrc={imageSrc} />
    </>
  );
}
