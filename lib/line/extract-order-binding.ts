import { extractOrderNumber } from "./extract-order-number";

const PHONE_LAST3_PATTERN = /\b\d{3}\b/g;

export interface ExtractedOrderBinding {
  orderNumber: string;
  recipientName: string;
  phoneLast3: string;
}

export function extractOrderBinding(
  text: string,
): ExtractedOrderBinding | null {
  const normalizedText = text.trim();
  const orderNumbers = normalizedText.match(/ORD-\d{8}-\d{3}/gi) ?? [];

  if (orderNumbers.length !== 1) {
    return null;
  }

  const orderNumber = extractOrderNumber(orderNumbers[0]);
  if (!orderNumber) {
    return null;
  }

  const withoutOrderNumber = normalizedText.replace(orderNumbers[0], " ");
  const phoneMatches = withoutOrderNumber.match(PHONE_LAST3_PATTERN) ?? [];
  if (phoneMatches.length !== 1) {
    return null;
  }

  const phoneLast3 = phoneMatches[0];
  const recipientName = withoutOrderNumber
    .replace(phoneLast3, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!recipientName) {
    return null;
  }

  return {
    orderNumber,
    recipientName,
    phoneLast3,
  };
}
