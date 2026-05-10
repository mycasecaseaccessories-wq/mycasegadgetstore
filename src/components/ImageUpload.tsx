import { useRef, useState } from "react";
import { Upload, X, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Props = {
  value?: string | null;
  onChange: (url: string | null) => void;
  bucket: "product-images" | "branding";
  folder?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
};

export function ImageUpload({ value, onChange, bucket, folder = "", className = "", size = "md" }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const dim = size === "sm" ? "h-20 w-20" : size === "lg" ? "h-40 w-40" : "h-28 w-28";

  const handleFile = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) return toast.error("Max 5MB");
    setBusy(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${folder ? folder + "/" : ""}${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from(bucket).upload(path, file, { cacheControl: "3600", upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      onChange(data.publicUrl);
      toast.success("Uploaded");
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className={`relative flex ${dim} items-center justify-center overflow-hidden rounded-lg border bg-muted`}>
        {value ? (
          <>
            <img src={value} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onChange(null)}
              className="absolute right-1 top-1 rounded-full bg-background/80 p-1 hover:bg-background"
              aria-label="Remove"
            >
              <X className="h-3 w-3" />
            </button>
          </>
        ) : (
          <ImageIcon className="h-6 w-6 text-muted-foreground" />
        )}
      </div>
      <div className="flex flex-col gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
        />
        <Button type="button" size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={busy}>
          <Upload className="mr-2 h-3.5 w-3.5" />
          {busy ? "Uploading…" : value ? "Replace" : "Upload"}
        </Button>
        <p className="text-[10px] text-muted-foreground">PNG/JPG up to 5MB</p>
      </div>
    </div>
  );
}
