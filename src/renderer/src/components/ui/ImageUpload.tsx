import { useState, useRef } from "react";
import { Upload, X } from "lucide-react";
import { useTranslation } from "react-i18next";

interface Props {
  value?: string;
  onChange: (file: File | null) => void;
  label?: string;
  error?: string;
  accept?: string;
  maxSizeMB?: number;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export function ImageUpload({
  value,
  onChange,
  label,
  error,
  accept = "image/*",
  maxSizeMB = 5,
}: Props) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(value ? `file://${value}` : null);
  const [isDragActive, setIsDragActive] = useState(false);

  const handleFileSelect = (file: File | null) => {
    if (!file) {
      setPreview(null);
      onChange(null);
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      alert(`${t("common.fileTooLarge", { size: maxSizeMB })}`);
      return;
    }

    if (!file.type.startsWith("image/")) {
      alert(t("common.invalidFileType"));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setPreview(reader.result as string);
      onChange(file);
    };
    reader.readAsDataURL(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(e.type === "dragenter" || e.type === "dragover");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {label && <label className="text-sm font-medium text-foreground">{label}</label>}

      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-lg p-6 transition-all ${
          isDragActive
            ? "border-accent/80 bg-accent/5"
            : error
              ? "border-destructive/50 bg-destructive/5"
              : "border-border hover:border-border/80 bg-secondary/30"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
          className="hidden"
          aria-label={label || t("common.uploadImage")}
        />

        {!preview ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-full flex flex-col items-center gap-2 cursor-pointer"
          >
            <Upload size={24} className="text-muted-foreground" />
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">
                {t("common.uploadImage")}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {t("common.dragDropOrClick", { size: maxSizeMB })}
              </p>
            </div>
          </button>
        ) : (
          <div className="relative group">
            <img
              src={preview}
              alt="Preview"
              className="max-h-48 mx-auto rounded object-contain"
            />
            <button
              type="button"
              onClick={() => handleFileSelect(null)}
              className="absolute top-2 right-2 p-1.5 rounded-md bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              aria-label={t("common.remove")}
            >
              <X size={16} />
            </button>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
