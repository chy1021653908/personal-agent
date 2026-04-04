"use client";

import { useState, useCallback } from "react";
import { Upload, X, File } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";

const ACCEPTED_TYPES = [
  "application/pdf",
  "text/plain",
  "text/markdown",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

const ACCEPTED_EXTENSIONS = [".pdf", ".txt", ".md", ".docx", ".xlsx"];

interface FileUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpload: (file: File) => Promise<void>;
}

export function FileUploadDialog({
  open,
  onOpenChange,
  onUpload,
}: FileUploadDialogProps) {
  const t = useTranslations();
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      (f) =>
        ACCEPTED_TYPES.includes(f.type) ||
        ACCEPTED_EXTENSIONS.some((ext) =>
          f.name.toLowerCase().endsWith(ext)
        )
    );
    setFiles((prev) => [...prev, ...droppedFiles]);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    setUploading(true);
    setProgress(0);

    for (let i = 0; i < files.length; i++) {
      try {
        await onUpload(files[i]);
        setProgress(((i + 1) / files.length) * 100);
      } catch (error) {
        console.error(`Failed to upload ${files[i].name}:`, error);
      }
    }

    setUploading(false);
    setFiles([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("knowledge.uploadDialog.title")}</DialogTitle>
        </DialogHeader>

        <div
          className={`relative rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
            dragOver
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <Upload className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">
            {t("knowledge.uploadDialog.dragAndDrop")}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {t("knowledge.uploadDialog.supportedFormats")}
          </p>
          <label className="mt-4 inline-block">
            <Button variant="secondary" size="sm" asChild>
              <span>{t("knowledge.uploadDialog.selectFile")}</span>
            </Button>
            <input
              type="file"
              className="hidden"
              multiple
              accept={ACCEPTED_EXTENSIONS.join(",")}
              onChange={handleFileSelect}
            />
          </label>
        </div>

        {files.length > 0 && (
          <div className="space-y-2 max-h-48 overflow-auto">
            {files.map((file, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-md bg-muted p-2 text-sm"
              >
                <File className="h-4 w-4 shrink-0" />
                <span className="truncate flex-1">{file.name}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {(file.size / 1024).toFixed(0)} KB
                </span>
                {!uploading && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => removeFile(i)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {uploading && <Progress value={progress} className="h-2" />}

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={uploading}
          >
            {t("knowledge.uploadDialog.cancel")}
          </Button>
          <Button
            onClick={handleUpload}
            disabled={files.length === 0 || uploading}
          >
            {uploading
              ? t("knowledge.uploadDialog.uploading")
              : t("knowledge.uploadDialog.upload", { count: files.length })}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
