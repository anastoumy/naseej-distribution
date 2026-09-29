import { useState, useEffect } from "react";

interface Props {
  imagePath: string | null;
  alt: string;
  className?: string;
  placeholderClassName?: string;
}

export function ProductImage({
  imagePath,
  alt,
  className = "w-12 h-12 object-cover rounded border border-border",
  placeholderClassName = "w-12 h-12 rounded border border-border bg-secondary/50 flex items-center justify-center text-xs text-muted-foreground",
}: Props) {
  const [imageDataUrl, setImageDataUrl] = useState<string>("");
  const [loading, setLoading] = useState(!!imagePath);

  useEffect(() => {
    if (!imagePath) {
      setImageDataUrl("");
      setLoading(false);
      return;
    }

    const loadImage = async () => {
      try {
        const res = await window.api.products.getImageDataUrl(imagePath);
        if (res.success && res.data) {
          setImageDataUrl(res.data);
        }
      } catch (error) {
        console.error("Failed to load product image:", error);
      } finally {
        setLoading(false);
      }
    };

    loadImage();
  }, [imagePath]);

  if (!imagePath || !imageDataUrl) {
    return (
      <div className={placeholderClassName}>
        —
      </div>
    );
  }

  return (
    <img
      src={imageDataUrl}
      alt={alt}
      className={className}
      style={{ opacity: loading ? 0.5 : 1 }}
    />
  );
}
