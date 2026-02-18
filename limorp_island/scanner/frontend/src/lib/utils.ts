import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatLMR(
  amount: string | number | bigint,
  decimals: number = 2,
): string {
  if (!amount) return "0";

  try {
    const val = BigInt(amount);
    const divisor = 1_000_000_000_000_000_000n; // 18 decimals

    // Convert to number for easy display (precision loss is acceptable for display)
    const formatted = Number(val) / Number(divisor);

    return formatted.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals,
    });
  } catch (e) {
    return "0";
  }
}

export function truncateAddress(address: string, length: number = 6): string {
  if (!address) return "...";
  if (address.length <= length * 2 + 2) return address;
  return `${address.slice(0, length + 2)}...${address.slice(-length)}`;
}
