export const DEFAULT_BRANDS = [
  "Apple",
  "Anker",
  "Baseus",
  "Belkin",
  "ESR",
  "Nomad",
  "Spigen",
  "UGREEN",
];

export const DEFAULT_CATEGORIES = [
  "Cases",
  "Screen Protectors",
  "Charging & Power",
  "Cables",
  "MagSafe",
  "Audio",
  "Stands & Mounts",
  "Bags & Carry",
  "Smart Gadgets",
  "Accessories",
];

export const DEFAULT_COLORS = [
  "Black",
  "White",
  "Clear",
  "Silver",
  "Gold",
  "Grey",
  "Blue",
  "Green",
  "Red",
  "Pink",
  "Purple",
  "Brown",
];

export const DEFAULT_MODELS = [
  "Air",
  "iPhone 11",
  "iPhone 12",
  "iPhone 13",
  "iPhone 14",
  "iPhone 15",
  "iPhone 16",
  "iPhone 17",
  "17 Pro",
  "17 Pro Max",
  "iPad",
  "MacBook",
  "Apple Watch",
  "AirPods",
];

export function uniqueOptions(...groups: Array<Array<string | null | undefined>>) {
  return Array.from(
    new Set(
      groups
        .flat()
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  );
}

export const CUSTOM_OPTION = "__custom__";

export function isPresetOption(value: string | null | undefined, options: string[]) {
  return Boolean(value && options.includes(value));
}

export function selectValue(value: string | null | undefined, options: string[]) {
  return isPresetOption(value, options) ? value! : value ? CUSTOM_OPTION : "";
}

export function optionLabel(value: string | null | undefined, options: string[]) {
  return value && isPresetOption(value, options) ? value : "Custom";
}
