import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const DEFAULT_CURRENCY_SYMBOL = "OMR";
const DEFAULT_CURRENCY_DECIMALS = 3;

let currencySymbol = DEFAULT_CURRENCY_SYMBOL;
let currencyDecimals = DEFAULT_CURRENCY_DECIMALS;

export function setCurrencyFormat(symbol: string, decimals = DEFAULT_CURRENCY_DECIMALS) {
  const trimmed = symbol.trim();
  currencySymbol = trimmed || DEFAULT_CURRENCY_SYMBOL;
  currencyDecimals = decimals;
}

export function getCurrencyFormat() {
  return { symbol: currencySymbol, decimals: currencyDecimals };
}

export function formatCurrency(amount: number, currency = "OMR"): string {
  return new Intl.NumberFormat("ar-OM", {
    style: "currency",
    currency,
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(amount);
}

export function formatMoney(amount: number, symbol = currencySymbol): string {
  return `${amount.toFixed(currencyDecimals)} ${symbol}`;
}

/** Formats amounts using the app currency (Omani Rial by default). */
export function formatJOD(amount: number): string {
  return formatMoney(amount);
}

export function formatTime(isoString: string): string {
  return new Intl.DateTimeFormat("en-SA", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(isoString));
}

export function formatDate(isoString: string): string {
  return new Intl.DateTimeFormat("en-SA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(isoString));
}

export function formatDateTime(isoString: string): string {
  return new Intl.DateTimeFormat("en-SA", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(isoString));
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}
