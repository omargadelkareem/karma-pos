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
import Charging from "./pages/Charging";
import Expenses from "./pages/Expenses";
import Treasury from "./pages/Treasury";
import Reports from "./pages/Reports";
import Taxes from "./pages/Taxes";
import BarcodePrint from "./pages/BarcodePrint";
import Employees from "./pages/Employees";

import TopNav from "./components/TopNav";
import PrintableReceipt from "./components/PrintableReceipt";
import Offers from "./pages/offers";
import CreditSales from "./pages/CreditSales";
import Units from "./pages/Units";
import Categories from "./pages/Categories";
import Warehouses from "./pages/wareHouses";
import Inventory from "./pages/Inventory";
import SalesReturns from "./pages/SalesReturns";
import ExpiryReports from "./pages/ExpiryReports";
import ExpiryAlerts from "./components/ExpiryAlerts";
import InventoryAudit from "./pages/InventoryAudit";
import Projects from "./pages/Projects";
import FixedAssets from "./pages/FixedAssets";
import CRM from "./pages/CRM";
import { ComplianceProvider } from "./pages/ComplianceContext";
import QualityCompliance from "./pages/QualityCompliance";
import Policies from "./pages/Policies";
import Documents from "./pages/Documents";
import { DocumentsProvider } from "./context/DocumentsContext";
import ActivityLog from "./pages/ActivityLog";

function getAllowedPages(role) {
  switch (role) {
    case "owner":
      return "ALL";
    case "cashier":
      return ["dashboard", "pos", "sales", "charging", "expenses", "treasury"];
    case "storekeeper":
      return ["dashboard", "products", "suppliers", "purchaseInvoices", "barcodePrint"];
    case "accountant":
      return ["dashboard", "sales", "customers", "suppliers", "purchaseInvoices", "expenses", "treasury", "taxes", "reports"];
    default:
      return ["dashboard", "pos"];
  }
}

export default function App() {
  const authValue = useContext(AuthContext);
  const [activePage, setActivePage] = useState("dashboard");

  if (!authValue) {
    return <div style={{ padding: 20 }}>AuthProvider غير موجود</div>;
  }

  const { user, bootLoading, logout } = authValue;

  const allowedPages = useMemo(() => {
    const res = getAllowedPages(user?.role || "cashier");
    return res;
  }, [user?.role]);

  useEffect(() => {
    if (!user) return;
    if (allowedPages === "ALL") return;

    if (!allowedPages.includes(activePage)) {
      setActivePage(allowedPages[0] || "dashboard");
    }
  }, [user, allowedPages, activePage]);

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

    <DocumentsProvider>
    <ComplianceProvider>

    <PosProvider>
      <div className="min-h-screen bg-slate-100 text-slate-900">
        <PrintableReceipt />

        <ExpiryAlerts />

        <TopNav
          active={activePage}
          onChange={setActivePage}
          userLabel={user.name || user.phone}
          userRole={user.role || "cashier"}
          onLogout={logout}
        />

        <main className="mx-auto max-w-[1800px] p-4">
          {activePage === "dashboard" && <Dashboard />}

          {activePage === "pos" && <POS />}
          {activePage === "sales" && <Sales />}
          {activePage === "charging" && <Charging />}

          {activePage === "products" && <Products />}
          {activePage === "barcodePrint" && <BarcodePrint />}

          {activePage === "customers" && <Customers />}
          {activePage === "suppliers" && <Suppliers />}

          {activePage === "purchaseInvoices" && <PurchaseInvoices />}
          {activePage === "walletTransfers" && <WalletTransfers />}

          {activePage === "expenses" && <Expenses />}
          {activePage === "treasury" && <Treasury />}

          {activePage === "reports" && <Reports />}
          {activePage === "taxes" && <Taxes />}

          {activePage === "employees" && <Employees />}
          {activePage === "projects"  && <Projects />}
          {activePage === "fixedAssets" && <FixedAssets />}
          {activePage === "crm" && <CRM /> }
          []

          {activePage === "settings" && <Settings />}

          {/* صفحات قريباً */}
          {activePage === "offers" && <Offers />}
          {activePage === "creditSales" && <CreditSales />}
          {activePage === "productCategories" && <Categories />}
          {activePage === "uom" && <Units />}
          {activePage === "inventory" && <Inventory />}
          {activePage === "threatenedStock" && <Warehouses />}
          {activePage === "returns" && <SalesReturns />}
          {activePage === "expiryReports" && <ExpiryReports />}
          {activePage === "stockAudit" && <InventoryAudit />}
       
        {activePage === "activityLog" && <ActivityLog />}
        
          {activePage === "quality" && <QualityCompliance />}
          {activePage === "policies" && <Policies />}
          {activePage === "docs" && <Documents />}
          {activePage === "roles" && <div className="p-6">صلاحيات المستخدمين - قريباً</div>}
          {activePage === "activityLog" && <div className="p-6">سجل النشاط - قريباً</div>}
        </main>
      </div>
    </PosProvider>
    </ComplianceProvider>
    </DocumentsProvider>
  );
}