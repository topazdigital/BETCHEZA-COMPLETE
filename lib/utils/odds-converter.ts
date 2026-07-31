import type { OddsFormat } from '../types';

/**
 * Convert decimal odds to fractional format
 */
export function decimalToFractional(decimal: number): string {
  const numerator = decimal - 1;
  
  // Find the best fraction approximation
  const tolerance = 0.0001;
  let bestNumerator = 1;
  let bestDenominator = 1;
  let bestError = Math.abs(numerator - 1);
  
  for (let d = 1; d <= 100; d++) {
    const n = Math.round(numerator * d);
    const error = Math.abs(numerator - n / d);
    if (error < bestError) {
      bestError = error;
      bestNumerator = n;
      bestDenominator = d;
    }
    if (error < tolerance) break;
  }
  
  // Simplify the fraction
  const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
  const divisor = gcd(bestNumerator, bestDenominator);
  
  return `${bestNumerator / divisor}/${bestDenominator / divisor}`;
}

/**
 * Convert decimal odds to American format
 */
export function decimalToAmerican(decimal: number): string {
  if (decimal >= 2) {
    // Positive odds
    const american = Math.round((decimal - 1) * 100);
    return `+${american}`;
  } else {
    // Negative odds
    const american = Math.round(-100 / (decimal - 1));
    return `${american}`;
  }
}

/**
 * Convert fractional odds to decimal format
 */
export function fractionalToDecimal(fractional: string): number {
  const parts = fractional.split('/');
  if (parts.length !== 2) return 2.0;
  
  const numerator = parseFloat(parts[0]);
  const denominator = parseFloat(parts[1]);
  
  if (isNaN(numerator) || isNaN(denominator) || denominator === 0) return 2.0;
  
  return (numerator / denominator) + 1;
}

/**
 * Convert American odds to decimal format
 */
export function americanToDecimal(american: number): number {
  if (american > 0) {
    return (american / 100) + 1;
  } else {
    return (100 / Math.abs(american)) + 1;
  }
}

/**
 * Format odds based on user preference
 */
export function formatOdds(decimal: number, format: OddsFormat): string {
  switch (format) {
    case 'fractional':
      return decimalToFractional(decimal);
    case 'american':
      return decimalToAmerican(decimal);
    case 'decimal':
    default:
      return decimal.toFixed(2);
  }
}

/**
 * Calculate implied probability from decimal odds
 */
export function impliedProbability(decimal: number): number {
  return (1 / decimal) * 100;
}

/**
 * Calculate potential payout
 */
export function calculatePayout(stake: number, odds: number): number {
  return stake * odds;
}

/**
 * Calculate profit
 */
export function calculateProfit(stake: number, odds: number): number {
  return stake * (odds - 1);
}
