import { statusTone } from "../format";

export function Chip({ status, overdue = false }: { status: string; overdue?: boolean }) {
  const tone = statusTone(status, overdue);
  const label = overdue ? `${status} · overdue` : status;
  return <span className={`chip ${tone === "neutral" ? "" : tone}`}>{label}</span>;
}
