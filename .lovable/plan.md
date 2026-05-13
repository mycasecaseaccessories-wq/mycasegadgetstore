## Scope

Purchase Orders page (`/purchase-orders`) ကို ပိုပြည့်စုံအောင် ပြင်ပေးမယ်၊ May လ data ကို seed လုပ်ပေးမယ်။

## Database changes (migration)

`purchase_order_items` table မှာ column အသစ်တွေ ထပ်ထည့်မယ်:
- `tracking_code` (text) — LEXPU... / LXBTH...
- `thb_price` (numeric) — တစ်ခုချင်း THB ဈေး
- `cargo_status` (text) — `ordered` / `in_transit` / `arrived` (default `ordered`)
- `variant` (text) — Black / Deep Gray / Champion / 17 pro max စသည်
- `unit_cost_ks` (numeric, nullable) — KS direct-input အတွက်

`purchase_orders` table မှာ:
- `currency` (text) — `THB` / `KS` (line items က override လုပ်နိုင်)
- `exchange_rate` (numeric, nullable) — THB→KS conversion rate snapshot

## UI changes — `/purchase-orders`

**New PO Dialog ပြင်ဆင်ချက်:**
- Currency toggle (THB / KS) — default THB
- Exchange rate field (rates table မှ latest auto-fill, manual edit ရ)
- Item row မှာ field အသစ်တွေ:
  - Variant / Color
  - Tracking code
  - **Price input — THB ဖြစ်ဖြစ် KS ဖြစ်ဖြစ်