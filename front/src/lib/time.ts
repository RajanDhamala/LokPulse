export const formatRelativeTime = (isoDate?: string | null) => {
  if (!isoDate) return "Updated time unavailable";
  const target = new Date(isoDate);
  if (Number.isNaN(target.getTime())) return "Updated time unavailable";

  const diffMs = target.getTime() - Date.now();
  const absMs = Math.abs(diffMs);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;

  if (absMs < hourMs) {
    const minutes = Math.round(diffMs / minuteMs);
    return rtf.format(minutes || -1, "minute");
  }
  if (absMs < dayMs) {
    const hours = Math.round(diffMs / hourMs);
    return rtf.format(hours, "hour");
  }
  const days = Math.round(diffMs / dayMs);
  return rtf.format(days, "day");
};
