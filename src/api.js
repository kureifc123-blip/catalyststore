// Small API client. The session token lives only in memory on purpose:
// refreshing the page or opening the site on another device always starts
// from the login screen, and all data is then loaded from the server.

let token = null;

export const setToken = (t) => {
  token = t || null;
};

export const hasToken = () => Boolean(token);

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export const api = async (path, { method = "GET", body } = {}) => {
  const res = await fetch(path, {
    method,
    headers: {
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  if (!res.ok) throw new ApiError(data.error || "Terjadi kesalahan. Coba lagi.", res.status);
  return data;
};

// Read a picked file, upload it to storage and return its URL.
export const uploadImage = (file) =>
  new Promise((resolve, reject) => {
    if (!file) return reject(new ApiError("Tidak ada file dipilih.", 400));
    if (file.size > 5 * 1024 * 1024) return reject(new ApiError("Ukuran gambar maksimal 5 MB.", 413));
    const reader = new FileReader();
    reader.onerror = () => reject(new ApiError("Gagal membaca gambar.", 400));
    reader.onload = async (e) => {
      try {
        const { url } = await api("/api/upload", { method: "POST", body: { dataUrl: e.target.result } });
        resolve(url);
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsDataURL(file);
  });

const fmt = (d) =>
  d ? new Date(d).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "";

// Shape server orders the way the UI expects.
export const normalizeOrder = (o) => ({
  ...o,
  createdAtTimestamp: o.createdAt ? Date.parse(o.createdAt) : null,
  createdAt: fmt(o.createdAt),
  refundRequestedAt: fmt(o.refundRequestedAt)
});

export const normalizeListing = (l) => ({
  ...l,
  images: Array.isArray(l.images) && l.images.length ? l.images : l.image ? [l.image] : [],
  isSold: Number(l.stock) <= 0
});

export const formatDate = fmt;

// wa.me link for an Indonesian number (08xx → 628xx).
export const waLink = (number, message = "") => {
  let clean = String(number || "").replace(/[^0-9]/g, "");
  if (clean.startsWith("0")) clean = "62" + clean.slice(1);
  if (!clean) return "";
  return `https://wa.me/${clean}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
};
