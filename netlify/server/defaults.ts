// Default store settings — used the first time the store runs, before any admin
// has saved their own configuration.

export const DEFAULT_SETTINGS: Record<string, any> = {
  games: [
    {
      id: "g_spike",
      name: "The Spike",
      icon: "https://images.unsplash.com/photo-1618042164219-62c820f10723?w=200&auto=format&fit=crop"
    },
    {
      id: "g_mlbb",
      name: "Mobile Legends",
      icon: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=200&auto=format&fit=crop"
    }
  ],
  models: [
    { id: "m_spike_liga", gameId: "g_spike", gameName: "The Spike", name: "LIGA" },
    { id: "m_mlbb_rank", gameId: "g_mlbb", gameName: "Mobile Legends", name: "Rank Match" }
  ],
  services: [
    {
      id: "srv_g_spike_m_spike_liga",
      gameId: "g_spike",
      gameName: "The Spike",
      modelId: "m_spike_liga",
      modelName: "LIGA",
      pricingType: "tiers",
      allLevels: ["Liga 1", "Liga 2", "Liga 3", "Liga 4", "Liga 5", "Liga 6", "Liga 7", "Liga 8", "Liga 9", "Liga 10"],
      segments: [
        { from: "Liga 1", to: "Liga 5", pricePerStep: 2000 },
        { from: "Liga 5", to: "Liga 10", pricePerStep: 3000 }
      ],
      multiplierUnit: "Game",
      multiplierPrice: 2000
    }
  ],
  payments: [
    {
      id: "pay_qris",
      name: "QRIS All Payment",
      accountNumber: "NMID: ID1020030040506",
      accountHolder: "CATALYST STORE OFFICIAL",
      hasImage: true,
      image:
        "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=00020101021126580016ID.CO.QRIS.WWW01189360091100200300405204581253033605802ID5916CATALYST+STORE6007JAKARTA630489AB"
    },
    {
      id: "pay_bca",
      name: "Bank BCA",
      accountNumber: "8831293812",
      accountHolder: "CATALYST STORE",
      hasImage: false,
      image: ""
    },
    {
      id: "pay_dana",
      name: "DANA",
      accountNumber: "085705606574",
      accountHolder: "ADMIN CATALYST",
      hasImage: false,
      image: ""
    }
  ],
  contact: {
    whatsapp: "085705606574",
    csName: "Admin CATALYST STORE Official",
    operationalHours: "24 Jam Non-Stop"
  },
  refund: {
    policyNote: "Pengembalian dana diproses maksimal 1x24 jam kerja setelah disetujui admin.",
    requireReason: true,
    requireBankName: true,
    requireAccountNumber: true,
    requireAccountHolder: true,
    requireAlternativeContact: true,
    requireEvidenceImage: false
  },
  accountFields: [
    { id: "rank", label: "Rank Akun", type: "text", placeholder: "Contoh: Mythic / Challenger", enabled: true },
    { id: "heroCount", label: "Jumlah Hero", type: "number", placeholder: "Contoh: 110", enabled: true },
    { id: "skinCount", label: "Jumlah Skin", type: "number", placeholder: "Contoh: 240", enabled: true },
    { id: "winRate", label: "Win Rate (%)", type: "text", placeholder: "Contoh: 65%", enabled: true },
    { id: "bindType", label: "Tipe Login / Bind", type: "text", placeholder: "Contoh: All Unbind Bersih", enabled: true }
  ]
};
