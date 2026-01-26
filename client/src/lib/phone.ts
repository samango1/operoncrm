const COUNTRY_CODE = '998';
const LOCAL_LENGTH = 9;

export const extractLocalPhoneDigits = (raw: string): string => {
  const digits = raw.replace(/\D/g, '');
  const local = digits.startsWith(COUNTRY_CODE) ? digits.slice(COUNTRY_CODE.length) : digits;
  return local.slice(0, LOCAL_LENGTH);
};

export const formatLocalPhone = (raw: string): string => {
  const digits = extractLocalPhoneDigits(raw);
  if (!digits) return '';

  const parts: string[] = [];
  if (digits.length >= 1) parts.push(digits.slice(0, 2));
  if (digits.length >= 3) parts.push(digits.slice(2, 5));
  if (digits.length >= 6) parts.push(digits.slice(5, 7));
  if (digits.length >= 8) parts.push(digits.slice(7, 9));

  return parts.join(' ');
};

export const toFullPhoneNumber = (raw: string): string => {
  const local = extractLocalPhoneDigits(raw);
  return `${COUNTRY_CODE}${local}`;
};

export const isLocalPhoneComplete = (raw: string): boolean => extractLocalPhoneDigits(raw).length === LOCAL_LENGTH;

export const formatPhoneDisplay = (raw: string): string => {
  const formatted = formatLocalPhone(raw);
  return formatted ? `+${COUNTRY_CODE} ${formatted}` : '';
};
