import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShoppingCart } from "lucide-react";
import { getCart } from "@/lib/cart";

export function CartBadge({ floating = false }: { floating?: boolean }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const update = () => setCount(getCart().reduce((s, i) => s + i.qty, 0));
    update();
    window.addEventListener("cart-updated", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("cart-updated", update);
      window.removeEventListener("storage", update);
    };
  }, []);

  if (floating) {
    return (
      <Link
        to="/shop/cart"
        className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/40 transition-transform hover:scale-105 active:scale-95"
        style={{ marginBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Cart"
      >
        <ShoppingCart className="h-6 w-6" />
        {count > 0 && (
          <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-destructive px-1.5 text-xs font-bold text-destructive-foreground ring-2 ring-background">
            {count}
          </span>
        )}
      </Link>
    );
  }

  return (
    <Link
      to="/shop/cart"
      className="relative inline-flex h-9 items-center gap-2 rounded-md border bg-background px-3 text-sm font-medium hover:bg-accent"
    >
      <ShoppingCart className="h-4 w-4" />
      <span className="hidden sm:inline">Cart</span>
      {count > 0 && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">
          {count}
        </span>
      )}
    </Link>
  );
}
