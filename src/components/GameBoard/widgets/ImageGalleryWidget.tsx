import { useState } from "react";
import { createPortal } from "react-dom";
import { useImageBus, type GalleryImage } from "@/providers/ImageBusProvider";

function GalleryThumbnail({
  image,
  onClick,
}: {
  image: GalleryImage;
  onClick: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  if (errored) {
    return (
      <div className="aspect-square bg-muted/30 rounded flex items-center justify-center text-xs text-muted-foreground">
        Unavailable
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="aspect-square overflow-hidden rounded cursor-pointer hover:ring-2 hover:ring-[var(--primary,hsl(var(--primary)))] transition-all"
    >
      <img
        src={image.url}
        alt={image.alt ?? "Gallery image"}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => setErrored(true)}
        className={`w-full h-full object-cover transition-opacity ${loaded ? "opacity-100" : "opacity-0"}`}
      />
    </button>
  );
}

export function ImageGalleryWidget() {
  const images = useImageBus();
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  if (images.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground/50 p-4">
        No images yet
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2 p-3">
        {images.map((img, i) => (
          <GalleryThumbnail
            key={img.render_id ?? `img-${i}`}
            image={img}
            onClick={() => setLightboxUrl(img.url)}
          />
        ))}
      </div>

      {lightboxUrl &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
            onClick={() => setLightboxUrl(null)}
            onKeyDown={(e) => e.key === "Escape" && setLightboxUrl(null)}
            role="dialog"
            aria-label="Image lightbox"
          >
            <img
              src={lightboxUrl}
              alt="Full size"
              className="max-w-[90vw] max-h-[90vh] object-contain rounded"
              onClick={(e) => e.stopPropagation()}
            />
          </div>,
          document.body,
        )}
    </>
  );
}
