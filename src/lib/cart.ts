export type CartItem = {
  id: string;
  product_id: string;
  variant_id?: string | null;
  name: string;
  price: number;
  qty: number;
  image_url: string | null;
  fulfillment_type?: "IN_STOCK" | "PREORDER";
  estimated_arrival?: string | null;
  deposit_required?: number;
};

const KEY = "shop_cart";

function read(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}
function write(items: CartItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("cart-updated"));
}

export const getCart = () => read();

export function addToCart(item: CartItem) {
  const items = read();
  // Keep in-stock and pre-order quantities as separate cart lines so a later
  // stock change cannot silently convert an existing line into a preorder.
  const cartId = item.id + ":" + (item.fulfillment_type ?? "IN_STOCK");
  const existing = items.find((i) => i.id === cartId);
  if (existing) existing.qty += item.qty;
  else items.push({ ...item, id: cartId });
  write(items);
}

export function updateQty(id: string, qty: number) {
  const items = read()
    .map((i) => (i.id === id ? { ...i, qty } : i))
    .filter((i) => i.qty > 0);
  write(items);
}

export function removeFromCart(id: string) {
  write(read().filter((i) => i.id !== id));
}

export function clearCart() {
  write([]);
}

export const cartTotal = (items: CartItem[]) => items.reduce((s, i) => s + i.price * i.qty, 0);
