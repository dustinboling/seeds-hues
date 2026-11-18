import type { PacketSize } from "@/lib/validators";

/** Packet sizes the farm offers — label and seed count only. Prices are never shown (R1). */
export function PacketList({ packets }: { packets: PacketSize[] }) {
  if (packets.length === 0) return null;
  return (
    <p className="text-sm text-muted">
      <span className="font-semibold text-ink">Packets: </span>
      {packets
        .map((p) => (p.seedCount !== null && !p.label.includes(String(p.seedCount)) ? `${p.label} (${p.seedCount} seeds)` : p.label))
        .join(" · ")}
    </p>
  );
}
