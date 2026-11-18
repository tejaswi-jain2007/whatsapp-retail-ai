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
} from "lucide-react";
import { api } from "@/lib/api";

type Tab = "orders" | "products" | "qr_verify" | "analytics" | "simulate";

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<Tab>("orders");
  const [store, setStore] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

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
  const [activeChatOrder, setActiveChatOrder] = useState<any>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);

  // Initialize and auto-login
  useEffect(() => {
    initApp();
  }, []);

  const initApp = async () => {
    setLoading(true);
    try {
      // Auto-login with default demo credentials if needed
      let token = localStorage.getItem("token");
      if (!token) {
        const loginRes = await api.login("ramesh@guptastores.com", "kirana123");
        if (loginRes.access_token) {
          localStorage.setItem("token", loginRes.access_token);
        }
      }

      // Fetch store
      const stores = await api.getStores();
      if (stores && stores.length > 0) {
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
      setOrders(Array.isArray(ordersData) ? ordersData : []);
      setProducts(Array.isArray(productsData) ? productsData : []);
      setAnalytics(analyticsData);
    } catch (e) {
      console.error("Error loading store data:", e);
    }
  };

  const refreshCurrentData = () => {
    if (store) loadStoreData(store.id);
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
    if (!store || !activeChatOrder) return;
    try {
      await api.simulateWhatsApp({
        store_id: store.id,
        phone_number_id: store.whatsapp_phone_number_id,
        sender_phone: activeChatOrder.customer?.phone || simPhone,
        sender_name: activeChatOrder.customer?.name || simName,
        message_text: action === "CONFIRM" ? "✅ Confirm Order" : "❌ Cancel Order",
      });
      await loadStoreData(store.id);
      await loadChatForOrder(orderId);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendSimulatedMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!store) return;
    try {
      const res = await api.simulateWhatsApp({
        store_id: store.id,
        phone_number_id: store.whatsapp_phone_number_id,
        sender_phone: simPhone,
        sender_name: simName,
        message_text: simText,
      });
      setSimSuccess("Message received & parsed by AI! New order created in dashboard.");
      setTimeout(() => setSimSuccess(null), 4000);
      await loadStoreData(store.id);
      // Auto-select latest order for chat view
      const updatedOrders = await api.getOrders(store.id);
      if (updatedOrders && updatedOrders.length > 0) {
        setActiveChatOrder(updatedOrders[0]);
        await loadChatForOrder(updatedOrders[0].id);
      }
    } catch (err) {
      console.error(err);
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
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-200 flex flex-col justify-between shrink-0">
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

          {/* Store Info */}
          {store && (
            <div className="p-4 mx-3 my-3 bg-slate-800/60 rounded-xl border border-slate-700/60">
              <div className="flex items-center space-x-2 text-xs text-emerald-400 font-medium mb-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>WhatsApp Connected</span>
              </div>
              <p className="text-sm font-semibold text-white truncate">{store.store_name}</p>
              <p className="text-xs text-slate-400 truncate">{store.address}</p>
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
              onClick={() => setActiveTab("simulate")}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition mt-4 ${
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
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <h2 className="text-xl font-bold text-slate-800 capitalize">
              {activeTab === "orders" && "Live Orders"}
              {activeTab === "products" && "Product Catalogue & Pricing"}
              {activeTab === "qr_verify" && "QR Pickup Verification"}
              {activeTab === "analytics" && "Store Performance Analytics"}
              {activeTab === "simulate" && "WhatsApp Customer Simulator"}
            </h2>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-xs bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>FastAPI Backend Live</span>
            </div>
          </div>
        </header>

        {/* Tab Content */}
        <div className="p-6 flex-1">
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
                              ({order.customer?.phone})
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
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1 transition shadow-sm"
                              >
                                <Package className="w-3.5 h-3.5" />
                                <span>Pack Items</span>
                              </button>
                            )}

                            {order.status === "READY_FOR_PICKUP" && (
                              <button
                                onClick={() => handleOpenReview(order)}
                                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold flex items-center space-x-1 transition"
                              >
                                <QrCode className="w-3.5 h-3.5" />
                                <span>Pickup QR</span>
                              </button>
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

          {/* TAB 2: PRODUCTS */}
          {activeTab === "products" && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="p-5 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-800">Store Catalogue & Dynamic Pricing</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Prices configured here are used by AI to automatically calculate customer orders.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Product Name</th>
                      <th className="py-3 px-4">Brand / Variant</th>
                      <th className="py-3 px-4">Aliases (AI Synonyms)</th>
                      <th className="py-3 px-4">Unit</th>
                      <th className="py-3 px-4">Current Price</th>
                      <th className="py-3 px-4">Stock</th>
                      <th className="py-3 px-4">Availability</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {products.map((prod) => (
                      <tr key={prod.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3.5 px-4 font-semibold text-slate-900">{prod.name}</td>
                        <td className="py-3.5 px-4">
                          <span className="text-slate-600">{prod.brand || "—"}</span>
                          {prod.variant && (
                            <span className="text-slate-400 block text-[11px]">{prod.variant}</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex flex-wrap gap-1">
                            {prod.aliases?.map((a: string, i: number) => (
                              <span
                                key={i}
                                className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px]"
                              >
                                {a}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">{prod.unit}</td>
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          ₹{parseFloat(prod.current_price).toFixed(2)}
                        </td>
                        <td className="py-3.5 px-4 font-mono">{parseFloat(prod.stock_quantity)}</td>
                        <td className="py-3.5 px-4">
                          {prod.availability ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                              In Stock
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-800">
                              Out of Stock
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
                    Enter Pickup Code or Scan Token:
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. PKUP-ORD-261118-1234-..."
                    value={qrTokenInput}
                    onChange={(e) => setQrTokenInput(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <button
                  onClick={handleVerifyQr}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-md shadow-emerald-600/20 transition flex items-center justify-center space-x-2"
                >
                  <Check className="w-5 h-5" />
                  <span>Verify and Mark Collected</span>
                </button>
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
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md shadow-emerald-600/20 transition flex items-center justify-center space-x-2"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Send Customer Message</span>
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
              <div className="lg:col-span-6 flex justify-center">
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
                    Customer: {selectedOrder.customer?.name} ({selectedOrder.customer?.phone})
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
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition flex items-center space-x-2"
                  >
                    <Send className="w-4 h-4" />
                    <span>Send Order Summary to Customer</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
