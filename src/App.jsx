import { AccountGallery, AccountDescription } from "./AccountDetails.jsx";
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  ShieldCheck,
  Gamepad2,
  Zap,
  ShoppingBag,
  Clock,
  CheckCircle2,
  PlusCircle,
  Trash2,
  Upload,
  Lock,
  LogOut,
  User,
  Phone,
  Mail,
  KeyRound,
  MessageCircle,
  Sliders,
  DollarSign,
  ArrowRight,
  CreditCard,
  Copy,
  AlertCircle,
  Download,
  Eye,
  EyeOff,
  X,
  Maximize2,
  RotateCcw,
  ShoppingCart,
  UserCheck,
  UserX,
  Crown,
  Settings2,
  ReceiptText,
  BadgeCheck,
  Pencil,
  Minus,
  Plus,
  Users,
  RefreshCw
} from "lucide-react";
import { api, setToken, uploadImage, normalizeOrder, normalizeListing, formatDate, waLink } from "./api.js";
import { calcJokiPrice, jokiDetail, parseLevels } from "../shared/pricing.js";

const POLL_MS = 8000;

const EMPTY_CFG = {
  games: [],
  models: [],
  services: [],
  payments: [],
  contact: { whatsapp: "", csName: "", operationalHours: "" },
  refund: {
    policyNote: "",
    requireReason: true,
    requireBankName: true,
    requireAccountNumber: true,
    requireAccountHolder: true,
    requireAlternativeContact: true,
    requireEvidenceImage: false
  },
  accountFields: []
};

const EMPTY_ACC_FORM = {
  gameId: "",
  title: "",
  price: "",
  stock: 1,
  image: "",
  images: [],
  description: "",
  customSpecs: {}
};

const DEFAULT_LEVELS_TEXT = "Liga 1, Liga 2, Liga 3, Liga 4, Liga 5, Liga 6, Liga 7, Liga 8, Liga 9, Liga 10";
const DEFAULT_SEGMENTS = [
  { from: "Liga 1", to: "Liga 5", pricePerStep: 2000 },
  { from: "Liga 5", to: "Liga 10", pricePerStep: 3000 }
];

export default function App() {
  // --- Auth State ---
  const [currentUser, setCurrentUser] = useState(null);
  const [authPortal, setAuthPortal] = useState("customer"); // 'customer' | 'admin'
  const [authMode, setAuthMode] = useState("login"); // 'login' | 'register'
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [hasAdmin, setHasAdmin] = useState(true);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  const [regName, setRegName] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [showRegPassword, setShowRegPassword] = useState(false);

  // --- App Navigation ---
  const [activeTab, setActiveTab] = useState("joki"); // 'joki' | 'accounts' | 'orders' | 'admin'

  // --- Store Data (always loaded from the server) ---
  const [cfg, setCfg] = useState(EMPTY_CFG);
  const cfgRef = useRef(EMPTY_CFG);
  const [listingRows, setListingRows] = useState([]);
  const [orderRows, setOrderRows] = useState([]);
  const [adminOrderRows, setAdminOrderRows] = useState([]);
  const [cartItems, setCartItemsState] = useState([]);
  const cartRef = useRef([]);
  const [staff, setStaff] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [sellerOrders, setSellerOrders] = useState([]);
  const [sellerWaDraft, setSellerWaDraft] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const writesInFlight = useRef(0);

  const masterGames = cfg.games || [];
  const jokiModels = cfg.models || [];
  const jokiServices = cfg.services || [];
  const paymentMethods = cfg.payments || [];
  const adminContact = cfg.contact || EMPTY_CFG.contact;
  const refundConfig = cfg.refund || EMPTY_CFG.refund;
  const accountFieldsConfig = cfg.accountFields || [];
  const accounts = useMemo(() => listingRows.map(normalizeListing), [listingRows]);
  const orders = useMemo(() => orderRows.map(normalizeOrder), [orderRows]);
  const adminOrders = useMemo(() => adminOrderRows.map(normalizeOrder), [adminOrderRows]);

  const isAdmin = currentUser?.role === "admin";
  const can = (perm) => Boolean(isAdmin && (currentUser.isRootAdmin || (currentUser.permissions || []).includes(perm)));
  const isRoot = Boolean(isAdmin && currentUser?.isRootAdmin);
  // Super Admin manages every listing; a regular admin (seller) only their own.
  const canManageListing = (acc) => can("listings") && (isRoot || acc.sellerId === currentUser?.id);
  const myListings = useMemo(
    () => (isRoot ? accounts : accounts.filter((a) => a.sellerId === currentUser?.id)),
    [accounts, isRoot, currentUser?.id]
  );

  // Admin Contact / refund note drafts (saved with a button, not on every keystroke)
  const [contactDraft, setContactDraft] = useState(null);
  const [policyDraft, setPolicyDraft] = useState(null);

  const [newCustomFieldName, setNewCustomFieldName] = useState("");
  const [newCustomFieldType, setNewCustomFieldType] = useState("text");

  // Joki Form state
  const [selectedGameId, setSelectedGameId] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [fromLevel, setFromLevel] = useState("");
  const [toLevel, setToLevel] = useState("");
  const [multiplierQty, setMultiplierQty] = useState(1);

  // Direct Checkout & Payment modal state
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [buyerWhatsapp, setBuyerWhatsapp] = useState("");
  const [activeOrderSnap, setActiveOrder] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentProofImage, setPaymentProofImage] = useState("");
  const [toastMessage, setToastMessage] = useState("");

  // Cart modal state
  const [showCartModal, setShowCartModal] = useState(false);
  const [cartPaymentMethodId, setCartPaymentMethodId] = useState("");
  const [cartBuyerWhatsapp, setCartBuyerWhatsapp] = useState("");

  // Full-screen image preview
  const [previewFullImage, setPreviewFullImage] = useState(null);

  // Refund modal state
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundTargetOrder, setRefundTargetOrder] = useState(null);
  const [refundFormData, setRefundFormData] = useState({
    reason: "",
    bankName: "",
    accountNumber: "",
    accountHolder: "",
    alternativeContact: "",
    evidenceImage: ""
  });

  // Admin Forms: Games & Models
  const [newGameName, setNewGameName] = useState("");
  const [newGameIcon, setNewGameIcon] = useState("");
  const [modelGameId, setModelGameId] = useState("");
  const [newModelName, setNewModelName] = useState("");

  // Admin Forms: Pricing & Checkpoint
  const [editingServiceId, setEditingServiceId] = useState("");
  const [configGameId, setConfigGameId] = useState("");
  const [configModelId, setConfigModelId] = useState("");
  const [configPricingType, setConfigPricingType] = useState("tiers");
  const [configAllLevelsText, setConfigAllLevelsText] = useState(DEFAULT_LEVELS_TEXT);
  const [configMultiplierUnit, setConfigMultiplierUnit] = useState("Game");
  const [configMultiplierPrice, setConfigMultiplierPrice] = useState(1000);
  const [configSegments, setConfigSegments] = useState(DEFAULT_SEGMENTS);
  const pricingFormRef = useRef(null);

  // Admin Forms: Account listing (create / edit)
  const [newAccForm, setNewAccForm] = useState(EMPTY_ACC_FORM);
  const [editingListingId, setEditingListingId] = useState("");
  const listingFormRef = useRef(null);
  const listingUploadVersion = useRef(0);
  const [listingUploading, setListingUploading] = useState(false);

  // Admin Forms: Payment Methods
  const [newPayName, setNewPayName] = useState("");
  const [newPayAccount, setNewPayAccount] = useState("");
  const [newPayHolder, setNewPayHolder] = useState("");
  const [newPayHasPhoto, setNewPayHasPhoto] = useState(false);
  const [newPayImage, setNewPayImage] = useState("");

  // Ledger Filter
  const [ledgerFilter, setLedgerFilter] = useState("all");

  // Timer Tick (1-second precision)
  const [currentTime, setCurrentTime] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Toast notifier
  const toastTimer = useRef(null);
  const showToast = (msg) => {
    setToastMessage(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMessage(""), 3500);
  };

  // Is there already an admin? (decides whether the first admin sign-up becomes Super Admin)
  useEffect(() => {
    if (currentUser) return;
    api("/api/auth/setup")
      .then((d) => setHasAdmin(Boolean(d.hasAdmin)))
      .catch(() => {});
  }, [currentUser, authPortal, authMode]);

  // ---------- Server sync ----------
  const resetSession = useCallback(() => {
    setToken(null);
    setCurrentUser(null);
    setActiveOrder(null);
    setShowPaymentModal(false);
    setShowCartModal(false);
    setCfg(EMPTY_CFG);
    cfgRef.current = EMPTY_CFG;
    setListingRows([]);
    setOrderRows([]);
    setAdminOrderRows([]);
    setCartItemsState([]);
    cartRef.current = [];
    setStaff([]);
    setCustomers([]);
    setSellerOrders([]);
    setSellerWaDraft(null);
  }, []);

  const applyState = useCallback((data) => {
    if (writesInFlight.current === 0) {
      const merged = { ...EMPTY_CFG, ...(data.settings || {}) };
      cfgRef.current = merged;
      setCfg(merged);
      cartRef.current = data.cart || [];
      setCartItemsState(cartRef.current);
    }
    setCurrentUser(data.user);
    setListingRows(data.listings || []);
    setOrderRows(data.orders || []);
    setAdminOrderRows(data.adminOrders || []);
    setStaff(data.staff || []);
    setCustomers(data.customers || []);
    setSellerOrders(data.sellerOrders || []);
  }, []);

  const refresh = useCallback(
    async (manual = false) => {
      if (manual) setSyncing(true);
      try {
        const data = await api("/api/state");
        applyState(data);
      } catch (err) {
        if (err.status === 401 || err.status === 403) {
          resetSession();
          showToast(err.message);
        } else if (manual) {
          showToast(err.message);
        }
      } finally {
        if (manual) setSyncing(false);
      }
    },
    [applyState, resetSession]
  );

  // Keep every device in sync: poll while signed in and re-sync when the tab regains focus.
  useEffect(() => {
    if (!currentUser) return;
    const t = setInterval(() => refresh(), POLL_MS);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", onFocus);
    };
  }, [currentUser?.id, refresh]);

  // Run an API mutation, then pull the fresh state from the server.
  const mutate = async (path, options, successMsg) => {
    writesInFlight.current += 1;
    try {
      const res = await api(path, options);
      if (successMsg) showToast(successMsg);
      return res;
    } catch (err) {
      showToast(err.message);
      return null;
    } finally {
      writesInFlight.current -= 1;
      refresh();
    }
  };

  // Save a store-wide setting. Settings are shared by every account automatically.
  const updateSetting = (key, upd) => {
    const prev = cfgRef.current[key];
    const next = typeof upd === "function" ? upd(prev) : upd;
    cfgRef.current = { ...cfgRef.current, [key]: next };
    setCfg(cfgRef.current);
    return mutate(`/api/settings/${key}`, { method: "PUT", body: { value: next } });
  };
  const setMasterGames = (upd) => updateSetting("games", upd);
  const setJokiModels = (upd) => updateSetting("models", upd);
  const setJokiServices = (upd) => updateSetting("services", upd);
  const setPaymentMethods = (upd) => updateSetting("payments", upd);
  const setRefundConfig = (upd) => updateSetting("refund", upd);
  const setAccountFieldsConfig = (upd) => updateSetting("accountFields", upd);

  // Cart is saved per account on the server.
  const setCartItems = (upd) => {
    const next = typeof upd === "function" ? upd(cartRef.current) : upd;
    cartRef.current = next;
    setCartItemsState(next);
    return mutate("/api/cart", { method: "PUT", body: { items: next } });
  };

  // Upload a picked image to storage, then hand its URL to the callback.
  const handleImageUpload = (file, callback) => {
    if (!file) return;
    showToast("Mengunggah gambar...");
    uploadImage(file)
      .then((url) => {
        callback(url);
        showToast("Gambar berhasil diunggah.");
      })
      .catch((err) => showToast(err.message));
  };

  // Always show the freshest copy of the order opened in the payment modal.
  const activeOrder = useMemo(() => {
    if (!activeOrderSnap) return null;
    return (
      orders.find((o) => o.id === activeOrderSnap.id) ||
      adminOrders.find((o) => o.id === activeOrderSnap.id) ||
      activeOrderSnap
    );
  }, [activeOrderSnap, orders, adminOrders]);

  // Active locked order for the current buyer
  const pendingOrActiveOrder = useMemo(() => {
    if (!currentUser || currentUser.role === "admin") return null;
    return orders.find(
      (o) => o.buyerId === currentUser.id && (o.status === "pending" || o.status === "processing")
    );
  }, [orders, currentUser]);

  // Formatted 10-minute countdown
  const getRemainingTime = (createdAtTimestamp) => {
    if (!createdAtTimestamp) return null;
    const diff = 10 * 60 * 1000 - (currentTime - createdAtTimestamp);
    if (diff <= 0) return "00:00 (Waktu Habis)";
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  // When the countdown ends, ask the server so the order shows as cancelled everywhere.
  useEffect(() => {
    if (!pendingOrActiveOrder || pendingOrActiveOrder.submittedProof) return;
    if (getRemainingTime(pendingOrActiveOrder.createdAtTimestamp)?.startsWith("00:00")) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Math.floor(currentTime / 5000)]);

  // ---------- Authentication ----------
  const enterApp = async (token, user) => {
    setToken(token);
    setCurrentUser(user);
    setActiveTab(user.role === "admin" ? "admin" : "joki");
    setLoginPassword("");
    setRegPassword("");
    await refresh();
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setAuthError("");
    if (!regName.trim() || !regPhone.trim() || !regEmail.trim() || regPassword.length < 8) {
      setAuthError("Semua form wajib diisi dengan benar. Sandi minimal 8 digit.");
      return;
    }
    setAuthBusy(true);
    try {
      const res = await api("/api/auth/register", {
        method: "POST",
        body: { portal: authPortal, name: regName, phone: regPhone, email: regEmail, password: regPassword }
      });
      if (res.pending) {
        setAuthMode("login");
        setLoginEmail(regEmail.trim().toLowerCase());
        setRegPassword("");
        showToast("Pendaftaran berhasil! Akun Anda menunggu persetujuan Super Admin.");
        return;
      }
      await enterApp(res.token, res.user);
      showToast(`Selamat datang, ${res.user.name} ${res.user.isRootAdmin ? "(SUPER ADMIN)" : ""}!`);
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthBusy(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError("");
    setAuthBusy(true);
    try {
      const res = await api("/api/auth/login", {
        method: "POST",
        body: { portal: authPortal, email: loginEmail, password: loginPassword }
      });
      await enterApp(res.token, res.user);
      showToast(`Selamat datang kembali, ${res.user.name}!`);
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthBusy(false);
    }
  };

  const handleLogout = async () => {
    try {
      await api("/api/me/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
    resetSession();
    showToast("Anda telah keluar dari akun.");
  };

  // Super Admin: approve / reject / permissions / delete
  const handleApproveAdmin = (userId, status) =>
    mutate(
      `/api/admin/users/${userId}`,
      { method: "POST", body: { adminStatus: status } },
      `Status admin telah diubah: ${status === "approved" ? "Disetujui" : "Ditolak"}`
    );

  const handleDeleteUser = (u) => {
    const extra = u.role === "admin" ? " Semua akun game yang dijual admin ini juga akan dihapus dari toko." : "";
    if (!window.confirm(`Hapus akun ${u.name} (${u.email})? Akun tidak bisa masuk lagi setelah dihapus.${extra}`)) return;
    mutate(`/api/admin/users/${u.id}`, { method: "DELETE" }, `Akun ${u.name} dihapus.`);
  };

  // ---------- Joki calculator ----------
  // Keep game / service selection valid whenever the admin changes the catalog.
  useEffect(() => {
    if (!masterGames.length) return;
    if (!masterGames.some((g) => g.id === selectedGameId)) setSelectedGameId(masterGames[0].id);
  }, [masterGames, selectedGameId]);

  useEffect(() => {
    const forGame = jokiServices.filter((s) => s.gameId === selectedGameId);
    if (!forGame.some((s) => s.id === selectedServiceId)) setSelectedServiceId(forGame[0] ? forGame[0].id : "");
  }, [jokiServices, selectedGameId, selectedServiceId]);

  const currentJokiService = useMemo(() => {
    return jokiServices.find((s) => s.id === selectedServiceId && s.gameId === selectedGameId) || null;
  }, [jokiServices, selectedServiceId, selectedGameId]);

  // Posisi Awal & Target Tujuan always follow the checkpoints saved by the admin.
  const serviceLevels = currentJokiService?.allLevels || [];
  const levelsKey = serviceLevels.join("|");
  useEffect(() => {
    if (!currentJokiService || currentJokiService.pricingType !== "tiers" || !serviceLevels.length) return;
    const fromOk = serviceLevels.includes(fromLevel);
    const nextFrom = fromOk ? fromLevel : serviceLevels[0];
    const toIdx = serviceLevels.indexOf(toLevel);
    const nextTo = toIdx === -1 || toIdx < serviceLevels.indexOf(nextFrom) ? nextFrom : toLevel;
    if (nextFrom !== fromLevel) setFromLevel(nextFrom);
    if (nextTo !== toLevel) setToLevel(nextTo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentJokiService?.id, levelsKey, fromLevel, toLevel]);

  const calculatedJokiPrice = useMemo(
    () => calcJokiPrice(currentJokiService, { fromLevel, toLevel, qty: multiplierQty }),
    [currentJokiService, fromLevel, toLevel, multiplierQty]
  );

  // ---------- Checkouts & Cart ----------
  const handleAddToCart = (item) => {
    if (pendingOrActiveOrder) {
      showToast("Pesanan aktif Anda masih menunggu diproses/selesai!");
      return;
    }
    setCartItems((prev) => [
      ...prev,
      { ...item, cartId: "crt_" + Date.now().toString(36) + Math.random().toString(36).substring(2, 5) }
    ]);
    showToast(`"${item.title}" ditambahkan ke keranjang!`);
  };

  const handleRemoveFromCart = (cartId) => {
    setCartItems((prev) => prev.filter((i) => i.cartId !== cartId));
    showToast("Item dihapus dari keranjang.");
  };

  const cartTotalPrice = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
  }, [cartItems]);

  const openNewOrder = (res, msg) => {
    if (!res?.order) return;
    setActiveOrder(normalizeOrder(res.order));
    setPaymentProofImage("");
    setShowPaymentModal(true);
    if (msg) showToast(msg);
  };

  const handleCheckoutCart = async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    if (pendingOrActiveOrder) return showToast("Selesaikan pesanan aktif Anda terlebih dahulu!");
    if (cartItems.length === 0) return showToast("Keranjang belanja kosong!");
    if (!cartPaymentMethodId) return showToast("Pilih metode pembayaran bersama!");
    if (!cartBuyerWhatsapp.trim()) return showToast("Masukkan nomor WhatsApp aktif!");

    const res = await mutate("/api/orders", {
      method: "POST",
      body: { kind: "CART", paymentMethodId: cartPaymentMethodId, whatsapp: cartBuyerWhatsapp }
    });
    if (res) {
      setShowCartModal(false);
      openNewOrder(res, "Pesanan bersama berhasil dibuat! Silakan transfer.");
    }
  };

  const handleCheckoutJoki = async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    if (pendingOrActiveOrder) return showToast("Terdapat pesanan aktif yang sedang diproses.");
    if (!currentJokiService || calculatedJokiPrice <= 0) return showToast("Pilihan tingkatan joki belum valid.");
    if (!paymentMethodId || !buyerWhatsapp.trim()) return showToast("Lengkapi metode pembayaran dan WhatsApp.");

    const res = await mutate("/api/orders", {
      method: "POST",
      body: {
        kind: "JOKI",
        serviceId: currentJokiService.id,
        fromLevel,
        toLevel,
        qty: multiplierQty,
        paymentMethodId,
        whatsapp: buyerWhatsapp
      }
    });
    openNewOrder(res, "Pesanan dibuat! Anda memiliki 10 menit untuk menyelesaikan pembayaran.");
  };

  const handleBuyAccount = async (acc) => {
    if (!currentUser) return;
    if (pendingOrActiveOrder) return showToast("Selesaikan pesanan aktif Anda terlebih dahulu.");
    if (acc.isSold) return showToast("Stok akun ini sudah habis.");
    const res = await mutate("/api/orders", { method: "POST", body: { kind: "ACCOUNT", accountId: acc.id } });
    openNewOrder(res, "Pesanan akun dibuat! Selesaikan pembayaran dalam 10 menit.");
  };

  // Lock Single Payment Proof
  const handleSubmitPaymentProof = async () => {
    if (!paymentProofImage) return showToast("Unggah struk transfer terlebih dahulu!");
    if (!activeOrder) return;
    await mutate(
      `/api/orders/${activeOrder.id}/proof`,
      { method: "POST", body: { proofImage: paymentProofImage } },
      "Bukti pembayaran berhasil dikunci & dikirim ke Admin!"
    );
  };

  // Admin order status changes
  const handleAdminConfirmPayment = (orderId) =>
    mutate(
      `/api/admin/orders/${orderId}/status`,
      { method: "POST", body: { status: "processing" } },
      `Pesanan #${orderId} telah dikonfirmasi lunas!`
    );

  const handleUpdateOrderStatus = (orderId, status) =>
    mutate(`/api/admin/orders/${orderId}/status`, { method: "POST", body: { status } }, `Status pesanan #${orderId} diubah.`);

  const handleCancelOrderByBuyer = (orderId) =>
    mutate(`/api/orders/${orderId}/cancel`, { method: "POST" }, `Pesanan #${orderId} berhasil dibatalkan.`);

  // Delete order history — each side only removes it from its own list.
  const handleDeleteOrderByBuyer = (ord) => {
    if (!window.confirm(`Hapus pesanan #${ord.id} dari riwayat Anda?`)) return;
    mutate(`/api/orders/${ord.id}`, { method: "DELETE" }, `Pesanan #${ord.id} dihapus dari riwayat Anda.`);
  };

  const handleDeleteOrderByAdmin = (ord) => {
    if (
      !window.confirm(
        `Hapus pesanan #${ord.id} dari daftar admin?\nRiwayat pesanan milik pelanggan tetap tersimpan dan tidak terpengaruh.`
      )
    )
      return;
    mutate(`/api/admin/orders/${ord.id}`, { method: "DELETE" }, `Pesanan #${ord.id} dihapus dari daftar admin.`);
  };

  // Refund workflow
  const handleSubmitRefundRequest = async (e) => {
    e.preventDefault();
    if (!refundTargetOrder) return;

    if (refundConfig.requireReason && !refundFormData.reason.trim()) return showToast("Alasan refund wajib diisi!");
    if (refundConfig.requireBankName && !refundFormData.bankName.trim()) return showToast("Nama Bank / E-Wallet wajib diisi!");
    if (refundConfig.requireAccountNumber && !refundFormData.accountNumber.trim()) return showToast("Nomor rekening wajib diisi!");
    if (refundConfig.requireAccountHolder && !refundFormData.accountHolder.trim())
      return showToast("Nama pemilik rekening wajib diisi!");

    const res = await mutate(
      `/api/orders/${refundTargetOrder.id}/refund`,
      { method: "POST", body: refundFormData },
      "Permohonan pengembalian dana telah dikirimkan ke Admin."
    );
    if (!res) return;
    setShowRefundModal(false);
    setRefundFormData({
      reason: "",
      bankName: "",
      accountNumber: "",
      accountHolder: "",
      alternativeContact: "",
      evidenceImage: ""
    });
  };

  const handleAdminProcessRefund = (orderId, status) =>
    mutate(
      `/api/admin/orders/${orderId}/refund`,
      { method: "POST", body: { status } },
      `Refund pesanan #${orderId} telah di-${status === "approved" ? "setujui" : "tolak"}.`
    );

  // ---------- Checkpoint & Skema Tarif ----------
  const resetPricingForm = () => {
    setEditingServiceId("");
    setConfigGameId("");
    setConfigModelId("");
    setConfigPricingType("tiers");
    setConfigAllLevelsText(DEFAULT_LEVELS_TEXT);
    setConfigMultiplierUnit("Game");
    setConfigMultiplierPrice(1000);
    setConfigSegments(DEFAULT_SEGMENTS);
  };

  const handleEditService = (srv) => {
    setEditingServiceId(srv.id);
    setConfigGameId(srv.gameId);
    setConfigModelId(srv.modelId);
    setConfigPricingType(srv.pricingType || "tiers");
    setConfigAllLevelsText((srv.allLevels || []).join(", ") || DEFAULT_LEVELS_TEXT);
    setConfigMultiplierUnit(srv.multiplierUnit || "Game");
    setConfigMultiplierPrice(srv.multiplierPrice || 1000);
    setConfigSegments(srv.segments?.length ? srv.segments.map((s) => ({ ...s })) : []);
    pricingFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    showToast(`Mengedit skema ${srv.gameName} - ${srv.modelName}`);
  };

  const handleDeleteService = (srv) => {
    if (!window.confirm(`Hapus skema tarif ${srv.gameName} - ${srv.modelName}?`)) return;
    if (editingServiceId === srv.id) resetPricingForm();
    setJokiServices((prev) => prev.filter((s) => s.id !== srv.id));
    showToast("Skema tarif dihapus.");
  };

  const handleSaveService = async (e) => {
    e.preventDefault();
    if (!configGameId || !configModelId) return showToast("Pilih game dan jenis joki!");
    const game = masterGames.find((g) => g.id === configGameId);
    const model = jokiModels.find((m) => m.id === configModelId);
    const levels = parseLevels(configAllLevelsText);

    if (configPricingType === "tiers") {
      if (levels.length < 1) return showToast("Isi minimal 1 checkpoint (pisahkan dengan koma).");
    } else if (!(Number(configMultiplierPrice) > 0) || !configMultiplierUnit.trim()) {
      return showToast("Isi satuan dan tarif per satuan!");
    }

    const segments =
      configPricingType === "tiers"
        ? configSegments
            .map((s) => ({ ...s, pricePerStep: Number(s.pricePerStep) || 0 }))
            .filter((s) => levels.includes(s.from) && levels.includes(s.to))
        : [];
    if (configPricingType === "tiers" && segments.length === 0) {
      return showToast("Tambahkan minimal 1 segmen tarif yang sesuai dengan daftar checkpoint.");
    }

    const srv = {
      id: "srv_" + configGameId + "_" + configModelId,
      gameId: configGameId,
      gameName: game ? game.name : "",
      modelId: configModelId,
      modelName: model ? model.name : "",
      pricingType: configPricingType,
      allLevels: levels,
      segments,
      multiplierUnit: configMultiplierUnit.trim() || "Game",
      multiplierPrice: Number(configMultiplierPrice) || 1000
    };

    const res = await setJokiServices((prev) => {
      const filtered = (prev || []).filter((s) => s.id !== srv.id && s.id !== editingServiceId);
      return [...filtered, srv];
    });
    if (res) {
      showToast(`Skema tarif ${srv.gameName} - ${srv.modelName} tersimpan & langsung dipakai di kalkulator!`);
      resetPricingForm();
    }
  };

  // ---------- Jual Akun (listings) ----------
  const handleListingImages = async (files) => {
    const selected = Array.from(files || []);
    if (!selected.length || listingUploading) return;
    if (newAccForm.images.length + selected.length > 10) return showToast("Maksimal 10 foto per produk.");
    if (selected.some((file) => !file.type.startsWith("image/") || file.size > 5 * 1024 * 1024)) {
      return showToast("Pilih file gambar dengan ukuran maksimal 5 MB per foto.");
    }
    const version = ++listingUploadVersion.current;
    setListingUploading(true);
    const results = await Promise.allSettled(selected.map(uploadImage));
    if (version === listingUploadVersion.current) {
      const urls = results.filter((r) => r.status === "fulfilled").map((r) => r.value);
      setNewAccForm((prev) => ({ ...prev, images: [...prev.images, ...urls] }));
      const failed = results.find((r) => r.status === "rejected");
      showToast(failed ? `${urls.length} foto berhasil diunggah. ${failed.reason.message}` : "Semua foto berhasil diunggah.");
    }
    setListingUploading(false);
  };

  const handleSaveListing = async (e) => {
    e.preventDefault();
    if (listingUploading) return;
    if (!newAccForm.gameId || !newAccForm.title || !newAccForm.price) {
      return showToast("Lengkapi nama game, judul akun, dan harga!");
    }
    const body = {
      gameId: newAccForm.gameId,
      title: newAccForm.title,
      price: Number(newAccForm.price) || 0,
      stock: Math.max(0, Number(newAccForm.stock) || 0),
      image: newAccForm.images[0] || "",
      images: newAccForm.images,
      description: newAccForm.description,
      specs: newAccForm.customSpecs
    };
    const res = editingListingId
      ? await mutate(`/api/listings/${editingListingId}`, { method: "PUT", body }, "Data akun berhasil diperbarui!")
      : await mutate("/api/listings", { method: "POST", body }, "Akun game berhasil ditambahkan ke etalase!");
    if (res) {
      setNewAccForm(EMPTY_ACC_FORM);
      setEditingListingId("");
    }
  };

  const handleEditListing = (acc) => {
    listingUploadVersion.current++;
    setEditingListingId(acc.id);
    setNewAccForm({
      gameId: acc.gameId,
      title: acc.title,
      price: String(acc.price),
      stock: acc.stock,
      image: acc.image,
      images: [...acc.images],
      description: acc.description,
      customSpecs: { ...(acc.specs || {}) }
    });
    setActiveTab("admin");
    setTimeout(() => listingFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  };

  const handleCancelEditListing = () => {
    listingUploadVersion.current++;
    setEditingListingId("");
    setNewAccForm(EMPTY_ACC_FORM);
  };

  const handleSetStock = (acc, stock) => {
    const value = Math.max(0, Number(stock) || 0);
    setListingRows((prev) => prev.map((l) => (l.id === acc.id ? { ...l, stock: value } : l)));
    mutate(`/api/listings/${acc.id}/stock`, { method: "PATCH", body: { stock: value } });
  };

  const handleDeleteListing = (acc) => {
    if (!window.confirm(`Hapus akun "${acc.title}" dari toko?`)) return;
    if (editingListingId === acc.id) handleCancelEditListing();
    setListingRows((prev) => prev.filter((l) => l.id !== acc.id));
    mutate(`/api/listings/${acc.id}`, { method: "DELETE" }, "Akun dihapus dari toko.");
  };

  // Seller (regular admin) saves the WhatsApp number shown to buyers.
  const handleSaveSellerWhatsapp = async (e) => {
    e.preventDefault();
    const res = await mutate(
      "/api/me/whatsapp",
      { method: "PUT", body: { whatsapp: sellerWaDraft ?? currentUser.phone } },
      "Nomor WhatsApp penjual disimpan."
    );
    if (res) setSellerWaDraft(null);
  };

  // WhatsApp link to the admin who sells an account.
  const sellerWaLink = (seller, accTitle, orderId) =>
    seller?.whatsapp
      ? waLink(
          seller.whatsapp,
          orderId
            ? `Halo ${seller.name}, saya pembeli akun "${accTitle}" di CATALYST STORE (ID Pesanan #${orderId}). Mohon info penyerahan data akun. Terima kasih!`
            : `Halo ${seller.name}, saya tertarik dengan akun "${accTitle}" yang Anda jual di CATALYST STORE. Apakah masih tersedia?`
        )
      : "";

  // Generate WhatsApp message url
  const generateWhatsAppLink = (ord) => {
    let clean = (adminContact.whatsapp || "").replace(/[^0-9]/g, "");
    if (clean.startsWith("0")) clean = "62" + clean.slice(1);
    const num = clean || "6285705606574";
    const msg = encodeURIComponent(
      `Halo ${adminContact.csName || "Admin CATALYST STORE"}, saya ingin konfirmasi pesanan:\n\n` +
        `• ID: #${ord.id}\n` +
        `• Nama: ${ord.buyerName}\n` +
        `• Layanan: ${ord.title}\n` +
        `• Rincian: ${ord.detail}\n` +
        `• Total: Rp ${Number(ord.price).toLocaleString("id-ID")}\n` +
        `• Metode: ${ord.paymentMethod}\n` +
        `• Status: SUDAH BAYAR & LUNAS\n\n` +
        `Mohon info pengerjaan joki / penyerahan data akun. Terima kasih!`
    );
    return `https://wa.me/${num}?text=${msg}`;
  };

  // Financial Ledger calculations (admin list)
  const totalOmzetLunas = useMemo(() => {
    return adminOrders
      .filter((o) => o.status === "processing" || o.status === "completed")
      .reduce((s, o) => s + (Number(o.price) || 0), 0);
  }, [adminOrders]);

  const omzetJoki = useMemo(() => {
    return adminOrders
      .filter((o) => o.type === "JOKI" && (o.status === "processing" || o.status === "completed"))
      .reduce((s, o) => s + (Number(o.price) || 0), 0);
  }, [adminOrders]);

  const omzetAkun = useMemo(() => {
    return adminOrders
      .filter((o) => o.type === "ACCOUNT" && (o.status === "processing" || o.status === "completed"))
      .reduce((s, o) => s + (Number(o.price) || 0), 0);
  }, [adminOrders]);

  const contactForm = contactDraft || adminContact;
  const policyNoteValue = policyDraft ?? refundConfig.policyNote;

  // ==========================================
  // VIEW: AUTHENTICATION (LOGIN / REGISTER)
  // ==========================================
  if (!currentUser) {
    const isFirstAdmin = !hasAdmin;

    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden font-sans">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-cyan-600/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="w-full max-w-md z-10">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500 to-indigo-600 p-0.5 shadow-xl shadow-cyan-500/20 mb-3">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center overflow-hidden">
                <img src="/logo.png" alt="CATALYST STORE" className="w-11 h-11 object-contain" />
              </div>
            </div>
            <h1 className="text-2xl font-black tracking-wider text-white">
              CATALYST<span className="text-cyan-400"> STORE</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">Platform Joki Profesional & Toko Akun Terpercaya</p>
          </div>

          <div className="grid grid-cols-2 p-1 bg-slate-900 border border-slate-800 rounded-2xl mb-4">
            <button
              type="button"
              onClick={() => {
                setAuthPortal("customer");
                setAuthError("");
              }}
              className={`py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 ${
                authPortal === "customer"
                  ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <User className="w-3.5 h-3.5" /> Portal Pelanggan
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthPortal("admin");
                setAuthError("");
              }}
              className={`py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 ${
                authPortal === "admin"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" /> Portal Admin
            </button>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
              <div>
                <h2 className="text-lg font-black text-white">
                  {authMode === "login" ? "Masuk ke Akun" : "Daftar Akun Baru"}
                </h2>
                <span className="text-[11px] text-slate-400">
                  {authPortal === "admin" ? "Khusus Manajemen & Admin Toko" : "Akses Joki & Marketplace Akun"}
                </span>
              </div>
              <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("login");
                    setAuthError("");
                  }}
                  className={`px-3 py-1 font-bold rounded-lg transition ${
                    authMode === "login" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white"
                  }`}
                >
                  Masuk
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("register");
                    setAuthError("");
                  }}
                  className={`px-3 py-1 font-bold rounded-lg transition ${
                    authMode === "register" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white"
                  }`}
                >
                  Daftar
                </button>
              </div>
            </div>

            {authError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{authError}</span>
              </div>
            )}

            {authMode === "login" ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                    Email Terdaftar
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
                    <input
                      type="email"
                      required
                      placeholder="nama@email.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-9 pr-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                    Kata Sandi
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
                    <input
                      type={showLoginPassword ? "text" : "password"}
                      required
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-9 pr-10 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword((p) => !p)}
                      className="absolute right-3 top-3 text-slate-500 hover:text-slate-300"
                    >
                      {showLoginPassword ? <EyeOff className="w-4 h-4 text-cyan-400" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={authBusy}
                  className={`w-full py-3 rounded-xl text-xs font-black tracking-wider uppercase transition shadow-lg mt-2 disabled:opacity-60 ${
                    authPortal === "admin"
                      ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30"
                      : "bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-cyan-500/30"
                  }`}
                >
                  {authBusy ? "Memproses..." : "Masuk Sekarang"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-3.5">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Nama Lengkap
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Budi Santoso"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-9 pr-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Nomor WhatsApp
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                    <input
                      type="tel"
                      required
                      placeholder="08xxxxxxxxxx"
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-9 pr-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                    <input
                      type="email"
                      required
                      placeholder="nama@email.com"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-9 pr-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Kata Sandi (Min. 8 Karakter)
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                    <input
                      type={showRegPassword ? "text" : "password"}
                      required
                      minLength={8}
                      placeholder="Minimal 8 digit"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-9 pr-10 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword((p) => !p)}
                      className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                    >
                      {showRegPassword ? <EyeOff className="w-4 h-4 text-cyan-400" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {authPortal === "admin" && (
                  <div
                    className={`p-3.5 rounded-2xl text-[11px] space-y-1.5 border transition ${
                      isFirstAdmin
                        ? "bg-amber-950/60 border-amber-500/80 text-amber-200 shadow-lg shadow-amber-500/10"
                        : "bg-slate-950 border-slate-800 text-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-black">
                        <Crown className={`w-4 h-4 ${isFirstAdmin ? "text-amber-400" : "text-indigo-400"}`} />
                        <span className={isFirstAdmin ? "text-amber-300" : "text-white"}>
                          {isFirstAdmin ? "DAFTAR SEBAGAI SUPER ADMIN" : "DAFTAR SEBAGAI ADMIN BIASA"}
                        </span>
                      </div>
                      <span
                        className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase border ${
                          isFirstAdmin
                            ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                            : "bg-slate-800 text-slate-400 border-slate-700"
                        }`}
                      >
                        {isFirstAdmin ? "Slot Akun Pusat" : "Perlu Persetujuan"}
                      </span>
                    </div>
                    {isFirstAdmin ? (
                      <p className="text-[10px] text-amber-300/90 leading-relaxed">
                        👑 <strong>Belum ada admin terdaftar.</strong> Akun yang didaftarkan sekarang akan otomatis menjadi{" "}
                        <strong>Super Admin (Akun Pusat)</strong>.
                      </p>
                    ) : (
                      <p className="text-[10px] text-slate-400 leading-relaxed">
                        🛡️ Super Admin sudah aktif. Akun admin baru memerlukan persetujuan dari Super Admin sebelum dapat masuk.
                      </p>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={authBusy}
                  className={`w-full py-3 rounded-xl text-xs font-black tracking-wider uppercase transition shadow-lg mt-3 disabled:opacity-60 ${
                    authPortal === "admin"
                      ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30"
                      : "bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-cyan-500/30"
                  }`}
                >
                  {authBusy
                    ? "Memproses..."
                    : authPortal === "admin"
                    ? isFirstAdmin
                      ? "👑 Buat Akun Super Admin"
                      : "Daftar Akun Admin (Minta Persetujuan)"
                    : "Daftar Akun Baru"}
                </button>
              </form>
            )}

            <div className="mt-5 pt-4 border-t border-slate-800 text-center text-[11px] text-slate-500 leading-relaxed">
              {authMode === "login" ? (
                <>
                  Belum punya akun?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode("register");
                      setAuthError("");
                    }}
                    className="text-cyan-400 font-bold hover:underline"
                  >
                    Daftar sekarang
                  </button>
                  <span className="block mt-1">Akun Anda tersimpan di server & bisa dipakai di perangkat mana pun.</span>
                </>
              ) : (
                <>
                  Sudah punya akun?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode("login");
                      setAuthError("");
                    }}
                    className="text-cyan-400 font-bold hover:underline"
                  >
                    Masuk di sini
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-cyan-500 text-white text-xs px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-cyan-400" />
            <span>{toastMessage}</span>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // VIEW: MAIN APPLICATION DASHBOARD
  // ==========================================
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* NAVBAR */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 sm:px-8 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-950 border border-slate-700 flex items-center justify-center shadow-lg shadow-cyan-500/20 overflow-hidden">
              <img src="/logo.png" alt="CATALYST STORE" className="w-8 h-8 object-contain" />
            </div>
            <div>
              <span className="font-black text-lg text-white tracking-wider">
                CATALYST<span className="text-cyan-400"> STORE</span>
              </span>
              <span className="hidden sm:inline-block text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full ml-2 border border-slate-700">
                Official Marketplace
              </span>
            </div>
          </div>

          <nav className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => setActiveTab("joki")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === "joki"
                  ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              <Zap className="w-3.5 h-3.5" /> Joki Game
            </button>
            <button
              onClick={() => setActiveTab("accounts")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === "accounts"
                  ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5" /> Toko Akun
            </button>
            <button
              onClick={() => setActiveTab("orders")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === "orders"
                  ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              <Clock className="w-3.5 h-3.5" /> Pesanan
            </button>

            <button
              onClick={() => setShowCartModal(true)}
              className="relative px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700"
            >
              <ShoppingCart className="w-3.5 h-3.5 text-cyan-400" />
              <span>Keranjang</span>
              {cartItems.length > 0 && (
                <span className="px-1.5 py-0.2 bg-cyan-500 text-slate-950 text-[10px] font-black rounded-full shadow">
                  {cartItems.length}
                </span>
              )}
            </button>

            {currentUser.role === "admin" && (
              <button
                onClick={() => setActiveTab("admin")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  activeTab === "admin"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                    : "text-indigo-400 hover:text-indigo-300 hover:bg-slate-800"
                }`}
              >
                <Sliders className="w-3.5 h-3.5" /> Panel Admin
              </button>
            )}
          </nav>

          <div className="flex items-center gap-2">
            <div className="hidden md:flex flex-col text-right">
              <span className="text-xs font-bold text-white">{currentUser.name}</span>
              <span className="text-[10px] text-cyan-400 uppercase font-bold">
                {currentUser.isRootAdmin ? "Super Admin" : currentUser.role === "admin" ? "Admin" : "Pelanggan"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => refresh(true)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-cyan-300 border border-slate-700 transition"
              title="Sinkronkan data terbaru"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="p-2 rounded-xl bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 border border-slate-700 transition"
              title="Keluar (Logout)"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {/* ========================================================= */}
        {/* TAB 1: KALKULATOR JOKI */}
        {/* ========================================================= */}
        {activeTab === "joki" && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-slate-900 to-slate-950 p-6 rounded-3xl border border-slate-800 shadow-xl">
              <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
                <Zap className="w-6 h-6 text-cyan-400" /> Kalkulator & Pemesanan Joki Game
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Pilih game dan tentukan rank target. Perhitungan inklusif menghitung semua tingkatan secara akurat.
              </p>
            </div>

            {masterGames.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center text-slate-400">
                <Gamepad2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <h3 className="text-base font-bold text-white">Belum Ada Game Terdaftar</h3>
                <p className="text-xs text-slate-500 mt-1">Admin dapat menambahkan game di Panel Admin.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  {/* Langkah 1: Pilih Game */}
                  <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-3xl">
                    <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider block mb-3">
                      Langkah 1: Pilih Game
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {masterGames.map((gm) => (
                        <button
                          key={gm.id}
                          type="button"
                          onClick={() => {
                            setSelectedGameId(gm.id);
                            const firstSrv = jokiServices.find((s) => s.gameId === gm.id);
                            setSelectedServiceId(firstSrv ? firstSrv.id : "");
                          }}
                          className={`p-3 rounded-2xl border text-left transition flex flex-col items-center text-center gap-2 ${
                            selectedGameId === gm.id
                              ? "bg-cyan-950/60 border-cyan-500 shadow-lg shadow-cyan-500/20"
                              : "bg-slate-950 border-slate-800 hover:border-slate-700"
                          }`}
                        >
                          <img
                            src={gm.icon}
                            alt={gm.name}
                            className="w-12 h-12 rounded-xl object-cover border border-slate-700"
                          />
                          <span className="text-xs font-bold text-white line-clamp-1">{gm.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Langkah 2: Pilih Model Joki */}
                  {selectedGameId && (
                    <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-3xl">
                      <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider block mb-3">
                        Langkah 2: Pilih Jenis Joki
                      </span>
                      {jokiServices.filter((s) => s.gameId === selectedGameId).length === 0 ? (
                        <div className="p-6 bg-slate-950 border border-slate-800 rounded-2xl text-center text-xs text-slate-500">
                          Belum ada skema tarif joki untuk game ini.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {jokiServices
                            .filter((s) => s.gameId === selectedGameId)
                            .map((srv) => (
                              <button
                                key={srv.id}
                                type="button"
                                onClick={() => setSelectedServiceId(srv.id)}
                                className={`p-4 rounded-2xl border text-left transition flex items-center justify-between ${
                                  selectedServiceId === srv.id
                                    ? "bg-cyan-950/60 border-cyan-500 shadow-md shadow-cyan-500/20"
                                    : "bg-slate-950 border-slate-800 hover:border-slate-700"
                                }`}
                              >
                                <div>
                                  <h4 className="text-xs font-black text-white">{srv.modelName}</h4>
                                  <span className="text-[10px] text-slate-400">
                                    {srv.pricingType === "multiplier"
                                      ? `Rp ${Number(srv.multiplierPrice).toLocaleString("id-ID")} / ${srv.multiplierUnit}`
                                      : "Tarif Bertingkat (Segmented)"}
                                  </span>
                                </div>
                                {selectedServiceId === srv.id && <CheckCircle2 className="w-4 h-4 text-cyan-400" />}
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Langkah 3: Konfigurasi Checkpoint Target */}
                  {currentJokiService && (
                    <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-3xl">
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider block">
                          Langkah 3: Tentukan Target Joki
                        </span>
                        <span className="text-[10px] text-slate-500">
                          Mengikuti checkpoint yang diatur admin
                        </span>
                      </div>

                      {currentJokiService.pricingType === "multiplier" ? (
                        <div className="space-y-4">
                          <div>
                            <label className="text-xs text-slate-400 block mb-1.5 font-bold">
                              Jumlah Pesanan ({currentJokiService.multiplierUnit}):
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={multiplierQty}
                              onChange={(e) => setMultiplierQty(Math.max(1, parseInt(e.target.value) || 1))}
                              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white font-bold"
                            />
                          </div>
                          <div className="flex gap-2">
                            {[1, 3, 5, 10].map((num) => (
                              <button
                                key={num}
                                type="button"
                                onClick={() => setMultiplierQty(num)}
                                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-cyan-300"
                              >
                                +{num} {currentJokiService.multiplierUnit}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : serviceLevels.length === 0 ? (
                        <div className="p-6 bg-slate-950 border border-slate-800 rounded-2xl text-center text-xs text-slate-500">
                          Admin belum mengisi daftar checkpoint untuk layanan ini.
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="text-xs text-slate-400 block mb-1.5 font-bold">
                                📍 Posisi Awal:
                              </label>
                              <select
                                value={fromLevel}
                                onChange={(e) => {
                                  const newFrom = e.target.value;
                                  setFromLevel(newFrom);
                                  const fromIdx = currentJokiService.allLevels.indexOf(newFrom);
                                  const toIdx = currentJokiService.allLevels.indexOf(toLevel);
                                  if (toIdx < fromIdx) setToLevel(newFrom);
                                }}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white font-bold"
                              >
                                {currentJokiService.allLevels.map((lvl) => (
                                  <option key={lvl} value={lvl}>
                                    {lvl}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="text-xs text-slate-400 block mb-1.5 font-bold">
                                🎯 Target Tujuan:
                              </label>
                              <select
                                value={toLevel}
                                onChange={(e) => setToLevel(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white font-bold"
                              >
                                {currentJokiService.allLevels
                                  .filter((_, idx) => idx >= currentJokiService.allLevels.indexOf(fromLevel))
                                  .map((lvl) => (
                                    <option key={lvl} value={lvl}>
                                      {lvl}
                                    </option>
                                  ))}
                              </select>
                            </div>
                          </div>

                          <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                            <span>
                              Perhitungan Inklusif:{" "}
                              <strong className="text-white">
                                {fromLevel === toLevel
                                  ? `1 Tingkat (${fromLevel})`
                                  : `${currentJokiService.allLevels.indexOf(toLevel) - currentJokiService.allLevels.indexOf(fromLevel) + 1} Tingkat (${fromLevel} s/d ${toLevel})`}
                              </strong>
                            </span>
                            <span className="text-cyan-400 font-bold">Otomatis Terhitung</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Ringkasan & Form Pemesanan Joki */}
                <div className="space-y-6">
                  <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-3xl sticky top-20 shadow-xl relative overflow-hidden">
                    {/* Active Order Lock Screen */}
                    {pendingOrActiveOrder && (
                      <div className="absolute inset-0 z-30 bg-slate-950/92 backdrop-blur-sm p-6 flex flex-col items-center justify-center text-center">
                        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-3 animate-pulse">
                          <Lock className="w-6 h-6" />
                        </div>
                        <h4 className="text-sm font-black text-white">Fitur Pemesanan Terkunci</h4>
                        <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
                          {pendingOrActiveOrder.submittedProof ? (
                            <>
                              Pesanan <strong className="text-cyan-400">#{pendingOrActiveOrder.id}</strong> sedang{" "}
                              <strong className="text-amber-400">menunggu konfirmasi Admin</strong>. Pemesanan baru dikunci sementara.
                            </>
                          ) : (
                            <>
                              Anda memiliki pesanan aktif <strong className="text-cyan-400">#{pendingOrActiveOrder.id}</strong> yang belum diselesaikan atau dibatalkan.
                            </>
                          )}
                        </p>
                        <div className="mt-4 flex flex-col gap-2 w-full max-w-xs">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveOrder(pendingOrActiveOrder);
                              setPaymentProofImage(pendingOrActiveOrder.proofImage || "");
                              setShowPaymentModal(true);
                            }}
                            className="w-full py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-xl shadow transition"
                          >
                            Buka Status Pembayaran
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveTab("orders")}
                            className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl border border-slate-700 transition"
                          >
                            Lihat di Riwayat Pesanan
                          </button>
                        </div>
                      </div>
                    )}

                    <h3 className="text-base font-black text-white flex items-center gap-2 mb-4 pb-3 border-b border-slate-800">
                      <CreditCard className="w-4 h-4 text-cyan-400" /> Ringkasan Pembayaran
                    </h3>

                    {currentJokiService ? (
                      <div className="space-y-4">
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between text-slate-400">
                            <span>Game:</span>
                            <span className="font-bold text-white">{currentJokiService.gameName}</span>
                          </div>
                          <div className="flex justify-between text-slate-400">
                            <span>Layanan:</span>
                            <span className="font-bold text-white">{currentJokiService.modelName}</span>
                          </div>
                          <div className="flex justify-between text-slate-400">
                            <span>Rute Target:</span>
                            <span className="font-bold text-cyan-400">
                              {jokiDetail(currentJokiService, { fromLevel, toLevel, qty: multiplierQty })}
                            </span>
                          </div>
                        </div>

                        <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 text-center">
                          <span className="text-[11px] text-slate-500 uppercase tracking-wider block font-bold mb-1">
                            Total Biaya Joki
                          </span>
                          <span className="text-2xl font-black text-cyan-400">
                            Rp {calculatedJokiPrice.toLocaleString("id-ID")}
                          </span>
                        </div>

                        <button
                          type="button"
                          disabled={Boolean(pendingOrActiveOrder) || calculatedJokiPrice <= 0}
                          onClick={() => {
                            handleAddToCart({
                              type: "JOKI",
                              serviceId: currentJokiService.id,
                              fromLevel,
                              toLevel,
                              qty: multiplierQty,
                              title: `${currentJokiService.gameName} - ${currentJokiService.modelName}`,
                              gameName: currentJokiService.gameName,
                              detail: jokiDetail(currentJokiService, { fromLevel, toLevel, qty: multiplierQty }),
                              price: calculatedJokiPrice
                            });
                          }}
                          className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-cyan-500/30 text-xs font-bold transition flex items-center justify-center gap-2"
                        >
                          <ShoppingCart className="w-4 h-4" /> Masukkan ke Keranjang (Bayar Barengan)
                        </button>

                        <form onSubmit={handleCheckoutJoki} className="space-y-3.5 pt-2">
                          <div>
                            <label className="text-[11px] font-bold text-slate-400 block mb-1">
                              Metode Pembayaran:
                            </label>
                            <select
                              required
                              value={paymentMethodId}
                              disabled={Boolean(pendingOrActiveOrder)}
                              onChange={(e) => setPaymentMethodId(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white disabled:opacity-50"
                            >
                              <option value="">-- Pilih Rekening / QRIS --</option>
                              {paymentMethods.map((pm) => (
                                <option key={pm.id} value={pm.id}>
                                  {pm.name} ({pm.accountHolder})
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="text-[11px] font-bold text-slate-400 block mb-1">
                              Nomor WhatsApp Anda:
                            </label>
                            <input
                              type="tel"
                              required
                              disabled={Boolean(pendingOrActiveOrder)}
                              placeholder="08xxxxxxxxxx"
                              value={buyerWhatsapp}
                              onChange={(e) => setBuyerWhatsapp(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white placeholder-slate-600 disabled:opacity-50"
                            />
                          </div>

                          <button
                            type="submit"
                            disabled={Boolean(pendingOrActiveOrder)}
                            className={`w-full py-3 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition flex items-center justify-center gap-2 ${
                              pendingOrActiveOrder
                                ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
                                : "bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 shadow-cyan-500/20"
                            }`}
                          >
                            <span>Lanjutkan Pembayaran Langsung</span>
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        </form>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-xs text-slate-500">
                        Pilih game dan jenis joki untuk menghitung rincian biaya.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: TOKO AKUN GAME */}
        {/* ========================================================= */}
        {activeTab === "accounts" && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-slate-900 to-slate-950 p-6 rounded-3xl border border-slate-800 shadow-xl">
              <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
                <ShoppingBag className="w-6 h-6 text-cyan-400" /> Katalog Akun Game Siap Pakai
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Koleksi akun aman dan siap serah terima data langsung dari Admin Toko.
              </p>
            </div>

            {pendingOrActiveOrder && (
              <div className="p-4 bg-amber-950/70 border border-amber-800 rounded-2xl flex items-center justify-between text-xs text-amber-300">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    Anda memiliki pesanan aktif <strong>#{pendingOrActiveOrder.id}</strong>. Selesaikan atau batalkan pesanan tersebut untuk order akun baru.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setActiveOrder(pendingOrActiveOrder);
                    setPaymentProofImage(pendingOrActiveOrder.proofImage || "");
                    setShowPaymentModal(true);
                  }}
                  className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded-lg shrink-0 ml-2"
                >
                  Cek Pesanan
                </button>
              </div>
            )}

            {accounts.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center text-slate-400">
                <ShoppingBag className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <h3 className="text-base font-bold text-white">Belum Ada Akun di Etalase</h3>
                <p className="text-xs text-slate-500 mt-1">Stok akun game saat ini sedang kosong.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {accounts.map((acc) => (
                  <div
                    key={acc.id}
                    className="bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden shadow-xl flex flex-col group hover:border-slate-700 transition"
                  >
                    <div className="relative h-48 bg-slate-950 overflow-hidden">
                      <AccountGallery images={acc.images} title={acc.title} />
                      <div className="absolute top-3 left-3 bg-slate-950/80 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-700 text-[10px] font-bold text-cyan-400">
                        {acc.gameName}
                      </div>
                      <div className="absolute top-3 right-3">
                        <span
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${
                            acc.isSold
                              ? "bg-rose-950/80 border-rose-800 text-rose-400"
                              : "bg-emerald-950/80 border-emerald-800 text-emerald-400"
                          }`}
                        >
                          {acc.isSold ? "STOK HABIS" : `READY • Stok ${acc.stock}`}
                        </span>
                      </div>
                      {canManageListing(acc) && (
                        <div className="absolute bottom-3 right-3 flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleEditListing(acc)}
                            className="px-2.5 py-1 rounded-lg bg-slate-950/90 border border-indigo-700 text-indigo-300 hover:text-white text-[10px] font-bold flex items-center gap-1"
                          >
                            <Pencil className="w-3 h-3" /> Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteListing(acc)}
                            className="px-2.5 py-1 rounded-lg bg-slate-950/90 border border-rose-800 text-rose-400 hover:text-rose-300 text-[10px] font-bold flex items-center gap-1"
                          >
                            <Trash2 className="w-3 h-3" /> Hapus
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="p-5 flex-1 flex flex-col justify-between">
                      <div>
                        <h4 className="text-sm font-black text-white line-clamp-1">{acc.title}</h4>
                        <div className="mt-2 flex items-center justify-between gap-2 bg-slate-950/70 border border-slate-800 rounded-xl px-2.5 py-1.5">
                          <div className="min-w-0">
                            <span className="text-[9px] uppercase font-bold text-slate-500 block">Dijual oleh</span>
                            <span className="text-[11px] font-bold text-indigo-300 truncate flex items-center gap-1">
                              {acc.seller?.isRootAdmin ? (
                                <Crown className="w-3 h-3 text-amber-400 shrink-0" />
                              ) : (
                                <ShieldCheck className="w-3 h-3 text-indigo-400 shrink-0" />
                              )}
                              <span className="truncate">{acc.seller ? acc.seller.name : "CATALYST STORE (Resmi)"}</span>
                            </span>
                          </div>
                          {acc.seller?.whatsapp && !acc.isSold && (
                            <a
                              href={sellerWaLink(acc.seller, acc.title)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0 px-2 py-1 rounded-lg bg-emerald-950 hover:bg-emerald-900 border border-emerald-800 text-emerald-300 text-[10px] font-bold inline-flex items-center gap-1"
                              title={`WhatsApp penjual: ${acc.seller.whatsapp}`}
                            >
                              <MessageCircle className="w-3 h-3" /> WA Penjual
                            </a>
                          )}
                        </div>
                        <AccountDescription text={acc.description} />

                        {acc.specs && Object.keys(acc.specs).length > 0 && (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800/80 my-3 text-center">
                            {Object.entries(acc.specs).map(([fieldKey, val]) => {
                              const fieldCfg = accountFieldsConfig.find((c) => c.id === fieldKey);
                              const label = fieldCfg ? fieldCfg.label : fieldKey;
                              return (
                                <div key={fieldKey} className="overflow-hidden">
                                  <span className="text-[9px] text-slate-500 block uppercase font-bold truncate">
                                    {label}
                                  </span>
                                  <span className="text-xs font-bold text-white truncate block">
                                    {val || "-"}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <div className="pt-3 border-t border-slate-800 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-[10px] text-slate-500 block">Harga Pas:</span>
                            <span className="text-lg font-black text-cyan-400">
                              Rp {Number(acc.price).toLocaleString("id-ID")}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={acc.isSold || Boolean(pendingOrActiveOrder)}
                              onClick={() => {
                                handleAddToCart({
                                  type: "ACCOUNT",
                                  accountId: acc.id,
                                  title: `Beli Akun: ${acc.title}`,
                                  gameName: acc.gameName,
                                  detail: Object.entries(acc.specs || {})
                                    .map(([k, v]) => {
                                      const f = accountFieldsConfig.find((c) => c.id === k);
                                      return `${f ? f.label : k}: ${v}`;
                                    })
                                    .join(" | "),
                                  price: acc.price
                                });
                              }}
                              className="p-2 bg-slate-800 hover:bg-slate-700 text-cyan-400 rounded-xl border border-slate-700 transition"
                              title="Tambah ke Keranjang"
                            >
                              <ShoppingCart className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              disabled={acc.isSold || Boolean(pendingOrActiveOrder)}
                              onClick={() => handleBuyAccount(acc)}
                              className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                                acc.isSold || pendingOrActiveOrder
                                  ? "bg-slate-800 text-slate-600 cursor-not-allowed"
                                  : "bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-md shadow-cyan-500/20"
                              }`}
                            >
                              <ShoppingBag className="w-3.5 h-3.5" /> Beli Langsung
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 3: RIWAYAT PESANAN */}
        {/* ========================================================= */}
        {activeTab === "orders" && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-slate-900 to-slate-950 p-6 rounded-3xl border border-slate-800 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
                  <Clock className="w-6 h-6 text-cyan-400" /> Riwayat Pesanan Saya
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Pantau verifikasi transfer, pengerjaan pesanan, atau ajukan pengembalian dana. Riwayat ini privat — hanya
                  bisa dilihat oleh akun Anda.
                </p>
              </div>
              <div className="text-xs text-slate-400 bg-slate-950/80 px-4 py-2 rounded-2xl border border-slate-800">
                Total Transaksi:{" "}
                <strong className="text-cyan-400 font-bold">
                  {orders.length}
                </strong>
              </div>
            </div>

            {orders.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center text-slate-400">
                <Clock className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <h3 className="text-base font-bold text-white">Belum Ada Transaksi</h3>
                <p className="text-xs text-slate-500 mt-1">Silakan lakukan pesanan jasa joki atau beli akun game.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {orders
                  .map((ord) => (
                    <div
                      key={ord.id}
                      className="bg-slate-900/90 border border-slate-800 p-5 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg hover:border-slate-700 transition"
                    >
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-bold text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded-lg border border-cyan-800">
                            #{ord.id}
                          </span>
                          <span className="text-[10px] text-slate-500">{ord.createdAt}</span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              ord.status === "completed"
                                ? "bg-emerald-950 border-emerald-700 text-emerald-400"
                                : ord.status === "processing"
                                ? "bg-blue-950 border-blue-700 text-blue-400"
                                : ord.status === "cancelled"
                                ? "bg-rose-950 border-rose-800 text-rose-400"
                                : "bg-amber-950 border-amber-800 text-amber-400"
                            }`}
                          >
                            {ord.status === "completed"
                              ? "SELESAI"
                              : ord.status === "processing"
                              ? "LUNAS / DIPROSES"
                              : ord.status === "cancelled"
                              ? "DIBATALKAN"
                              : "MENUNGGU PEMBAYARAN / KONFIRMASI"}
                          </span>
                        </div>

                        <h4 className="text-sm font-black text-white">{ord.title}</h4>
                        <p className="text-xs text-slate-400">{ord.detail}</p>
                        <div className="text-[11px] text-slate-400">
                          Metode: <strong className="text-white">{ord.paymentMethod}</strong>
                        </div>
                        {(ord.sellers || []).length > 0 && (
                          <div className="text-[11px] text-slate-400">
                            Penjual Akun:{" "}
                            <strong className="text-indigo-300">{ord.sellers.map((sl) => sl.name).join(", ")}</strong>
                          </div>
                        )}

                        {ord.cancelReason && (
                          <div className="text-[11px] text-rose-400 italic">
                            Alasan Pembatalan: {ord.cancelReason}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col md:items-end justify-between gap-3">
                        <div className="text-left md:text-right">
                          <span className="text-[10px] text-slate-500 block uppercase font-bold">Total Biaya:</span>
                          <span className="text-lg font-black text-cyan-400">
                            Rp {Number(ord.price).toLocaleString("id-ID")}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveOrder(ord);
                              setPaymentProofImage(ord.proofImage || "");
                              setShowPaymentModal(true);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-xs font-bold transition flex items-center gap-1.5"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>{ord.submittedProof ? "Lihat Status Bayar" : "Bayar Sekarang"}</span>
                          </button>

                          {ord.status === "pending" && (
                            <button
                              type="button"
                              onClick={() => handleCancelOrderByBuyer(ord.id)}
                              className="px-3 py-1.5 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-800 text-rose-300 text-xs font-bold transition flex items-center gap-1.5 shadow"
                            >
                              <X className="w-3.5 h-3.5 text-rose-400" /> Batalkan Pesanan
                            </button>
                          )}

                          {(ord.status === "processing" ||
                            ord.status === "completed" ||
                            (ord.status === "pending" && ord.submittedProof)) &&
                            ord.refundStatus !== "requested" &&
                            ord.refundStatus !== "approved" && (
                              <button
                                type="button"
                                onClick={() => {
                                  setRefundTargetOrder(ord);
                                  setShowRefundModal(true);
                                }}
                                className="px-3 py-1.5 rounded-xl bg-amber-950/60 hover:bg-amber-900 border border-amber-800 text-amber-300 text-xs font-bold transition flex items-center gap-1.5 shadow"
                              >
                                <RotateCcw className="w-3.5 h-3.5 text-amber-400" /> Ajukan Pengembalian
                              </button>
                            )}

                          {ord.refundStatus === "requested" && (
                            <span className="text-[10px] font-bold text-amber-400 bg-amber-950/80 px-2.5 py-1.5 rounded-xl border border-amber-800 flex items-center gap-1">
                              <RotateCcw className="w-3 h-3 text-amber-400" /> Refund Diajukan (Menunggu Admin)
                            </span>
                          )}

                          {ord.refundStatus === "approved" && (
                            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/80 px-2.5 py-1.5 rounded-xl border border-emerald-800">
                              ✓ Refund Disetujui
                            </span>
                          )}

                          {ord.refundStatus === "rejected" && (
                            <span className="text-[10px] font-bold text-rose-400 bg-rose-950/80 px-2.5 py-1.5 rounded-xl border border-rose-800">
                              ✕ Refund Ditolak
                            </span>
                          )}

                          {((ord.status === "pending" && ord.submittedProof) ||
                            ord.status === "processing" || ord.status === "completed") && (
                            <a
                              href={generateWhatsAppLink(ord)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow"
                            >
                              <MessageCircle className="w-3.5 h-3.5" /> Chat WA Admin
                            </a>
                          )}

                          {(ord.status === "processing" || ord.status === "completed") &&
                            (ord.sellers || [])
                              .filter((sl) => sl.whatsapp)
                              .map((sl) => (
                                <a
                                  key={sl.id || "store"}
                                  href={sellerWaLink(sl, ord.title, ord.id)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow"
                                >
                                  <MessageCircle className="w-3.5 h-3.5" /> Chat Penjual ({sl.name})
                                </a>
                              ))}

                          {(ord.status === "completed" || ord.status === "cancelled") && (
                            <button
                              type="button"
                              onClick={() => handleDeleteOrderByBuyer(ord)}
                              className="px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-rose-950 border border-slate-700 hover:border-rose-800 text-slate-400 hover:text-rose-300 text-xs font-bold transition flex items-center gap-1.5"
                              title="Hapus dari riwayat saya"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Hapus
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 4: PANEL ADMIN */}
        {/* ========================================================= */}
        {activeTab === "admin" && currentUser.role === "admin" && (
          <div className="space-y-8">
            <div className="bg-gradient-to-r from-indigo-950/80 to-slate-900 p-6 rounded-3xl border border-indigo-800/50 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
                  <Sliders className="w-6 h-6 text-indigo-400" /> {isRoot ? "Panel Manajemen Toko" : "Panel Penjual Akun"}
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  {isRoot
                    ? "Kontrol master game, skema tarif joki, stok katalog akun, metode bayar, buku kas, dan approval staff."
                    : "Bagian khusus Anda: jual akun game, atur stok, dan hapus akun milik Anda sendiri. Akun milik admin lain tidak terlihat di sini."}
                </p>
              </div>

              {currentUser.isRootAdmin ? (
                <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/40 px-3.5 py-1.5 rounded-2xl text-xs font-black text-amber-400">
                  <Crown className="w-4 h-4 text-amber-400" />
                  <span>SUPER ADMIN (AKUN PUSAT)</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/40 px-3.5 py-1.5 rounded-2xl text-xs font-bold text-indigo-300">
                  <ShieldCheck className="w-4 h-4 text-indigo-400" />
                  <span>Admin Penjual Akun</span>
                </div>
              )}
            </div>

            {/* SUPER ADMIN: STAFF APPROVAL & PERMISSIONS */}
            {currentUser.isRootAdmin && (
              <div className="bg-slate-900/90 border border-amber-800/60 p-6 rounded-3xl space-y-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <Crown className="w-5 h-5 text-amber-400" /> Persetujuan, Izin Akses & Manajemen Admin
                  </h3>
                  <span className="text-[11px] bg-amber-950 border border-amber-800 text-amber-400 px-3 py-1 rounded-full font-bold">
                    Super Admin Control
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Admin baru hanya bisa masuk setelah Anda setujui. Admin biasa adalah penjual akun: mereka hanya bisa menjual,
                  mengatur stok, dan menghapus akun game milik mereka sendiri. Pengaturan joki, pesanan, pembayaran, dan
                  pengaturan toko lainnya hanya bisa diatur oleh Super Admin.
                </p>

                {staff.length === 0 ? (
                  <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl text-xs text-slate-500 text-center">
                    Belum ada permohonan admin baru.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {staff.map((adm) => (
                      <div key={adm.id} className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <span className="font-bold text-white text-sm block">{adm.name}</span>
                            <span className="block text-[11px] text-slate-400">
                              {adm.email} • {adm.phone}
                            </span>
                            <span className="block text-[10px] text-slate-500">
                              Daftar: {adm.registeredAt ? new Date(adm.registeredAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "-"}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                adm.adminStatus === "approved"
                                  ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                                  : adm.adminStatus === "rejected"
                                  ? "bg-rose-950 text-rose-400 border border-rose-800"
                                  : "bg-amber-950 text-amber-400 border border-amber-800 animate-pulse"
                              }`}
                            >
                              {adm.adminStatus === "approved"
                                ? "DISETUJUI"
                                : adm.adminStatus === "rejected"
                                ? "DITOLAK"
                                : "MENUNGGU APPROVAL"}
                            </span>
                            {adm.adminStatus !== "approved" && (
                              <button
                                type="button"
                                onClick={() => handleApproveAdmin(adm.id, "approved")}
                                className="px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] inline-flex items-center gap-1 shadow"
                              >
                                <UserCheck className="w-3 h-3" /> Setujui
                              </button>
                            )}
                            {adm.adminStatus !== "rejected" && (
                              <button
                                type="button"
                                onClick={() => handleApproveAdmin(adm.id, "rejected")}
                                className="px-2.5 py-1 rounded-xl bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 font-bold text-[10px] inline-flex items-center gap-1 shadow"
                              >
                                <UserX className="w-3 h-3" /> {adm.adminStatus === "approved" ? "Cabut Akses" : "Tolak"}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(adm)}
                              className="p-1.5 rounded-xl text-slate-500 hover:text-rose-400"
                              title="Hapus akun admin"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center gap-2 text-[10px]">
                          <span className="px-2.5 py-1 rounded-xl font-bold border bg-indigo-950 border-indigo-700 text-indigo-200">
                            Akses: Jual & Hapus Akun Miliknya Sendiri
                          </span>
                          <span className="px-2.5 py-1 rounded-xl font-bold border bg-slate-900 border-slate-700 text-slate-300">
                            Akun dijual: {accounts.filter((a) => a.sellerId === adm.id).length}
                          </span>
                          <span className="px-2.5 py-1 rounded-xl font-bold border bg-slate-900 border-slate-700 text-slate-300">
                            WA Penjual: {adm.phone || "-"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* SUPER ADMIN: CUSTOMER ACCOUNTS */}
            {currentUser.isRootAdmin && (
              <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-3xl space-y-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <Users className="w-5 h-5 text-cyan-400" /> Akun Pelanggan Terdaftar ({customers.length})
                  </h3>
                  <span className="text-[11px] bg-slate-800 text-slate-400 px-3 py-1 rounded-full font-bold">
                    Data pesanan tiap pelanggan bersifat privat
                  </span>
                </div>
                {customers.length === 0 ? (
                  <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl text-xs text-slate-500 text-center">
                    Belum ada pelanggan yang mendaftar.
                  </div>
                ) : (
                  <div className="overflow-x-auto max-h-80 overflow-y-auto">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-slate-950 text-slate-500 uppercase text-[10px] font-bold sticky top-0">
                        <tr>
                          <th className="p-3">Nama</th>
                          <th className="p-3">Email & WA</th>
                          <th className="p-3">Waktu Daftar</th>
                          <th className="p-3 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {customers.map((cu) => (
                          <tr key={cu.id} className="hover:bg-slate-950/40">
                            <td className="p-3 font-bold text-white">{cu.name}</td>
                            <td className="p-3">
                              <span className="block text-slate-300">{cu.email}</span>
                              <span className="block text-[10px] text-slate-500">{cu.phone}</span>
                            </td>
                            <td className="p-3 text-[10px] text-slate-500">
                              {cu.registeredAt ? new Date(cu.registeredAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "-"}
                            </td>
                            <td className="p-3 text-right">
                              <button
                                type="button"
                                onClick={() => handleDeleteUser(cu)}
                                className="px-2 py-1 rounded bg-rose-950 hover:bg-rose-900 text-rose-400 text-[10px] font-bold"
                              >
                                Hapus Akun
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ADMIN PENJUAL: NOMOR WA & PENJUALAN AKUN SAYA */}
            {!isRoot && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <form
                  onSubmit={handleSaveSellerWhatsapp}
                  className="bg-slate-900/90 border border-indigo-800/60 p-6 rounded-3xl space-y-3"
                >
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <Phone className="w-5 h-5 text-emerald-400" /> Nomor WhatsApp Penjual
                  </h3>
                  <p className="text-xs text-slate-400">
                    Nomor ini tampil di setiap akun yang Anda jual, sehingga pembeli bisa menghubungi Anda langsung.
                  </p>
                  <label htmlFor="seller-wa" className="text-[11px] font-bold text-slate-400 block">
                    Nomor WhatsApp:
                  </label>
                  <input
                    id="seller-wa"
                    type="tel"
                    required
                    placeholder="08xxxxxxxxxx"
                    value={sellerWaDraft ?? currentUser.phone ?? ""}
                    onChange={(e) => setSellerWaDraft(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow"
                    >
                      Simpan Nomor
                    </button>
                    {currentUser.phone && (
                      <a
                        href={waLink(currentUser.phone)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-emerald-400 hover:text-emerald-300 font-bold"
                      >
                        Tes link WA
                      </a>
                    )}
                  </div>
                </form>

                <div className="lg:col-span-2 bg-slate-900/90 border border-slate-800 p-6 rounded-3xl space-y-3">
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <ShoppingBag className="w-5 h-5 text-cyan-400" /> Penjualan Akun Saya ({sellerOrders.length})
                  </h3>
                  <p className="text-xs text-slate-400">
                    Pesanan yang berisi akun milik Anda. Verifikasi pembayaran dilakukan oleh Super Admin; nomor WhatsApp
                    pembeli muncul setelah pembayaran diverifikasi.
                  </p>
                  {sellerOrders.length === 0 ? (
                    <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl text-xs text-slate-500 text-center">
                      Belum ada akun Anda yang dipesan.
                    </div>
                  ) : (
                    <div className="overflow-x-auto max-h-80 overflow-y-auto">
                      <table className="w-full text-left text-xs text-slate-300">
                        <thead className="bg-slate-950 text-slate-500 uppercase text-[10px] font-bold sticky top-0">
                          <tr>
                            <th className="p-3">ID & Waktu</th>
                            <th className="p-3">Akun</th>
                            <th className="p-3">Pembeli</th>
                            <th className="p-3">Total</th>
                            <th className="p-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {sellerOrders.map((so) => (
                            <tr key={so.id} className="hover:bg-slate-950/40">
                              <td className="p-3">
                                <span className="font-mono text-cyan-400 font-bold block">#{so.id}</span>
                                <span className="text-[10px] text-slate-500 block">{formatDate(so.createdAt)}</span>
                              </td>
                              <td className="p-3">
                                {so.items.map((it, i) => (
                                  <span key={i} className="block text-white">
                                    {it.title} <span className="text-[10px] text-slate-500">({it.gameName})</span>
                                  </span>
                                ))}
                              </td>
                              <td className="p-3">
                                <span className="font-bold text-white block">{so.buyerName}</span>
                                {so.buyerWhatsapp && (
                                  <a
                                    href={waLink(so.buyerWhatsapp)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[10px] text-emerald-400 hover:text-emerald-300 block"
                                  >
                                    {so.buyerWhatsapp}
                                  </a>
                                )}
                              </td>
                              <td className="p-3 font-bold text-cyan-400">Rp {Number(so.total).toLocaleString("id-ID")}</td>
                              <td className="p-3">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    so.status === "completed"
                                      ? "bg-emerald-950 text-emerald-400"
                                      : so.status === "processing"
                                      ? "bg-indigo-950 text-indigo-300"
                                      : so.status === "cancelled"
                                      ? "bg-rose-950 text-rose-400"
                                      : "bg-amber-950 text-amber-400"
                                  }`}
                                >
                                  {so.status === "completed"
                                    ? "SELESAI"
                                    : so.status === "processing"
                                    ? "LUNAS / DIPROSES"
                                    : so.status === "cancelled"
                                    ? "DIBATALKAN"
                                    : "MENUNGGU PEMBAYARAN"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {can("orders") && (
            <>
            {/* BUKU KAS & LAPORAN TRANSAKSI */}
            <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-3xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <ReceiptText className="w-5 h-5 text-emerald-400" /> Buku Kas & Laporan Transaksi
                </h3>
                <div className="flex gap-2">
                  {["all", "JOKI", "ACCOUNT"].map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setLedgerFilter(f)}
                      className={`px-3 py-1 rounded-xl text-xs font-bold transition border ${
                        ledgerFilter === f
                          ? "bg-emerald-950 border-emerald-600 text-emerald-300"
                          : "bg-slate-950 border-slate-800 text-slate-400"
                      }`}
                    >
                      {f === "all" ? "Semua Transaksi" : f === "JOKI" ? "Jasa Joki" : "Toko Akun"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                  <span className="text-[11px] font-bold text-slate-500 uppercase block">Total Omzet Lunas</span>
                  <span className="text-2xl font-black text-emerald-400 block mt-1">
                    Rp {totalOmzetLunas.toLocaleString("id-ID")}
                  </span>
                  <span className="text-[10px] text-slate-500">Seluruh pesanan selesai & lunas</span>
                </div>
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                  <span className="text-[11px] font-bold text-slate-500 uppercase block">Omzet Jasa Joki</span>
                  <span className="text-2xl font-black text-cyan-400 block mt-1">
                    Rp {omzetJoki.toLocaleString("id-ID")}
                  </span>
                  <span className="text-[10px] text-slate-500">Khusus layanan kalkulator joki</span>
                </div>
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                  <span className="text-[11px] font-bold text-slate-500 uppercase block">Omzet Penjualan Akun</span>
                  <span className="text-2xl font-black text-indigo-400 block mt-1">
                    Rp {omzetAkun.toLocaleString("id-ID")}
                  </span>
                  <span className="text-[10px] text-slate-500">Khusus etalase jual beli akun</span>
                </div>
              </div>
            </div>

            {/* TABEL KELOLA PESANAN MASUK & VERIFIKASI STRUK */}
            <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-3xl space-y-4">
              <h3 className="text-base font-black text-white flex items-center justify-between">
                <span>Kelola & Verifikasi Pesanan Masuk ({adminOrders.length})</span>
              </h3>
              <p className="text-[11px] text-slate-500 -mt-2">
                Menghapus pesanan di sini hanya menghilangkannya dari daftar admin — riwayat milik pelanggan tetap utuh.
              </p>
              {adminOrders.length === 0 ? (
                <div className="text-xs text-slate-500 text-center py-4">Belum ada pesanan masuk.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950 text-slate-500 uppercase text-[10px] font-bold">
                      <tr>
                        <th className="p-3">ID & Waktu</th>
                        <th className="p-3">Pembeli</th>
                        <th className="p-3">Layanan</th>
                        <th className="p-3">Biaya</th>
                        <th className="p-3">Struk Transfer</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 text-right">Aksi Verifikasi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {adminOrders
                        .filter((o) => (ledgerFilter === "all" ? true : o.type === ledgerFilter))
                        .map((ord) => (
                          <tr key={ord.id} className="hover:bg-slate-950/40">
                            <td className="p-3">
                              <span className="font-mono text-cyan-400 font-bold block">#{ord.id}</span>
                              <span className="text-[10px] text-slate-500 block">{ord.createdAt}</span>
                            </td>
                            <td className="p-3">
                              <span className="font-bold text-white block">{ord.buyerName}</span>
                              <span className="text-[10px] text-slate-400 block">{ord.whatsapp}</span>
                            </td>
                            <td className="p-3">
                              <span className="text-white block">{ord.title}</span>
                              <span className="text-[10px] text-slate-500 block">{ord.detail}</span>
                              {(ord.sellers || []).length > 0 && (
                                <span className="text-[10px] text-indigo-300 block mt-1">
                                  Penjual:{" "}
                                  {ord.sellers.map((sl) => `${sl.name}${sl.whatsapp ? ` (${sl.whatsapp})` : ""}`).join(", ")}
                                </span>
                              )}
                            </td>
                            <td className="p-3 font-bold text-cyan-400">
                              Rp {Number(ord.price).toLocaleString("id-ID")}
                            </td>
                            <td className="p-3">
                              {ord.proofImage ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPreviewFullImage({
                                      url: ord.proofImage,
                                      title: `Bukti Transfer #${ord.id}`,
                                      info: `Pembeli: ${ord.buyerName} (${ord.whatsapp})`
                                    })
                                  }
                                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-cyan-950/60 hover:bg-cyan-900 border border-cyan-800 text-cyan-300 text-[10px] font-bold rounded-lg"
                                >
                                  <Eye className="w-3.5 h-3.5" /> Lihat Full Screen
                                </button>
                              ) : (
                                <span className="text-[10px] text-slate-500 italic">Belum Upload</span>
                              )}
                            </td>
                            <td className="p-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  ord.status === "completed"
                                    ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                                    : ord.status === "processing"
                                    ? "bg-blue-950 text-blue-400 border border-blue-800"
                                    : ord.status === "cancelled"
                                    ? "bg-rose-950 text-rose-400 border border-rose-800"
                                    : "bg-amber-950 text-amber-400 border border-amber-800"
                                }`}
                              >
                                {ord.status.toUpperCase()}
                              </span>
                              {ord.refundStatus === "requested" && (
                                <div className="mt-1 space-y-0.5">
                                  <span className="block text-[9px] font-black text-amber-400 bg-amber-950/80 px-1.5 py-0.5 rounded border border-amber-800">
                                    PENGAJUAN REFUND
                                  </span>
                                  {ord.refundReason && (
                                    <span className="block text-[10px] text-slate-400">Alasan: {ord.refundReason}</span>
                                  )}
                                  <span className="block text-[10px] text-slate-400">Tujuan: {ord.refundBankDetails}</span>
                                  {ord.refundContact && (
                                    <span className="block text-[10px] text-slate-400">WA: {ord.refundContact}</span>
                                  )}
                                  {ord.refundEvidenceImage && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setPreviewFullImage({
                                          url: ord.refundEvidenceImage,
                                          title: `Bukti Kendala #${ord.id}`,
                                          info: `Pembeli: ${ord.buyerName}`
                                        })
                                      }
                                      className="text-[10px] text-cyan-400 hover:underline font-bold"
                                    >
                                      Lihat foto kendala
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="p-3 text-right space-x-1">
                              {ord.refundStatus === "requested" && (
                                <div className="inline-flex gap-1 mr-1">
                                  <button
                                    type="button"
                                    onClick={() => handleAdminProcessRefund(ord.id, "approved")}
                                    className="px-2 py-1 rounded bg-amber-600 hover:bg-amber-500 text-slate-950 text-[10px] font-black"
                                    title={`Tujuan: ${ord.refundBankDetails}`}
                                  >
                                    Setujui Refund
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleAdminProcessRefund(ord.id, "rejected")}
                                    className="px-2 py-1 rounded bg-slate-800 hover:bg-rose-950 text-rose-400 text-[10px] font-bold"
                                  >
                                    Tolak
                                  </button>
                                </div>
                              )}

                              {ord.status === "pending" && (
                                <button
                                  type="button"
                                  onClick={() => handleAdminConfirmPayment(ord.id)}
                                  className="px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold shadow"
                                >
                                  Konfirmasi Lunas
                                </button>
                              )}
                              {ord.status === "processing" && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateOrderStatus(ord.id, "completed")}
                                  className="px-2.5 py-1 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-[10px] font-bold shadow"
                                >
                                  Selesaikan
                                </button>
                              )}
                              {ord.status !== "cancelled" && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateOrderStatus(ord.id, "cancelled")}
                                  className="px-2.5 py-1 rounded-xl bg-rose-950 hover:bg-rose-900 text-rose-400 text-[10px] font-bold"
                                >
                                  Batalkan
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleDeleteOrderByAdmin(ord)}
                                className="p-1.5 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-slate-800 align-middle"
                                title="Hapus dari daftar admin"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            </>
            )}

            {can("payments") && (
            <>
            {/* KELOLA METODE & REKENING PEMBAYARAN */}
            <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-3xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-cyan-400" /> Kelola Rekening & QRIS Pembayaran Toko
                </h3>
                <span className="text-[11px] bg-slate-800 text-slate-400 px-3 py-1 rounded-full font-bold">
                  Bisa Dengan / Tanpa Foto
                </span>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newPayName || !newPayAccount || !newPayHolder) {
                    showToast("Lengkapi nama bank, nomor rekening, dan nama pemilik!");
                    return;
                  }
                  const newP = {
                    id: "pay_" + Date.now().toString(36),
                    name: newPayName.trim(),
                    accountNumber: newPayAccount.trim(),
                    accountHolder: newPayHolder.trim(),
                    hasImage: newPayHasPhoto,
                    image: newPayHasPhoto ? newPayImage : ""
                  };
                  setPaymentMethods((prev) => [...prev, newP]);
                  setNewPayName("");
                  setNewPayAccount("");
                  setNewPayHolder("");
                  setNewPayHasPhoto(false);
                  setNewPayImage("");
                  showToast("Metode pembayaran baru ditambahkan!");
                }}
                className="space-y-4 bg-slate-950 p-4 rounded-2xl border border-slate-800"
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 block mb-1">
                      Nama Metode (Bank / QRIS / E-Wallet):
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: QRIS All Payment / Bank BCA"
                      value={newPayName}
                      onChange={(e) => setNewPayName(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-400 block mb-1">
                      Nomor Rekening / NMID:
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: 8831293812 / ID1020030040506"
                      value={newPayAccount}
                      onChange={(e) => setNewPayAccount(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-400 block mb-1">
                      Atas Nama (Pemilik Akun):
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: CATALYST STORE OFFICIAL"
                      value={newPayHolder}
                      onChange={(e) => setNewPayHolder(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span className="text-xs font-bold text-slate-400">Pilihan Foto Barcode / QR:</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setNewPayHasPhoto(false)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
                        !newPayHasPhoto
                          ? "bg-cyan-950 border-cyan-500 text-cyan-300"
                          : "bg-slate-900 border-slate-800 text-slate-400"
                      }`}
                    >
                      ✕ Tanpa Foto
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewPayHasPhoto(true)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
                        newPayHasPhoto
                          ? "bg-cyan-950 border-cyan-500 text-cyan-300"
                          : "bg-slate-900 border-slate-800 text-slate-400"
                      }`}
                    >
                      ✓ Pakai Foto (QRIS / Barcode)
                    </button>
                  </div>
                </div>

                {newPayHasPhoto && (
                  <div className="space-y-2 p-3 bg-slate-900 rounded-xl border border-slate-800">
                    <label className="text-[11px] font-bold text-slate-400 block">
                      Unggah Gambar QRIS / Logo:
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e.target.files[0], setNewPayImage)}
                      className="w-full text-xs text-slate-400 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:bg-slate-800 file:text-cyan-400"
                    />
                    {newPayImage && (
                      <img src={newPayImage} alt="QR Preview" className="h-24 rounded border border-slate-700" />
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs uppercase rounded-xl transition"
                >
                  + Tambah Metode Pembayaran
                </button>
              </form>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {paymentMethods.map((pm) => (
                  <div
                    key={pm.id}
                    className="p-3 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-white block">{pm.name}</span>
                      <span className="text-cyan-400 font-mono text-[11px] block">{pm.accountNumber}</span>
                      <span className="text-[10px] text-slate-500 block">a.n {pm.accountHolder}</span>
                      {pm.hasImage && <span className="text-[9px] text-emerald-400 font-bold mt-1 block">✓ Ada Foto QR</span>}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentMethods((prev) => prev.filter((p) => p.id !== pm.id));
                        showToast(`Metode ${pm.name} dihapus.`);
                      }}
                      className="p-1.5 text-slate-500 hover:text-rose-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            </>
            )}

            {can("refund") && (
            <>
            {/* PENGATURAN SYARAT & FORMULIR REFUND */}
            <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-3xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <RotateCcw className="w-5 h-5 text-amber-400" /> Pengaturan Syarat Formulir Refund
                </h3>
                <span className="text-[11px] bg-amber-950 border border-amber-800 text-amber-400 px-3 py-1 rounded-full font-bold">
                  Kustomisasi Syarat Pelanggan
                </span>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">
                    Catatan Kebijakan Refund Toko:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={policyNoteValue}
                      onChange={(e) => setPolicyDraft(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                    />
                    <button
                      type="button"
                      disabled={policyDraft === null}
                      onClick={async () => {
                        const res = await setRefundConfig((p) => ({ ...p, policyNote: policyNoteValue }));
                        if (res) {
                          setPolicyDraft(null);
                          showToast("Catatan kebijakan refund disimpan untuk semua akun!");
                        }
                      }}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-bold text-xs rounded-xl shadow shrink-0"
                    >
                      Simpan
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-slate-950 border border-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={refundConfig.requireReason}
                      onChange={(e) => setRefundConfig((p) => ({ ...p, requireReason: e.target.checked }))}
                      className="w-4 h-4 rounded text-amber-500 focus:ring-0 bg-slate-900 border-slate-700"
                    />
                    <span className="text-xs text-white font-bold">Wajibkan Alasan</span>
                  </label>
                  <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-slate-950 border border-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={refundConfig.requireBankName}
                      onChange={(e) => setRefundConfig((p) => ({ ...p, requireBankName: e.target.checked }))}
                      className="w-4 h-4 rounded text-amber-500 focus:ring-0 bg-slate-900 border-slate-700"
                    />
                    <span className="text-xs text-white font-bold">Wajibkan Nama Bank</span>
                  </label>
                  <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-slate-950 border border-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={refundConfig.requireAccountNumber}
                      onChange={(e) => setRefundConfig((p) => ({ ...p, requireAccountNumber: e.target.checked }))}
                      className="w-4 h-4 rounded text-amber-500 focus:ring-0 bg-slate-900 border-slate-700"
                    />
                    <span className="text-xs text-white font-bold">Wajibkan Nomor Rekening</span>
                  </label>
                  <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-slate-950 border border-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={refundConfig.requireAccountHolder}
                      onChange={(e) => setRefundConfig((p) => ({ ...p, requireAccountHolder: e.target.checked }))}
                      className="w-4 h-4 rounded text-amber-500 focus:ring-0 bg-slate-900 border-slate-700"
                    />
                    <span className="text-xs text-white font-bold">Wajibkan Nama Pemilik Rekening</span>
                  </label>
                  <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-slate-950 border border-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={refundConfig.requireAlternativeContact}
                      onChange={(e) => setRefundConfig((p) => ({ ...p, requireAlternativeContact: e.target.checked }))}
                      className="w-4 h-4 rounded text-amber-500 focus:ring-0 bg-slate-900 border-slate-700"
                    />
                    <span className="text-xs text-white font-bold">Wajibkan WA Alternatif</span>
                  </label>
                  <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-slate-950 border border-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={refundConfig.requireEvidenceImage}
                      onChange={(e) => setRefundConfig((p) => ({ ...p, requireEvidenceImage: e.target.checked }))}
                      className="w-4 h-4 rounded text-amber-500 focus:ring-0 bg-slate-900 border-slate-700"
                    />
                    <span className="text-xs text-white font-bold">Wajibkan Foto Kendala</span>
                  </label>
                </div>
              </div>
            </div>

            </>
            )}

            {can("contact") && (
            <>
            {/* PENGATURAN KONTAK ADMIN */}
            <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-3xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <Phone className="w-5 h-5 text-emerald-400" /> Pengaturan Kontak WhatsApp Admin & CS
                </h3>
                <span className="text-[11px] bg-emerald-950 border border-emerald-800 text-emerald-400 px-3 py-1 rounded-full font-bold">
                  Aktif di Seluruh Pesanan
                </span>
              </div>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const res = await updateSetting("contact", { ...contactForm });
                  if (res) {
                    setContactDraft(null);
                    showToast("Kontak admin berhasil disimpan untuk semua akun!");
                  }
                }}
                className="grid grid-cols-1 sm:grid-cols-3 gap-3"
              >
                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">Nomor WhatsApp Admin:</label>
                  <input
                    type="tel"
                    required
                    value={contactForm.whatsapp}
                    onChange={(e) => setContactDraft({ ...contactForm, whatsapp: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-bold"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">Nama CS / Identitas:</label>
                  <input
                    type="text"
                    required
                    value={contactForm.csName}
                    onChange={(e) => setContactDraft({ ...contactForm, csName: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">Jam Operasional:</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={contactForm.operationalHours}
                      onChange={(e) => setContactDraft({ ...contactForm, operationalHours: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow shrink-0"
                    >
                      Simpan
                    </button>
                  </div>
                </div>
              </form>
            </div>

            </>
            )}

            {can("catalog") && (
            <>
            {/* MASTER GAME & JENIS JOKI */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Tambah Master Game */}
              <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-3xl space-y-4">
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <Gamepad2 className="w-5 h-5 text-cyan-400" /> Daftarkan Game Baru
                </h3>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!newGameName.trim()) return;
                    const newG = {
                      id: "g_" + Date.now().toString(36),
                      name: newGameName.trim(),
                      icon: newGameIcon.trim() || "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=200&auto=format&fit=crop"
                    };
                    setMasterGames((p) => [...p, newG]);
                    setNewGameName("");
                    setNewGameIcon("");
                    showToast(`Game ${newG.name} didaftarkan!`);
                  }}
                  className="space-y-3"
                >
                  <input
                    type="text"
                    required
                    placeholder="Nama Game (misal: Valorant, Genshin)"
                    value={newGameName}
                    onChange={(e) => setNewGameName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                  />
                  <div className="flex gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e.target.files[0], setNewGameIcon)}
                      className="w-full text-xs text-slate-400 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:bg-slate-800 file:text-cyan-400"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-xl shadow shrink-0"
                    >
                      + Tambah Game
                    </button>
                  </div>
                </form>

                <div className="flex flex-wrap gap-2 pt-2">
                  {masterGames.map((g) => (
                    <div
                      key={g.id}
                      className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs"
                    >
                      <img src={g.icon} alt={g.name} className="w-4 h-4 rounded object-cover" />
                      <span className="font-bold text-white">{g.name}</span>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!window.confirm(`Hapus game ${g.name} beserta jenis joki & skema tarifnya?`)) return;
                          await setMasterGames((p) => p.filter((item) => item.id !== g.id));
                          if (jokiModels.some((m) => m.gameId === g.id))
                            await setJokiModels((p) => p.filter((m) => m.gameId !== g.id));
                          if (jokiServices.some((sv) => sv.gameId === g.id))
                            await setJokiServices((p) => p.filter((sv) => sv.gameId !== g.id));
                          showToast(`Game ${g.name} dihapus.`);
                        }}
                        className="text-slate-500 hover:text-rose-400 ml-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tambah Jenis Joki */}
              <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-3xl space-y-4">
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-400" /> Buat Jenis Joki
                </h3>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!modelGameId || !newModelName.trim()) return;
                    const game = masterGames.find((g) => g.id === modelGameId);
                    const newM = {
                      id: "m_" + Date.now().toString(36),
                      gameId: modelGameId,
                      gameName: game ? game.name : "",
                      name: newModelName.trim()
                    };
                    setJokiModels((p) => [...p, newM]);
                    setNewModelName("");
                    showToast(`Jenis joki ${newM.name} dibuat!`);
                  }}
                  className="space-y-3"
                >
                  <select
                    required
                    value={modelGameId}
                    onChange={(e) => setModelGameId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                  >
                    <option value="">-- Pilih Game Induk --</option>
                    {masterGames.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      placeholder="Nama Jenis (misal: LIGA, Rank, Win Streak)"
                      value={newModelName}
                      onChange={(e) => setNewModelName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow shrink-0"
                    >
                      + Tambah
                    </button>
                  </div>
                </form>

                <div className="flex flex-wrap gap-2 pt-2">
                  {jokiModels.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs"
                    >
                      <span className="text-[10px] bg-slate-800 text-cyan-400 px-1.5 py-0.5 rounded font-bold">
                        {m.gameName}
                      </span>
                      <span className="font-bold text-white">{m.name}</span>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!window.confirm(`Hapus jenis joki ${m.name} beserta skema tarifnya?`)) return;
                          await setJokiModels((p) => p.filter((item) => item.id !== m.id));
                          if (jokiServices.some((sv) => sv.modelId === m.id))
                            await setJokiServices((p) => p.filter((sv) => sv.modelId !== m.id));
                          showToast(`Jenis joki ${m.name} dihapus.`);
                        }}
                        className="text-slate-500 hover:text-rose-400 ml-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            </>
            )}

            {can("pricing") && (
            <>
            {/* PENGATURAN SKEMA TARIF JOKI */}
            <div ref={pricingFormRef} className="bg-slate-900/90 border border-slate-800 p-6 rounded-3xl space-y-4 scroll-mt-24">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-400" /> Pengaturan Checkpoint & Skema Tarif
                </h3>
                <span className="text-[11px] bg-emerald-950 border border-emerald-800 text-emerald-400 px-3 py-1 rounded-full font-bold">
                  Tersimpan otomatis ke Kalkulator Joki
                </span>
              </div>

              {editingServiceId && (
                <div className="p-3 bg-indigo-950/50 border border-indigo-700 rounded-2xl text-xs text-indigo-200 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <Pencil className="w-4 h-4 text-indigo-400" />
                    Sedang mengedit skema tersimpan. Klik <strong>Simpan Perubahan</strong> untuk memperbarui.
                  </span>
                  <button
                    type="button"
                    onClick={resetPricingForm}
                    className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-white font-bold text-[10px]"
                  >
                    Batal Edit
                  </button>
                </div>
              )}

              <form
                onSubmit={handleSaveService}
                className="space-y-4"
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 block mb-1">Game:</label>
                    <select
                      required
                      value={configGameId}
                      onChange={(e) => {
                        setConfigGameId(e.target.value);
                        setConfigModelId("");
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                    >
                      <option value="">-- Pilih Game --</option>
                      {masterGames.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-400 block mb-1">Jenis Joki:</label>
                    <select
                      required
                      value={configModelId}
                      onChange={(e) => setConfigModelId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                    >
                      <option value="">-- Pilih Jenis Joki --</option>
                      {jokiModels
                        .filter((m) => m.gameId === configGameId)
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-400 block mb-1">Model Tarif:</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setConfigPricingType("tiers")}
                        className={`py-2 text-xs font-bold rounded-xl border transition ${
                          configPricingType === "tiers"
                            ? "bg-emerald-950 border-emerald-500 text-emerald-300"
                            : "bg-slate-950 border-slate-800 text-slate-400"
                        }`}
                      >
                        Rentang Tier
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfigPricingType("multiplier")}
                        className={`py-2 text-xs font-bold rounded-xl border transition ${
                          configPricingType === "multiplier"
                            ? "bg-emerald-950 border-emerald-500 text-emerald-300"
                            : "bg-slate-950 border-slate-800 text-slate-400"
                        }`}
                      >
                        Kelipatan
                      </button>
                    </div>
                  </div>
                </div>

                {configPricingType === "multiplier" ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-slate-950 rounded-2xl border border-slate-800">
                    <div>
                      <label className="text-[11px] font-bold text-slate-400 block mb-1">Satuan Target:</label>
                      <input
                        type="text"
                        value={configMultiplierUnit}
                        onChange={(e) => setConfigMultiplierUnit(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-400 block mb-1">Tarif per Satuan (Rp):</label>
                      <input
                        type="number"
                        min="100"
                        value={configMultiplierPrice}
                        onChange={(e) => setConfigMultiplierPrice(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-bold"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 p-4 bg-slate-950 rounded-2xl border border-slate-800">
                    <div>
                      <label className="text-[11px] font-bold text-slate-400 block mb-1">
                        Daftar Semua Checkpoint (Pisahkan Koma):
                      </label>
                      <input
                        type="text"
                        value={configAllLevelsText}
                        onChange={(e) => setConfigAllLevelsText(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                      />
                      <div className="flex flex-wrap gap-1 mt-2">
                        {parseLevels(configAllLevelsText).map((lvl, idx) => (
                          <span
                            key={lvl}
                            className="px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-800 text-[10px] text-slate-300"
                          >
                            <span className="text-slate-500">{idx + 1}.</span> {lvl}
                          </span>
                        ))}
                      </div>
                      <span className="text-[10px] text-slate-500 block mt-1">
                        Daftar ini yang muncul sebagai pilihan Posisi Awal & Target Tujuan di Langkah 3 kalkulator.
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-400">Rentang Segmen Tarif:</span>
                        <button
                          type="button"
                          onClick={() => {
                            const list = parseLevels(configAllLevelsText);
                            if (list.length >= 2) {
                              setConfigSegments((p) => [
                                ...p,
                                { from: list[0], to: list[list.length - 1], pricePerStep: 2000 }
                              ]);
                            }
                          }}
                          className="text-[11px] text-cyan-400 hover:underline font-bold"
                        >
                          + Tambah Segmen Tarif
                        </button>
                      </div>

                      {configSegments.map((seg, idx) => {
                        const list = parseLevels(configAllLevelsText);
                        return (
                          <div key={idx} className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                            <span className="text-xs text-slate-500 font-bold shrink-0">Dari</span>
                            <select
                              value={list.includes(seg.from) ? seg.from : ""}
                              onChange={(e) => {
                                const v = e.target.value;
                                setConfigSegments((p) => p.map((s, i) => (i === idx ? { ...s, from: v } : s)));
                              }}
                              className="bg-slate-900 border border-slate-800 rounded-xl p-2 text-xs text-white"
                            >
                              <option value="">-- Pilih --</option>
                              {list.map((lvl) => (
                                <option key={lvl} value={lvl}>
                                  {lvl}
                                </option>
                              ))}
                            </select>

                            <span className="text-xs text-slate-500 font-bold shrink-0">Sampai</span>
                            <select
                              value={list.includes(seg.to) ? seg.to : ""}
                              onChange={(e) => {
                                const v = e.target.value;
                                setConfigSegments((p) => p.map((s, i) => (i === idx ? { ...s, to: v } : s)));
                              }}
                              className="bg-slate-900 border border-slate-800 rounded-xl p-2 text-xs text-white"
                            >
                              <option value="">-- Pilih --</option>
                              {list.map((lvl) => (
                                <option key={lvl} value={lvl}>
                                  {lvl}
                                </option>
                              ))}
                            </select>

                            <span className="text-xs text-slate-500 font-bold shrink-0">Tarif/Step (Rp):</span>
                            <input
                              type="number"
                              value={seg.pricePerStep}
                              onChange={(e) => {
                                const v = Number(e.target.value) || 0;
                                setConfigSegments((p) => p.map((s, i) => (i === idx ? { ...s, pricePerStep: v } : s)));
                              }}
                              className="w-28 bg-slate-900 border border-slate-800 rounded-xl p-2 text-xs text-white font-bold"
                            />

                            <button
                              type="button"
                              onClick={() => setConfigSegments((p) => p.filter((_, i) => i !== idx))}
                              className="p-2 text-slate-500 hover:text-rose-400"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow transition"
                >
                  {editingServiceId ? "Simpan Perubahan Skema" : "Simpan Skema Tarif"}
                </button>
              </form>

              <div className="pt-4 border-t border-slate-800 space-y-3">
                <span className="text-xs font-bold text-slate-400 block">
                  Skema Tarif Tersimpan ({jokiServices.length}) — inilah yang menjadi pilihan target di kalkulator joki
                </span>
                {jokiServices.length === 0 ? (
                  <div className="text-xs text-slate-500 text-center py-4 bg-slate-950 rounded-2xl border border-slate-800">
                    Belum ada skema tarif tersimpan.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {jokiServices.map((srv) => (
                      <div
                        key={srv.id}
                        className={`p-4 rounded-2xl border bg-slate-950 space-y-2 ${
                          editingServiceId === srv.id ? "border-indigo-500" : "border-slate-800"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[10px] bg-slate-800 text-cyan-400 px-1.5 py-0.5 rounded font-bold">
                              {srv.gameName}
                            </span>
                            <h4 className="text-sm font-black text-white mt-1">{srv.modelName}</h4>
                            <span className="text-[10px] text-slate-400">
                              {srv.pricingType === "multiplier"
                                ? `Kelipatan • Rp ${Number(srv.multiplierPrice).toLocaleString("id-ID")} / ${srv.multiplierUnit}`
                                : `Rentang Tier • ${(srv.allLevels || []).length} checkpoint`}
                            </span>
                          </div>
                          <div className="flex gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleEditService(srv)}
                              className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold flex items-center gap-1"
                            >
                              <Pencil className="w-3 h-3" /> Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteService(srv)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-900"
                              title="Hapus skema"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        {srv.pricingType !== "multiplier" && (
                          <>
                            <div className="flex flex-wrap gap-1">
                              {(srv.allLevels || []).map((lvl) => (
                                <span
                                  key={lvl}
                                  className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] text-slate-300"
                                >
                                  {lvl}
                                </span>
                              ))}
                            </div>
                            <div className="space-y-0.5">
                              {(srv.segments || []).map((seg, idx) => (
                                <span key={idx} className="block text-[10px] text-emerald-400">
                                  {seg.from} → {seg.to}: Rp {Number(seg.pricePerStep).toLocaleString("id-ID")} / tingkat
                                </span>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            </>
            )}

            {can("listings") && (
            <>
            {/* KUSTOMISASI KOLOM SPESIFIKASI AKUN & TAMBAH STOK AKUN */}
            <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-3xl space-y-6">
              {isRoot && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <Settings2 className="w-5 h-5 text-indigo-400" /> Kustomisasi Kolom Spesifikasi Akun Game
                  </h3>
                  <span className="text-[11px] bg-indigo-950 border border-indigo-800 text-indigo-300 px-3 py-1 rounded-full font-bold">
                    Dinamis Sesuai Kebutuhan
                  </span>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!newCustomFieldName.trim()) return;
                    const fieldId = "spec_" + Date.now().toString(36);
                    const newField = {
                      id: fieldId,
                      label: newCustomFieldName.trim(),
                      type: newCustomFieldType,
                      placeholder: `Isi ${newCustomFieldName.trim()}`,
                      enabled: true
                    };
                    setAccountFieldsConfig((p) => [...p, newField]);
                    setNewCustomFieldName("");
                    showToast(`Kolom "${newField.label}" ditambahkan!`);
                  }}
                  className="flex flex-col sm:flex-row gap-2 bg-slate-950 p-3.5 rounded-2xl border border-slate-800"
                >
                  <input
                    type="text"
                    required
                    placeholder="Nama Kolom Baru (misal: Win Rate, Server, Level Akun)"
                    value={newCustomFieldName}
                    onChange={(e) => setNewCustomFieldName(e.target.value)}
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  />
                  <select
                    value={newCustomFieldType}
                    onChange={(e) => setNewCustomFieldType(e.target.value)}
                    className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="text">Teks / Keterangan</option>
                    <option value="number">Angka / Jumlah</option>
                  </select>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow shrink-0"
                  >
                    + Tambah Kolom
                  </button>
                </form>

                <div className="flex flex-wrap gap-2">
                  {accountFieldsConfig.map((field) => (
                    <div
                      key={field.id}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs ${
                        field.enabled
                          ? "bg-slate-950 border-indigo-500/50 text-white"
                          : "bg-slate-950/40 border-slate-800 text-slate-600 line-through"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setAccountFieldsConfig((p) =>
                            p.map((f) => (f.id === field.id ? { ...f, enabled: !f.enabled } : f))
                          )
                        }
                        className="font-bold hover:text-indigo-400"
                      >
                        {field.label} {field.enabled ? "✓" : "(Mati)"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAccountFieldsConfig((p) => p.filter((f) => f.id !== field.id));
                          showToast("Kolom dihapus.");
                        }}
                        className="text-slate-500 hover:text-rose-400"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              )}

              {/* Form Tambah / Edit Akun Jual */}
              <div ref={listingFormRef} className={`space-y-4 scroll-mt-24 ${isRoot ? "pt-4 border-t border-slate-800" : ""}`}>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h4 className="text-sm font-black text-white flex items-center gap-2">
                    {editingListingId ? (
                      <>
                        <Pencil className="w-4 h-4 text-indigo-400" /> Edit Akun Siap Jual
                      </>
                    ) : (
                      <>
                        <ShoppingBag className="w-4 h-4 text-cyan-400" /> Unggah Stok Akun Siap Jual
                      </>
                    )}
                  </h4>
                  {editingListingId && (
                    <button
                      type="button"
                      onClick={handleCancelEditListing}
                      className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-700 text-slate-300 hover:text-white font-bold text-[10px]"
                    >
                      Batal Edit
                    </button>
                  )}
                </div>
                <form
                  onSubmit={handleSaveListing}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-400 block mb-1">Pilih Game:</label>
                      <select
                        required
                        value={newAccForm.gameId}
                        onChange={(e) => setNewAccForm({ ...newAccForm, gameId: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                      >
                        <option value="">-- Pilih Game --</option>
                        {masterGames.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-400 block mb-1">Judul Akun:</label>
                      <input
                        type="text"
                        required
                        placeholder="Contoh: Akun Mythical Glory Full Skin"
                        value={newAccForm.title}
                        onChange={(e) => setNewAccForm({ ...newAccForm, title: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-400 block mb-1">Harga Pas (Rp):</label>
                      <input
                        type="number"
                        required
                        placeholder="Contoh: 150000"
                        value={newAccForm.price}
                        onChange={(e) => setNewAccForm({ ...newAccForm, price: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-bold"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-400 block mb-1">Jumlah Stok:</label>
                      <input
                        type="number"
                        min="0"
                        required
                        value={newAccForm.stock}
                        onChange={(e) => setNewAccForm({ ...newAccForm, stock: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-bold"
                      />
                    </div>
                  </div>

                  {accountFieldsConfig.filter((f) => f.enabled).length > 0 && (
                    <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
                      <span className="text-xs font-bold text-indigo-400 block">
                        Isi Spesifikasi Sesuai Kolom yang Aktif:
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {accountFieldsConfig
                          .filter((f) => f.enabled)
                          .map((field) => (
                            <div key={field.id}>
                              <label className="text-[11px] font-bold text-slate-400 block mb-1">
                                {field.label}:
                              </label>
                              <input
                                type={field.type || "text"}
                                placeholder={field.placeholder || `Isi ${field.label}`}
                                value={newAccForm.customSpecs?.[field.id] || ""}
                                onChange={(e) =>
                                  setNewAccForm({
                                    ...newAccForm,
                                    customSpecs: {
                                      ...newAccForm.customSpecs,
                                      [field.id]: e.target.value
                                    }
                                  })
                                }
                                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                              />
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="listing-images" className="text-[11px] font-bold text-slate-400 block mb-1">Foto Akun ({newAccForm.images.length}/10):</label>
                      <input id="listing-images" type="file" accept="image/*" multiple disabled={listingUploading}
                        onChange={(e) => { handleListingImages(e.target.files); e.target.value = ""; }}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-slate-400 disabled:opacity-50" />
                      <p role="status" className="text-[10px] text-slate-500 mt-1">{listingUploading ? "Mengunggah foto..." : "Maksimal 10 foto, 5 MB per foto. Foto pertama menjadi foto utama."}</p>
                      <div className="flex gap-2 flex-wrap mt-2">
                        {newAccForm.images.map((url, index) => (
                          <div key={`${url}-${index}`} className="w-24 rounded-lg border border-slate-700 p-1 space-y-1">
                            <img src={url} alt={`Foto akun ${index + 1}`} className="h-16 w-full object-cover rounded" />
                            <button type="button" disabled={listingUploading || index === 0} onClick={() => setNewAccForm((prev) => ({ ...prev, images: [url, ...prev.images.filter((_, i) => i !== index)] }))} className="text-[10px] text-cyan-400 disabled:text-slate-500 w-full">{index === 0 ? "Foto utama" : "Jadikan utama"}</button>
                            <button type="button" disabled={listingUploading} onClick={() => setNewAccForm((prev) => ({ ...prev, images: prev.images.filter((_, i) => i !== index) }))} className="text-[10px] text-rose-400 w-full">Hapus foto</button>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label htmlFor="listing-description" className="text-[11px] font-bold text-slate-400 block mb-1">Deskripsi Produk:</label>
                      <textarea id="listing-description" rows={6} maxLength={5000}
                        placeholder="Jelaskan isi akun, koleksi, kondisi, dan informasi penting untuk pembeli."
                        value={newAccForm.description}
                        onChange={(e) => setNewAccForm({ ...newAccForm, description: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white resize-y" />
                      <p className="text-[10px] text-slate-500 mt-1">{newAccForm.description.length}/5000 karakter. Pembeli dapat membuka deskripsi lengkap atau meringkasnya.</p>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={listingUploading}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow transition"
                  >
                    {editingListingId ? "Simpan Perubahan Akun" : "+ Unggah Akun ke Toko"}
                  </button>
                </form>
              </div>

              {/* Tabel Stok Akun */}
              <div className="pt-2">
                <span className="text-xs font-bold text-slate-400 block mb-2">
                  {isRoot ? `Daftar Stok Akun Semua Penjual (${myListings.length})` : `Daftar Akun Jual Milik Saya (${myListings.length})`}
                </span>
                {myListings.length === 0 ? (
                  <div className="text-xs text-slate-500 text-center py-4">
                    {isRoot ? "Belum ada akun di etalase." : "Anda belum menjual akun. Unggah akun pertama Anda di atas."}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-slate-950 text-slate-500 uppercase text-[10px] font-bold">
                        <tr>
                          <th className="p-3">Judul Akun</th>
                          <th className="p-3">Game</th>
                          {isRoot && <th className="p-3">Penjual</th>}
                          <th className="p-3">Harga</th>
                          <th className="p-3">Stok</th>
                          <th className="p-3">Status</th>
                          <th className="p-3 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {myListings.map((acc) => (
                          <tr key={acc.id} className="hover:bg-slate-950/40">
                            <td className="p-3 font-bold text-white">{acc.title}</td>
                            <td className="p-3 text-cyan-400">{acc.gameName}</td>
                            {isRoot && (
                              <td className="p-3">
                                <span className="block font-bold text-indigo-300">{acc.seller ? acc.seller.name : "CATALYST STORE (Resmi)"}</span>
                                {acc.seller?.whatsapp && <span className="block text-[10px] text-slate-500">{acc.seller.whatsapp}</span>}
                              </td>
                            )}
                            <td className="p-3 font-bold">Rp {Number(acc.price).toLocaleString("id-ID")}</td>
                            <td className="p-3">
                              <div className="inline-flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-xl p-0.5">
                                <button
                                  type="button"
                                  onClick={() => handleSetStock(acc, acc.stock - 1)}
                                  disabled={acc.stock <= 0}
                                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30"
                                  title="Kurangi stok"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="w-8 text-center font-black text-white">{acc.stock}</span>
                                <button
                                  type="button"
                                  onClick={() => handleSetStock(acc, acc.stock + 1)}
                                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                                  title="Tambah stok"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
                            <td className="p-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  acc.isSold ? "bg-rose-950 text-rose-400" : "bg-emerald-950 text-emerald-400"
                                }`}
                              >
                                {acc.isSold ? "HABIS" : "READY"}
                              </span>
                            </td>
                            <td className="p-3 text-right space-x-2 whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => handleEditListing(acc)}
                                className="px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold inline-flex items-center gap-1"
                              >
                                <Pencil className="w-3 h-3" /> Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteListing(acc)}
                                className="px-2 py-1 rounded bg-rose-950 hover:bg-rose-900 text-rose-400 text-[10px] font-bold inline-flex items-center gap-1"
                              >
                                <Trash2 className="w-3 h-3" /> Hapus
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
            </>
            )}

          </div>
        )}
      </main>

      {/* ========================================================= */}
      {/* MODAL: KERANJANG BELANJA (CART) */}
      {/* ========================================================= */}
      {showCartModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 max-w-lg w-full rounded-3xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setShowCartModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-black text-white flex items-center gap-2 mb-2">
              <ShoppingCart className="w-4 h-4 text-cyan-400" /> Keranjang Belanja Anda
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Bayar beberapa pesanan joki & beli akun sekaligus dengan 1 kali transfer.
            </p>

            {cartItems.length === 0 ? (
              <div className="p-8 text-center bg-slate-950 border border-slate-800 rounded-2xl text-slate-500 text-xs">
                Keranjang belanja masih kosong.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {cartItems.map((item) => (
                    <div
                      key={item.cartId}
                      className="p-3 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold text-white block">{item.title}</span>
                        <span className="text-[11px] text-slate-400 block">{item.detail}</span>
                        <span className="text-cyan-400 font-bold block mt-1">
                          Rp {Number(item.price).toLocaleString("id-ID")}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveFromCart(item.cartId)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400">Total Tagihan Bersama:</span>
                  <span className="text-xl font-black text-cyan-400">
                    Rp {cartTotalPrice.toLocaleString("id-ID")}
                  </span>
                </div>

                {pendingOrActiveOrder ? (
                  <div className="p-3 bg-amber-950/60 border border-amber-800 rounded-xl text-[11px] text-amber-300 flex items-center gap-2">
                    <Lock className="w-4 h-4 shrink-0 text-amber-400" />
                    <span>
                      Checkout terkunci karena Anda memiliki pesanan aktif <strong>#{pendingOrActiveOrder.id}</strong>.
                    </span>
                  </div>
                ) : (
                  <form onSubmit={handleCheckoutCart} className="space-y-3 pt-2">
                    <div>
                      <label className="text-[11px] font-bold text-slate-400 block mb-1">
                        Pilih Metode Pembayaran:
                      </label>
                      <select
                        required
                        value={cartPaymentMethodId}
                        onChange={(e) => setCartPaymentMethodId(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                      >
                        <option value="">-- Pilih Rekening / QRIS --</option>
                        {paymentMethods.map((pm) => (
                          <option key={pm.id} value={pm.id}>
                            {pm.name} ({pm.accountHolder})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-400 block mb-1">Nomor WhatsApp Anda:</label>
                      <input
                        type="tel"
                        required
                        placeholder="08xxxxxxxxxx"
                        value={cartBuyerWhatsapp}
                        onChange={(e) => setCartBuyerWhatsapp(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white placeholder-slate-600"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition flex items-center justify-center gap-2"
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>Bayar Barengan ({cartItems.length} Item)</span>
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: DETAIL PEMBAYARAN & UNGGAH BUKTI TRANSFER */}
      {/* ========================================================= */}
      {showPaymentModal && activeOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 max-w-md w-full rounded-3xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setShowPaymentModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-black text-white flex items-center gap-2 mb-1">
              <CreditCard className="w-4 h-4 text-cyan-400" /> Selesaikan Pembayaran
            </h3>
            <span className="text-[11px] text-slate-400 block mb-4">
              ID Pesanan: <strong className="text-white">#{activeOrder.id}</strong>
            </span>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-center mb-4">
              <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">
                Total Tagihan Pas
              </span>
              <span className="text-2xl font-black text-cyan-400">
                Rp {Number(activeOrder.price).toLocaleString("id-ID")}
              </span>

              {activeOrder.status === "pending" && !activeOrder.submittedProof && (
                <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 bg-rose-950/80 border border-rose-800 rounded-full text-xs text-rose-300 font-bold animate-pulse">
                  <Clock className="w-3.5 h-3.5 text-rose-400" />
                  <span>Sisa Waktu Bayar: {getRemainingTime(activeOrder.createdAtTimestamp)}</span>
                </div>
              )}
            </div>

            {activeOrder.paymentDetails && (
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2 mb-4 text-xs">
                <span className="text-slate-400 font-bold block">Tujuan Transfer:</span>
                <div className="flex justify-between items-center bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                  <div>
                    <span className="font-bold text-white block">{activeOrder.paymentDetails.name}</span>
                    <span className="text-cyan-400 font-mono text-sm block">
                      {activeOrder.paymentDetails.accountNumber}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      a.n {activeOrder.paymentDetails.accountHolder}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(activeOrder.paymentDetails.accountNumber);
                      showToast("Nomor rekening berhasil disalin!");
                    }}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-cyan-400 rounded-lg text-xs"
                    title="Salin Nomor"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>

                {activeOrder.paymentDetails.hasImage && activeOrder.paymentDetails.image && (
                  <div className="text-center pt-2">
                    <img
                      src={activeOrder.paymentDetails.image}
                      alt="QRIS Toko"
                      className="w-44 h-44 mx-auto rounded-xl object-contain border border-slate-800"
                    />
                    <span className="text-[10px] text-slate-500 block mt-1">
                      Scan QRIS dari Mobile Banking atau E-Wallet
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Locked 1x Proof Upload Box */}
            {activeOrder.submittedProof || activeOrder.proofImage ? (
              <div className="p-4 bg-emerald-950/40 border border-emerald-800 rounded-2xl text-center space-y-3">
                <div className="flex items-center justify-center gap-1.5 text-emerald-400 font-bold text-xs">
                  <BadgeCheck className="w-4 h-4" /> Bukti Pembayaran Terkunci (1x Kirim)
                </div>

                {activeOrder.status === "pending" && (
                  <div className="p-2.5 bg-slate-950/80 border border-amber-800/60 rounded-xl text-amber-300 text-[11px] flex items-center justify-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0 animate-pulse" />
                    <span>
                      Estimasi Batas Verifikasi: <strong>{getRemainingTime(activeOrder.createdAtTimestamp)}</strong>
                    </span>
                  </div>
                )}

                <p className="text-[11px] text-slate-400">
                  Bukti struk tersimpan dan sedang menunggu konfirmasi admin.
                </p>

                {activeOrder.status === "pending" && (
                  <button
                    type="button"
                    onClick={() => {
                      handleCancelOrderByBuyer(activeOrder.id);
                      setShowPaymentModal(false);
                    }}
                    className="px-3 py-1.5 bg-rose-950/80 hover:bg-rose-900 border border-rose-800 text-rose-300 text-xs font-bold rounded-xl transition inline-flex items-center gap-1"
                  >
                    <X className="w-3.5 h-3.5" /> Batalkan Pesanan Ini
                  </button>
                )}

                {(activeOrder.proofImage || paymentProofImage) && (
                  <div className="relative group inline-block">
                    <img
                      src={activeOrder.proofImage || paymentProofImage}
                      alt="Struk Transfer"
                      className="max-h-40 mx-auto rounded-lg border border-slate-700 object-contain cursor-pointer"
                      onClick={() =>
                        setPreviewFullImage({
                          url: activeOrder.proofImage || paymentProofImage,
                          title: `Struk Transfer Pesanan #${activeOrder.id}`,
                          info: `Pembeli: ${activeOrder.buyerName}`
                        })
                      }
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewFullImage({
                          url: activeOrder.proofImage || paymentProofImage,
                          title: `Struk Transfer Pesanan #${activeOrder.id}`,
                          info: `Pembeli: ${activeOrder.buyerName}`
                        })
                      }
                      className="absolute bottom-1 right-1 bg-slate-950/90 text-cyan-300 border border-slate-700 p-1 rounded text-[10px] flex items-center gap-1"
                    >
                      <Maximize2 className="w-3 h-3" /> Full
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">
                    Upload Foto / Screenshot Struk Bukti Transfer:
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e.target.files[0], setPaymentProofImage)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-slate-400 file:mr-3 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:bg-slate-800 file:text-cyan-400"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSubmitPaymentProof}
                  className="w-full py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs uppercase tracking-wider rounded-xl shadow transition"
                >
                  Kunci & Kirim Bukti Transfer (1x)
                </button>
              </div>
            )}

            {(activeOrder.status === "pending" && activeOrder.submittedProof) ||
            activeOrder.status === "processing" || activeOrder.status === "completed" ? (
              <div className="pt-4 border-t border-slate-800 mt-4">
                <a
                  href={generateWhatsAppLink(activeOrder)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-600/20 transition flex items-center justify-center gap-2"
                >
                  <MessageCircle className="w-4 h-4" /> Hubungi WhatsApp Admin Sekarang
                </a>
              </div>
            ) : (
              <div className="text-center pt-3 text-[11px] text-slate-500">
                Tombol WhatsApp Admin akan aktif setelah Anda mengunggah bukti transfer dan mengunci pembayaran.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: FULL-SCREEN IMAGE VIEWER */}
      {/* ========================================================= */}
      {previewFullImage && (
        <div
          onClick={() => setPreviewFullImage(null)}
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col justify-between p-4 sm:p-6 cursor-zoom-out"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex items-center justify-between bg-slate-900/90 border border-slate-800 px-4 py-3 rounded-2xl max-w-4xl w-full mx-auto shadow-2xl shrink-0"
          >
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Eye className="w-4 h-4 text-cyan-400" /> {previewFullImage.title}
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5">{previewFullImage.info}</p>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={previewFullImage.url}
                download="bukti-transfer-catalyststore.png"
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition"
              >
                <Download className="w-3.5 h-3.5 text-cyan-400" /> Download
              </a>
              <button
                type="button"
                onClick={() => setPreviewFullImage(null)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div
            onClick={(e) => e.stopPropagation()}
            className="flex-1 flex items-center justify-center p-2 sm:p-4 min-h-0"
          >
            <img
              src={previewFullImage.url}
              alt="Bukti Transfer Penuh"
              className="max-h-[82vh] max-w-full rounded-2xl object-contain shadow-2xl border border-slate-800 ring-1 ring-white/10"
            />
          </div>

          <div className="text-center text-[11px] text-slate-500 shrink-0">
            Klik area gelap atau tombol ✕ untuk menutup tampilan layar penuh.
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: PENGAJUAN PENGEMBALIAN DANA (REFUND) */}
      {/* ========================================================= */}
      {showRefundModal && refundTargetOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 max-w-md w-full rounded-3xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setShowRefundModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-black text-white flex items-center gap-2 mb-2">
              <RotateCcw className="w-4 h-4 text-amber-400" /> Form Pengajuan Pengembalian Dana (Refund)
            </h3>
            <p className="text-xs text-slate-400 mb-2">
              Pesanan: <strong className="text-white">#{refundTargetOrder.id}</strong> ({refundTargetOrder.title})
            </p>
            <div className="text-xs text-cyan-400 font-bold mb-4">
              Nominal yang Dikembalikan: Rp {Number(refundTargetOrder.price).toLocaleString("id-ID")}
            </div>

            {refundConfig.policyNote && (
              <div className="p-3 bg-amber-950/40 border border-amber-800/60 rounded-xl text-[11px] text-amber-300 mb-4">
                <strong>Kebijakan Toko:</strong> {refundConfig.policyNote}
              </div>
            )}

            <form onSubmit={handleSubmitRefundRequest} className="space-y-3.5">
              {refundConfig.requireReason && (
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">
                    Alasan Pengembalian Dana: <span className="text-rose-400">*</span>
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Tuliskan alasan pengajuan pengembalian dana."
                    value={refundFormData.reason}
                    onChange={(e) => setRefundFormData((p) => ({ ...p, reason: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
                  />
                </div>
              )}

              {refundConfig.requireBankName && (
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">
                    Nama Bank / E-Wallet Tujuan: <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Bank BCA / Mandiri / DANA"
                    value={refundFormData.bankName}
                    onChange={(e) => setRefundFormData((p) => ({ ...p, bankName: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white placeholder-slate-600"
                  />
                </div>
              )}

              {refundConfig.requireAccountNumber && (
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">
                    Nomor Rekening / E-Wallet: <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: 8831293812"
                    value={refundFormData.accountNumber}
                    onChange={(e) => setRefundFormData((p) => ({ ...p, accountNumber: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono placeholder-slate-600"
                  />
                </div>
              )}

              {refundConfig.requireAccountHolder && (
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">
                    Atas Nama Pemilik Rekening: <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Budi Santoso"
                    value={refundFormData.accountHolder}
                    onChange={(e) => setRefundFormData((p) => ({ ...p, accountHolder: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white placeholder-slate-600"
                  />
                </div>
              )}

              {refundConfig.requireAlternativeContact && (
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">
                    Nomor WhatsApp Konfirmasi:
                  </label>
                  <input
                    type="tel"
                    placeholder="08xxxxxxxxxx"
                    value={refundFormData.alternativeContact}
                    onChange={(e) => setRefundFormData((p) => ({ ...p, alternativeContact: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white placeholder-slate-600"
                  />
                </div>
              )}

              {refundConfig.requireEvidenceImage && (
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">
                    Foto Bukti Kendala:
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      handleImageUpload(e.target.files[0], (img) =>
                        setRefundFormData((p) => ({ ...p, evidenceImage: img }))
                      )
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-slate-400 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:bg-slate-800 file:text-cyan-400"
                  />
                  {refundFormData.evidenceImage && (
                    <img
                      src={refundFormData.evidenceImage}
                      alt="Bukti Refund"
                      className="mt-2 max-h-24 rounded-lg border border-slate-700 object-contain"
                    />
                  )}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition mt-2"
              >
                Kirim Pengajuan Pengembalian Dana
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TOAST NOTIFIER */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-cyan-500/50 text-white text-xs px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
