/**
 * Utility functions for LMR unit conversion (1 LMR = 10^18 units)
 */

const LMR_DECIMALS = 18;
const MULTIPLIER = BigInt(10) ** BigInt(LMR_DECIMALS);

/**
 * Format raw units (10^18) to a human readable LMR string
 */
export function formatLMR(
  units: string | bigint | number,
  decimals = 4,
): string {
  try {
    const bUnits = BigInt(units.toString());
    const integerPart = bUnits / MULTIPLIER;
    const fractionalPart = bUnits % MULTIPLIER;

    let fractionStr = fractionalPart.toString().padStart(LMR_DECIMALS, "0");
    // Trim trailing zeros and limit to requested decimals
    fractionStr = fractionStr.replace(/0+$/, "");
    if (fractionStr.length > decimals) {
      fractionStr = fractionStr.substring(0, decimals);
    }

    if (!fractionStr) return integerPart.toString();
    return `${integerPart}.${fractionStr}`;
  } catch (e) {
    return "0";
  }
}

/**
 * Parse human readable LMR string to raw units (10^18)
 */
export function parseLMR(lmr: string): string {
  try {
    if (!lmr || lmr === ".") return "0";

    const [integerStr, fractionalStr = ""] = lmr.split(".");
    const bInteger = BigInt(integerStr || "0") * MULTIPLIER;

    let bFraction = 0n;
    if (fractionalStr) {
      const paddedFraction = fractionalStr
        .padEnd(LMR_DECIMALS, "0")
        .substring(0, LMR_DECIMALS);
      bFraction = BigInt(paddedFraction);
    }

    return (bInteger + bFraction).toString();
  } catch (e) {
    return "0";
  }
}
