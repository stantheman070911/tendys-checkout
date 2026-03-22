const ORDER_NUMBER_PATTERN = /ORD-\d{8}-\d{3}/i;

export function extractOrderNumber(text: string): string | null {
  const match = text.trim().toUpperCase().match(ORDER_NUMBER_PATTERN);
  return match ? match[0] : null;
}
