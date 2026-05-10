import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "mm";

const dict = {
  en: {
    "nav.dashboard": "Dashboard",
    "nav.rates": "Rates & Calc",
    "nav.products": "Products",
    "nav.calculator": "Calculator",
    "nav.orders": "Orders",
    "nav.vouchers": "Vouchers",
    "nav.customers": "Customers",
    "nav.reports": "Reports",
    "nav.analytics": "Analytics",
    "nav.exports": "Exports",
    "nav.content": "Content",
    "nav.inventory": "Inventory",
    "nav.bulkVariants": "Bulk Variants",
    "nav.settings": "Settings",
    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.search": "Search",
    "common.add": "Add",
    "common.edit": "Edit",
    "common.delete": "Delete",
    "common.loading": "Loading…",
    "common.empty": "No data",
    "common.signOut": "Sign out",
    "common.language": "Language",
    "common.english": "English",
    "common.myanmar": "မြန်မာ",
  },
  mm: {
    "nav.dashboard": "မူလစာမျက်နှာ",
    "nav.rates": "Rate နှင့် တွက်ချက်ရန်",
    "nav.products": "ပစ္စည်းများ",
    "nav.calculator": "စျေးတွက်စက်",
    "nav.orders": "အော်ဒါများ",
    "nav.vouchers": "ဘောက်ချာများ",
    "nav.customers": "ဖောက်သည်များ",
    "nav.reports": "အစီရင်ခံစာ",
    "nav.analytics": "Analytics",
    "nav.exports": "ထုတ်ယူရန်",
    "nav.content": "မှတ်စုများ",
    "nav.inventory": "လက်ကျန်",
    "nav.bulkVariants": "Variant အစုလိုက်",
    "nav.settings": "ဆက်တင်",
    "common.save": "သိမ်းမည်",
    "common.cancel": "ပယ်ဖျက်",
    "common.search": "ရှာရန်",
    "common.add": "ထည့်မည်",
    "common.edit": "ပြင်ရန်",
    "common.delete": "ဖျက်မည်",
    "common.loading": "ဖွင့်နေသည်…",
    "common.empty": "အချက်အလက် မရှိ",
    "common.signOut": "ထွက်မည်",
    "common.language": "ဘာသာစကား",
    "common.english": "English",
    "common.myanmar": "မြန်မာ",
  },
} as const;

type Key = keyof typeof dict.en;

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: (k: Key) => string }>({
  lang: "en",
  setLang: () => {},
  t: (k) => k as string,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const saved = (typeof window !== "undefined" && localStorage.getItem("lang")) as Lang | null;
    if (saved === "en" || saved === "mm") setLangState(saved);
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") localStorage.setItem("lang", l);
  };

  const t = (k: Key) => dict[lang][k] ?? (dict.en[k] as string) ?? (k as string);

  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);
