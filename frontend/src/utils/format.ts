export function formatMoney(n: number | undefined | null): string {
  const v = n ?? 0;
  return "₹" + v.toLocaleString("en-IN");
}

export function formatMoneyShort(n: number | undefined | null): string {
  const v = n ?? 0;
  if (v >= 10000000) return "₹" + (v / 10000000).toFixed(2) + "Cr";
  if (v >= 100000) return "₹" + (v / 100000).toFixed(2) + "L";
  if (v >= 1000) return "₹" + (v / 1000).toFixed(1) + "K";
  return "₹" + v.toLocaleString("en-IN");
}

export function formatDate(iso: string | undefined | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function fromNow(iso: string | undefined | null): string {
  if (!iso) return "";
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(iso);
}
