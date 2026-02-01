export const TASHKENT_TIMEZONE = 'Asia/Tashkent';

const DEFAULT_TIME = '00:00';

const DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: TASHKENT_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const TIME_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  timeZone: TASHKENT_TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

export const getTashkentDate = (value: Date): string => DATE_FORMATTER.format(value);

export const getTashkentTime = (value: Date): string => TIME_FORMATTER.format(value);

export const getTashkentNowParts = (): { date: string; time: string } => {
  const now = new Date();
  return {
    date: getTashkentDate(now),
    time: getTashkentTime(now),
  };
};

export const splitDateTimeToTashkent = (value?: string | null): { date: string; time: string } => {
  if (!value) return getTashkentNowParts();

  if (!value.includes('T')) {
    return {
      date: value.slice(0, 10),
      time: DEFAULT_TIME,
    };
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return getTashkentNowParts();

  return {
    date: getTashkentDate(parsed),
    time: getTashkentTime(parsed),
  };
};

export const buildTashkentDateTime = (date: string, time: string): string => {
  const safeDate = (date ?? '').slice(0, 10);
  const safeTime = (time ?? '').slice(0, 5) || DEFAULT_TIME;

  if (!safeDate) return '';

  return `${safeDate}T${safeTime}:00+05:00`;
};
