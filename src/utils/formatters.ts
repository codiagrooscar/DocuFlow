/**
 * Formats a number as a currency string using German (de-DE) locale
 * to ensure consistent thousands separator (dot) even for 4-digit numbers.
 */
export const formatCurrency = (amount: number | string | undefined | null, currency: string = 'EUR'): string => {
  if (amount === undefined || amount === null || amount === '') return '-';
  
  const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(numericAmount)) return '-';
  
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true
  }).format(numericAmount);
};
