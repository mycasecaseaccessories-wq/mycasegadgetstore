import { useRef, useState } from "react";
import { Image as ImageIcon, Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StorageImage } from "@/components/StorageImage";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Props = {
  value?: string[] | null;
  onChange: (urls: string[]) => void;
  bucket?: "product-images" | "branding";
  folder?: string;
  label?: string;
  hint?: string;
};

export function MultiImageUpload({
  value = [],
  onChange,
  bucket = "product-images",
  folder = "",
  label = "Photos",
  hint = "PNG/JPG/WebP up to 5MB each",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const images = value ?? [];

  const upload = async (files: File[]) => {
    const accepted = files.filter((file) => file.type.startsWith("image/") && file.size <= 5 * 1024 * 1024);
    if (accepted.length !== files.length) toast.error("Only images up to 5MB each are allowed");
    if (!accepted.length) return;
    setBusy(true);
    try {
      const uploaded: string[] = [];
      for (const file of accepted) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${folder ? `${folder}/` : ""}${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error } = await supabase.storage.from(bucket).upload(path, file, { cacheControl: "3600", upsert: false });
        if (error) throw error;
        uploaded.push(supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl);
      }
      onChange([...images, ...uploaded]);
      toast.success(`${uploaded.length} photo${uploaded.length > 1 ? "s" : ""} uploaded`);
    } catch (error: any) {
      toast.error(error?.message ?? "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const remove = (index: number) => onChange(images.filter((_, itemIndex) => itemIndex !== index));

  return (
    <div className="space-y-2 rounded-lg border border-dashed p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-[11px] text-muted-foreground">{hint}</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            if (files.length) void upload(files);
            event.target.value = "";
          }}
        />
        <Button type="button" size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={busy}>
          {busy ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-2 h-3.5 w-3.5" />}
          {busy ? "Uploading…" : "Add photos"}
        </Button>
      </div>
      {images.length === 0 ? (
        <div className="flex h-20 items-center justify-center gap-2 rounded-md bg-muted/40 text-xs text-muted-foreground">
          <ImageIcon className="h-4 w-4" /> No photos added
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {images.map((url, index) => (
            <div key={`${url}-${index}`} className="relative aspect-square overflow-hidden rounded-md border bg-muted">
              <StorageImage src={url} alt={`${label} ${index + 1}`} className="h-full w-full object-cover" fallback={<ImageIcon className="m-auto h-5 w-5 text-muted-foreground" />} />
              <button type="button" onClick={() => remove(index)} className="absolute right-1 top-1 rounded-full bg-background/90 p-1" aria-label={`Remove ${label} ${index + 1}`}>
                <X className="h-3 w-3" />
              </button>
              {index === 0 && <span className="absolute bottom-0 left-0 right-0 bg-background/80 px-1 py-0.5 text-center text-[9px]">Cover</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
