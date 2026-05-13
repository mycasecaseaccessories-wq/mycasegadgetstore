const KEY = "shop_wishlist";

function read(): string[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { return []; }
}
function write(ids: string[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(ids));
  window.dispatchEvent(new Event("wishlist-updated"));
}

export const getWishlist = () => read();
export const isWished = (id: string) => read().includes(id);
export function toggleWish(id: string) {
  const ids = read();
  const idx = ids.indexOf(id);
  if (idx >= 0) ids.splice(idx, 1);
  else ids.push(id);
  write(ids);
  return ids.includes(id);
}
export function removeWish(id: string) {
  write(read().filter(x => x !== id));
}
