export const money = (value: number) => new Intl.NumberFormat("en-SG", { style: "currency", currency: "SGD", maximumFractionDigits: 0 }).format(value);
export const number = (value: number) => new Intl.NumberFormat("en-SG", { maximumFractionDigits: 1 }).format(value);
export const label = (value: string) => value.replace(/([a-z])([A-Z])/g, "$1 $2").split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
