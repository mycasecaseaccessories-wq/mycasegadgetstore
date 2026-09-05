export type CartItem = {
  id: string;
  product_id: string;
  name: string;
  price: number;
  qty: number;
  image_url: string | null;
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
  const existing = items.find((i) => i.id === item.id);
  if (existing) existing.qty += item.qty;
  else items.push(item);
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
