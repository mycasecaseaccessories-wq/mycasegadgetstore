// Phase 7 — Centralized query keys for consistent cache invalidation.
// Additive: existing pages keep their own keys; new code can opt in.
export const qk = {
  products: (filters?: Record<string, unknown>) => ["products", filters ?? {}] as const,
  product: (id: string) => ["product", id] as const,
  orders: (filters?: Record<string, unknown>) => ["orders", filters ?? {}] as const,
  order: (id: string) => ["order", id] as const,
  vouchers: (filters?: Record<string, unknown>) => ["vouchers", filters ?? {}] as const,
  customers: (filters?: Record<string, unknown>) => ["customers", filters ?? {}] as const,
  customer: (id: string) => ["customer", id] as const,
  inventory: () => ["inventory"] as const,
  suppliers: () => ["suppliers"] as const,
  purchaseOrders: (filters?: Record<string, unknown>) => ["purchase-orders", filters ?? {}] as const,
  expenses: (filters?: Record<string, unknown>) => ["expenses", filters ?? {}] as const,
  activity: (filters?: Record<string, unknown>) => ["activity-logs", filters ?? {}] as const,
  settings: () => ["settings"] as const,
  rates: () => ["rates"] as const,
  roles: (userId?: string) => ["roles", userId] as const,
};
