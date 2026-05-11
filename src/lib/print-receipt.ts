// Phase 13 — Thermal 80mm receipt printer. Opens a clean popup with print dialog.
import { formatKS } from "@/lib/format";

interface ReceiptItem { product_name: string; unit_price: number; quantity: number; }
interface ReceiptData {
  voucher_no: number | string;
  business_name?: string | null;
  logo_url?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  items: ReceiptItem[];
  subtotal: number;
  discount: number;
  extra_fee: number;
  total: number;
  paid: number;
  payment_method?: string | null;
  note?: string | null;
  issued_at: string;
  footer?: string;
}

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

export function printThermalReceipt(d: ReceiptData) {
  const w = window.open("", "_blank", "width=420,height=720");
  if (!w) return;
  const itemsHtml = d.items
    .map(
      (i) => `
      <tr>
        <td colspan="3" class="name">${esc(i.product_name)}</td>
      </tr>
      <tr>
        <td class="qty">${i.quantity} ×</td>
        <td class="unit">${esc(formatKS(i.unit_price))}</td>
        <td class="lt">${esc(formatKS(i.unit_price * i.quantity))}</td>
      </tr>`
    )
    .join("");
  const due = d.total - d.paid;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Receipt #${d.voucher_no}</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  html, body { margin: 0; padding: 0; }
  body { font-family: ui-monospace, "SF Mono", "Courier New", monospace; font-size: 11px; color: #000; background: #fff; padding: 4mm 3mm; width: 74mm; }
  .center { text-align: center; }
  .right { text-align: right; }
  h1 { font-size: 14px; margin: 0 0 2px; }
  .muted { color: #444; font-size: 10px; }
  hr { border: 0; border-top: 1px dashed #000; margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 1px 0; vertical-align: top; }
  .name { font-weight: 600; padding-top: 4px; }
  .qty { width: 28%; }
  .unit { width: 32%; }
  .lt { text-align: right; }
  .totals td { padding: 1px 0; }
  .totals .label { color: #333; }
  .totals .val { text-align: right; }
  .total-row td { font-weight: 700; font-size: 13px; border-top: 1px solid #000; padding-top: 4px; }
  img.logo { max-width: 40mm; max-height: 18mm; margin: 0 auto 4px; display: block; }
  .footer { margin-top: 8px; font-size: 10px; text-align: center; }
</style></head><body>
  ${d.logo_url ? `<img class="logo" src="${esc(d.logo_url)}" />` : ""}
  <h1 class="center">${esc(d.business_name || "Receipt")}</h1>
  <div class="center muted">Voucher #${esc(d.voucher_no)}</div>
  <div class="center muted">${esc(new Date(d.issued_at).toLocaleString())}</div>
  <hr/>
  ${d.customer_name ? `<div><b>To:</b> ${esc(d.customer_name)}</div>` : ""}
  ${d.customer_phone ? `<div class="muted">${esc(d.customer_phone)}</div>` : ""}
  <hr/>
  <table>${itemsHtml || `<tr><td class="center muted">No items</td></tr>`}</table>
  <hr/>
  <table class="totals">
    <tr><td class="label">Subtotal</td><td class="val">${esc(formatKS(d.subtotal))}</td></tr>
    ${d.discount ? `<tr><td class="label">Discount</td><td class="val">- ${esc(formatKS(d.discount))}</td></tr>` : ""}
    ${d.extra_fee ? `<tr><td class="label">Extra</td><td class="val">+ ${esc(formatKS(d.extra_fee))}</td></tr>` : ""}
    <tr class="total-row"><td>TOTAL</td><td class="val">${esc(formatKS(d.total))}</td></tr>
    <tr><td class="label">Paid${d.payment_method ? ` (${esc(d.payment_method)})` : ""}</td><td class="val">${esc(formatKS(d.paid))}</td></tr>
    <tr><td class="label">${due > 0 ? "Due" : "Change"}</td><td class="val"><b>${esc(formatKS(Math.abs(due)))}</b></td></tr>
  </table>
  ${d.note ? `<hr/><div class="muted">${esc(d.note)}</div>` : ""}
  <div class="footer">${esc(d.footer || "Thank you!")}</div>
  <script>window.onload = () => { setTimeout(() => { window.print(); }, 100); };</script>
</body></html>`;
  w.document.open();
  w.document.write(html);
  w.document.close();
}
