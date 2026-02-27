import React, { useContext, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { AuthContext } from "./context/AuthContext";
import { PosProvider } from "./context/PosContext";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import POS from "./pages/POS";
import Sales from "./pages/Sales";
import Settings from "./pages/Settings";
import Customers from "./pages/Customers";
import Suppliers from "./pages/Suppliers";
import PurchaseInvoices from "./pages/PurchaseInvoices";
import WalletTransfers from "./pages/WalletTransfers";

import Sidebar from "./components/Sidebar";
import PrintableReceipt from "./components/PrintableReceipt";

function getAllowedPages(role) {
  switch (role) {
    case "owner":
      return [
        "dashboard",
        "products",
        "pos",
        "sales",
        "customers",
        "suppliers",
        "purchaseInvoices",
        "walletTransfers",
        "settings",
      ];
    case "cashier":
      return ["pos", "sales"];
    case "storekeeper":
      return ["dashboard", "products", "suppliers", "purchaseInvoices"];
    case "accountant":
      return ["dashboard", "sales", "customers", "walletTransfers"];
    default:
      return ["pos"];
  }
}

export default function App() {
  const authValue = useContext(AuthContext);
  const [activePage, setActivePage] = useState("dashboard");

  if (!authValue) {
    return <div style={{ padding: 20 }}>AuthProvider غير موجود</div>;
  }

  const { user, bootLoading, logout } = authValue;

  const allowedPages = useMemo(
    () => getAllowedPages(user?.role || "cashier"),
    [user?.role]
  );

  useEffect(() => {
    if (!allowedPages.includes(activePage)) {
      setActivePage(allowedPages[0]);
    }
  }, [activePage, allowedPages]);

  if (bootLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="inline-flex items-center gap-3 rounded-3xl bg-white px-6 py-4 shadow-sm ring-1 ring-slate-200">
          <RefreshCw className="h-5 w-5 animate-spin" />
          <span className="font-medium text-slate-700">جاري التحميل...</span>
        </div>
      </div>
    );
  }

  if (!user) return <Login />;

  return (
    <PosProvider>
      <div className="min-h-screen bg-slate-100 text-slate-900">
        <PrintableReceipt />

        <div className="mx-auto max-w-[1800px] p-4 xl:grid xl:grid-cols-[260px_minmax(0,1fr)] xl:gap-4">
          <Sidebar
            active={activePage}
            onChange={setActivePage}
            userLabel={user.name || user.phone}
            userRole={user.role || "cashier"}
            onLogout={logout}
          />

          <main className="mt-4 xl:mt-0">
            {activePage === "dashboard" && <Dashboard />}
            {activePage === "products" && <Products />}
            {activePage === "pos" && <POS />}
            {activePage === "sales" && <Sales />}
            {activePage === "customers" && <Customers />}
            {activePage === "suppliers" && <Suppliers />}
            {activePage === "purchaseInvoices" && <PurchaseInvoices />}
            {activePage === "walletTransfers" && <WalletTransfers />}
            {activePage === "settings" && <Settings />}
          </main>
        </div>
      </div>
    </PosProvider>
  );
}