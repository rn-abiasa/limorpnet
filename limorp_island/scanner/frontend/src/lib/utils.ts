import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrecision(
  amount: string | number | bigint,
  decimals: number = 18,
): string {
  if (!amount) return "0";
  try {
    const valStr = amount.toString();
    const isNegative = valStr.startsWith("-");
    const absoluteVal = isNegative ? valStr.slice(1) : valStr;

    // Ensure we have enough length for decimals
    const padded = absoluteVal.padStart(decimals + 1, "0");
    const wholePart = padded.slice(0, padded.length - decimals);
    const fractionalPart = padded.slice(padded.length - decimals);

    // Trim trailing zeros from fractional part
    const trimmedFractional = fractionalPart.replace(/0+$/, "");

    let result = isNegative ? "-" : "";
    result += wholePart;

    if (trimmedFractional.length > 0) {
      result += "." + trimmedFractional;
    }

    return result;
  } catch (e) {
    return "0";
  }
}

export function formatLMR(
  amount: string | number | bigint,
  displayDecimals: number = 4,
): string {
  const full = formatPrecision(amount, 18);
  if (full === "0") return "0";

  const [whole, fractional] = full.split(".");
  if (!fractional) return whole;

  const limitedFractional = fractional.slice(0, displayDecimals);
  if (!limitedFractional) return whole;

  return `${whole}.${limitedFractional}`;
}

export function truncateAddress(address: string, length: number = 6): string {
  if (!address) return "...";
  if (address.length <= length * 2 + 2) return address;
  return `${address.slice(0, length + 2)}...${address.slice(-length)}`;
}
