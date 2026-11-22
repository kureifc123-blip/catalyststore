// Shared joki pricing rules — used by the browser calculator AND the server,
// so the price a customer sees is exactly the price the server charges.

export const parseLevels = (text) =>
  String(text || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((lvl, idx, arr) => arr.indexOf(lvl) === idx);

// Inclusive level calculation (Liga 1 → Liga 1 = 1 level, Liga 1 → Liga 3 = 3 levels)
export const calcJokiPrice = (service, { fromLevel, toLevel, qty } = {}) => {
  if (!service) return 0;
  if (service.pricingType === "multiplier") {
    const q = Math.max(1, Math.floor(Number(qty) || 1));
    return q * (Number(service.multiplierPrice) || 0);
  }

  const allLevels = service.allLevels || [];
  const segments = service.segments || [];
  if (!allLevels.length || !fromLevel || !toLevel) return 0;

  const fromIdx = allLevels.indexOf(fromLevel);
  const toIdx = allLevels.indexOf(toLevel);
  if (fromIdx === -1 || toIdx === -1 || toIdx < fromIdx) return 0;

  let total = 0;
  for (let i = fromIdx; i <= toIdx; i++) {
    let stepPrice = 0;
    for (const seg of segments) {
      const segStart = allLevels.indexOf(seg.from);
      const segEnd = allLevels.indexOf(seg.to);
      if (segStart !== -1 && segEnd !== -1 && i >= segStart && i <= segEnd) {
        stepPrice = Number(seg.pricePerStep) || 0;
        break;
      }
    }
    if (stepPrice === 0 && segments.length > 0) {
      stepPrice = Number(segments[0].pricePerStep) || 2000;
    }
    total += stepPrice;
  }
  return total;
};

export const jokiDetail = (service, { fromLevel, toLevel, qty } = {}) =>
  service?.pricingType === "multiplier"
    ? `${Math.max(1, Math.floor(Number(qty) || 1))} ${service.multiplierUnit}`
    : `${fromLevel} ➔ ${toLevel}`;

// Permission keys an approved admin can be granted by the Super Admin.
export const ADMIN_PERMISSIONS = [
  { id: "orders", label: "Kelola Pesanan & Buku Kas" },
  { id: "listings", label: "Jual Akun (Stok, Edit, Hapus)" },
  { id: "pricing", label: "Checkpoint & Skema Tarif" },
  { id: "catalog", label: "Master Game & Jenis Joki" },
  { id: "payments", label: "Rekening & QRIS" },
  { id: "refund", label: "Syarat Refund" },
  { id: "contact", label: "Kontak WhatsApp CS" }
];

// Which permission is needed to change each settings key.
export const SETTING_PERMISSION = {
  games: "catalog",
  models: "catalog",
  services: "pricing",
  payments: "payments",
  contact: "contact",
  refund: "refund",
  accountFields: "listings"
};
