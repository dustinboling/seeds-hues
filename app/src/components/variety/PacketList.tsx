import type { ApiPacketSize } from "../../data/types";

/** Packet sizes the farm offers — label and seed count only. Prices are never shown (R1). */
export function PacketList({ packets }: { packets: ApiPacketSize[] }) {
  if (packets.length === 0) return null;
  return (
    <p className="listing-packets">
      <span className="listing-packets-label">Packets: </span>
      {packets
        .map((p) => (p.seedCount !== null && !p.label.includes(String(p.seedCount)) ? `${p.label} (${p.seedCount} seeds)` : p.label))
        .join(" · ")}
    </p>
  );
}
