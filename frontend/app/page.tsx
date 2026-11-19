"use client";

import React, { useState, useEffect } from "react";
import {
  ShoppingBag,
  Package,
  QrCode,
  BarChart3,
  MessageSquare,
  CheckCircle2,
  Clock,
  Send,
  AlertCircle,
  RefreshCw,
  Search,
  Check,
  X,
  FileText,
  User,
  ArrowRight,
  ChevronRight,
  Store as StoreIcon,
  Sparkles,
  Smartphone,
  Copy,
  ShieldCheck,
  Zap,
  Menu,
  Bell,
  Phone,
  Plus,
  Trash2,
  Edit2,
  Tag,
} from "lucide-react";
import { api } from "@/lib/api";

type Tab = "orders" | "lists" | "products" | "qr_verify" | "analytics" | "simulate" | "pairing";

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<Tab>("orders");
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [store, setStore] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Pairing Code states (No Laptop / No QR needed)
  const [pairingPhone, setPairingPhone] = useState<string>("");
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [isGeneratingPairing, setIsGeneratingPairing] = useState<boolean>(false);
  const [pairingError, setPairingError] = useState<string | null>(null);
  const [gatewayStatus, setGatewayStatus] = useState<string>("disconnected");
  const [isCodeCopied, setIsCodeCopied] = useState<boolean>(false);

  // Shopkeeper Mobile Number Edit
  const [isEditingPhone, setIsEditingPhone] = useState<boolean>(false);
  const [shopMobileInput, setShopMobileInput] = useState<string>("");
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);

  // Selected Order for Review / Packing modal
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [reviewItems, setReviewItems] = useState<any[]>([]);

  // QR Verification
  const [qrTokenInput, setQrTokenInput] = useState<string>("");
  const [qrVerificationResult, setQrVerificationResult] = useState<any>(null);

  // WhatsApp Simulation form
  const [simPhone, setSimPhone] = useState<string>("+919812345678");
  const [simName, setSimName] = useState<string>("Pooja Verma");
  const [simText, setSimText] = useState<string>(
    "Bhaiya, 2 kg atta, 1 litre oil, 1 kg sugar aur 2 packet Maggi rakh dena"
  );
  const [simSuccess, setSimSuccess] = useState<string | null>(null);
  const [simError, setSimError] = useState<string | null>(null);
  const [isSendingSim, setIsSendingSim] = useState<boolean>(false);
  const [activeChatOrder, setActiveChatOrder] = useState<any>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);

  // Product management modal states
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [newProdName, setNewProdName] = useState("");
  const [newProdBrand, setNewProdBrand] = useState("");
  const [newProdUnit, setNewProdUnit] = useState("kg");
  const [newProdPrice, setNewProdPrice] = useState("");
  const [newProdStock, setNewProdStock] = useState("100");
  const [newProdAliases, setNewProdAliases] = useState("");
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [editingPriceProdId, setEditingPriceProdId] = useState<string | null>(null);
  const [editPriceVal, setEditPriceVal] = useState<string>("");

  // Bulk catalogue states
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [bulkImportText, setBulkImportText] = useState("");
  const [isSeedingCatalogue, setIsSeedingCatalogue] = useState(false);
  const [catalogueNotice, setCatalogueNotice] = useState<string | null>(null);

  // Initialize and auto-login
  useEffect(() => {
    initApp();
  }, []);

  const initApp = async () => {
    setLoading(true);
    try {
      let stores = await api.getStores();
      if (!Array.isArray(stores) || stores.length === 0) {
        const loginRes = await api.login("ramesh@guptastores.com", "kirana123");
        if (loginRes.access_token) {
          localStorage.setItem("token", loginRes.access_token);
        }
        stores = await api.getStores();
      }

      if (Array.isArray(stores) && stores.length > 0) {
        setStore(stores[0]);
        await loadStoreData(stores[0].id);
      }
    } catch (err) {
      console.error("Initialization error:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadStoreData = async (storeId: string) => {
    try {
      const [ordersData, productsData, analyticsData] = await Promise.all([
        api.getOrders(storeId),
        api.getProducts(storeId),
        api.getAnalytics(storeId),
      ]);
      const ords = Array.isArray(ordersData) ? ordersData : [];
      setOrders(ords);
      setProducts(Array.isArray(productsData) ? productsData : []);
      setAnalytics(analyticsData);
      if (ords.length > 0 && !activeChatOrder) {
        setActiveChatOrder(ords[0]);
        loadChatForOrder(ords[0].id);
      }
    } catch (e) {
      console.error("Error loading store data:", e);
    }
  };

  const refreshCurrentData = () => {
    if (store) loadStoreData(store.id);
  };

  const checkGatewayStatus = async (storeId: string) => {
    try {
      const res = await api.getWhatsAppGatewayStatus(storeId);
      if (res && res.status) {
        setGatewayStatus(res.status);
        if (res.pairing_code && !pairingCode) {
          setPairingCode(res.pairing_code);
        }
        if (res.phone) {
          setStore((prev: any) => (prev && prev.phone !== res.phone ? { ...prev, phone: res.phone } : prev));
        }
      }
    } catch (e) {
      // gateway offline or starting
    }
  };

  const handleRequestPairingCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const storeId = store?.id || "s0000001-0000-0000-0000-000000000001";
    if (!pairingPhone.trim()) {
      setPairingError("Kripya apna WhatsApp mobile number dalein");
      return;
    }
    setIsGeneratingPairing(true);
    setPairingError(null);
    setPairingCode(null);
    try {
      const res = await api.requestPairingCode(storeId, pairingPhone);
      if (res && res.success && res.pairing_code) {
        setPairingCode(res.pairing_code);
        setGatewayStatus("pairing");
      } else {
        setPairingError(res?.error || "Pairing code generate nahi ho paya. Kripya number check karein aur dobara try karein.");
      }
    } catch (err: any) {
      console.error("Pairing request failed:", err);
      setPairingError(err.message || "WhatsApp Gateway connect nahi ho paya. Kripya check karein ki server live hai.");
    } finally {
      setIsGeneratingPairing(false);
    }
  };

  const handleCopyPairingCode = () => {
    if (!pairingCode) return;
    navigator.clipboard.writeText(pairingCode.replace("-", ""));
    setIsCodeCopied(true);
    setTimeout(() => setIsCodeCopied(false), 3000);
  };

  useEffect(() => {
    const storeId = store?.id || "s0000001-0000-0000-0000-000000000001";
    checkGatewayStatus(storeId);
    
    // Auto-refresh orders and connection status every 4 seconds
    const interval = setInterval(() => {
      checkGatewayStatus(storeId);
      if (store?.id) {
        api.getOrders(store.id).then((fresh) => {
          if (Array.isArray(fresh)) setOrders(fresh);
        }).catch(() => {});
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [store?.id]);

  const handleSaveShopMobile = async () => {
    if (!store || !shopMobileInput) return;
    try {
      const updated = await api.updateStore(store.id, {
        phone: shopMobileInput,
      });
      setStore(updated);
      setIsEditingPhone(false);
    } catch (err) {
      console.error(err);
    }
  };

  const formatCustomerPhone = (phone?: string) => {
    if (!phone) return "";
    const cleaned = phone.replace("+", "").split("@")[0];
    if (cleaned.length > 12 || cleaned.startsWith("195") || phone.includes("@lid")) {
      return "WhatsApp";
    }
    return phone;
  };

  const handleCopyShoppingList = (order: any) => {
    const lines = [
      `🛒 Shopping List for ${order.customer?.name || "Customer"} (${formatCustomerPhone(order.customer?.phone)}):`,
      `Order #${order.order_number}`,
      `------------------------`,
      ...order.items.map(
        (it: any, i: number) => `${i + 1}. [ ] ${it.product_name_snapshot} - ${it.quantity} ${it.unit} (₹${it.total_price})`
      ),
      `------------------------`,
      `Total: ₹${order.grand_total}`,
    ];
    navigator.clipboard.writeText(lines.join("\n"));
    setCopiedOrderId(order.id);
    setTimeout(() => setCopiedOrderId(null), 2500);
  };

  // Open Order Review modal
  const handleOpenReview = (order: any) => {
    setSelectedOrder(order);
    setReviewItems(
      order.items.map((i: any) => ({
        id: i.id,
        product_name_snapshot: i.product_name_snapshot,
        quantity: i.quantity,
        unit: i.unit,
        unit_price: i.unit_price,
        total_price: i.total_price,
        packing_status: i.packing_status,
      }))
    );
  };

  const handleUpdateItemPriceOrQty = (idx: number, field: string, val: any) => {
    const updated = [...reviewItems];
    updated[idx][field] = val;
    const qty = parseFloat(updated[idx].quantity) || 0;
    const price = parseFloat(updated[idx].unit_price) || 0;
    updated[idx].total_price = (qty * price).toFixed(2);
    setReviewItems(updated);
  };

  const handleSaveReviewAndSend = async () => {
    if (!selectedOrder) return;
    try {
      await api.reviewOrder(selectedOrder.id, {
        items: reviewItems,
      });
      await api.sendSummary(selectedOrder.id);
      setSelectedOrder(null);
      refreshCurrentData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleTogglePacking = async (orderId: string, itemId: string, currentStatus: string) => {
    const nextStatus = currentStatus === "PACKED" ? "UNPACKED" : "PACKED";
    try {
      await api.updateItemPacking(orderId, itemId, nextStatus);
      // Reload order detail
      const updatedOrder = await api.getOrder(orderId);
      setSelectedOrder(updatedOrder);
      refreshCurrentData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkOrderPacked = async (orderId: string) => {
    try {
      const res = await api.markOrderPacked(orderId);
      if (res && res.id) {
        setSimSuccess("🎉 Order marked as PACKED! WhatsApp ready notification sent to customer.");
        setTimeout(() => setSimSuccess(null), 5000);
        if (selectedOrder && selectedOrder.id === orderId) {
          setSelectedOrder(res);
        }
        refreshCurrentData();
      }
    } catch (err: any) {
      console.error("Mark packed failed:", err);
      alert("Error marking packed: " + (err.message || "Could not reach server"));
    }
  };

  const handleSendOrderReminder = async (orderId: string) => {
    try {
      const res = await api.sendOrderReminder(orderId);
      if (res && res.id) {
        setSimSuccess(`🔔 Pickup Reminder (${res.pickup_reminders_count || 1}/4) sent to customer on WhatsApp!`);
        setTimeout(() => setSimSuccess(null), 5000);
        if (selectedOrder && selectedOrder.id === orderId) {
          setSelectedOrder(res);
        }
        refreshCurrentData();
      }
    } catch (err: any) {
      console.error("Reminder failed:", err);
      alert("Error sending reminder: " + (err.message || "Could not reach server"));
    }
  };

  const handleVerifyQr = async () => {
    if (!store || !qrTokenInput) return;
    try {
      const res = await api.verifyQr(store.id, qrTokenInput);
      setQrVerificationResult(res);
      if (res.success) {
        refreshCurrentData();
      }
    } catch (err) {
      setQrVerificationResult({ success: false, message: "Verification request failed" });
    }
  };

  const loadChatForOrder = async (orderId: string) => {
    try {
      const msgs = await api.getOrderChat(orderId);
      setChatMessages(Array.isArray(msgs) ? msgs : []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCustomerConfirmFromPhone = async (orderId: string, action: string) => {
    try {
      await api.simulateWhatsApp({
        store_id: store?.id,
        phone_number_id: store?.whatsapp_phone_number_id || store?.phone,
        shopkeeper_phone: store?.phone,
        sender_phone: activeChatOrder?.customer?.phone || simPhone,
        sender_name: activeChatOrder?.customer?.name || simName,
        message_text: action === "CONFIRM" ? "✅ Confirm Order" : "❌ Cancel Order",
      });
      if (store?.id) await loadStoreData(store.id);
      await loadChatForOrder(orderId);
      const freshOrder = await api.getOrder(orderId);
      if (freshOrder?.id) setActiveChatOrder(freshOrder);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendSimulatedMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simText.trim()) return;
    setIsSendingSim(true);
    setSimError(null);
    try {
      const res = await api.simulateWhatsApp({
        store_id: store?.id,
        phone_number_id: store?.whatsapp_phone_number_id || store?.phone,
        shopkeeper_phone: store?.phone,
        sender_phone: simPhone,
        sender_name: simName,
        message_text: simText,
      });

      if (res && (res.status === "success" || res.simulated_message_id)) {
        setSimSuccess("✅ Order message received & parsed! New shopping list created.");
        setTimeout(() => setSimSuccess(null), 5000);

        let storeId = store?.id;
        if (!storeId) {
          const stores = await api.getStores();
          if (Array.isArray(stores) && stores.length > 0) {
            setStore(stores[0]);
            storeId = stores[0].id;
          }
        }

        if (storeId) {
          await loadStoreData(storeId);
          const freshOrders = await api.getOrders(storeId);
          if (Array.isArray(freshOrders) && freshOrders.length > 0) {
            setActiveChatOrder(freshOrders[0]);
            await loadChatForOrder(freshOrders[0].id);
          }
        }
      } else {
        setSimError(res?.detail || res?.message || "Failed to process message");
      }
    } catch (err: any) {
      console.error("Simulation error:", err);
      setSimError(err.message || "Failed to connect to backend server");
    } finally {
      setIsSendingSim(false);
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName.trim() || !newProdPrice || !store?.id) return;
    setIsSavingProduct(true);
    try {
      const aliasList = newProdAliases
        .split(",")
        .map((a) => a.trim().toLowerCase())
        .filter(Boolean);
      await api.createProduct(store.id, {
        name: newProdName.trim(),
        brand: newProdBrand.trim() || null,
        unit: newProdUnit,
        current_price: parseFloat(newProdPrice),
        stock_quantity: parseFloat(newProdStock) || 0,
        aliases: aliasList,
        availability: true,
      });
      const freshProds = await api.getProducts(store.id);
      if (Array.isArray(freshProds)) setProducts(freshProds);
      setIsAddProductOpen(false);
      setNewProdName("");
      setNewProdBrand("");
      setNewProdPrice("");
      setNewProdAliases("");
    } catch (err) {
      console.error("Failed to add product:", err);
    } finally {
      setIsSavingProduct(false);
    }
  };

  const handleAddPreset = async (preset: any) => {
    if (!store?.id) return;
    try {
      const aliasList = preset.aliases
        .split(",")
        .map((a: string) => a.trim().toLowerCase())
        .filter(Boolean);
      await api.createProduct(store.id, {
        name: preset.name,
        brand: preset.brand,
        unit: preset.unit,
        current_price: parseFloat(preset.price),
        stock_quantity: 100,
        aliases: aliasList,
        availability: true,
      });
      const freshProds = await api.getProducts(store.id);
      if (Array.isArray(freshProds)) setProducts(freshProds);
    } catch (err) {
      console.error("Failed to add preset:", err);
    }
  };

  const handleToggleStock = async (product: any) => {
    if (!store?.id) return;
    try {
      await api.updateProduct(product.id, {
        availability: !product.availability,
      });
      const freshProds = await api.getProducts(store.id);
      if (Array.isArray(freshProds)) setProducts(freshProds);
    } catch (err) {
      console.error("Failed to toggle stock:", err);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!store?.id || !confirm("Kya aap sach me is product ko catalogue se hatana chahte hain?")) return;
    try {
      await api.deleteProduct(productId);
      const freshProds = await api.getProducts(store.id);
      if (Array.isArray(freshProds)) setProducts(freshProds);
    } catch (err) {
      console.error("Failed to delete product:", err);
    }
  };

  const handleSavePriceEdit = async (productId: string) => {
    if (!store?.id || !editPriceVal) return;
    try {
      await api.updateProductPrice(productId, parseFloat(editPriceVal));
      setEditingPriceProdId(null);
      setEditPriceVal("");
      const freshProds = await api.getProducts(store.id);
      if (Array.isArray(freshProds)) setProducts(freshProds);
    } catch (err) {
      console.error("Failed to update price:", err);
    }
  };

  const handleSeedCatalogue = async () => {
    if (!store?.id) return;
    setIsSeedingCatalogue(true);
    try {
      const res = await api.seedCatalogue(store.id);
      const freshProds = await api.getProducts(store.id);
      if (Array.isArray(freshProds)) setProducts(freshProds);
      setCatalogueNotice(`🎉 50+ Popular Indian Kirana items aapke catalogue me jud gaye! (Total: ${res?.total_catalogue_size || freshProds.length} items)`);
      setTimeout(() => setCatalogueNotice(null), 6000);
    } catch (err) {
      console.error("Failed to seed catalogue:", err);
    } finally {
      setIsSeedingCatalogue(false);
    }
  };

  const handleBulkPasteImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkImportText.trim() || !store?.id) return;
    setIsSavingProduct(true);
    try {
      const lines = bulkImportText.split("\n").map((l) => l.trim()).filter(Boolean);
      const parsedItems: any[] = [];

      for (const line of lines) {
        if (line.includes(",")) {
          const parts = line.split(",").map((p) => p.trim());
          const name = parts[0];
          const price = parseFloat(parts[1]?.replace(/[^\d.]/g, "") || "0");
          const unit = parts[2] || "kg";
          const aliases = parts.slice(3).map((a) => a.toLowerCase().trim());
          if (name && price > 0) {
            parsedItems.push({
              name,
              current_price: price,
              unit,
              aliases: aliases.length > 0 ? aliases : [name.toLowerCase()],
              stock_quantity: 100,
              availability: true,
            });
          }
        } else {
          const match = line.match(/^(.+?)\s+[-:=]?\s*(?:rs\.?|₹)?\s*([0-9]+(?:\.[0-9]+)?)(?:\s*\/\s*([a-zA-Z]+))?/i);
          if (match) {
            const name = match[1].trim();
            const price = parseFloat(match[2]);
            const unit = match[3]?.toLowerCase() || (name.toLowerCase().includes("oil") || name.toLowerCase().includes("tel") || name.toLowerCase().includes("milk") ? "litre" : "kg");
            parsedItems.push({
              name,
              current_price: price,
              unit,
              aliases: [name.toLowerCase()],
              stock_quantity: 100,
              availability: true,
            });
          }
        }
      }

      if (parsedItems.length > 0) {
        await api.bulkCreateProducts(store.id, parsedItems);
        const freshProds = await api.getProducts(store.id);
        if (Array.isArray(freshProds)) setProducts(freshProds);
        setIsBulkImportOpen(false);
        setBulkImportText("");
        setCatalogueNotice(`✅ ${parsedItems.length} products ek sath catalogue me jud gaye!`);
        setTimeout(() => setCatalogueNotice(null), 5000);
      } else {
        alert("Koi valid product nahi mila. Please format check karein (Jaise: Atta 45 ya Sugar, 48, kg).");
      }
    } catch (err) {
      console.error("Bulk import failed:", err);
    } finally {
      setIsSavingProduct(false);
    }
  };

  // Filter orders
  const filteredOrders = orders.filter((o) => {
    if (statusFilter === "ALL") return true;
    if (statusFilter === "REVIEW") return ["NEW", "SHOPKEEPER_REVIEW", "NEEDS_CLARIFICATION"].includes(o.status);
    if (statusFilter === "CONFIRMATION") return o.status === "CUSTOMER_CONFIRMATION";
    if (statusFilter === "PACKING") return ["CONFIRMED", "PACKING", "PARTIALLY_PACKED"].includes(o.status);
    if (statusFilter === "READY") return o.status === "READY_FOR_PICKUP";
    if (statusFilter === "COLLECTED") return o.status === "COLLECTED";
    return true;
  });

  const getStatusBadge = (status: string) => {
    const map: Record<string, { bg: string; label: string }> = {
      NEW: { bg: "bg-blue-100 text-blue-800", label: "New Order" },
      SHOPKEEPER_REVIEW: { bg: "bg-amber-100 text-amber-800", label: "Needs Review" },
      NEEDS_CLARIFICATION: { bg: "bg-purple-100 text-purple-800", label: "Clarification Required" },
      CUSTOMER_CONFIRMATION: { bg: "bg-indigo-100 text-indigo-800", label: "Awaiting Customer" },
      CONFIRMED: { bg: "bg-emerald-100 text-emerald-800", label: "Confirmed" },
      PACKING: { bg: "bg-orange-100 text-orange-800", label: "Packing in Progress" },
      PARTIALLY_PACKED: { bg: "bg-orange-100 text-orange-800", label: "Partially Packed" },
      READY_FOR_PICKUP: { bg: "bg-green-100 text-green-800", label: "Ready for Pickup" },
      COLLECTED: { bg: "bg-slate-200 text-slate-700", label: "Collected" },
      CANCELLED: { bg: "bg-red-100 text-red-800", label: "Cancelled" },
    };
    const s = map[status] || { bg: "bg-gray-100 text-gray-800", label: status };
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${s.bg}`}>
        {s.label}
      </span>
    );
  };

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      {/* Mobile Drawer Backdrop & Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden bg-slate-900/70 backdrop-blur-sm flex">
          <div className="w-4/5 max-w-xs bg-slate-900 text-slate-200 h-full flex flex-col justify-between p-4 animate-in slide-in-from-left duration-200 shadow-2xl">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-white">
                    <ShoppingBag className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-bold text-base text-white">KiranaAI</h2>
                    <p className="text-[10px] text-slate-400">Retail OS</p>
                  </div>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Mobile Store info */}
              {store && (
                <div className="mt-3 p-3 bg-slate-800/80 rounded-xl text-xs">
                  <p className="text-[10px] text-emerald-400 font-semibold uppercase">My Store</p>
                  <p className="font-bold text-white text-xs mt-0.5">{store.store_name}</p>
                  <p className="font-mono text-[11px] text-slate-300">{store.phone}</p>
                </div>
              )}

              {/* Mobile Navigation Links */}
              <nav className="mt-4 space-y-1">
                {[
                  { id: "orders", label: "Orders", icon: ShoppingBag, count: orders.length },
                  { id: "lists", label: "Customer Lists (ग्राहक लिस्ट)", icon: FileText, count: orders.length },
                  { id: "pairing", label: "Link Phone (No Laptop)", icon: Smartphone, highlight: true },
                  { id: "products", label: "Catalogue & Prices", icon: Package },
                  { id: "qr_verify", label: "QR Pickup Scanner", icon: QrCode },
                  { id: "analytics", label: "Store Analytics", icon: BarChart3 },
                  { id: "simulate", label: "WhatsApp Simulator", icon: MessageSquare, warning: true },
                ].map((item: any) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition ${
                        isActive
                          ? "bg-emerald-600 text-white font-bold"
                          : item.highlight
                          ? "text-emerald-400 bg-emerald-950/30 border border-emerald-500/20"
                          : "text-slate-300 hover:bg-slate-800"
                      }`}
                    >
                      <div className="flex items-center space-x-2.5">
                        <Icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </div>
                      {item.count !== undefined && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-300">
                          {item.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>Ramesh Gupta</span>
              <button onClick={refreshCurrentData} className="p-1 hover:text-white">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="flex-1" onClick={() => setMobileMenuOpen(false)} />
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-slate-900 text-slate-200 flex-col justify-between shrink-0">
        <div>
          {/* Logo */}
          <div className="p-5 border-b border-slate-800 flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/30">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-white leading-tight">KiranaAI</h1>
              <p className="text-xs text-slate-400">WhatsApp Retail OS</p>
            </div>
          </div>

          {/* Store Info & Connected Mobile */}
          {store && (
            <div className="p-3.5 mx-3 my-3 bg-slate-800/70 rounded-xl border border-slate-700/60 text-xs">
              <div className="flex items-center justify-between text-[11px] text-emerald-400 font-medium mb-1">
                <span className="flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>WhatsApp Number</span>
                </span>
                <button
                  onClick={() => {
                    setShopMobileInput(store.phone || "+919876543210");
                    setIsEditingPhone(!isEditingPhone);
                  }}
                  className="text-[10px] text-slate-400 hover:text-white underline"
                >
                  {isEditingPhone ? "Cancel" : "Change"}
                </button>
              </div>

              {!isEditingPhone ? (
                <div>
                  <p className="font-mono font-bold text-white text-sm">{store.phone}</p>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">{store.store_name}</p>
                </div>
              ) : (
                <div className="mt-1 space-y-1.5">
                  <input
                    type="text"
                    value={shopMobileInput}
                    onChange={(e) => setShopMobileInput(e.target.value)}
                    placeholder="+91..."
                    className="w-full px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <button
                    onClick={handleSaveShopMobile}
                    className="w-full py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-[11px]"
                  >
                    Save My Number
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Navigation Links */}
          <nav className="p-3 space-y-1">
            <button
              onClick={() => setActiveTab("orders")}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                activeTab === "orders"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <div className="flex items-center space-x-3">
                <ShoppingBag className="w-4 h-4" />
                <span>Orders</span>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                {orders.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("lists")}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                activeTab === "lists"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <div className="flex items-center space-x-3">
                <FileText className="w-4 h-4" />
                <span>Customer Lists (ग्राहक लिस्ट)</span>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                {orders.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("products")}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                activeTab === "products"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <Package className="w-4 h-4" />
              <span>Catalogue & Prices</span>
            </button>

            <button
              onClick={() => setActiveTab("qr_verify")}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                activeTab === "qr_verify"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <QrCode className="w-4 h-4" />
              <span>QR Pickup Scanner</span>
            </button>

            <button
              onClick={() => setActiveTab("analytics")}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                activeTab === "analytics"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Store Analytics</span>
            </button>

            <button
              onClick={() => setActiveTab("pairing")}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition mt-3 border ${
                activeTab === "pairing"
                  ? "bg-emerald-600 text-white shadow-sm border-emerald-500"
                  : "text-emerald-400 hover:bg-slate-800 hover:text-emerald-300 border-emerald-500/30 bg-emerald-950/20"
              }`}
            >
              <div className="flex items-center space-x-3">
                <Smartphone className="w-4 h-4 text-emerald-400" />
                <span>Link Phone (No Laptop)</span>
              </div>
              {gatewayStatus === "connected" ? (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              ) : (
                <span className="text-[10px] bg-emerald-900/80 text-emerald-300 px-1.5 py-0.5 rounded font-mono">
                  8-Digit
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("simulate")}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition mt-2 ${
                activeTab === "simulate"
                  ? "bg-amber-600 text-white shadow-sm"
                  : "text-amber-400/90 hover:bg-slate-800 hover:text-amber-300"
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>WhatsApp Simulator</span>
            </button>
          </nav>
        </div>

        {/* User profile & refresh */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white">
              RG
            </div>
            <div>
              <p className="text-xs font-semibold text-white">Ramesh Gupta</p>
              <p className="text-[10px] text-slate-400">Store Owner</p>
            </div>
          </div>
          <button
            onClick={refreshCurrentData}
            title="Refresh Data"
            className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-y-auto">
        {/* Top Navbar */}
        <header className="h-14 sm:h-16 bg-white border-b border-slate-200 px-3 sm:px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 rounded-xl text-slate-700 hover:bg-slate-100 transition border border-slate-200"
              title="Open Navigation Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-sm sm:text-lg md:text-xl font-bold text-slate-800 truncate">
              {activeTab === "orders" && "Live Orders"}
              {activeTab === "lists" && "Customer Lists (ग्राहक लिस्ट)"}
              {activeTab === "pairing" && "Link WhatsApp (No Laptop)"}
              {activeTab === "products" && "Catalogue & Pricing"}
              {activeTab === "qr_verify" && "QR Pickup Verification"}
              {activeTab === "analytics" && "Store Analytics"}
              {activeTab === "simulate" && "WhatsApp Simulator"}
            </h2>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-4">
            <div className="flex items-center space-x-1.5 sm:space-x-2 text-[10px] sm:text-xs bg-emerald-50 text-emerald-700 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="hidden sm:inline">FastAPI Backend Live</span>
              <span className="sm:hidden">Live</span>
            </div>
          </div>
        </header>

        {/* Tab Content */}
        <div className="p-3 sm:p-6 pb-24 md:pb-6 flex-1">
          {/* TAB 1: ORDERS */}
          {activeTab === "orders" && (
            <div>
              {/* Filter Tabs */}
              <div className="flex flex-wrap gap-2 mb-6">
                {[
                  { id: "ALL", label: "All Orders" },
                  { id: "REVIEW", label: "Review & Bill" },
                  { id: "CONFIRMATION", label: "Waiting Customer" },
                  { id: "PACKING", label: "Packing Checklist" },
                  { id: "READY", label: "Ready for Pickup" },
                  { id: "COLLECTED", label: "Collected" },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setStatusFilter(t.id)}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
                      statusFilter === t.id
                        ? "bg-slate-900 text-white shadow-sm"
                        : "bg-white text-slate-600 hover:bg-slate-200/80 border border-slate-200"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Order Cards Grid */}
              {filteredOrders.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                  <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <h3 className="text-base font-semibold text-slate-700">No orders found</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Incoming WhatsApp messages from customers will automatically appear here with
                    AI-parsed products and suggested pricing.
                  </p>
                  <button
                    onClick={() => setActiveTab("simulate")}
                    className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold inline-flex items-center space-x-2 transition"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Simulate WhatsApp Order Now</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filteredOrders.map((order) => {
                    const packedCount = order.items.filter((i: any) => i.packing_status === "PACKED").length;
                    const totalItems = order.items.length;
                    const percent = totalItems > 0 ? Math.round((packedCount / totalItems) * 100) : 0;

                    return (
                      <div
                        key={order.id}
                        className="bg-white rounded-xl border border-slate-200 hover:border-slate-300 shadow-sm hover:shadow transition flex flex-col justify-between"
                      >
                        <div className="p-5">
                          <div className="flex items-center justify-between mb-3">
                            <span className="font-mono text-xs font-bold text-slate-900">
                              #{order.order_number}
                            </span>
                            {getStatusBadge(order.status)}
                          </div>

                          {/* Customer */}
                          <div className="flex items-center space-x-2 text-xs text-slate-600 mb-3">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            <span className="font-medium text-slate-800">
                              {order.customer?.name || "Customer"}
                            </span>
                            <span className="text-slate-400 font-mono">
                              ({formatCustomerPhone(order.customer?.phone)})
                            </span>
                          </div>

                          {/* Original Message snippet */}
                          <div className="bg-slate-50 border border-slate-200/70 rounded-lg p-2.5 mb-4 text-xs text-slate-600 italic">
                            &ldquo;{order.original_message}&rdquo;
                          </div>

                          {/* Items Preview */}
                          <div className="space-y-1.5 mb-4">
                            {order.items.slice(0, 3).map((item: any) => (
                              <div
                                key={item.id}
                                className="flex items-center justify-between text-xs text-slate-700"
                              >
                                <span className="truncate pr-2">
                                  {item.product_name_snapshot} ({item.quantity} {item.unit})
                                </span>
                                <span className="font-semibold shrink-0">₹{item.total_price}</span>
                              </div>
                            ))}
                            {order.items.length > 3 && (
                              <p className="text-[11px] text-slate-400 font-medium">
                                +{order.items.length - 3} more items...
                              </p>
                            )}
                          </div>

                          {/* Packing progress if confirmed/packing */}
                          {["CONFIRMED", "PACKING", "PARTIALLY_PACKED", "READY_FOR_PICKUP"].includes(
                            order.status
                          ) && (
                            <div className="mb-3">
                              <div className="flex justify-between text-[11px] text-slate-500 font-medium mb-1">
                                <span>Packing Checklist</span>
                                <span>
                                  {packedCount}/{totalItems} items ({percent}%)
                                </span>
                              </div>
                              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className={`h-full transition-all duration-300 ${
                                    percent === 100 ? "bg-emerald-500" : "bg-orange-500"
                                  }`}
                                  style={{ width: `${percent}%` }}
                                ></div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Card Footer Actions */}
                        <div className="px-5 py-3 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between rounded-b-xl">
                          <div>
                            <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">
                              Grand Total
                            </span>
                            <span className="text-base font-bold text-slate-900">
                              ₹{order.grand_total}
                            </span>
                          </div>

                          <div className="flex items-center space-x-2">
                            {/* Action based on status */}
                            {["NEW", "SHOPKEEPER_REVIEW", "NEEDS_CLARIFICATION"].includes(
                              order.status
                            ) && (
                              <button
                                onClick={() => handleOpenReview(order)}
                                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-semibold flex items-center space-x-1 transition shadow-sm"
                              >
                                <span>Review & Bill</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {["CONFIRMED", "PACKING", "PARTIALLY_PACKED"].includes(
                              order.status
                            ) && (
                              <button
                                onClick={() => handleOpenReview(order)}
                                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center space-x-1 transition shadow-sm"
                              >
                                <Package className="w-3.5 h-3.5" />
                                <span>Checklist</span>
                              </button>
                            )}

                            {/* Single-tap Mark as Packed button */}
                            {["NEW", "SHOPKEEPER_REVIEW", "NEEDS_CLARIFICATION", "CONFIRMED", "PACKING", "PARTIALLY_PACKED"].includes(
                              order.status
                            ) && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMarkOrderPacked(order.id);
                                }}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1 transition shadow-sm"
                                title="Mark all items packed & send WhatsApp ready message"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Mark Packed</span>
                              </button>
                            )}

                            {order.status === "READY_FOR_PICKUP" && (
                              <>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSendOrderReminder(order.id);
                                  }}
                                  className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-semibold flex items-center space-x-1 transition shadow-sm"
                                  title="Send WhatsApp pickup reminder (up to 4 times a day)"
                                >
                                  <Bell className="w-3.5 h-3.5" />
                                  <span>Remind ({order.pickup_reminders_count || 1}/4)</span>
                                </button>
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    const pin = order.order_number.split("-").slice(-1)[0];
                                    const res = await api.verifyQr(store.id, pin);
                                    if (res.success) {
                                      setSimSuccess("✅ Order delivered & marked as Collected!");
                                      setTimeout(() => setSimSuccess(null), 4000);
                                      refreshCurrentData();
                                    } else {
                                      alert(res.message || "Could not deliver order");
                                    }
                                  }}
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center space-x-1 transition shadow-sm"
                                  title="1-Tap Deliver to Customer"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Deliver (PIN: {order.order_number.split("-").slice(-1)[0]})</span>
                                </button>
                                <button
                                  onClick={() => handleOpenReview(order)}
                                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold flex items-center space-x-1 transition"
                                >
                                  <QrCode className="w-3.5 h-3.5" />
                                  <span>QR</span>
                                </button>
                              </>
                            )}

                            {order.status === "COLLECTED" && (
                              <button
                                onClick={() => handleOpenReview(order)}
                                className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-semibold flex items-center space-x-1 transition"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                <span>View Bill</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB: CUSTOMER SHOPPING LISTS */}
          {activeTab === "lists" && (
            <div className="space-y-6">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-base text-slate-800">
                    Customer Shopping Lists (ग्राहक ऑर्डर्स / लिस्ट)
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    AI automatically converts incoming customer WhatsApp messages into organized, itemized packing lists.
                  </p>
                </div>
                <div className="flex items-center space-x-2 text-xs text-slate-600 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
                  <span className="font-semibold">Shop Mobile:</span>
                  <span className="font-mono font-bold text-slate-900">{store?.phone}</span>
                </div>
              </div>

              {orders.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                  <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <h3 className="text-base font-semibold text-slate-700">No shopping lists yet</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    When customers send shopping lists on WhatsApp, AI will automatically parse and display their lists here.
                  </p>
                  <button
                    onClick={() => setActiveTab("simulate")}
                    className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold inline-flex items-center space-x-2"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Simulate First WhatsApp Order</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {orders.map((order) => {
                    const isCopied = copiedOrderId === order.id;

                    return (
                      <div
                        key={order.id}
                        className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between"
                      >
                        {/* List Card Header */}
                        <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-mono text-xs font-bold text-slate-900">
                              #{order.order_number}
                            </span>
                            {getStatusBadge(order.status)}
                          </div>

                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center space-x-2">
                              <User className="w-4 h-4 text-emerald-600" />
                              <span className="font-bold text-slate-900">
                                {order.customer?.name || "Customer"}
                              </span>
                              <span className="font-mono text-slate-500">
                                ({formatCustomerPhone(order.customer?.phone)})
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-400">
                              {new Date(order.created_at).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>

                          {/* Raw message received on WhatsApp */}
                          <div className="mt-3 bg-white border border-slate-200/80 rounded-xl p-2.5 text-xs text-slate-600 italic">
                            &ldquo;{order.original_message}&rdquo;
                          </div>
                        </div>

                        {/* Parsed Items Checklist */}
                        <div className="p-5 flex-1">
                          <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">
                            AI-Extracted Items Checklist:
                          </h4>
                          <div className="space-y-2">
                            {order.items.map((item: any) => {
                              const isPacked = item.packing_status === "PACKED";

                              return (
                                <div
                                  key={item.id}
                                  onClick={() =>
                                    handleTogglePacking(order.id, item.id, item.packing_status)
                                  }
                                  className={`p-2.5 rounded-xl border flex items-center justify-between text-xs cursor-pointer transition select-none ${
                                    isPacked
                                      ? "bg-emerald-50/60 border-emerald-200 text-slate-500 line-through"
                                      : "bg-slate-50/80 border-slate-200 hover:border-slate-300 text-slate-800"
                                  }`}
                                >
                                  <div className="flex items-center space-x-3">
                                    <div
                                      className={`w-4 h-4 rounded flex items-center justify-center border transition ${
                                        isPacked
                                          ? "bg-emerald-600 border-emerald-600 text-white"
                                          : "border-slate-300 bg-white"
                                      }`}
                                    >
                                      {isPacked && <Check className="w-3 h-3 stroke-[3]" />}
                                    </div>
                                    <span className="font-semibold">
                                      {item.product_name_snapshot}
                                    </span>
                                  </div>

                                  <div className="flex items-center space-x-3 shrink-0">
                                    <span className="font-mono font-medium px-2 py-0.5 rounded bg-white border border-slate-200 text-[11px]">
                                      {item.quantity} {item.unit}
                                    </span>
                                    <span className="font-bold text-slate-900 w-16 text-right">
                                      ₹{item.total_price}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* List Footer */}
                        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase font-bold block">
                              Bill Total
                            </span>
                            <span className="text-base font-bold text-slate-900">
                              ₹{order.grand_total}
                            </span>
                          </div>

                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleCopyShoppingList(order)}
                              className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition shadow-xs"
                            >
                              {isCopied ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  <span className="text-emerald-700">Copied!</span>
                                </>
                              ) : (
                                <>
                                  <FileText className="w-3.5 h-3.5" />
                                  <span>Copy List</span>
                                </>
                              )}
                            </button>

                            {order.status !== "READY_FOR_PICKUP" && order.status !== "COLLECTED" ? (
                              <button
                                onClick={() => handleMarkOrderPacked(order.id)}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition shadow-sm"
                                title="Mark order packed & send WhatsApp ready notification"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Mark Packed</span>
                              </button>
                            ) : (
                              <>
                                <button
                                  onClick={async () => {
                                    const pin = order.order_number.split("-").slice(-1)[0];
                                    const res = await api.verifyQr(store.id, pin);
                                    if (res.success) {
                                      setSimSuccess("✅ Order delivered & marked as Collected!");
                                      setTimeout(() => setSimSuccess(null), 4000);
                                      refreshCurrentData();
                                    } else {
                                      alert(res.message || "Could not deliver order");
                                    }
                                  }}
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 transition shadow-sm"
                                  title="1-Tap Deliver"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Deliver (PIN: {order.order_number.split("-").slice(-1)[0]})</span>
                                </button>
                                <button
                                  onClick={() => handleSendOrderReminder(order.id)}
                                  className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-semibold flex items-center space-x-1 transition shadow-sm"
                                  title="Send WhatsApp pickup reminder"
                                >
                                  <Bell className="w-3.5 h-3.5" />
                                  <span>Remind ({order.pickup_reminders_count || 1}/4)</span>
                                </button>
                              </>
                            )}

                            <button
                              onClick={() => handleOpenReview(order)}
                              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition shadow-sm"
                            >
                              <span>Details</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: PRODUCTS & CATALOGUE */}
          {activeTab === "products" && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="p-5 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                      <Package className="w-5 h-5 text-emerald-600" />
                      <span>Dukan Ka Catalogue & Dynamic Pricing ({products.length} Products)</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Yahan jo price aur samaan hoga, AI customer ke WhatsApp messages se auto-match karke bill banayega.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={handleSeedCatalogue}
                      disabled={isSeedingCatalogue}
                      className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-md hover:shadow-lg transition shrink-0 cursor-pointer disabled:opacity-50"
                      title="Load 50+ Top Indian Kirana Items in 1-Click"
                    >
                      <Zap className="w-4 h-4 fill-white" />
                      <span>{isSeedingCatalogue ? "Loading..." : "⚡ 1-Click Load 50+ Kirana Items"}</span>
                    </button>
                    <button
                      onClick={() => setIsBulkImportOpen(true)}
                      className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md hover:shadow-lg transition shrink-0 cursor-pointer"
                      title="Bulk Paste from WhatsApp or Diary"
                    >
                      <FileText className="w-4 h-4" />
                      <span>📋 Quick Bulk Paste</span>
                    </button>
                    <button
                      onClick={() => setIsAddProductOpen(true)}
                      className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md hover:shadow-lg transition shrink-0 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>+ Naya Samaan</span>
                    </button>
                  </div>
                </div>

                {catalogueNotice && (
                  <div className="bg-emerald-50 border-b border-emerald-200 px-5 py-2.5 text-xs text-emerald-800 font-bold flex items-center gap-2 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{catalogueNotice}</span>
                  </div>
                )}

                {/* 1-Click Fast Presets */}
                <div className="bg-emerald-50/50 border-b border-emerald-100/60 px-5 py-3 flex items-center gap-2 overflow-x-auto text-xs">
                  <span className="text-emerald-800 font-bold shrink-0 flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    <span>1-Tap Popular Kirana Add:</span>
                  </span>
                  {[
                    { name: "Aashirvaad Shudh Chakki Atta", brand: "Aashirvaad", unit: "kg", price: "55", aliases: "atta, gehun atta, aashirvaad atta" },
                    { name: "Madhur Pure Sugar", brand: "Madhur", unit: "kg", price: "48", aliases: "sugar, shakkar, chini, cheeni" },
                    { name: "Fortune Kachi Ghani Mustard Oil", brand: "Fortune", unit: "litre", price: "145", aliases: "sarson tel, mustard oil, tel" },
                    { name: "Tata Salt Vacuum Evaporated", brand: "Tata", unit: "packet", price: "28", aliases: "tata namak, namak, salt" },
                    { name: "Maggi 2-Minute Noodles", brand: "Nestle", unit: "packet", price: "14", aliases: "maggi, noodles, 2 minute maggi" },
                    { name: "Amul Taaza Toned Milk (500ml)", brand: "Amul", unit: "packet", price: "27", aliases: "doodh, amul doodh, milk" },
                  ].map((preset, i) => (
                    <button
                      key={i}
                      onClick={() => handleAddPreset(preset)}
                      className="shrink-0 px-3 py-1 rounded-full bg-white border border-emerald-200 hover:border-emerald-500 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 text-[11px] font-medium transition shadow-2xs cursor-pointer flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3 text-emerald-600" />
                      <span>{preset.name}</span>
                      <span className="font-bold text-emerald-700">₹{preset.price}</span>
                    </button>
                  ))}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4">Samaan / Product Name</th>
                        <th className="py-3 px-4">Brand</th>
                        <th className="py-3 px-4">AI Synonyms (WhatsApp Aliases)</th>
                        <th className="py-3 px-4">Unit</th>
                        <th className="py-3 px-4">Dukan Ka Price (Rate)</th>
                        <th className="py-3 px-4">Stock</th>
                        <th className="py-3 px-4">Availability</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {products.map((prod) => (
                        <tr key={prod.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-3.5 px-4 font-semibold text-slate-900">
                            <div>{prod.name}</div>
                            {prod.variant && <div className="text-[11px] text-slate-400 font-normal">{prod.variant}</div>}
                          </td>
                          <td className="py-3.5 px-4 text-slate-600">
                            {prod.brand || "—"}
                          </td>
                          <td className="py-3.5 px-4 max-w-xs">
                            <div className="flex flex-wrap gap-1">
                              {prod.aliases && prod.aliases.length > 0 ? (
                                prod.aliases.map((a: string, i: number) => (
                                  <span
                                    key={i}
                                    className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px]"
                                  >
                                    {a}
                                  </span>
                                ))
                              ) : (
                                <span className="text-slate-400 text-[11px] italic">Koi alias nahi</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-medium text-slate-600">{prod.unit}</td>
                          <td className="py-3.5 px-4 font-bold text-slate-900">
                            {editingPriceProdId === prod.id ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  step="0.5"
                                  value={editPriceVal}
                                  onChange={(e) => setEditPriceVal(e.target.value)}
                                  className="w-16 px-1.5 py-1 text-xs border border-emerald-500 rounded bg-white font-bold"
                                  autoFocus
                                />
                                <button
                                  onClick={() => handleSavePriceEdit(prod.id)}
                                  className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-700"
                                >
                                  <Check className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => setEditingPriceProdId(null)}
                                  className="p-1 rounded bg-slate-200 text-slate-600 hover:bg-slate-300"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 group">
                                <span>₹{parseFloat(prod.current_price).toFixed(2)}</span>
                                <button
                                  onClick={() => {
                                    setEditingPriceProdId(prod.id);
                                    setEditPriceVal(parseFloat(prod.current_price).toString());
                                  }}
                                  className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-emerald-600 p-0.5 transition"
                                  title="Change Price"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-600">
                            {parseFloat(prod.stock_quantity)}
                          </td>
                          <td className="py-3.5 px-4">
                            <button
                              onClick={() => handleToggleStock(prod)}
                              className="cursor-pointer"
                              title="Click to toggle stock status"
                            >
                              {prod.availability ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 hover:bg-emerald-200 transition">
                                  ✓ In Stock
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-800 hover:bg-rose-200 transition">
                                  ✕ Out of Stock
                                </span>
                              )}
                            </button>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => handleDeleteProduct(prod.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                              title="Delete Product"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ADD PRODUCT MODAL POPUP */}
              {isAddProductOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
                  <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 relative">
                    <button
                      onClick={() => setIsAddProductOpen(false)}
                      className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                    >
                      <X className="w-5 h-5" />
                    </button>

                    <div className="flex items-center gap-3 mb-5">
                      <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                        <Plus className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-base">Naya Samaan / Product Jodein</h3>
                        <p className="text-xs text-slate-500">Apni dukan ka samaan aur rate yahan add karein.</p>
                      </div>
                    </div>

                    <form onSubmit={handleAddProduct} className="space-y-4 text-xs">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Product / Samaan Ka Naam *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Jaise: Madhur Sugar 1kg, Fortune Mustard Oil 1L"
                          value={newProdName}
                          onChange={(e) => setNewProdName(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-medium"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">
                            Brand (Company)
                          </label>
                          <input
                            type="text"
                            placeholder="Tata, Amul, Fortune, etc."
                            value={newProdBrand}
                            onChange={(e) => setNewProdBrand(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">
                            Unit (Napne Ki Ikai) *
                          </label>
                          <select
                            value={newProdUnit}
                            onChange={(e) => setNewProdUnit(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm bg-white"
                          >
                            <option value="kg">kg (Kilogram)</option>
                            <option value="g">g (Gram)</option>
                            <option value="litre">litre (Litre)</option>
                            <option value="ml">ml (Millilitre)</option>
                            <option value="packet">packet (Packet)</option>
                            <option value="piece">piece (Piece / Nag)</option>
                            <option value="bottle">bottle (Bottle)</option>
                            <option value="dozen">dozen (Darjan)</option>
                            <option value="box">box (Dabba / Box)</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">
                            Current Price / Rate (₹) *
                          </label>
                          <input
                            type="number"
                            step="0.5"
                            required
                            placeholder="48.00"
                            value={newProdPrice}
                            onChange={(e) => setNewProdPrice(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-bold text-slate-900"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">
                            Stock Quantity
                          </label>
                          <input
                            type="number"
                            step="1"
                            placeholder="100"
                            value={newProdStock}
                            onChange={(e) => setNewProdStock(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1 flex items-center justify-between">
                          <span>AI Synonyms / Aliases (WhatsApp Search Keywords)</span>
                          <span className="text-[10px] text-emerald-600 font-normal">Comma se alag karein</span>
                        </label>
                        <input
                          type="text"
                          placeholder="Jaise: shakkar, chini, cheeni, sugar"
                          value={newProdAliases}
                          onChange={(e) => setNewProdAliases(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                        />
                        <p className="text-[11px] text-slate-400 mt-1">
                          💡 Customer WhatsApp par jo bolenge (jaise "shakkar", "cheeni"), AI usse is product se jod lega.
                        </p>
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setIsAddProductOpen(false)}
                          className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold transition"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={isSavingProduct}
                          className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                          {isSavingProduct ? (
                            <span>Saving...</span>
                          ) : (
                            <>
                              <Check className="w-4 h-4" />
                              <span>Catalogue Me Save Karein</span>
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
              {/* BULK IMPORT MODAL POPUP */}
              {isBulkImportOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
                  <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 relative">
                    <button
                      onClick={() => setIsBulkImportOpen(false)}
                      className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                    >
                      <X className="w-5 h-5" />
                    </button>

                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-base">Quick Bulk Paste / Import</h3>
                        <p className="text-xs text-slate-500">Apne WhatsApp rate-list ya diary se ek sath saare samaan paste karein.</p>
                      </div>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-3 text-xs text-slate-600">
                      <p className="font-bold text-slate-800 mb-1">💡 Example Format (Har line me ek item):</p>
                      <pre className="font-mono text-[11px] text-slate-700 bg-white p-2 rounded border border-slate-200">
Atta 45/kg
Madhur Sugar 48/kg
Fortune Mustard Oil 145/L
Tata Salt 28/packet
Moong Dal 120/kg
Toor Dal 165/kg
Parle G 10/packet
Dettol Soap 36/piece</pre>
                    </div>

                    <form onSubmit={handleBulkPasteImport} className="space-y-4 text-xs">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Samaan Aur Rates Ki List Yahan Paste Karein:
                        </label>
                        <textarea
                          rows={7}
                          required
                          placeholder={"Atta 45/kg\nSugar 48/kg\nFortune Mustard Oil 145/L\nTata Namak 28/packet..."}
                          value={bulkImportText}
                          onChange={(e) => setBulkImportText(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-mono"
                        />
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setIsBulkImportOpen(false)}
                          className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold transition"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={isSavingProduct}
                          className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                          {isSavingProduct ? <span>Importing...</span> : <><span>🚀 Ek Sath Saare Import Karein</span></>}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: QR PICKUP VERIFICATION */}
          {activeTab === "qr_verify" && (
            <div className="max-w-xl mx-auto bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mx-auto mb-4">
                <QrCode className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 text-center">
                QR Pickup Code Verification
              </h3>
              <p className="text-xs text-slate-500 text-center mt-1 mb-6">
                When a customer arrives at your store, scan their WhatsApp pickup QR code or enter
                their pickup token below to verify and complete the order.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    4-Digit Pickup PIN ya Order Number Daalein:
                  </label>
                  <input
                    type="text"
                    placeholder="Sirf 4-digit PIN daalein (jaise: 7792)"
                    value={qrTokenInput}
                    onChange={(e) => setQrTokenInput(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 font-mono text-center text-lg font-bold tracking-widest text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <p className="text-[11px] text-slate-400 text-center mt-1">
                    Customer ke WhatsApp par 4-digit PIN gaya hai (jaise: <strong>7792</strong>). Sirf wo PIN yahan daalein!
                  </p>
                </div>

                <button
                  onClick={handleVerifyQr}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-md shadow-emerald-600/20 transition flex items-center justify-center space-x-2"
                >
                  <Check className="w-5 h-5" />
                  <span>Verify PIN & Deliver (समान दे दिया)</span>
                </button>

                {/* Quick 1-Tap Delivery for Ready Orders */}
                {orders.filter((o) => o.status === "READY_FOR_PICKUP").length > 0 && (
                  <div className="pt-3 border-t border-slate-200">
                    <p className="text-xs font-semibold text-slate-600 mb-2">
                      Ya niche ready order par 1-tap karke deliver karein:
                    </p>
                    <div className="space-y-2">
                      {orders
                        .filter((o) => o.status === "READY_FOR_PICKUP")
                        .map((readyOrd) => {
                          const pin = readyOrd.order_number.split("-").slice(-1)[0];
                          return (
                            <div
                              key={readyOrd.id}
                              className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between"
                            >
                              <div>
                                <span className="font-bold text-xs text-slate-900 block">
                                  {readyOrd.customer?.name || "Customer"} (#{readyOrd.order_number})
                                </span>
                                <span className="text-[11px] text-emerald-800 font-mono font-bold">
                                  PIN: {pin} &bull; Total: ₹{readyOrd.grand_total}
                                </span>
                              </div>
                              <button
                                onClick={async () => {
                                  setQrTokenInput(pin);
                                  const res = await api.verifyQr(store.id, pin);
                                  setQrVerificationResult(res);
                                  if (res.success) refreshCurrentData();
                                }}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm"
                              >
                                Deliver Now
                              </button>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>

              {/* Verification Result Feedback */}
              {qrVerificationResult && (
                <div
                  className={`mt-6 p-5 rounded-xl border ${
                    qrVerificationResult.success
                      ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                      : "bg-red-50 border-red-200 text-red-900"
                  }`}
                >
                  <div className="flex items-center space-x-2 mb-2">
                    {qrVerificationResult.success ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-600" />
                    )}
                    <h4 className="font-bold text-sm">
                      {qrVerificationResult.success
                        ? "Order Verified Successfully!"
                        : "Verification Failed"}
                    </h4>
                  </div>
                  <p className="text-xs mb-3">{qrVerificationResult.message}</p>

                  {qrVerificationResult.success && (
                    <div className="bg-white/80 rounded-lg p-3 text-xs space-y-1 font-medium border border-emerald-200/50">
                      <p>Order: #{qrVerificationResult.order_number}</p>
                      <p>Customer: {qrVerificationResult.customer_phone}</p>
                      <p>Amount to Collect: {qrVerificationResult.grand_total}</p>
                      <p className="text-emerald-700 font-bold">
                        Status: Order marked as COLLECTED
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: STORE ANALYTICS */}
          {activeTab === "analytics" && analytics && (
            <div className="space-y-6">
              {/* Metrics Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Total Sales (Revenue)
                  </p>
                  <h4 className="text-2xl font-bold text-slate-900 mt-1">
                    ₹{parseFloat(analytics.total_revenue).toFixed(2)}
                  </h4>
                  <p className="text-xs text-emerald-600 font-semibold mt-1">
                    Recorded across confirmed orders
                  </p>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Total Orders
                  </p>
                  <h4 className="text-2xl font-bold text-slate-900 mt-1">{analytics.total_orders}</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    {analytics.collected_orders} orders successfully collected
                  </p>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Average Order Value
                  </p>
                  <h4 className="text-2xl font-bold text-slate-900 mt-1">
                    ₹{parseFloat(analytics.average_order_value).toFixed(2)}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">Per transaction average</p>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Orders In Packing / Ready
                  </p>
                  <h4 className="text-2xl font-bold text-amber-600 mt-1">
                    {analytics.packing_orders + analytics.ready_orders}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">Active fulfillment pipeline</p>
                </div>
              </div>

              {/* Top Selling Products */}
              <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                <h4 className="text-base font-bold text-slate-800 mb-4">
                  Top Selling Kirana Products
                </h4>
                <div className="divide-y divide-slate-100">
                  {analytics.top_products.map((p: any, idx: number) => (
                    <div key={idx} className="py-3 flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-3">
                        <span className="w-6 h-6 rounded-full bg-slate-100 font-bold text-slate-600 flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <div>
                          <p className="font-bold text-slate-800">{p.product_name}</p>
                          <p className="text-slate-400">{p.order_count} orders</p>
                        </div>
                      </div>
                      <span className="font-semibold text-slate-900">
                        {p.total_quantity} {p.unit} sold
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: WHATSAPP SIMULATOR & LIVE CHAT PREVIEW */}
          {activeTab === "simulate" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-6xl mx-auto">
              {/* Left Column: Simulator Form & Real WhatsApp Setup */}
              <div className="lg:col-span-6 space-y-6">
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                  <div className="flex items-center space-x-3 mb-4 pb-3 border-b border-slate-200">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/30">
                      <MessageSquare className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-800">
                        Inbound Message Simulator
                      </h3>
                      <p className="text-xs text-slate-500">
                        Send test customer shopping lists to test AI parsing & order generation.
                      </p>
                    </div>
                  </div>

                  {simSuccess && (
                    <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center space-x-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{simSuccess}</span>
                    </div>
                  )}

                  {simError && (
                    <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold flex items-center space-x-2">
                      <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                      <span>{simError}</span>
                    </div>
                  )}

                  <form onSubmit={handleSendSimulatedMessage} className="space-y-3.5">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Customer Name:
                        </label>
                        <input
                          type="text"
                          value={simName}
                          onChange={(e) => setSimName(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                          WhatsApp Phone:
                        </label>
                        <input
                          type="text"
                          value={simPhone}
                          onChange={(e) => setSimPhone(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Shopping List Text:
                      </label>
                      <textarea
                        rows={3}
                        value={simText}
                        onChange={(e) => setSimText(e.target.value)}
                        placeholder="e.g. 2 kg atta, 1 litre oil, 1 kg sugar aur 2 packet maggi rakh dena"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          setSimText(
                            "Bhaiya, 2 kg atta, 1 litre oil, 1 kg sugar aur 2 packet Maggi rakh dena"
                          )
                        }
                        className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px]"
                      >
                        Sample 1 (Kirana Mix)
                      </button>
                      <button
                        type="button"
                        onClick={() => setSimText("5 kg atta, 2 packet tata salt aur 2 litre tel")}
                        className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px]"
                      >
                        Sample 2 (Bulk)
                      </button>
                      <button
                        type="button"
                        onClick={() => setSimText("1 kg cheeni, 4 packet maggi urgent bhej do")}
                        className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px]"
                      >
                        Sample 3 (Quick)
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={isSendingSim}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow-md shadow-emerald-600/20 transition flex items-center justify-center space-x-2"
                    >
                      {isSendingSim ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>AI Parsing Message...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>Send Customer Message</span>
                        </>
                      )}
                    </button>
                  </form>
                </div>

                {/* Real WhatsApp Setup Instructions Card */}
                <div className="bg-amber-50/70 border border-amber-200/90 rounded-2xl p-5 text-xs text-amber-900 space-y-2.5">
                  <div className="flex items-center space-x-2 font-bold text-amber-950">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    <span>Real WhatsApp Delivery Setup (Meta Cloud API)</span>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    By default, when Meta credentials are not configured, messages are safely simulated. To receive and send real WhatsApp messages on real phones:
                  </p>
                  <ol className="list-decimal pl-4 space-y-1 text-[11px] text-amber-900">
                    <li>Create a Meta App at <a href="https://developers.facebook.com" target="_blank" rel="noreferrer" className="underline font-bold">developers.facebook.com</a> with <strong>WhatsApp Cloud API</strong>.</li>
                    <li>Copy your <strong>System User Access Token</strong> and <strong>Phone Number ID</strong> into <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">.env</code>.</li>
                    <li>Expose local port 8000 using ngrok: <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">ngrok http 8000</code>.</li>
                    <li>Set Meta Webhook Callback URL to: <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">https://YOUR-NGROK/api/v1/webhooks/whatsapp</code> with verify token <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">retail_verify_token_secure_2026</code>.</li>
                  </ol>
                </div>
              </div>

              {/* Right Column: Interactive WhatsApp Phone Mockup */}
              <div className="lg:col-span-6 flex flex-col items-center">
                {orders.length > 0 && (
                  <div className="w-full max-w-sm mb-2 flex items-center justify-between text-[11px]">
                    <span className="font-bold text-slate-700">Showing Phone for:</span>
                    <select
                      value={activeChatOrder?.id || ""}
                      onChange={(e) => {
                        const ord = orders.find((o) => o.id === e.target.value);
                        if (ord) {
                          setActiveChatOrder(ord);
                          loadChatForOrder(ord.id);
                        }
                      }}
                      className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-800 shadow-xs focus:outline-none"
                    >
                      {orders.map((o) => (
                        <option key={o.id} value={o.id}>
                          #{o.order_number} - {o.customer?.name || "Customer"}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="w-full max-w-sm bg-slate-900 rounded-[2.5rem] p-3 shadow-2xl border-4 border-slate-800">
                  {/* Phone Bezel */}
                  <div className="bg-[#EFEAE2] rounded-[2rem] overflow-hidden flex flex-col h-[560px] border border-slate-700/50">
                    {/* WhatsApp Top Header */}
                    <div className="bg-[#075E54] text-white px-3 py-2.5 flex items-center justify-between shadow">
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 rounded-full bg-emerald-700 flex items-center justify-center text-xs font-bold border border-emerald-400">
                          GK
                        </div>
                        <div>
                          <p className="text-xs font-bold leading-tight flex items-center space-x-1">
                            <span>Gupta Kirana Store</span>
                            <span className="text-[10px] bg-emerald-400 text-slate-900 px-1 rounded font-normal">Official</span>
                          </p>
                          <p className="text-[10px] text-emerald-200">Online • WhatsApp Business</p>
                        </div>
                      </div>
                      {activeChatOrder && (
                        <button
                          onClick={() => loadChatForOrder(activeChatOrder.id)}
                          title="Refresh Chat"
                          className="p-1 text-emerald-200 hover:text-white"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Chat Bubble Area */}
                    <div className="flex-1 p-3 overflow-y-auto space-y-2.5 text-xs">
                      <div className="text-center my-1">
                        <span className="bg-amber-100/80 text-amber-900 text-[10px] px-2.5 py-0.5 rounded-md shadow-xs">
                          Messages are end-to-end encrypted
                        </span>
                      </div>

                      {chatMessages.length === 0 ? (
                        <div className="text-center py-12 text-slate-400 text-xs">
                          <MessageSquare className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                          <p>No messages yet.</p>
                          <p className="text-[10px] text-slate-400 mt-1">
                            Send a message using the form on the left to see customer chat here live!
                          </p>
                        </div>
                      ) : (
                        chatMessages.map((msg, idx) => {
                          const isCustomer = msg.sender === "customer";
                          const isConfirmationPrompt = msg.message_type === "CUSTOMER_CONFIRMATION_REQUIRED";

                          return (
                            <div
                              key={idx}
                              className={`flex flex-col ${isCustomer ? "items-end" : "items-start"}`}
                            >
                              <div
                                className={`max-w-[85%] rounded-lg p-2.5 shadow-xs text-[11px] leading-relaxed whitespace-pre-line ${
                                  isCustomer
                                    ? "bg-[#DCF8C6] text-slate-800 rounded-tr-none"
                                    : "bg-white text-slate-800 rounded-tl-none"
                                }`}
                              >
                                {msg.text}
                              </div>

                              {/* Interactive buttons if order is awaiting customer confirmation */}
                              {!isCustomer && isConfirmationPrompt && activeChatOrder?.status === "CUSTOMER_CONFIRMATION" && (
                                <div className="mt-1.5 space-y-1 w-full max-w-[85%]">
                                  <button
                                    onClick={() => handleCustomerConfirmFromPhone(activeChatOrder.id, "CONFIRM")}
                                    className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold shadow-xs transition"
                                  >
                                    ✅ Confirm Order
                                  </button>
                                  <button
                                    onClick={() => handleCustomerConfirmFromPhone(activeChatOrder.id, "CANCEL")}
                                    className="w-full py-1 bg-white hover:bg-slate-100 text-red-600 border border-red-200 rounded-lg text-[10px] font-semibold transition"
                                  >
                                    ❌ Cancel Order
                                  </button>
                                </div>
                              )}

                              <span className="text-[9px] text-slate-400 mt-0.5 px-1">
                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Simulated Input Footer */}
                    <div className="bg-[#F0F2F5] px-2 py-1.5 flex items-center space-x-1.5 border-t border-slate-200">
                      <input
                        type="text"
                        placeholder="Message Gupta Kirana..."
                        disabled
                        className="flex-1 bg-white px-3 py-1.5 rounded-full text-[11px] text-slate-400 border border-slate-200 focus:outline-none"
                      />
                      <div className="w-7 h-7 rounded-full bg-[#128C7E] flex items-center justify-center text-white">
                        <Send className="w-3 h-3" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          {/* TAB: WHATSAPP PAIRING CODE (NO LAPTOP / NO QR NEEDED) */}
          {activeTab === "pairing" && (
            <div className="max-w-4xl mx-auto space-y-6">
              {/* Header Card */}
              <div className="bg-gradient-to-r from-emerald-800 to-teal-900 rounded-3xl p-6 md:p-8 text-white shadow-xl">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="inline-flex items-center space-x-2 bg-emerald-700/60 border border-emerald-400/30 px-3 py-1 rounded-full text-xs font-semibold text-emerald-200 mb-3">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
                      <span>Zero Setup • No Laptop Needed • 100% Free</span>
                    </div>
                    <h2 className="text-2xl font-bold tracking-tight">
                      Link WhatsApp with 8-Digit Code
                    </h2>
                    <p className="text-emerald-100 text-xs md:text-sm mt-1 max-w-xl">
                      Dukandaar apne ek hi Android phone se bina kisi laptop ya QR scan ke sirf 8-digit Pairing Code daal kar apna WhatsApp connect kar sakta hai.
                    </p>
                  </div>

                  <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 text-center shrink-0">
                    <p className="text-[11px] text-emerald-200 font-medium uppercase tracking-wider">
                      Connection Status
                    </p>
                    <div className="mt-1 flex items-center justify-center space-x-2">
                      <span
                        className={`w-3 h-3 rounded-full ${
                          gatewayStatus === "connected"
                            ? "bg-emerald-400 animate-pulse shadow-lg shadow-emerald-400/50"
                            : pairingCode || gatewayStatus === "pairing"
                            ? "bg-amber-400 animate-bounce"
                            : "bg-slate-400"
                        }`}
                      ></span>
                      <span className="font-bold text-sm tracking-wide">
                        {gatewayStatus === "connected"
                          ? "Live & Connected"
                          : pairingCode || gatewayStatus === "pairing"
                          ? "Enter Code on WhatsApp"
                          : "Ready to Link"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Connected Banner if already linked */}
              {gatewayStatus === "connected" && (
                <div className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-5 text-emerald-900 flex items-start space-x-3.5 shadow-sm">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-sm text-emerald-950">
                      🎉 Aapka WhatsApp Successfully Linked Hai!
                    </h4>
                    <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
                      Ab koi bhi mohalle ka customer aapke mobile number par jab bhi saman ki list bhejega, hamara AI model automatically us message ko padhkar <strong>&ldquo;Customer Lists (ग्राहक लिस्ट)&rdquo;</strong> me add kar dega aur packing checklist bana dega!
                    </p>
                    <button
                      onClick={() => setActiveTab("lists")}
                      className="mt-3 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold inline-flex items-center space-x-1.5 transition"
                    >
                      <span>Check Customer Lists Now</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Pairing Form & Instructions Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Card: Input & Code Display */}
                <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-1 flex items-center space-x-2">
                      <Smartphone className="w-4 h-4 text-emerald-600" />
                      <span>Step 1: Enter Your WhatsApp Number</span>
                    </h3>
                    <p className="text-xs text-slate-500 mb-4">
                      Wo mobile number dalein jispar aapke grahak (customers) saman ki list bhejte hain.
                    </p>

                    {pairingError && (
                      <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold flex items-center space-x-2">
                        <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                        <span>{pairingError}</span>
                      </div>
                    )}

                    <form onSubmit={handleRequestPairingCode} className="space-y-4">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Shopkeeper WhatsApp Number:
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={pairingPhone}
                            onChange={(e) => setPairingPhone(e.target.value)}
                            placeholder="e.g. 9876543210 ya +919876543210"
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">
                          India ke 10-digit number ke aage 91 automatically jud jayega.
                        </p>
                      </div>

                      <button
                        type="submit"
                        disabled={isGeneratingPairing || !pairingPhone.trim()}
                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow-md shadow-emerald-600/20 transition flex items-center justify-center space-x-2"
                      >
                        {isGeneratingPairing ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>WhatsApp Server Se Code Generate Ho Raha Hai...</span>
                          </>
                        ) : (
                          <>
                            <Zap className="w-4 h-4" />
                            <span>Generate 8-Digit Pairing Code</span>
                          </>
                        )}
                      </button>
                    </form>

                    {/* Display 8-digit Pairing Code */}
                    {pairingCode && (
                      <div className="mt-6 p-5 rounded-2xl bg-slate-900 text-white text-center border-2 border-emerald-500/50 shadow-lg animate-in fade-in zoom-in-95">
                        <p className="text-[11px] text-emerald-300 font-semibold uppercase tracking-wider mb-1">
                          Aapka 8-Digit Pairing Code:
                        </p>
                        <div className="my-2 py-3 px-4 bg-slate-800 rounded-xl border border-slate-700 font-mono font-extrabold text-3xl tracking-widest text-emerald-400 select-all">
                          {pairingCode}
                        </div>

                        <div className="flex items-center justify-center space-x-3 mt-3">
                          <button
                            type="button"
                            onClick={handleCopyPairingCode}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold inline-flex items-center space-x-1.5 transition shadow"
                          >
                            <Copy className="w-4 h-4" />
                            <span>{isCodeCopied ? "Copied!" : "Copy Code"}</span>
                          </button>
                          <span className="text-xs text-amber-300 font-semibold">
                            ⏱️ 2 minute me WhatsApp me dalein
                          </span>
                        </div>

                        <div className="mt-4 p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-left text-xs text-emerald-100">
                          <p className="font-bold text-emerald-300 mb-1">📲 WhatsApp Me Code Kahan Daalein:</p>
                          <p className="text-[11px] leading-relaxed">
                            WhatsApp &gt; 3 dots (Settings) &gt; <strong>Linked Devices</strong> &gt; <strong>Link a device</strong> &gt; Niche tap karein: <em>&ldquo;Link with phone number instead&rdquo;</em>
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                    <span className="flex items-center space-x-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>End-to-End Encrypted</span>
                    </span>
                    <span>Meta Cloud API Fees: ₹0</span>
                  </div>
                </div>

                {/* Right Card: 4-Step Visual Instructions */}
                <div className="lg:col-span-6 bg-slate-50 rounded-2xl border border-slate-200/80 p-6 flex flex-col justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center space-x-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Step 2: Apne WhatsApp Me Code Kaise Daalein?</span>
                    </h3>

                    <div className="space-y-3.5">
                      <div className="flex items-start space-x-3 bg-white p-3.5 rounded-xl border border-slate-200">
                        <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center shrink-0">
                          1
                        </div>
                        <div className="text-xs">
                          <p className="font-bold text-slate-800">WhatsApp Kholein</p>
                          <p className="text-slate-500 text-[11px] mt-0.5">
                            Apne usi mobile me WhatsApp app open karein.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start space-x-3 bg-white p-3.5 rounded-xl border border-slate-200">
                        <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center shrink-0">
                          2
                        </div>
                        <div className="text-xs">
                          <p className="font-bold text-slate-800">Linked Devices par jayein</p>
                          <p className="text-slate-500 text-[11px] mt-0.5">
                            Top right me <strong>3 Dots (⋮)</strong> ya <strong>Settings</strong> par tap karein, fir <strong>Linked Devices (लिंक्ड डिवाइसेस)</strong> select karein.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start space-x-3 bg-white p-3.5 rounded-xl border border-slate-200">
                        <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center shrink-0">
                          3
                        </div>
                        <div className="text-xs">
                          <p className="font-bold text-slate-800">&ldquo;Link a device&rdquo; dabayein</p>
                          <p className="text-slate-500 text-[11px] mt-0.5">
                            Green button <strong>Link a device</strong> par tap karein. Agar fingerprint/PIN mange toh confirm karein.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start space-x-3 bg-emerald-50/80 p-3.5 rounded-xl border-2 border-emerald-300">
                        <div className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                          4
                        </div>
                        <div className="text-xs">
                          <p className="font-bold text-emerald-950">
                            &ldquo;Link with phone number instead&rdquo; par tap karein
                          </p>
                          <p className="text-emerald-800 text-[11px] mt-0.5">
                            Screen ke niche chhota text dikhega <strong>&ldquo;Link with phone number instead (फोन नंबर से लिंक करें)&rdquo;</strong>. Uspe tap karke upar ka 8-digit code daal dein!
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900">
                    💡 <strong>Tip:</strong> Code daalte hi 2 second me screen par <strong>Live & Connected</strong> ho jayega, aur aapka setup complete ho jayega!
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* MODAL: ORDER REVIEW & PACKING CHECKLIST */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-mono font-bold text-xs">
                  ORD
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="font-bold text-base text-slate-900">
                      Order #{selectedOrder.order_number}
                    </h3>
                    {getStatusBadge(selectedOrder.status)}
                  </div>
                  <p className="text-xs text-slate-500">
                    Customer: {selectedOrder.customer?.name} ({formatCustomerPhone(selectedOrder.customer?.phone)})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5">
              {/* Original WhatsApp Message */}
              <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3.5">
                <div className="flex items-center space-x-1.5 text-xs font-bold text-emerald-800 mb-1">
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Original WhatsApp Message from Customer:</span>
                </div>
                <p className="text-xs text-slate-800 italic bg-white p-2.5 rounded-lg border border-emerald-100">
                  &ldquo;{selectedOrder.original_message}&rdquo;
                </p>
              </div>

              {/* Items Breakdown Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Order Items & Packing Checklist:
                  </h4>
                  <span className="text-xs text-slate-500">
                    {["CONFIRMED", "PACKING", "PARTIALLY_PACKED", "READY_FOR_PICKUP"].includes(
                      selectedOrder.status
                    ) && "Click item to toggle Packed status"}
                  </span>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Item Name</th>
                        <th className="py-2.5 px-3 w-20">Qty</th>
                        <th className="py-2.5 px-3 w-20">Unit</th>
                        <th className="py-2.5 px-3 w-24">Price (₹)</th>
                        <th className="py-2.5 px-3 w-24 text-right">Total (₹)</th>
                        {["CONFIRMED", "PACKING", "PARTIALLY_PACKED", "READY_FOR_PICKUP"].includes(
                          selectedOrder.status
                        ) && <th className="py-2.5 px-3 w-24 text-center">Packing</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {reviewItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/70">
                          <td className="py-2.5 px-3">
                            {["NEW", "SHOPKEEPER_REVIEW", "NEEDS_CLARIFICATION"].includes(
                              selectedOrder.status
                            ) ? (
                              <input
                                type="text"
                                value={item.product_name_snapshot}
                                onChange={(e) =>
                                  handleUpdateItemPriceOrQty(
                                    idx,
                                    "product_name_snapshot",
                                    e.target.value
                                  )
                                }
                                className="w-full px-2 py-1 rounded border border-slate-300 text-xs"
                              />
                            ) : (
                              <span className="font-medium text-slate-800">
                                {item.product_name_snapshot}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            {["NEW", "SHOPKEEPER_REVIEW", "NEEDS_CLARIFICATION"].includes(
                              selectedOrder.status
                            ) ? (
                              <input
                                type="number"
                                step="any"
                                value={item.quantity}
                                onChange={(e) =>
                                  handleUpdateItemPriceOrQty(idx, "quantity", e.target.value)
                                }
                                className="w-full px-2 py-1 rounded border border-slate-300 text-xs font-mono"
                              />
                            ) : (
                              <span className="font-mono">{item.quantity}</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500">{item.unit}</td>
                          <td className="py-2.5 px-3">
                            {["NEW", "SHOPKEEPER_REVIEW", "NEEDS_CLARIFICATION"].includes(
                              selectedOrder.status
                            ) ? (
                              <input
                                type="number"
                                step="0.01"
                                value={item.unit_price}
                                onChange={(e) =>
                                  handleUpdateItemPriceOrQty(idx, "unit_price", e.target.value)
                                }
                                className="w-full px-2 py-1 rounded border border-slate-300 text-xs font-mono font-bold"
                              />
                            ) : (
                              <span className="font-mono">₹{item.unit_price}</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900 font-mono">
                            ₹{item.total_price}
                          </td>

                          {/* Packing Checkbox Toggle */}
                          {["CONFIRMED", "PACKING", "PARTIALLY_PACKED", "READY_FOR_PICKUP"].includes(
                            selectedOrder.status
                          ) && (
                            <td className="py-2.5 px-3 text-center">
                              <button
                                onClick={() =>
                                  handleTogglePacking(
                                    selectedOrder.id,
                                    item.id,
                                    item.packing_status
                                  )
                                }
                                className={`px-2 py-1 rounded text-[10px] font-bold transition flex items-center justify-center space-x-1 mx-auto ${
                                  item.packing_status === "PACKED"
                                    ? "bg-emerald-600 text-white"
                                    : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                                }`}
                              >
                                {item.packing_status === "PACKED" ? (
                                  <>
                                    <Check className="w-3 h-3" />
                                    <span>Packed</span>
                                  </>
                                ) : (
                                  <span>Unpacked</span>
                                )}
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Ready for Pickup QR Display if order is ready */}
              {selectedOrder.status === "READY_FOR_PICKUP" && selectedOrder.qr_tokens?.length > 0 && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-center">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-2">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-emerald-900 text-sm">
                    Order is 100% Packed and Ready for Pickup!
                  </h4>
                  <p className="text-xs text-emerald-700 mt-1 mb-3">
                    Pickup token has been generated and sent to customer on WhatsApp.
                  </p>
                  <div className="inline-block bg-white p-2 rounded-xl border border-emerald-200 shadow-sm">
                    <span className="font-mono font-bold text-xs text-slate-800">
                      Single-use Token Hash: {selectedOrder.qr_tokens[0]?.token_hash.slice(0, 16)}...
                    </span>
                  </div>
                </div>
              )}

              {/* PDF Invoice link */}
              {selectedOrder.invoices?.length > 0 && (
                <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="flex items-center space-x-2 text-xs">
                    <FileText className="w-4 h-4 text-slate-500" />
                    <span className="font-semibold text-slate-700">
                      Invoice #{selectedOrder.invoices[0]?.invoice_number}
                    </span>
                  </div>
                  <a
                    href={`http://localhost:8000${selectedOrder.invoices[0]?.pdf_url}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-emerald-600 font-bold hover:underline flex items-center space-x-1"
                  >
                    <span>Download PDF Invoice</span>
                    <ArrowRight className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">
                  Total Bill
                </span>
                <span className="text-xl font-bold text-slate-900">
                  ₹{selectedOrder.grand_total}
                </span>
              </div>

              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-semibold transition"
                >
                  Close
                </button>

                {["NEW", "SHOPKEEPER_REVIEW", "NEEDS_CLARIFICATION"].includes(
                  selectedOrder.status
                ) && (
                  <button
                    onClick={handleSaveReviewAndSend}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5"
                  >
                    <Send className="w-4 h-4" />
                    <span>Send Bill to Customer</span>
                  </button>
                )}

                {selectedOrder.status !== "READY_FOR_PICKUP" && selectedOrder.status !== "COLLECTED" && (
                  <button
                    onClick={() => handleMarkOrderPacked(selectedOrder.id)}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition flex items-center space-x-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Mark as Packed (पैक हो गया)</span>
                  </button>
                )}

                {selectedOrder.status === "READY_FOR_PICKUP" && (
                  <button
                    onClick={() => handleSendOrderReminder(selectedOrder.id)}
                    className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-500/20 transition flex items-center space-x-1.5"
                  >
                    <Bell className="w-4 h-4" />
                    <span>Send Reminder ({selectedOrder.pickup_reminders_count || 1}/4 Sent)</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Mobile Bottom Navigation Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 flex items-center justify-around py-1.5 px-2 shadow-lg">
        <button
          onClick={() => setActiveTab("orders")}
          className={`flex flex-col items-center py-1 px-3 rounded-lg text-[10px] transition ${
            activeTab === "orders" ? "text-emerald-700 font-bold" : "text-slate-500"
          }`}
        >
          <ShoppingBag className="w-5 h-5 mb-0.5" />
          <span>Orders</span>
        </button>

        <button
          onClick={() => setActiveTab("lists")}
          className={`flex flex-col items-center py-1 px-3 rounded-lg text-[10px] transition ${
            activeTab === "lists" ? "text-emerald-700 font-bold" : "text-slate-500"
          }`}
        >
          <FileText className="w-5 h-5 mb-0.5" />
          <span>ग्राहक लिस्ट</span>
        </button>

        <button
          onClick={() => setActiveTab("pairing")}
          className={`flex flex-col items-center py-1 px-3 rounded-xl text-[10px] font-bold transition ${
            activeTab === "pairing"
              ? "bg-emerald-600 text-white shadow-sm"
              : "text-emerald-700 bg-emerald-50 border border-emerald-300"
          }`}
        >
          <Smartphone className="w-5 h-5 mb-0.5" />
          <span>Link Phone</span>
        </button>

        <button
          onClick={() => setMobileMenuOpen(true)}
          className="flex flex-col items-center py-1 px-3 rounded-lg text-[10px] font-medium text-slate-500"
        >
          <Menu className="w-5 h-5 mb-0.5" />
          <span>Menu</span>
        </button>
      </div>
    </div>
  );
}
