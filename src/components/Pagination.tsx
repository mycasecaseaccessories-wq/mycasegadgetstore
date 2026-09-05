// Phase 7 — Reusable pagination control. Drop-in for any list page.
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  page: number; // 0-indexed
  totalPages: number;
  total?: number;
  onChange: (page: number) => void;
  className?: string;
}

export function Pagination({ page, totalPages, total, onChange, className = "" }: Props) {
  return (
    <div
      className={`flex items-center justify-between gap-2 text-xs text-muted-foreground ${className}`}
    >
      <span>
        Page {page + 1} / {totalPages}
        {total != null && <> · {total.toLocaleString()} total</>}
      </span>
      <div className="flex gap-1">
        <Button
          size="sm"
          variant="outline"
          disabled={page === 0}
          onClick={() => onChange(Math.max(0, page - 1))}
        >
          <ChevronLeft className="h-3 w-3" /> Prev
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={page + 1 >= totalPages}
          onClick={() => onChange(page + 1)}
        >
          Next <ChevronRight className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
