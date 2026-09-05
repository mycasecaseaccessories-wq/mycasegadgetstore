// Phase 14 — Customer messaging deep-links (SMS / Viber / Telegram / WhatsApp / Copy).
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Share2, MessageSquare, Send, Phone, Copy, MessageCircle } from "lucide-react";
import { formatKS } from "@/lib/format";
import { toast } from "sonner";

interface ShareData {
  voucher_no: number | string;
  business_name?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  total: number;
  paid: number;
  issued_at: string;
}

function buildMessage(d: ShareData): string {
  const due = d.total - d.paid;
  const lines = [
    `${d.business_name || "Receipt"} — Voucher #${d.voucher_no}`,
    d.customer_name ? `To: ${d.customer_name}` : "",
    `Date: ${new Date(d.issued_at).toLocaleDateString()}`,
    "",
    `Total: ${formatKS(d.total)}`,
    `Paid:  ${formatKS(d.paid)}`,
    due > 0 ? `Due:   ${formatKS(due)}` : `Change: ${formatKS(Math.abs(due))}`,
    "",
    "Thank you!",
  ].filter(Boolean);
  return lines.join("\n");
}

const cleanPhone = (p?: string | null) => (p || "").replace(/[^\d+]/g, "");

export function ShareVoucherMenu({ data }: { data: ShareData }) {
  const message = buildMessage(data);
  const encoded = encodeURIComponent(message);
  const phone = cleanPhone(data.customer_phone);

  const open = (url: string) => window.open(url, "_blank", "noopener,noreferrer");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Copy failed");
    }
  };

  const nativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: `Voucher #${data.voucher_no}`, text: message });
      } catch {
        /* cancelled */
      }
    } else {
      copy();
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <Share2 className="mr-2 h-4 w-4" />
          Send to customer
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          {phone ? `To ${phone}` : "No phone — message will copy"}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => open(`sms:${phone}?body=${encoded}`)} disabled={!phone}>
          <Phone className="mr-2 h-4 w-4" /> SMS
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => open(`https://wa.me/${phone.replace(/^\+/, "")}?text=${encoded}`)}
          disabled={!phone}
        >
          <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => open(`viber://forward?text=${encoded}`)}>
          <MessageSquare className="mr-2 h-4 w-4" /> Viber
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() =>
            open(`https://t.me/share/url?url=${encodeURIComponent(" ")}&text=${encoded}`)
          }
        >
          <Send className="mr-2 h-4 w-4" /> Telegram
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={copy}>
          <Copy className="mr-2 h-4 w-4" /> Copy text
        </DropdownMenuItem>
        <DropdownMenuItem onClick={nativeShare}>
          <Share2 className="mr-2 h-4 w-4" /> System share…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
