import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { onValue, push, ref, remove, set, update } from "firebase/database";
import { db } from "../firebase/db";
import { AuthContext } from "./AuthContext";
import { todayKey } from "../utils/date";
import { downloadCsv } from "../utils/csv";

export const PosContext = createContext(null);

/* ==============================
   Initial Forms (Backward + New)
============================== */

// ✅ Products (يدعم القديم + الجديد)
const initialProductForm = {
  name: "",
  barcode: "",

  // القديم
  category: "",
  packageName: "",

  // الجديد (Master Data)
  categoryId: "",
  categoryName: "",
  baseUnitId: "",
  baseUnitName: "",
  packageUnitId: "",
  packageUnitName: "",

  itemsPerPackage: "",
  purchasePackagePrice: "",
  saleItemPrice: "",
  salePackagePrice: "",

  // كميات (للـ warehouse النشط)
  packageQty: "",
  itemQty: "",
  minPackageQty: "",

  expiryDate: "", // YYYY-MM-DD
};

// Categories / Units / Warehouses
const initialCategoryForm = { name: "", code: "", isActive: true };
const initialUnitForm = { name: "", short: "", type: "count", isActive: true };
const initialWarehouseForm = { name: "", location: "", isDefault: false, isActive: true };

// Customers / Suppliers
const initialCustomerForm = { name: "", phone: "", address: "", notes: "", openingBalance: "" };
const initialSupplierForm = { name: "", phone: "", address: "", notes: "" };

// Wallet
const initialWalletTransferForm = {
  personName: "",
  walletNumber: "",
  amount: "",
  transactionType: "send",
  isPaid: true,
  receiptNumber: "",
  notes: "",
};

// Expenses
const initialExpenseForm = { title: "", category: "", amount: "", notes: "", expenseDate: "" };

// Charging
const initialChargingForm = {
  serviceType: "mobile_recharge",
  company: "vodafone",
  targetNumber: "",
  amount: "",
  fee: "",
  referenceNumber: "",
  notes: "",
  status: "success",
};

// Offers
const initialOfferForm = {
  title: "",
  code: "",
  type: "percent", // percent | fixed | buy_x_get_y
  percent: "",
  fixedAmount: "",
  buyQty: "",
  getQty: "",
  scope: "all", // all | category | product
  categoryId: "",
  productId: "",
  applyOn: "items_only", // items_only | packages_only | both
  startDate: "",
  endDate: "",
  minCartTotal: "",
  maxDiscount: "",
  notes: "",
  isActive: true,
};

// Treasury
const initialTreasuryForm = {
  type: "income", // income | expense
  title: "",
  amount: "",
  paymentMethod: "cash", // cash | wallet | card | transfer | credit
  category: "",
  entryDate: "", // YYYY-MM-DD
  notes: "",
};

// Shipments
const initialShipmentForm = {
  customerName: "",
  phone: "",
  governorate: "",
  postOffice: "",
  trackingNumber: "",
  entryDate: "",
  status: "pending",
  shippingCompany: "egypt_post",
  notes: "",
  // optional product link
  productId: "",
  unitType: "item",
  qty: "1",
};

// Employees
const initialEmployeeForm = { name: "", phone: "", roleTitle: "", monthlySalary: "", isActive: true };

// Taxes
const initialTaxSettings = {
  registrationName: "كرمة ماركت",
  taxNumber: "",
  vatRegistrationNumber: "",
  vatSalesRate: 14,
  vatPurchaseRate: 14,
  stampDutyRate: 0,
  incomeTaxRate: 0,
  includeReturnsInVAT: true,
};

/* ==============================
   Helpers
============================== */
function toNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function getMonthKey(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function getServiceTypeLabel(type) {
  switch (type) {
    case "mobile_recharge":
      return "شحن رصيد";
    case "scratch_card":
      return "كارت شحن";
    case "landline":
      return "فاتورة أرضي";
    case "internet":
      return "فاتورة إنترنت";
    case "electricity":
      return "كهرباء";
    case "water":
      return "مياه";
    case "gas":
      return "غاز";
    default:
      return type || "خدمة";
  }
}

function getCompanyLabel(company) {
  switch (company) {
    case "vodafone":
      return "فودافون";
    case "orange":
      return "أورنج";
    case "etisalat":
      return "اتصالات";
    case "we":
      return "WE";
    default:
      return company || "شركة";
  }
}

/* ==============================
   Product normalize (with expiry)
============================== */
function normalizeProduct(product) {
  const itemsPerPackage = Math.max(1, toNumber(product.itemsPerPackage, 1));
  const purchasePackagePrice = Math.max(0, toNumber(product.purchasePackagePrice));
  const saleItemPrice = Math.max(0, toNumber(product.saleItemPrice));
  const salePackagePrice = Math.max(0, toNumber(product.salePackagePrice));
  const packageQty = Math.max(0, toNumber(product.packageQty));
  const itemQty = Math.max(0, toNumber(product.itemQty));
  const minPackageQty = Math.max(0, toNumber(product.minPackageQty));

  const purchaseItemPrice = itemsPerPackage > 0 ? purchasePackagePrice / itemsPerPackage : 0;
  const totalItems = packageQty * itemsPerPackage + itemQty;
  const minItems = minPackageQty * itemsPerPackage;
  const isLowStock = totalItems <= minItems && totalItems > 0;
  const stockValue = packageQty * purchasePackagePrice + itemQty * purchaseItemPrice;

  return {
    ...product,
    itemsPerPackage,
    purchasePackagePrice,
    purchaseItemPrice,
    saleItemPrice,
    salePackagePrice,
    packageQty,
    itemQty,
    minPackageQty,
    totalItems,
    minItems,
    isLowStock,
    stockValue,
    expiryDate: product.expiryDate || "",
    // Backward fields
    category: product.category || product.categoryName || "",
    packageName: product.packageName || product.packageUnitName || "",
  };
}

/* ==============================
   Inventory sale / return helpers
============================== */
function applySaleDeduction(product, inv, invoiceItems) {
  const itemsPerPackage = Math.max(1, toNumber(product.itemsPerPackage, 1));
  let packageQty = Math.max(0, toNumber(inv?.packageQty));
  let baseQty = Math.max(0, toNumber(inv?.baseQty));

  const sellPackageQty = invoiceItems
    .filter((i) => i.unitType === "package")
    .reduce((s, i) => s + toNumber(i.qty), 0);

  const sellBaseQty = invoiceItems
    .filter((i) => i.unitType === "item")
    .reduce((s, i) => s + toNumber(i.qty), 0);

  if (sellPackageQty > packageQty) throw new Error(`المخزون غير كافٍ (عبوات): ${product.name}`);
  packageQty -= sellPackageQty;

  if (sellBaseQty > baseQty) {
    const needed = sellBaseQty - baseQty;
    const packagesToOpen = Math.ceil(needed / itemsPerPackage);
    if (packagesToOpen > packageQty) throw new Error(`المخزون غير كافٍ (قطع): ${product.name}`);
    packageQty -= packagesToOpen;
    baseQty += packagesToOpen * itemsPerPackage;
  }
  baseQty -= sellBaseQty;

  return { packageQty, baseQty };
}

function applyReturn(inv, returnItems) {
  let packageQty = Math.max(0, toNumber(inv?.packageQty));
  let baseQty = Math.max(0, toNumber(inv?.baseQty));

  const returnedPackageQty = returnItems
    .filter((i) => i.unitType === "package")
    .reduce((s, i) => s + toNumber(i.qty), 0);

  const returnedBaseQty = returnItems
    .filter((i) => i.unitType === "item")
    .reduce((s, i) => s + toNumber(i.qty), 0);

  packageQty += returnedPackageQty;
  baseQty += returnedBaseQty;

  return { packageQty, baseQty };
}

/* ========================================================================
   Provider
======================================================================== */
export function PosProvider({ children }) {
  const auth = useContext(AuthContext);
  const user = auth?.user || null;
  const currentCashierId = user?.id || user?.uid || "";

  /* =============================
     Settings
  ============================= */
  const [settings, setSettings] = useState({
    storeName: "كرمة ماركت",
    currencyCode: "EGP",
  });

  /* =============================
     Taxes (Fix Taxes.jsx crash)
  ============================= */
  const [taxSettings, setTaxSettings] = useState(initialTaxSettings);
  const [savingTaxSettings, setSavingTaxSettings] = useState(false);

  const saveTaxSettings = async () => {
    setSavingTaxSettings(true);
    try {
      await set(ref(db, "settings/taxes"), {
        registrationName: String(taxSettings.registrationName || "").trim(),
        taxNumber: String(taxSettings.taxNumber || "").trim(),
        vatRegistrationNumber: String(taxSettings.vatRegistrationNumber || "").trim(),
        vatSalesRate: toNumber(taxSettings.vatSalesRate),
        vatPurchaseRate: toNumber(taxSettings.vatPurchaseRate),
        stampDutyRate: toNumber(taxSettings.stampDutyRate),
        incomeTaxRate: toNumber(taxSettings.incomeTaxRate),
        includeReturnsInVAT: !!taxSettings.includeReturnsInVAT,
      });
      window.alert("تم حفظ إعدادات الضرائب ✅");
    } catch (e) {
      window.alert(e?.message || "حدث خطأ أثناء حفظ إعدادات الضرائب");
    } finally {
      setSavingTaxSettings(false);
    }
  };

  /* =============================
     Master Data
  ============================= */
  const [categories, setCategories] = useState([]);
  const [units, setUnits] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [activeWarehouseId, setActiveWarehouseId] = useState("");

  /* =============================
     Inventory Map
     inventory/{warehouseId}/{productId} = { baseQty, packageQty }
  ============================= */
  const [inventoryMap, setInventoryMap] = useState({});
  const [stockMovements, setStockMovements] = useState([]);

  /* =============================
     Business Data (All lists must default [])
  ============================= */
  const [productsBase, setProductsBase] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [salesReturns, setSalesReturns] = useState([]);
  const [purchaseInvoices, setPurchaseInvoices] = useState([]);

  const [customers, setCustomers] = useState([]);
  const [customerPayments, setCustomerPayments] = useState([]);

  const [suppliers, setSuppliers] = useState([]);
  const [supplierPayments, setSupplierPayments] = useState([]);

  const [walletTransfers, setWalletTransfers] = useState([]);
  const [expenses, setExpenses] = useState([]);

  const [chargingOperations, setChargingOperations] = useState([]);
  const [treasuryTransactions, setTreasuryTransactions] = useState([]);
  const [offers, setOffers] = useState([]);
  const [shipments, setShipments] = useState([]);

  // employees
  const [employees, setEmployees] = useState([]);
  const [employeeTransactions, setEmployeeTransactions] = useState([]);

  // cash drawer
  const [cashSessions, setCashSessions] = useState([]);
  const [cashTransactions, setCashTransactions] = useState([]);

  // ✅ Activity Logs
  const [activityLogs, setActivityLogs] = useState([]);

  /* =============================
     Forms / UI
  ============================= */
  const [productForm, setProductForm] = useState(initialProductForm);
  const [editingProductId, setEditingProductId] = useState(null);

  const [categoryForm, setCategoryForm] = useState(initialCategoryForm);
  const [unitForm, setUnitForm] = useState(initialUnitForm);
  const [warehouseForm, setWarehouseForm] = useState(initialWarehouseForm);

  const [customerForm, setCustomerForm] = useState(initialCustomerForm);
  const [supplierForm, setSupplierForm] = useState(initialSupplierForm);

  const [walletTransferForm, setWalletTransferForm] = useState(initialWalletTransferForm);
  const [expenseForm, setExpenseForm] = useState(initialExpenseForm);

  const [chargingForm, setChargingForm] = useState(initialChargingForm);
  const [treasuryForm, setTreasuryForm] = useState(initialTreasuryForm);

  const [offerForm, setOfferForm] = useState(initialOfferForm);
  const [editingOfferId, setEditingOfferId] = useState(null);

  const [shipmentForm, setShipmentForm] = useState(initialShipmentForm);
  const [employeeForm, setEmployeeForm] = useState(initialEmployeeForm);

  // POS
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paidAmount, setPaidAmount] = useState("");

  // Loading flags
  const [savingProduct, setSavingProduct] = useState(false);
  const [savingCategory, setSavingCategory] = useState(false);
  const [savingUnit, setSavingUnit] = useState(false);
  const [savingWarehouse, setSavingWarehouse] = useState(false);

  const [savingCustomer, setSavingCustomer] = useState(false);
  const [savingSupplier, setSavingSupplier] = useState(false);
  const [savingWalletTransfer, setSavingWalletTransfer] = useState(false);
  const [savingExpense, setSavingExpense] = useState(false);
  const [savingCharging, setSavingCharging] = useState(false);
  const [savingTreasury, setSavingTreasury] = useState(false);
  const [savingOffer, setSavingOffer] = useState(false);
  const [savingShipment, setSavingShipment] = useState(false);

  const [savingEmployee, setSavingEmployee] = useState(false);
  const [savingEmployeeTx, setSavingEmployeeTx] = useState(false);

  const [checkoutLoading, setCheckoutLoading] = useState(false);

  // Print
  const [receiptData, setReceiptData] = useState(null);
  const [invoiceResetTick, setInvoiceResetTick] = useState(0);

  /* =============================
     Purchase Invoice (existing pages rely on these)
  ============================= */
  const [purchaseInvoiceForm, setPurchaseInvoiceForm] = useState({
    supplierId: "",
    paidAmount: "",
    notes: "",
  });
  const [purchaseCart, setPurchaseCart] = useState([]);
  const [savingPurchaseInvoice, setSavingPurchaseInvoice] = useState(false);

  /* =============================
     ✅ Activity Logger (Global)
  ============================= */
  const logActivity = async ({
    type,
    title,
    entityType = "",
    entityId = "",
    entityLabel = "",
    action = "",
    meta = {},
  }) => {
    try {
      const createdAt = Date.now();
      const dateKey = new Date(createdAt).toISOString().slice(0, 10);
      const monthKey = dateKey.slice(0, 7);

      const refNew = push(ref(db, "activityLogs"));
      await set(refNew, {
        type: String(type || "").trim(),
        title: String(title || "").trim(),
        entityType: String(entityType || "").trim(),
        entityId: String(entityId || "").trim(),
        entityLabel: String(entityLabel || "").trim(),
        action: String(action || "").trim(),
        meta: meta || {},
        createdAt,
        dateKey,
        monthKey,
        userId: user?.id || user?.uid || "",
        userName: user?.name || user?.phone || "",
        userRole: user?.role || "",
      });
    } catch (e) {
      console.warn("logActivity failed", e);
    }
  };

  /* ======================================================================
     Realtime Listeners (All nodes) ✅ بدون أي return مبكر
  ====================================================================== */
  useEffect(() => {
    if (!user) return;

    const unsubActivity = onValue(ref(db, "activityLogs"), (snap) => {
      const data = snap.val() || {};
      const parsed = Object.entries(data)
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setActivityLogs(parsed);
    });

    const unsubSettings = onValue(ref(db, "settings/general"), (snap) => {
      const data = snap.val();
      if (data) setSettings((p) => ({ ...p, ...data }));
    });

    const unsubTaxes = onValue(ref(db, "settings/taxes"), (snap) => {
      const data = snap.val();
      if (data) {
        setTaxSettings((prev) => ({
          ...prev,
          ...data,
          vatSalesRate: Number(data.vatSalesRate ?? prev.vatSalesRate),
          vatPurchaseRate: Number(data.vatPurchaseRate ?? prev.vatPurchaseRate),
          stampDutyRate: Number(data.stampDutyRate ?? prev.stampDutyRate),
          incomeTaxRate: Number(data.incomeTaxRate ?? prev.incomeTaxRate),
          includeReturnsInVAT: !!data.includeReturnsInVAT,
        }));
      }
    });

    const unsubCategories = onValue(ref(db, "categories"), (snap) => {
      const data = snap.val() || {};
      const parsed = Object.entries(data)
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ar"));
      setCategories(parsed);
    });

    const unsubUnits = onValue(ref(db, "units"), (snap) => {
      const data = snap.val() || {};
      const parsed = Object.entries(data)
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ar"));
      setUnits(parsed);
    });

    const unsubWarehouses = onValue(ref(db, "warehouses"), (snap) => {
      const data = snap.val() || {};
      const parsed = Object.entries(data).map(([id, v]) => ({ id, ...v }));
      parsed.sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0));
      setWarehouses(parsed);
    });

    const unsubInventory = onValue(ref(db, "inventory"), (snap) => {
      setInventoryMap(snap.val() || {});
    });

    const unsubStockMovements = onValue(ref(db, "stockMovements"), (snap) => {
      const data = snap.val() || {};
      const parsed = Object.entries(data)
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setStockMovements(parsed);
    });

    const unsubProducts = onValue(ref(db, "products"), (snap) => {
      const data = snap.val() || {};
      const parsed = Object.entries(data)
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ar"));
      setProductsBase(parsed);
    });

    const unsubInvoices = onValue(ref(db, "invoices"), (snap) => {
      const data = snap.val() || {};
      const parsed = Object.entries(data)
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setInvoices(parsed);
    });

    const unsubSalesReturns = onValue(ref(db, "salesReturns"), (snap) => {
      const data = snap.val() || {};
      const parsed = Object.entries(data)
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setSalesReturns(parsed);
    });

    const unsubPurchaseInvoices = onValue(ref(db, "purchaseInvoices"), (snap) => {
      const data = snap.val() || {};
      const parsed = Object.entries(data)
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setPurchaseInvoices(parsed);
    });

    const unsubCustomers = onValue(ref(db, "customers"), (snap) => {
      const data = snap.val() || {};
      const parsed = Object.entries(data)
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ar"));
      setCustomers(parsed);
    });

    const unsubCustomerPayments = onValue(ref(db, "customerPayments"), (snap) => {
      const data = snap.val() || {};
      const parsed = Object.entries(data)
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setCustomerPayments(parsed);
    });

    const unsubSuppliers = onValue(ref(db, "suppliers"), (snap) => {
      const data = snap.val() || {};
      const parsed = Object.entries(data)
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ar"));
      setSuppliers(parsed);
    });

    const unsubSupplierPayments = onValue(ref(db, "supplierPayments"), (snap) => {
      const data = snap.val() || {};
      const parsed = Object.entries(data)
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setSupplierPayments(parsed);
    });

    const unsubWalletTransfers = onValue(ref(db, "walletTransfers"), (snap) => {
      const data = snap.val() || {};
      const parsed = Object.entries(data)
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setWalletTransfers(parsed);
    });

    const unsubExpenses = onValue(ref(db, "expenses"), (snap) => {
      const data = snap.val() || {};
      const parsed = Object.entries(data)
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setExpenses(parsed);
    });

    const unsubCharging = onValue(ref(db, "chargingOperations"), (snap) => {
      const data = snap.val() || {};
      const parsed = Object.entries(data)
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setChargingOperations(parsed);
    });

    const unsubTreasury = onValue(ref(db, "treasuryTransactions"), (snap) => {
      const data = snap.val() || {};
      const parsed = Object.entries(data)
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setTreasuryTransactions(parsed);
    });

    const unsubOffers = onValue(ref(db, "offers"), (snap) => {
      const data = snap.val() || {};
      const parsed = Object.entries(data)
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setOffers(parsed);
    });

    const unsubShipments = onValue(ref(db, "shipments"), (snap) => {
      const data = snap.val() || {};
      const parsed = Object.entries(data)
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setShipments(parsed);
    });

    const unsubEmployees = onValue(ref(db, "employees"), (snap) => {
      const data = snap.val() || {};
      const parsed = Object.entries(data)
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ar"));
      setEmployees(parsed);
    });

    const unsubEmployeeTx = onValue(ref(db, "employeeTransactions"), (snap) => {
      const data = snap.val() || {};
      const parsed = Object.entries(data)
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setEmployeeTransactions(parsed);
    });

    const unsubCashSessions = onValue(ref(db, "cashSessions"), (snap) => {
      const data = snap.val() || {};
      const parsed = Object.entries(data)
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => (b.openedAt || 0) - (a.openedAt || 0));
      setCashSessions(parsed);
    });

    const unsubCashTransactions = onValue(ref(db, "cashTransactions"), (snap) => {
      const data = snap.val() || {};
      const parsed = Object.entries(data)
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setCashTransactions(parsed);
    });

    return () => {
      unsubActivity();
      unsubSettings();
      unsubTaxes();
      unsubCategories();
      unsubUnits();
      unsubWarehouses();
      unsubInventory();
      unsubStockMovements();
      unsubProducts();
      unsubInvoices();
      unsubSalesReturns();
      unsubPurchaseInvoices();
      unsubCustomers();
      unsubCustomerPayments();
      unsubSuppliers();
      unsubSupplierPayments();
      unsubWalletTransfers();
      unsubExpenses();
      unsubCharging();
      unsubTreasury();
      unsubOffers();
      unsubShipments();
      unsubEmployees();
      unsubEmployeeTx();
      unsubCashSessions();
      unsubCashTransactions();
    };
  }, [user]);

  /* =============================
     Ensure default warehouse exists
  ============================= */
  const defaultWarehouse = useMemo(() => {
    return warehouses.find((w) => w.isDefault) || warehouses[0] || null;
  }, [warehouses]);

  const createdDefaultWarehouseRef = useRef(false);
  useEffect(() => {
    if (!user) return;
    if (warehouses.length > 0) return;
    if (createdDefaultWarehouseRef.current) return;

    createdDefaultWarehouseRef.current = true;
    (async () => {
      const newRef = push(ref(db, "warehouses"));
      await set(newRef, {
        name: "المخزن الرئيسي",
        location: "",
        isDefault: true,
        isActive: true,
        createdAt: Date.now(),
        createdBy: user?.name || "",
      });
    })().catch(() => {
      createdDefaultWarehouseRef.current = false;
    });
  }, [user, warehouses.length]);

  useEffect(() => {
    if (!defaultWarehouse) return;
    if (!activeWarehouseId) setActiveWarehouseId(defaultWarehouse.id);
  }, [defaultWarehouse, activeWarehouseId]);

  /* =============================
     Inventory helpers
  ============================= */
  const getInventoryEntry = (warehouseId, productId) => {
    if (!warehouseId || !productId) return null;
    return inventoryMap?.[warehouseId]?.[productId] || null;
  };

  const writeInventoryEntry = async (warehouseId, productId, next) => {
    if (!warehouseId || !productId) return;
    await set(ref(db, `inventory/${warehouseId}/${productId}`), {
      baseQty: toNumber(next.baseQty),
      packageQty: toNumber(next.packageQty),
      updatedAt: Date.now(),
      updatedBy: user?.name || "",
    });
  };

  const addStockMovement = async (payload) => {
    const mvRef = push(ref(db, "stockMovements"));
    await set(mvRef, { ...payload, createdAt: Date.now(), createdBy: user?.name || "" });
    return mvRef.key;
  };

  /* =============================
     Merge Products + inventory for active warehouse
  ============================= */
  const products = useMemo(() => {
    const whId = activeWarehouseId || defaultWarehouse?.id || "";
    const invForWh = whId ? inventoryMap?.[whId] || {} : {};

    return (productsBase || []).map((p) => {
      const inv = invForWh?.[p.id];

      const merged = {
        ...p,
        packageQty: inv ? toNumber(inv.packageQty) : toNumber(p.packageQty),
        itemQty: inv ? toNumber(inv.baseQty) : toNumber(p.itemQty),

        // Backward fields
        category: p.category || p.categoryName || "",
        packageName: p.packageName || p.packageUnitName || "",
      };

      return normalizeProduct(merged);
    });
  }, [productsBase, inventoryMap, activeWarehouseId, defaultWarehouse]);

  const filteredProducts = useMemo(() => {
    const q = String(search || "").trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => {
      const txt = `${p.name || ""} ${p.barcode || ""} ${p.category || ""} ${p.categoryName || ""}`.toLowerCase();
      return txt.includes(q);
    });
  }, [products, search]);

  /* =============================
     Stats
  ============================= */
  const inventoryValue = useMemo(() => (products || []).reduce((s, p) => s + toNumber(p.stockValue), 0), [products]);
  const lowStockProducts = useMemo(() => (products || []).filter((p) => p.isLowStock), [products]);

  const todayInvoices = useMemo(() => (invoices || []).filter((i) => i.dateKey === todayKey()), [invoices]);
  const todaySales = useMemo(() => (todayInvoices || []).reduce((s, i) => s + toNumber(i.total), 0), [todayInvoices]);

  const totalSalesReturns = useMemo(() => (salesReturns || []).reduce((s, r) => s + toNumber(r.total), 0), [salesReturns]);
  const todaySalesReturns = useMemo(() => {
    return (salesReturns || [])
      .filter((r) => {
        const d = r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 10) : "";
        return d === todayKey();
      })
      .reduce((s, r) => s + toNumber(r.total), 0);
  }, [salesReturns]);

  const netTodaySales = useMemo(() => todaySales - todaySalesReturns, [todaySales, todaySalesReturns]);

  /* =============================
     Customer Balances / Ledgers
  ============================= */
  const customerBalances = useMemo(() => {
    const map = {};
    (customers || []).forEach((c) => {
      map[c.id] = Math.max(0, toNumber(c.openingBalance));
    });

    (invoices || []).forEach((inv) => {
      if (inv.customerId) {
        map[inv.customerId] = (map[inv.customerId] || 0) + toNumber(inv.remainingAmount);
      }
    });

    (customerPayments || []).forEach((pay) => {
      if (pay.customerId) {
        map[pay.customerId] = (map[pay.customerId] || 0) - toNumber(pay.amount);
      }
    });

    return map;
  }, [customers, invoices, customerPayments]);

  const getCustomerLedger = (customerId) => {
    const customer = (customers || []).find((c) => c.id === customerId);

    const openingEntries =
      customer && toNumber(customer.openingBalance) > 0
        ? [
            {
              id: `opening-${customerId}`,
              type: "opening_balance",
              label: "مديونية سابقة قبل تشغيل السيستم",
              debit: toNumber(customer.openingBalance),
              credit: 0,
              amount: toNumber(customer.openingBalance),
              notes: "رصيد افتتاحي للعميل",
              createdAt: customer.createdAt || Date.now(),
            },
          ]
        : [];

    const salesEntries = (invoices || [])
      .filter((inv) => inv.customerId === customerId)
      .map((inv) => ({
        id: inv.id,
        type: "sale_invoice",
        label: `فاتورة بيع - ${inv.invoiceNumber}`,
        debit: toNumber(inv.remainingAmount),
        credit: 0,
        totalInvoice: toNumber(inv.total),
        paidAmount: toNumber(inv.paidAmount),
        remainingAmount: toNumber(inv.remainingAmount),
        paymentMethod: inv.paymentMethod || "",
        items: inv.items || [],
        invoiceNumber: inv.invoiceNumber || "",
        createdAt: inv.createdAt,
      }));

    const paymentEntries = (customerPayments || [])
      .filter((p) => p.customerId === customerId)
      .map((p) => ({
        id: p.id,
        type: "payment",
        label: "سداد عميل",
        debit: 0,
        credit: toNumber(p.amount),
        amount: toNumber(p.amount),
        notes: p.notes || "",
        createdAt: p.createdAt,
        receiptNumber: p.receiptNumber || "",
      }));

    return [...openingEntries, ...salesEntries, ...paymentEntries].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  };

  /* =============================
     Supplier Balances / Ledgers
  ============================= */
  const supplierBalances = useMemo(() => {
    const map = {};
    (suppliers || []).forEach((s) => (map[s.id] = 0));

    (purchaseInvoices || []).forEach((inv) => {
      if (inv.supplierId) map[inv.supplierId] = (map[inv.supplierId] || 0) + toNumber(inv.remainingAmount);
    });

    (supplierPayments || []).forEach((pay) => {
      if (pay.supplierId) map[pay.supplierId] = (map[pay.supplierId] || 0) - toNumber(pay.amount);
    });

    return map;
  }, [suppliers, purchaseInvoices, supplierPayments]);

  const getSupplierLedger = (supplierId) => {
    const invoiceEntries = (purchaseInvoices || [])
      .filter((inv) => inv.supplierId === supplierId)
      .map((inv) => ({
        id: inv.id,
        type: "purchase_invoice",
        label: `فاتورة شراء - ${inv.invoiceNumber}`,
        debit: toNumber(inv.remainingAmount),
        credit: 0,
        createdAt: inv.createdAt,
      }));

    const paymentEntries = (supplierPayments || [])
      .filter((p) => p.supplierId === supplierId)
      .map((p) => ({
        id: p.id,
        type: "payment",
        label: "سداد للمورد",
        debit: 0,
        credit: toNumber(p.amount),
        createdAt: p.createdAt,
      }));

    return [...invoiceEntries, ...paymentEntries].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  };

  /* =============================
     Credit Sales stats + installment
  ============================= */
  const creditInvoices = useMemo(() => {
    return (invoices || []).filter((inv) => toNumber(inv.remainingAmount) > 0);
  }, [invoices]);

  const creditStats = useMemo(() => {
    const totalCreditSales = (creditInvoices || []).reduce((s, inv) => s + toNumber(inv.total), 0);
    const totalOutstanding = (creditInvoices || []).reduce((s, inv) => s + toNumber(inv.remainingAmount), 0);
    const totalCollected = (creditInvoices || []).reduce((s, inv) => s + toNumber(inv.paidAmount), 0);

    const customersSet = new Set();
    (creditInvoices || []).forEach((inv) => {
      if (inv.customerId) customersSet.add(inv.customerId);
    });

    return { totalCreditSales, totalOutstanding, totalCollected, creditCustomersCount: customersSet.size };
  }, [creditInvoices]);

  const payCreditInstallment = async (invoiceId, amount, notes = "") => {
    const amt = toNumber(amount);
    if (!invoiceId) return window.alert("فاتورة غير صحيحة");
    if (amt <= 0) return window.alert("أدخل مبلغ صحيح");

    const inv = (invoices || []).find((x) => x.id === invoiceId);
    if (!inv) return window.alert("الفاتورة غير موجودة");

    const remaining = toNumber(inv.remainingAmount);
    if (remaining <= 0) return window.alert("هذه الفاتورة مسددة بالفعل");
    if (amt > remaining) return window.alert("المبلغ أكبر من المتبقي");

    try {
      const createdAt = Date.now();

      const payRef = push(ref(db, "customerPayments"));
      await set(payRef, {
        customerId: inv.customerId || "",
        customerName: inv.customerName || "",
        amount: amt,
        notes: String(notes || "").trim() || `سداد دفعة لفاتورة ${inv.invoiceNumber}`,
        createdAt,
        createdBy: user?.name || "",
        receiptNumber: `CP-${createdAt}`,
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        type: "credit_installment",
      });

      const newPaid = toNumber(inv.paidAmount) + amt;
      const newRemaining = Math.max(0, remaining - amt);

      await update(ref(db, `invoices/${invoiceId}`), {
        paidAmount: newPaid,
        remainingAmount: newRemaining,
        paymentStatus: newRemaining === 0 ? "paid" : "partial",
        updatedAt: createdAt,
        updatedBy: user?.name || "",
      });

      window.alert("تم تحصيل الدفعة ✅");
    } catch (e) {
      window.alert(e?.message || "حدث خطأ أثناء تحصيل الدفعة");
    }
  };

  const exportCreditInvoicesCsv = (rows = creditInvoices) => {
    const headers = ["رقم الفاتورة", "التاريخ", "اسم العميل", "الإجمالي", "المدفوع", "المتبقي", "الحالة"];
    const rowsData = (rows || []).map((i) => [
      i.invoiceNumber || "",
      i.createdAt ? new Date(i.createdAt).toLocaleString("ar-EG") : "",
      i.customerName || "",
      toNumber(i.total),
      toNumber(i.paidAmount),
      toNumber(i.remainingAmount),
      i.paymentStatus || "",
    ]);
    downloadCsv("karma-credit-sales.csv", headers, rowsData);
  };

  /* =============================
     POS totals
  ============================= */
  const cartTotal = useMemo(() => (cart || []).reduce((s, i) => s + toNumber(i.total), 0), [cart]);

  const salePaidAmount = useMemo(() => {
    if (paymentMethod === "credit") return 0;
    if (paymentMethod === "cash" || paymentMethod === "wallet" || paymentMethod === "card") {
      const num = toNumber(paidAmount, cartTotal);
      return Math.max(0, Math.min(num, cartTotal));
    }
    return Math.max(0, Math.min(toNumber(paidAmount), cartTotal));
  }, [paymentMethod, paidAmount, cartTotal]);

  const saleRemainingAmount = useMemo(() => Math.max(0, cartTotal - salePaidAmount), [cartTotal, salePaidAmount]);

  const selectedCustomer = useMemo(() => (customers || []).find((c) => c.id === selectedCustomerId) || null, [
    customers,
    selectedCustomerId,
  ]);

  const selectedSupplier = useMemo(
    () => (suppliers || []).find((s) => s.id === purchaseInvoiceForm.supplierId) || null,
    [suppliers, purchaseInvoiceForm.supplierId]
  );

  /* =============================
     Cash Drawer (Active session)
  ============================= */
  const activeCashSession = useMemo(() => {
    if (!currentCashierId) return null;
    return (cashSessions || []).find((s) => s.status === "open" && (s.cashierId || "") === currentCashierId) || null;
  }, [cashSessions, currentCashierId]);

  const addCashTransaction = async ({ sessionId, type, amount, referenceType = "", referenceId = "", notes = "" }) => {
    const amt = toNumber(amount);
    if (!sessionId) return;
    if (amt <= 0) return;

    const txRef = push(ref(db, "cashTransactions"));
    await set(txRef, {
      sessionId,
      type,
      amount: amt,
      referenceType,
      referenceId,
      notes,
      createdAt: Date.now(),
      createdBy: user?.name || "",
    });
  };

  const getSessionSummary = useMemo(() => {
    return (sessionId) => {
      const session = (cashSessions || []).find((s) => s.id === sessionId);
      if (!session) return null;

      const list = (cashTransactions || []).filter((t) => t.sessionId === sessionId);
      const sum = (types) => list.filter((t) => types.includes(t.type)).reduce((s, t) => s + toNumber(t.amount), 0);

      const opening = toNumber(session.openingCash);
      const cashSales = sum(["sale_cash"]);
      const chargingCash = sum(["charging_cash"]);
      const customerPaymentsCash = sum(["customer_payment_cash"]);
      const cashIn = sum(["cash_in"]);

      const cashOut = sum(["cash_out"]);
      const cashExpenses = sum(["expense_cash"]);
      const cashRefunds = sum(["refund_cash"]);

      const expectedCash = opening + cashIn + cashSales + chargingCash + customerPaymentsCash - cashOut - cashExpenses - cashRefunds;

      return {
        opening,
        cashSales,
        chargingCash,
        customerPaymentsCash,
        cashIn,
        cashOut,
        cashExpenses,
        cashRefunds,
        expectedCash,
        txCount: list.length,
      };
    };
  }, [cashSessions, cashTransactions]);

  const openCashSession = async ({ openingCash, notes }) => {
    if (!currentCashierId) return window.alert("لا يوجد مستخدم");
    if (activeCashSession) return window.alert("هناك وردية مفتوحة بالفعل");

    const opening = toNumber(openingCash);
    if (opening < 0) return window.alert("رصيد الافتتاحي غير صحيح");

    const openedAt = Date.now();
    const sessionRef = push(ref(db, "cashSessions"));

    const payload = {
      sessionNumber: `SHIFT-${openedAt}`,
      cashierId: currentCashierId,
      cashierName: user?.name || user?.phone || "",
      openedAt,
      openingCash: opening,
      status: "open",
      notes: String(notes || "").trim(),
      shiftHours: 12,
    };

    await set(sessionRef, payload);

    await addCashTransaction({
      sessionId: sessionRef.key,
      type: "opening",
      amount: opening,
      referenceType: "session",
      referenceId: payload.sessionNumber,
      notes: "رصيد افتتاحي",
    });

    window.alert("تم فتح الوردية ✅");
  };

  const addCashInOut = async ({ type, amount, notes }) => {
    if (!activeCashSession) return window.alert("افتح وردية أولاً");
    if (type !== "cash_in" && type !== "cash_out") return window.alert("نوع العملية غير صحيح");

    const amt = toNumber(amount);
    if (amt <= 0) return window.alert("أدخل مبلغ صحيح");

    await addCashTransaction({
      sessionId: activeCashSession.id,
      type,
      amount: amt,
      referenceType: "manual",
      referenceId: "",
      notes: String(notes || "").trim(),
    });

    window.alert("تم حفظ الحركة ✅");
  };

  const closeCashSession = async ({ countedCash, notes }) => {
    if (!activeCashSession) return window.alert("لا توجد وردية مفتوحة");

    const summary = getSessionSummary(activeCashSession.id);
    const counted = toNumber(countedCash);
    if (!Number.isFinite(counted)) return window.alert("أدخل مبلغ العد بشكل صحيح");

    const diff = counted - toNumber(summary?.expectedCash);

    await update(ref(db, `cashSessions/${activeCashSession.id}`), {
      status: "closed",
      closedAt: Date.now(),
      countedCash: counted,
      difference: diff,
      closeNotes: String(notes || "").trim(),
    });

    window.alert("تم إغلاق الوردية ✅");
  };

  /* =============================
     Cart Actions
  ============================= */
  const addToCart = (product, unitType) => {
    if (!product || !product.id) return window.alert("بيانات المنتج غير صحيحة");

    const unitName = unitType === "package" ? product.packageUnitName || product.packageName || "عبوة" : product.baseUnitName || "قطعة";
    const unitPrice = unitType === "package" ? toNumber(product.salePackagePrice) : toNumber(product.saleItemPrice);
    const key = `${product.id}-${unitType}`;

    if (unitType === "package" && toNumber(product.packageQty) <= 0) return window.alert("لا يوجد مخزون عبوات");
    if (unitType === "item" && toNumber(product.totalItems) <= 0) return window.alert("لا يوجد مخزون");

    setCart((prev) => {
      const exists = (prev || []).find((i) => i.key === key);
      if (exists) {
        return (prev || []).map((i) => (i.key === key ? { ...i, qty: i.qty + 1, total: (i.qty + 1) * i.unitPrice } : i));
      }
      return [
        ...(prev || []),
        {
          key,
          productId: product.id,
          productName: product.name,
          unitType,
          unitName,
          unitPrice,
          qty: 1,
          total: unitPrice,
          barcode: product.barcode || "",
        },
      ];
    });
  };

  const increaseCartItem = (key) =>
    setCart((prev) => (prev || []).map((i) => (i.key === key ? { ...i, qty: i.qty + 1, total: (i.qty + 1) * i.unitPrice } : i)));

  const decreaseCartItem = (key) =>
    setCart((prev) =>
      (prev || [])
        .map((i) => (i.key === key ? { ...i, qty: i.qty - 1, total: (i.qty - 1) * i.unitPrice } : i))
        .filter((i) => i.qty > 0)
    );

  const removeCartItem = (key) => setCart((prev) => (prev || []).filter((i) => i.key !== key));

  const clearCart = () => {
    setCart([]);
    setSelectedCustomerId("");
    setPaymentMethod("cash");
    setPaidAmount("");
  };

  /* =============================
     Products CRUD + Inventory init
  ============================= */
  const saveProduct = async () => {
    const name = String(productForm.name || "").trim();
    if (!name) return window.alert("من فضلك أدخل اسم المنتج");

    const itemsPerPackage = Math.max(1, toNumber(productForm.itemsPerPackage, 1));
    if (itemsPerPackage <= 0) return window.alert("أدخل عدد القطع داخل العبوة");

    if (toNumber(productForm.purchasePackagePrice) <= 0) return window.alert("أدخل سعر شراء العبوة");
    if (toNumber(productForm.saleItemPrice) <= 0) return window.alert("أدخل سعر بيع القطعة");
    if (toNumber(productForm.salePackagePrice) <= 0) return window.alert("أدخل سعر بيع العبوة");

    const whId = activeWarehouseId || defaultWarehouse?.id;
    if (!whId) return window.alert("لا يوجد مخزن نشط");

    const normalizedBarcode = String(productForm.barcode || "").trim();
    if (normalizedBarcode) {
      const dup = (productsBase || []).find((p) => p.id !== editingProductId && String(p.barcode || "").trim() === normalizedBarcode);
      if (dup) return window.alert(`هذا الباركود مستخدم بالفعل للمنتج: ${dup.name}`);
    }

    setSavingProduct(true);
    try {
      const createdAt = Date.now();

      const cat = (categories || []).find((c) => c.id === productForm.categoryId) || null;
      const baseUnit = (units || []).find((u) => u.id === productForm.baseUnitId) || null;
      const packUnit = (units || []).find((u) => u.id === productForm.packageUnitId) || null;

      const payload = {
        name,
        barcode: normalizedBarcode,

        // old + new
        categoryId: productForm.categoryId || "",
        categoryName: cat ? cat.name : String(productForm.categoryName || productForm.category || "").trim(),
        category: String(productForm.category || "").trim(), // keep old

        baseUnitId: productForm.baseUnitId || "",
        baseUnitName: baseUnit ? baseUnit.name : String(productForm.baseUnitName || "قطعة").trim(),

        packageUnitId: productForm.packageUnitId || "",
        packageUnitName: packUnit ? packUnit.name : String(productForm.packageUnitName || productForm.packageName || "عبوة").trim(),

        // old
        packageName: String(productForm.packageName || "").trim(),

        itemsPerPackage,
        purchasePackagePrice: toNumber(productForm.purchasePackagePrice),
        saleItemPrice: toNumber(productForm.saleItemPrice),
        salePackagePrice: toNumber(productForm.salePackagePrice),

        minPackageQty: Math.max(0, toNumber(productForm.minPackageQty)),
        expiryDate: String(productForm.expiryDate || "").trim(),

        updatedAt: createdAt,
        updatedBy: user?.name || "",
      };

      if (editingProductId) {
        await update(ref(db, `products/${editingProductId}`), payload);

        await writeInventoryEntry(whId, editingProductId, {
          baseQty: Math.max(0, toNumber(productForm.itemQty)),
          packageQty: Math.max(0, toNumber(productForm.packageQty)),
        });

        await addStockMovement({
          type: "adjustment",
          warehouseId: whId,
          productId: editingProductId,
          referenceType: "product_edit",
          referenceId: editingProductId,
          notes: "تعديل/تسوية رصيد من شاشة المنتج",
        });

        await logActivity({
          type: "product_update",
          title: "تعديل منتج",
          entityType: "product",
          entityId: editingProductId,
          entityLabel: payload.name,
          action: "update",
          meta: { barcode: payload.barcode, category: payload.categoryName || payload.category || "" },
        });
      } else {
        const newRef = push(ref(db, "products"));
        const newId = newRef.key;

        await set(newRef, { ...payload, createdAt, createdBy: user?.name || "" });

        await writeInventoryEntry(whId, newId, {
          baseQty: Math.max(0, toNumber(productForm.itemQty)),
          packageQty: Math.max(0, toNumber(productForm.packageQty)),
        });

        await addStockMovement({
          type: "adjustment",
          warehouseId: whId,
          productId: newId,
          referenceType: "product_create",
          referenceId: newId,
          notes: "رصيد افتتاحي",
        });

        await logActivity({
          type: "product_create",
          title: "إضافة منتج",
          entityType: "product",
          entityId: newId,
          entityLabel: payload.name,
          action: "create",
          meta: { barcode: payload.barcode, category: payload.categoryName || payload.category || "" },
        });
      }

      setProductForm(initialProductForm);
      setEditingProductId(null);
      window.alert("تم حفظ المنتج ✅");
    } catch (e) {
      window.alert(e?.message || "حدث خطأ أثناء حفظ المنتج");
    } finally {
      setSavingProduct(false);
    }
  };

  const startEditProduct = (product) => {
    if (!product) return;
    setEditingProductId(product.id);

    setProductForm({
      ...initialProductForm,
      name: product.name || "",
      barcode: product.barcode || "",

      category: product.category || "",
      packageName: product.packageName || "",

      categoryId: product.categoryId || "",
      categoryName: product.categoryName || "",
      baseUnitId: product.baseUnitId || "",
      baseUnitName: product.baseUnitName || "",
      packageUnitId: product.packageUnitId || "",
      packageUnitName: product.packageUnitName || "",

      itemsPerPackage: String(product.itemsPerPackage ?? ""),
      purchasePackagePrice: String(product.purchasePackagePrice ?? ""),
      saleItemPrice: String(product.saleItemPrice ?? ""),
      salePackagePrice: String(product.salePackagePrice ?? ""),

      packageQty: String(product.packageQty ?? ""),
      itemQty: String(product.itemQty ?? ""),
      minPackageQty: String(product.minPackageQty ?? ""),
      expiryDate: product.expiryDate || "",
    });
  };

  const cancelEditProduct = () => {
    setEditingProductId(null);
    setProductForm(initialProductForm);
  };

  const deleteProduct = async (id) => {
    const ok = window.confirm("هل تريد حذف هذا المنتج؟");
    if (!ok) return;

    const p = (productsBase || []).find((x) => x.id === id);

    await remove(ref(db, `products/${id}`));

    const inv = inventoryMap || {};
    const updates = {};
    Object.keys(inv).forEach((whId) => {
      if (inv?.[whId]?.[id]) updates[`inventory/${whId}/${id}`] = null;
    });
    if (Object.keys(updates).length) await update(ref(db), updates);

    setCart((prev) => (prev || []).filter((i) => i.productId !== id));
    if (editingProductId === id) cancelEditProduct();

    await logActivity({
      type: "product_delete",
      title: "حذف منتج",
      entityType: "product",
      entityId: id,
      entityLabel: p?.name || "",
      action: "delete",
    });
  };

  /* =============================
     Categories CRUD
  ============================= */
  const saveCategory = async () => {
    const name = String(categoryForm.name || "").trim();
    if (!name) return window.alert("أدخل اسم الفئة");
    setSavingCategory(true);
    try {
      const newRef = push(ref(db, "categories"));
      await set(newRef, {
        name,
        code: String(categoryForm.code || "").trim().toUpperCase(),
        isActive: !!categoryForm.isActive,
        createdAt: Date.now(),
        createdBy: user?.name || "",
      });
      setCategoryForm(initialCategoryForm);

      await logActivity({
        type: "category_create",
        title: "إضافة فئة منتجات",
        entityType: "category",
        entityId: newRef.key,
        entityLabel: name,
        action: "create",
      });

      window.alert("تم حفظ الفئة ✅");
    } catch (e) {
      window.alert(e?.message || "خطأ أثناء حفظ الفئة");
    } finally {
      setSavingCategory(false);
    }
  };

  const deleteCategory = async (categoryId) => {
    const used = (productsBase || []).some((p) => String(p.categoryId || "") === String(categoryId));
    if (used) return window.alert("لا يمكن حذف فئة مرتبطة بمنتجات");
    const ok = window.confirm("حذف الفئة؟");
    if (!ok) return;

    const c = (categories || []).find((x) => x.id === categoryId);
    await remove(ref(db, `categories/${categoryId}`));

    await logActivity({
      type: "category_delete",
      title: "حذف فئة منتجات",
      entityType: "category",
      entityId: categoryId,
      entityLabel: c?.name || "",
      action: "delete",
    });
  };

  /* =============================
     Units CRUD
  ============================= */
  const saveUnit = async () => {
    const name = String(unitForm.name || "").trim();
    if (!name) return window.alert("أدخل اسم الوحدة");
    setSavingUnit(true);
    try {
      const newRef = push(ref(db, "units"));
      await set(newRef, {
        name,
        short: String(unitForm.short || "").trim(),
        type: unitForm.type || "count",
        isActive: !!unitForm.isActive,
        createdAt: Date.now(),
        createdBy: user?.name || "",
      });
      setUnitForm(initialUnitForm);

      await logActivity({
        type: "unit_create",
        title: "إضافة وحدة قياس",
        entityType: "unit",
        entityId: newRef.key,
        entityLabel: name,
        action: "create",
      });

      window.alert("تم حفظ الوحدة ✅");
    } catch (e) {
      window.alert(e?.message || "خطأ أثناء حفظ الوحدة");
    } finally {
      setSavingUnit(false);
    }
  };

  const deleteUnit = async (unitId) => {
    const used = (productsBase || []).some(
      (p) => String(p.baseUnitId || "") === String(unitId) || String(p.packageUnitId || "") === String(unitId)
    );
    if (used) return window.alert("لا يمكن حذف وحدة مرتبطة بمنتجات");
    const ok = window.confirm("حذف الوحدة؟");
    if (!ok) return;

    const u = (units || []).find((x) => x.id === unitId);
    await remove(ref(db, `units/${unitId}`));

    await logActivity({
      type: "unit_delete",
      title: "حذف وحدة قياس",
      entityType: "unit",
      entityId: unitId,
      entityLabel: u?.name || "",
      action: "delete",
    });
  };

  /* =============================
     Warehouses CRUD
  ============================= */
  const saveWarehouse = async () => {
    const name = String(warehouseForm.name || "").trim();
    if (!name) return window.alert("أدخل اسم المخزن");
    setSavingWarehouse(true);
    try {
      const newRef = push(ref(db, "warehouses"));
      const payload = {
        name,
        location: String(warehouseForm.location || "").trim(),
        isDefault: !!warehouseForm.isDefault,
        isActive: !!warehouseForm.isActive,
        createdAt: Date.now(),
        createdBy: user?.name || "",
      };
      await set(newRef, payload);

      if (payload.isDefault) {
        const updates = {};
        (warehouses || []).forEach((w) => {
          updates[`warehouses/${w.id}/isDefault`] = false;
        });
        await update(ref(db), updates);
      }

      setWarehouseForm(initialWarehouseForm);

      await logActivity({
        type: "warehouse_create",
        title: "إضافة مخزن",
        entityType: "warehouse",
        entityId: newRef.key,
        entityLabel: name,
        action: "create",
        meta: { isDefault: payload.isDefault, location: payload.location },
      });

      window.alert("تم حفظ المخزن ✅");
    } catch (e) {
      window.alert(e?.message || "خطأ أثناء حفظ المخزن");
    } finally {
      setSavingWarehouse(false);
    }
  };

  const setDefaultWarehouse = async (warehouseId) => {
    if (!warehouseId) return;
    const updates = {};
    (warehouses || []).forEach((w) => {
      updates[`warehouses/${w.id}/isDefault`] = w.id === warehouseId;
    });
    await update(ref(db), updates);
    setActiveWarehouseId(warehouseId);

    const wh = (warehouses || []).find((x) => x.id === warehouseId);
    await logActivity({
      type: "warehouse_set_default",
      title: "تعيين مخزن افتراضي",
      entityType: "warehouse",
      entityId: warehouseId,
      entityLabel: wh?.name || "",
      action: "update",
    });
  };

  const deleteWarehouse = async (warehouseId) => {
    const wh = (warehouses || []).find((w) => w.id === warehouseId);
    if (wh?.isDefault) return window.alert("لا يمكن حذف المخزن الافتراضي");
    const invHasData = Object.keys(inventoryMap?.[warehouseId] || {}).length > 0;
    if (invHasData) return window.alert("لا يمكن حذف مخزن يحتوي على مخزون");

    const ok = window.confirm("حذف المخزن؟");
    if (!ok) return;

    await remove(ref(db, `warehouses/${warehouseId}`));

    await logActivity({
      type: "warehouse_delete",
      title: "حذف مخزن",
      entityType: "warehouse",
      entityId: warehouseId,
      entityLabel: wh?.name || "",
      action: "delete",
    });
  };

  /* =============================
     Checkout (sale) + inventory deduction
  ============================= */
  const checkout = async () => {
    if ((cart || []).length === 0) return window.alert("الفاتورة فارغة");
    if (saleRemainingAmount > 0 && !selectedCustomer) return window.alert("اختر العميل لأن هناك مبلغ متبقي");

    const whId = activeWarehouseId || defaultWarehouse?.id;
    if (!whId) return window.alert("لا يوجد مخزن نشط");

    setCheckoutLoading(true);
    try {
      const grouped = (cart || []).reduce((acc, it) => {
        if (!acc[it.productId]) acc[it.productId] = [];
        acc[it.productId].push(it);
        return acc;
      }, {});

      const createdAt = Date.now();
      const invoiceRef = push(ref(db, "invoices"));
      const invoiceNumber = `فاتورة-${createdAt}`;

      const updatesObj = {};

      Object.keys(grouped).forEach((productId) => {
        const product = (products || []).find((p) => p.id === productId);
        if (!product) throw new Error("أحد المنتجات غير موجود");

        const inv = getInventoryEntry(whId, productId) || {
          baseQty: toNumber(product.itemQty),
          packageQty: toNumber(product.packageQty),
        };

        const next = applySaleDeduction(product, inv, grouped[productId]);

        updatesObj[`inventory/${whId}/${productId}/baseQty`] = next.baseQty;
        updatesObj[`inventory/${whId}/${productId}/packageQty`] = next.packageQty;
        updatesObj[`inventory/${whId}/${productId}/updatedAt`] = createdAt;
        updatesObj[`inventory/${whId}/${productId}/updatedBy`] = user?.name || "";
      });

      const invoiceItems = (cart || []).map((i) => ({
        productId: i.productId,
        productName: i.productName,
        unitType: i.unitType,
        unitName: i.unitName,
        unitPrice: toNumber(i.unitPrice),
        qty: toNumber(i.qty),
        total: toNumber(i.total),
        barcode: i.barcode || "",
      }));

      const invoicePayload = {
        invoiceNumber,
        createdAt,
        dateKey: todayKey(),
        warehouseId: whId,
        cashierId: currentCashierId,
        cashierName: user?.name || "",
        cashierPhone: user?.phone || "",
        customerId: selectedCustomer?.id || "",
        customerName: selectedCustomer?.name || "",
        paymentMethod,
        items: invoiceItems,
        total: cartTotal,
        paidAmount: salePaidAmount,
        remainingAmount: saleRemainingAmount,
        paymentStatus: saleRemainingAmount === 0 ? "paid" : salePaidAmount > 0 ? "partial" : "credit",
      };

      updatesObj[`invoices/${invoiceRef.key}`] = invoicePayload;

      for (const productId of Object.keys(grouped)) {
        await addStockMovement({
          type: "sale",
          warehouseId: whId,
          productId,
          referenceType: "invoice",
          referenceId: invoiceRef.key,
          notes: invoiceNumber,
        });
      }

      await update(ref(db), updatesObj);

      if (paymentMethod === "cash" && activeCashSession) {
        await addCashTransaction({
          sessionId: activeCashSession.id,
          type: "sale_cash",
          amount: salePaidAmount,
          referenceType: "invoice",
          referenceId: invoiceRef.key,
          notes: invoiceNumber,
        });
      }

      await logActivity({
        type: "invoice_create",
        title: "إنشاء فاتورة بيع",
        entityType: "invoice",
        entityId: invoiceRef.key,
        entityLabel: invoiceNumber,
        action: "create",
        meta: {
          total: cartTotal,
          paid: salePaidAmount,
          remaining: saleRemainingAmount,
          paymentMethod,
          customerName: selectedCustomer?.name || "",
          warehouseId: whId,
        },
      });

      setReceiptData(invoicePayload);
      clearCart();
      setSearch("");
      setInvoiceResetTick((p) => p + 1);

      window.alert("تم حفظ الفاتورة ✅");
    } catch (e) {
      window.alert(e?.message || "حدث خطأ أثناء حفظ الفاتورة");
    } finally {
      setCheckoutLoading(false);
    }
  };

  /* =============================
     Sales Return
  ============================= */
  const createSalesReturn = async ({ invoice, items }) => {
    if (!invoice || !invoice.id) return window.alert("الفاتورة غير صحيحة");
    if (!items || items.length === 0) return window.alert("لا توجد أصناف مرتجعة");

    const whId = invoice.warehouseId || activeWarehouseId || defaultWarehouse?.id;
    if (!whId) return window.alert("لا يوجد مخزن");

    try {
      const createdAt = Date.now();
      const updatesObj = {};

      const grouped = items.reduce((acc, it) => {
        if (!acc[it.productId]) acc[it.productId] = [];
        acc[it.productId].push(it);
        return acc;
      }, {});

      Object.keys(grouped).forEach((productId) => {
        const product = (products || []).find((p) => p.id === productId);
        if (!product) return;

        const inv = getInventoryEntry(whId, productId) || {
          baseQty: toNumber(product.itemQty),
          packageQty: toNumber(product.packageQty),
        };

        const next = applyReturn(inv, grouped[productId]);

        updatesObj[`inventory/${whId}/${productId}/baseQty`] = next.baseQty;
        updatesObj[`inventory/${whId}/${productId}/packageQty`] = next.packageQty;
        updatesObj[`inventory/${whId}/${productId}/updatedAt`] = createdAt;
        updatesObj[`inventory/${whId}/${productId}/updatedBy`] = user?.name || "";
      });

      const total = items.reduce((s, it) => s + toNumber(it.total), 0);

      const returnRef = push(ref(db, "salesReturns"));
      const payload = {
        originalInvoiceId: invoice.id,
        originalInvoiceNumber: invoice.invoiceNumber || "",
        warehouseId: whId,
        createdAt,
        createdBy: user?.name || "",
        customerId: invoice.customerId || "",
        customerName: invoice.customerName || "",
        items: items.map((it) => ({
          productId: it.productId,
          productName: it.productName,
          unitType: it.unitType,
          unitName: it.unitName,
          unitPrice: toNumber(it.unitPrice),
          qty: toNumber(it.qty),
          total: toNumber(it.total),
        })),
        total,
      };

      updatesObj[`salesReturns/${returnRef.key}`] = payload;

      for (const pid of Object.keys(grouped)) {
        await addStockMovement({
          type: "return",
          warehouseId: whId,
          productId: pid,
          referenceType: "sales_return",
          referenceId: returnRef.key,
          notes: payload.originalInvoiceNumber,
        });
      }

      await update(ref(db), updatesObj);

      if (activeCashSession) {
        await addCashTransaction({
          sessionId: activeCashSession.id,
          type: "refund_cash",
          amount: total,
          referenceType: "sales_return",
          referenceId: returnRef.key,
          notes: payload.originalInvoiceNumber,
        });
      }

      await logActivity({
        type: "sales_return_create",
        title: "تسجيل مرتجع بيع",
        entityType: "sales_return",
        entityId: returnRef.key,
        entityLabel: payload.originalInvoiceNumber || "",
        action: "create",
        meta: { total, warehouseId: whId, customerName: payload.customerName || "" },
      });

      window.alert("تم حفظ المرتجع ✅");
    } catch (e) {
      window.alert(e?.message || "خطأ أثناء حفظ المرتجع");
    }
  };

  /* =============================
     Purchase Invoices (add packages)
  ============================= */
  const addPurchaseItem = (productId) => {
    const product = (products || []).find((p) => p.id === productId);
    if (!product) return;

    setPurchaseCart((prev) => {
      const exists = (prev || []).find((i) => i.productId === product.id);
      if (exists) {
        return (prev || []).map((i) =>
          i.productId === product.id
            ? { ...i, packageQty: i.packageQty + 1, total: (i.packageQty + 1) * i.purchasePackagePrice }
            : i
        );
      }
      return [
        ...(prev || []),
        {
          productId: product.id,
          productName: product.name,
          packageName: product.packageUnitName || product.packageName || "عبوة",
          packageQty: 1,
          purchasePackagePrice: toNumber(product.purchasePackagePrice),
          total: toNumber(product.purchasePackagePrice),
        },
      ];
    });
  };

  const increasePurchaseItem = (productId) =>
    setPurchaseCart((prev) =>
      (prev || []).map((i) =>
        i.productId === productId
          ? { ...i, packageQty: i.packageQty + 1, total: (i.packageQty + 1) * i.purchasePackagePrice }
          : i
      )
    );

  const decreasePurchaseItem = (productId) =>
    setPurchaseCart((prev) =>
      (prev || [])
        .map((i) =>
          i.productId === productId
            ? { ...i, packageQty: i.packageQty - 1, total: (i.packageQty - 1) * i.purchasePackagePrice }
            : i
        )
        .filter((i) => i.packageQty > 0)
    );

  const updatePurchaseItemPrice = (productId, price) =>
    setPurchaseCart((prev) =>
      (prev || []).map((i) =>
        i.productId === productId ? { ...i, purchasePackagePrice: toNumber(price), total: i.packageQty * toNumber(price) } : i
      )
    );

  const removePurchaseItem = (productId) => setPurchaseCart((prev) => (prev || []).filter((i) => i.productId !== productId));

  const clearPurchaseCart = () => {
    setPurchaseCart([]);
    setPurchaseInvoiceForm({ supplierId: "", paidAmount: "", notes: "" });
  };

  const purchaseSubtotal = useMemo(() => (purchaseCart || []).reduce((s, i) => s + toNumber(i.total), 0), [purchaseCart]);
  const purchasePaidAmount = useMemo(() => Math.max(0, Math.min(toNumber(purchaseInvoiceForm.paidAmount), purchaseSubtotal)), [
    purchaseInvoiceForm.paidAmount,
    purchaseSubtotal,
  ]);
  const purchaseRemainingAmount = useMemo(() => Math.max(0, purchaseSubtotal - purchasePaidAmount), [purchaseSubtotal, purchasePaidAmount]);

  const savePurchaseInvoice = async () => {
    if (!selectedSupplier) return window.alert("اختر المورد");
    if ((purchaseCart || []).length === 0) return window.alert("أضف منتجات لفاتورة الشراء");

    const whId = activeWarehouseId || defaultWarehouse?.id;
    if (!whId) return window.alert("لا يوجد مخزن نشط");

    setSavingPurchaseInvoice(true);
    try {
      const createdAt = Date.now();
      const invUpdates = {};
      const invoiceRef = push(ref(db, "purchaseInvoices"));
      const invoiceNumber = `شراء-${createdAt}`;

      (purchaseCart || []).forEach((it) => {
        const inv = getInventoryEntry(whId, it.productId) || { baseQty: 0, packageQty: 0 };
        invUpdates[`inventory/${whId}/${it.productId}/packageQty`] = toNumber(inv.packageQty) + toNumber(it.packageQty);
        invUpdates[`inventory/${whId}/${it.productId}/baseQty`] = toNumber(inv.baseQty);
        invUpdates[`inventory/${whId}/${it.productId}/updatedAt`] = createdAt;
        invUpdates[`inventory/${whId}/${it.productId}/updatedBy`] = user?.name || "";
      });

      const payload = {
        invoiceNumber,
        createdAt,
        warehouseId: whId,
        supplierId: selectedSupplier.id,
        supplierName: selectedSupplier.name,
        items: (purchaseCart || []).map((it) => ({
          productId: it.productId,
          productName: it.productName,
          packageName: it.packageName,
          packageQty: toNumber(it.packageQty),
          purchasePackagePrice: toNumber(it.purchasePackagePrice),
          total: toNumber(it.total),
        })),
        subtotal: purchaseSubtotal,
        paidAmount: purchasePaidAmount,
        remainingAmount: purchaseRemainingAmount,
        paymentStatus: purchaseRemainingAmount === 0 ? "paid" : purchasePaidAmount > 0 ? "partial" : "credit",
        notes: purchaseInvoiceForm.notes || "",
        createdBy: user?.name || "",
      };

      const updatesObj = { ...invUpdates, [`purchaseInvoices/${invoiceRef.key}`]: payload };

      for (const it of purchaseCart || []) {
        await addStockMovement({
          type: "purchase",
          warehouseId: whId,
          productId: it.productId,
          referenceType: "purchase_invoice",
          referenceId: invoiceRef.key,
          notes: invoiceNumber,
        });
      }

      await update(ref(db), updatesObj);

      await logActivity({
        type: "purchase_invoice_create",
        title: "إنشاء فاتورة شراء",
        entityType: "purchase_invoice",
        entityId: invoiceRef.key,
        entityLabel: invoiceNumber,
        action: "create",
        meta: { subtotal: purchaseSubtotal, supplierName: selectedSupplier.name, warehouseId: whId },
      });

      clearPurchaseCart();
      window.alert("تم حفظ فاتورة الشراء ✅");
    } catch (e) {
      window.alert(e?.message || "خطأ أثناء حفظ فاتورة الشراء");
    } finally {
      setSavingPurchaseInvoice(false);
    }
  };

  /* =============================
     Customers CRUD + Payments
  ============================= */
  const saveCustomer = async () => {
    if (!String(customerForm.name || "").trim()) return window.alert("أدخل اسم العميل");
    setSavingCustomer(true);
    try {
      const newRef = push(ref(db, "customers"));
      await set(newRef, {
        name: String(customerForm.name || "").trim(),
        phone: String(customerForm.phone || "").trim(),
        address: String(customerForm.address || "").trim(),
        notes: String(customerForm.notes || "").trim(),
        openingBalance: Math.max(0, toNumber(customerForm.openingBalance)),
        createdAt: Date.now(),
      });
      setCustomerForm(initialCustomerForm);

      await logActivity({
        type: "customer_create",
        title: "إضافة عميل",
        entityType: "customer",
        entityId: newRef.key,
        entityLabel: String(customerForm.name || "").trim(),
        action: "create",
      });

      window.alert("تم حفظ العميل ✅");
    } catch (e) {
      window.alert(e?.message || "خطأ أثناء حفظ العميل");
    } finally {
      setSavingCustomer(false);
    }
  };

  const addCustomerPayment = async ({ customerId, customerName, amount, notes }) => {
    if (!customerId || toNumber(amount) <= 0) return window.alert("اختر العميل وأدخل مبلغ صحيح");

    const createdAt = Date.now();
    const receiptNumber = `CP-${createdAt}`;
    const newRef = push(ref(db, "customerPayments"));

    await set(newRef, {
      customerId,
      customerName,
      amount: toNumber(amount),
      notes: String(notes || "").trim(),
      createdAt,
      createdBy: user?.name || "",
      receiptNumber,
    });

    if (activeCashSession) {
      await addCashTransaction({
        sessionId: activeCashSession.id,
        type: "customer_payment_cash",
        amount: toNumber(amount),
        referenceType: "customer_payment",
        referenceId: newRef.key,
        notes: receiptNumber,
      });
    }

    await logActivity({
      type: "customer_payment",
      title: "تحصيل سداد من عميل",
      entityType: "customer",
      entityId: customerId,
      entityLabel: customerName || "",
      action: "pay",
      meta: { amount: toNumber(amount), receiptNumber, notes: String(notes || "").trim() },
    });

    setReceiptData({
      type: "customer_payment",
      createdAt,
      receiptNumber,
      customerName,
      total: toNumber(amount),
      paidAmount: toNumber(amount),
      remainingAmount: 0,
      items: [{ productName: "سداد من العميل", unitName: "عملية سداد", unitPrice: toNumber(amount), qty: 1, total: toNumber(amount) }],
    });
  };

  /* =============================
     Suppliers CRUD + Payments
  ============================= */
  const saveSupplier = async () => {
    if (!String(supplierForm.name || "").trim()) return window.alert("أدخل اسم المورد");
    setSavingSupplier(true);
    try {
      const newRef = push(ref(db, "suppliers"));
      await set(newRef, {
        name: String(supplierForm.name || "").trim(),
        phone: String(supplierForm.phone || "").trim(),
        address: String(supplierForm.address || "").trim(),
        notes: String(supplierForm.notes || "").trim(),
        createdAt: Date.now(),
      });
      setSupplierForm(initialSupplierForm);

      await logActivity({
        type: "supplier_create",
        title: "إضافة مورد",
        entityType: "supplier",
        entityId: newRef.key,
        entityLabel: String(supplierForm.name || "").trim(),
        action: "create",
      });

      window.alert("تم حفظ المورد ✅");
    } catch (e) {
      window.alert(e?.message || "خطأ أثناء حفظ المورد");
    } finally {
      setSavingSupplier(false);
    }
  };

  const addSupplierPayment = async ({ supplierId, supplierName, amount, notes }) => {
    if (!supplierId || toNumber(amount) <= 0) return window.alert("اختر المورد وأدخل مبلغ صحيح");

    const newRef = push(ref(db, "supplierPayments"));
    await set(newRef, {
      supplierId,
      supplierName,
      amount: toNumber(amount),
      notes: String(notes || "").trim(),
      createdAt: Date.now(),
      createdBy: user?.name || "",
    });

    await logActivity({
      type: "supplier_payment",
      title: "سداد لمورد",
      entityType: "supplier",
      entityId: supplierId,
      entityLabel: supplierName || "",
      action: "pay",
      meta: { amount: toNumber(amount), notes: String(notes || "").trim() },
    });

    window.alert("تم حفظ سداد المورد ✅");
  };

  /* =============================
     Wallet Transfers
  ============================= */
  const saveWalletTransfer = async () => {
    if (!String(walletTransferForm.personName || "").trim()) return window.alert("أدخل الاسم");
    if (!String(walletTransferForm.walletNumber || "").trim()) return window.alert("أدخل رقم المحفظة");
    if (toNumber(walletTransferForm.amount) <= 0) return window.alert("أدخل مبلغ صحيح");

    setSavingWalletTransfer(true);
    try {
      const newRef = push(ref(db, "walletTransfers"));
      await set(newRef, {
        personName: String(walletTransferForm.personName || "").trim(),
        walletNumber: String(walletTransferForm.walletNumber || "").trim(),
        amount: toNumber(walletTransferForm.amount),
        transactionType: walletTransferForm.transactionType,
        isPaid: !!walletTransferForm.isPaid,
        receiptNumber: String(walletTransferForm.receiptNumber || "").trim(),
        notes: String(walletTransferForm.notes || "").trim(),
        createdAt: Date.now(),
        createdBy: user?.name || "",
      });
      setWalletTransferForm(initialWalletTransferForm);

      await logActivity({
        type: "wallet_transfer_create",
        title: "عملية محفظة",
        entityType: "wallet_transfer",
        entityId: newRef.key,
        entityLabel: String(walletTransferForm.personName || "").trim(),
        action: "create",
        meta: {
          amount: toNumber(walletTransferForm.amount),
          transactionType: walletTransferForm.transactionType,
          walletNumber: String(walletTransferForm.walletNumber || "").trim(),
        },
      });

      window.alert("تم حفظ التحويل ✅");
    } catch (e) {
      window.alert(e?.message || "خطأ أثناء حفظ التحويل");
    } finally {
      setSavingWalletTransfer(false);
    }
  };

  /* =============================
     Expenses
  ============================= */
  const saveExpense = async () => {
    if (!String(expenseForm.title || "").trim()) return window.alert("أدخل اسم المصروف");
    if (toNumber(expenseForm.amount) <= 0) return window.alert("أدخل مبلغ صحيح");

    setSavingExpense(true);
    try {
      const createdAt = expenseForm.expenseDate ? new Date(`${expenseForm.expenseDate}T12:00:00`).getTime() : Date.now();
      const newRef = push(ref(db, "expenses"));
      await set(newRef, {
        title: String(expenseForm.title || "").trim(),
        category: String(expenseForm.category || "").trim(),
        amount: toNumber(expenseForm.amount),
        notes: String(expenseForm.notes || "").trim(),
        expenseDate: expenseForm.expenseDate || "",
        dateKey: expenseForm.expenseDate || todayKey(),
        monthKey: getMonthKey(createdAt),
        createdAt,
        createdBy: user?.name || "",
      });

      if (activeCashSession) {
        await addCashTransaction({
          sessionId: activeCashSession.id,
          type: "expense_cash",
          amount: toNumber(expenseForm.amount),
          referenceType: "expense",
          referenceId: newRef.key,
          notes: expenseForm.title || "مصروف",
        });
      }

      await logActivity({
        type: "expense_create",
        title: "تسجيل مصروف",
        entityType: "expense",
        entityId: newRef.key,
        entityLabel: String(expenseForm.title || "").trim(),
        action: "create",
        meta: { amount: toNumber(expenseForm.amount), category: String(expenseForm.category || "").trim() },
      });

      setExpenseForm(initialExpenseForm);
      window.alert("تم حفظ المصروف ✅");
    } catch (e) {
      window.alert(e?.message || "خطأ أثناء حفظ المصروف");
    } finally {
      setSavingExpense(false);
    }
  };

  const totalExpenses = useMemo(() => (expenses || []).reduce((s, e) => s + toNumber(e.amount), 0), [expenses]);

  const todayExpenses = useMemo(() => {
    return (expenses || []).filter((e) => e.dateKey === todayKey()).reduce((s, e) => s + toNumber(e.amount), 0);
  }, [expenses]);

  const currentMonthExpenses = useMemo(() => {
    const mk = getMonthKey(Date.now());
    return (expenses || []).filter((e) => e.monthKey === mk).reduce((s, e) => s + toNumber(e.amount), 0);
  }, [expenses]);

  const exportExpensesCsv = (rows = expenses) => {
    const headers = ["التاريخ", "اسم المصروف", "التصنيف", "المبلغ", "ملاحظات", "تم بواسطة"];
    const data = (rows || []).map((e) => [
      e.createdAt ? new Date(e.createdAt).toLocaleString("ar-EG") : "",
      e.title || "",
      e.category || "",
      toNumber(e.amount),
      e.notes || "",
      e.createdBy || "",
    ]);
    downloadCsv("karma-expenses.csv", headers, data);
  };

  /* =============================
     Charging
  ============================= */
  const saveChargingOperation = async () => {
    if (!String(chargingForm.targetNumber || "").trim()) return window.alert("أدخل الرقم");
    if (toNumber(chargingForm.amount) <= 0) return window.alert("أدخل مبلغ صحيح");

    setSavingCharging(true);
    try {
      const createdAt = Date.now();
      const operationRef = push(ref(db, "chargingOperations"));

      const payload = {
        serviceType: chargingForm.serviceType,
        company: chargingForm.company,
        targetNumber: String(chargingForm.targetNumber || "").trim(),
        amount: toNumber(chargingForm.amount),
        fee: toNumber(chargingForm.fee),
        referenceNumber: String(chargingForm.referenceNumber || "").trim() || `CH-${createdAt}`,
        notes: String(chargingForm.notes || "").trim(),
        status: chargingForm.status || "success",
        createdAt,
        cashierId: currentCashierId,
        cashierName: user?.name || "",
      };

      await set(operationRef, payload);

      if (activeCashSession) {
        await addCashTransaction({
          sessionId: activeCashSession.id,
          type: "charging_cash",
          amount: payload.amount,
          referenceType: "charging",
          referenceId: operationRef.key,
          notes: payload.referenceNumber,
        });
      }

      await logActivity({
        type: "charging_create",
        title: "عملية شحن",
        entityType: "charging",
        entityId: operationRef.key,
        entityLabel: payload.referenceNumber,
        action: "create",
        meta: {
          serviceType: payload.serviceType,
          company: payload.company,
          targetNumber: payload.targetNumber,
          amount: payload.amount,
          fee: payload.fee,
        },
      });

      setReceiptData({
        type: "charging",
        createdAt: payload.createdAt,
        receiptNumber: payload.referenceNumber,
        customerName: payload.targetNumber,
        total: payload.amount,
        paidAmount: payload.amount,
        remainingAmount: 0,
        items: [
          {
            productName: `${getServiceTypeLabel(payload.serviceType)} - ${getCompanyLabel(payload.company)}`,
            unitName: "خدمة",
            unitPrice: payload.amount,
            qty: 1,
            total: payload.amount,
          },
        ],
      });

      setChargingForm(initialChargingForm);
      window.alert("تم حفظ عملية الشحن ✅");
    } catch (e) {
      window.alert(e?.message || "خطأ أثناء حفظ الشحن");
    } finally {
      setSavingCharging(false);
    }
  };

  /* =============================
     Treasury
  ============================= */
  const saveTreasuryTransaction = async () => {
    if (!treasuryForm.type) return window.alert("اختر نوع المعاملة");
    if (toNumber(treasuryForm.amount) <= 0) return window.alert("أدخل مبلغ صحيح");
    if (!String(treasuryForm.paymentMethod || "").trim()) return window.alert("اختر طريقة الدفع");
    if (!String(treasuryForm.category || "").trim()) return window.alert("أدخل الفئة");

    setSavingTreasury(true);
    try {
      const createdAt = treasuryForm.entryDate ? new Date(`${treasuryForm.entryDate}T12:00:00`).getTime() : Date.now();
      const newRef = push(ref(db, "treasuryTransactions"));

      const payload = {
        type: treasuryForm.type,
        title: String(treasuryForm.title || "").trim(),
        amount: toNumber(treasuryForm.amount),
        paymentMethod: treasuryForm.paymentMethod,
        category: String(treasuryForm.category || "").trim(),
        entryDate: treasuryForm.entryDate || "",
        notes: String(treasuryForm.notes || "").trim(),
        createdAt,
        createdBy: user?.name || "",
      };

      await set(newRef, payload);

      await logActivity({
        type: "treasury_create",
        title: payload.type === "income" ? "حركة خزينة: إيراد" : "حركة خزينة: مصروف",
        entityType: "treasury",
        entityId: newRef.key,
        entityLabel: payload.title || payload.category,
        action: "create",
        meta: { amount: payload.amount, paymentMethod: payload.paymentMethod, category: payload.category, notes: payload.notes },
      });

      setTreasuryForm(initialTreasuryForm);
      window.alert("تم حفظ حركة الخزينة ✅");
    } catch (e) {
      window.alert(e?.message || "خطأ أثناء حفظ حركة الخزينة");
    } finally {
      setSavingTreasury(false);
    }
  };

  const exportTreasuryCsv = (rows = treasuryTransactions) => {
    const headers = ["التاريخ", "النوع", "العنوان", "الفئة", "طريقة الدفع", "المبلغ", "ملاحظات", "تم بواسطة"];
    const data = (rows || []).map((t) => [
      t.createdAt ? new Date(t.createdAt).toLocaleString("ar-EG") : "",
      t.type === "income" ? "إيراد" : "مصروف",
      t.title || "",
      t.category || "",
      t.paymentMethod || "",
      toNumber(t.amount),
      t.notes || "",
      t.createdBy || "",
    ]);
    downloadCsv("karma-treasury.csv", headers, data);
  };

  /* =============================
     Offers
  ============================= */
  function offerPreviewText(form) {
    const c = settings?.currencyCode || "EGP";
    const num = (v) => Number(v || 0);

    if (form.type === "percent") return `خصم ${num(form.percent)}%`;
    if (form.type === "fixed") return `خصم ${num(form.fixedAmount)} ${c}`;
    if (form.type === "buy_x_get_y") return `اشتري ${num(form.buyQty)} وخد ${num(form.getQty)} مجانًا`;
    return "عرض";
  }

  const saveOffer = async () => {
    if (!String(offerForm.title || "").trim()) return window.alert("أدخل اسم العرض");

    if (offerForm.type === "percent" && Number(offerForm.percent || 0) <= 0) return window.alert("أدخل نسبة خصم صحيحة");
    if (offerForm.type === "fixed" && Number(offerForm.fixedAmount || 0) <= 0) return window.alert("أدخل قيمة خصم صحيحة");
    if (offerForm.type === "buy_x_get_y") {
      if (Number(offerForm.buyQty || 0) <= 0 || Number(offerForm.getQty || 0) <= 0) return window.alert("أدخل X و Y بشكل صحيح");
    }

    if (offerForm.scope === "category" && !String(offerForm.categoryId || "").trim()) return window.alert("اختر القسم");
    if (offerForm.scope === "product" && !String(offerForm.productId || "").trim()) return window.alert("اختر المنتج");

    const code = String(offerForm.code || "").trim().toUpperCase();
    if (code) {
      const dup = (offers || []).find((o) => o.id !== editingOfferId && String(o.code || "").toUpperCase() === code);
      if (dup) return window.alert("كود العرض مستخدم بالفعل");
    }

    setSavingOffer(true);
    try {
      const now = Date.now();
      const catName = offerForm.scope === "category" ? String(offerForm.categoryId || "") : "";
      const product = offerForm.scope === "product" ? (products || []).find((p) => p.id === offerForm.productId) || null : null;

      const payload = {
        title: String(offerForm.title || "").trim(),
        code,
        type: offerForm.type,
        percent: Number(offerForm.percent || 0),
        fixedAmount: Number(offerForm.fixedAmount || 0),
        buyQty: Number(offerForm.buyQty || 0),
        getQty: Number(offerForm.getQty || 0),

        scope: offerForm.scope,
        categoryId: catName,
        categoryName: catName,

        productId: product ? product.id : "",
        productName: product ? product.name : "",

        applyOn: offerForm.applyOn,
        startDate: offerForm.startDate || "",
        endDate: offerForm.endDate || "",
        minCartTotal: Number(offerForm.minCartTotal || 0),
        maxDiscount: Number(offerForm.maxDiscount || 0),

        notes: String(offerForm.notes || "").trim(),
        isActive: !!offerForm.isActive,

        previewText: offerPreviewText(offerForm),
        createdAt: now,
        updatedAt: now,
        updatedBy: user?.name || "",
      };

      if (editingOfferId) {
        await update(ref(db, `offers/${editingOfferId}`), payload);

        await logActivity({
          type: "offer_update",
          title: "تعديل عرض",
          entityType: "offer",
          entityId: editingOfferId,
          entityLabel: payload.title,
          action: "update",
          meta: { code: payload.code, type: payload.type, scope: payload.scope },
        });

        window.alert("تم تعديل العرض ✅");
      } else {
        const newRef = push(ref(db, "offers"));
        await set(newRef, payload);

        await logActivity({
          type: "offer_create",
          title: "إضافة عرض",
          entityType: "offer",
          entityId: newRef.key,
          entityLabel: payload.title,
          action: "create",
          meta: { code: payload.code, type: payload.type, scope: payload.scope },
        });

        window.alert("تم حفظ العرض ✅");
      }

      setOfferForm(initialOfferForm);
      setEditingOfferId(null);
    } catch (e) {
      window.alert(e?.message || "خطأ أثناء حفظ العرض");
    } finally {
      setSavingOffer(false);
    }
  };

  const startEditOffer = (offer) => {
    if (!offer) return;
    setEditingOfferId(offer.id);
    setOfferForm({
      title: offer.title || "",
      code: offer.code || "",
      type: offer.type || "percent",
      percent: String(offer.percent ?? ""),
      fixedAmount: String(offer.fixedAmount ?? ""),
      buyQty: String(offer.buyQty ?? ""),
      getQty: String(offer.getQty ?? ""),
      scope: offer.scope || "all",
      categoryId: offer.categoryId || "",
      productId: offer.productId || "",
      applyOn: offer.applyOn || "items_only",
      startDate: offer.startDate || "",
      endDate: offer.endDate || "",
      minCartTotal: String(offer.minCartTotal ?? ""),
      maxDiscount: String(offer.maxDiscount ?? ""),
      notes: offer.notes || "",
      isActive: !!offer.isActive,
    });
  };

  const cancelEditOffer = () => {
    setEditingOfferId(null);
    setOfferForm(initialOfferForm);
  };

  const deleteOffer = async (id) => {
    const ok = window.confirm("هل تريد حذف هذا العرض؟");
    if (!ok) return;

    const o = (offers || []).find((x) => x.id === id);
    await remove(ref(db, `offers/${id}`));
    if (editingOfferId === id) cancelEditOffer();

    await logActivity({
      type: "offer_delete",
      title: "حذف عرض",
      entityType: "offer",
      entityId: id,
      entityLabel: o?.title || "",
      action: "delete",
    });
  };

  const exportOffersCsv = (rows = offers) => {
    const headers = ["اسم العرض", "الكود", "النوع", "النطاق", "القسم", "المنتج", "بداية", "نهاية", "حد أدنى", "حد أقصى", "مفعل"];
    const data = (rows || []).map((o) => [
      o.title || "",
      o.code || "",
      o.type || "",
      o.scope || "",
      o.categoryName || "",
      o.productName || "",
      o.startDate || "",
      o.endDate || "",
      toNumber(o.minCartTotal),
      toNumber(o.maxDiscount),
      o.isActive ? "نعم" : "لا",
    ]);
    downloadCsv("karma-offers.csv", headers, data);
  };

  /* =============================
     Shipments
  ============================= */
  const getShipmentProductPreview = (form) => {
    const productId = String(form.productId || "").trim();
    if (!productId) return null;

    const p = (products || []).find((x) => x.id === productId);
    if (!p) return null;

    const unitType = form.unitType === "package" ? "package" : "item";
    const qty = Math.max(1, toNumber(form.qty, 1));
    const unitPrice = unitType === "package" ? toNumber(p.salePackagePrice) : toNumber(p.saleItemPrice);
    const total = qty * unitPrice;

    return { productId: p.id, productName: p.name, unitType, qty, unitPrice, total };
  };

  const saveShipment = async () => {
    if (!String(shipmentForm.customerName || "").trim()) return window.alert("أدخل الاسم");
    if (!String(shipmentForm.phone || "").trim()) return window.alert("أدخل الهاتف");
    if (!String(shipmentForm.governorate || "").trim()) return window.alert("أدخل المحافظة");
    if (!String(shipmentForm.shippingCompany || "").trim()) return window.alert("اختر شركة الشحن");

    const entryDate = shipmentForm.entryDate || todayKey();
    const createdAt = Date.now();
    const preview = getShipmentProductPreview(shipmentForm);

    setSavingShipment(true);
    try {
      const newRef = push(ref(db, "shipments"));
      const payload = {
        customerName: String(shipmentForm.customerName || "").trim(),
        phone: String(shipmentForm.phone || "").trim(),
        governorate: String(shipmentForm.governorate || "").trim(),
        postOffice: String(shipmentForm.postOffice || "").trim(),
        trackingNumber: String(shipmentForm.trackingNumber || "").trim(),
        shippingCompany: shipmentForm.shippingCompany,
        status: shipmentForm.status || "pending",
        entryDate,
        notes: String(shipmentForm.notes || "").trim(),
        createdAt,
        createdBy: user?.name || "",
      };

      if (preview) {
        payload.productId = preview.productId;
        payload.productName = preview.productName;
        payload.unitType = preview.unitType;
        payload.qty = preview.qty;
        payload.unitPrice = preview.unitPrice;
        payload.total = preview.total;
      }

      await set(newRef, payload);

      await logActivity({
        type: "shipment_create",
        title: "تسجيل شحنة",
        entityType: "shipment",
        entityId: newRef.key,
        entityLabel: payload.trackingNumber || payload.customerName,
        action: "create",
        meta: { status: payload.status, shippingCompany: payload.shippingCompany },
      });

      setShipmentForm(initialShipmentForm);
      window.alert("تم حفظ الشحنة ✅");
    } catch (e) {
      window.alert(e?.message || "خطأ أثناء حفظ الشحنة");
    } finally {
      setSavingShipment(false);
    }
  };

  const updateShipmentStatus = async (shipmentId, status) => {
    if (!shipmentId) return;
    await update(ref(db, `shipments/${shipmentId}`), {
      status,
      updatedAt: Date.now(),
      updatedBy: user?.name || "",
    });

    await logActivity({
      type: "shipment_status_update",
      title: "تغيير حالة شحنة",
      entityType: "shipment",
      entityId: shipmentId,
      entityLabel: "",
      action: "update",
      meta: { status },
    });
  };

  const exportShipmentsCsv = (rows = shipments) => {
    const headers = ["تاريخ الإدخال", "الاسم", "الهاتف", "المحافظة", "مكتب البريد", "شركة الشحن", "رقم التتبع", "الحالة", "المنتج", "الكمية", "الإجمالي"];
    const data = (rows || []).map((s) => [
      s.entryDate || "",
      s.customerName || "",
      s.phone || "",
      s.governorate || "",
      s.postOffice || "",
      s.shippingCompany || "",
      s.trackingNumber || "",
      s.status || "",
      s.productName || "",
      s.qty || "",
      toNumber(s.total),
    ]);
    downloadCsv("karma-shipments.csv", headers, data);
  };

  /* =============================
     Employees
  ============================= */
  const saveEmployee = async () => {
    if (!String(employeeForm.name || "").trim()) return window.alert("أدخل اسم الموظف");
    if (toNumber(employeeForm.monthlySalary) <= 0) return window.alert("أدخل مرتب صحيح");

    setSavingEmployee(true);
    try {
      const newRef = push(ref(db, "employees"));
      await set(newRef, {
        name: String(employeeForm.name || "").trim(),
        phone: String(employeeForm.phone || "").trim(),
        roleTitle: String(employeeForm.roleTitle || "").trim(),
        monthlySalary: toNumber(employeeForm.monthlySalary),
        isActive: !!employeeForm.isActive,
        createdAt: Date.now(),
      });
      setEmployeeForm(initialEmployeeForm);

      await logActivity({
        type: "employee_create",
        title: "إضافة موظف",
        entityType: "employee",
        entityId: newRef.key,
        entityLabel: String(employeeForm.name || "").trim(),
        action: "create",
      });

      window.alert("تم حفظ الموظف ✅");
    } catch (e) {
      window.alert(e?.message || "خطأ أثناء حفظ الموظف");
    } finally {
      setSavingEmployee(false);
    }
  };

  const addEmployeeTransaction = async ({ employeeId, employeeName, type, amount, notes }) => {
    if (!employeeId) return window.alert("اختر الموظف");
    if (!type) return window.alert("اختر نوع العملية");
    if (toNumber(amount) <= 0) return window.alert("أدخل مبلغ صحيح");

    setSavingEmployeeTx(true);
    try {
      const createdAt = Date.now();
      const monthKey = getMonthKey(createdAt);
      const txRef = push(ref(db, "employeeTransactions"));
      await set(txRef, {
        employeeId,
        employeeName,
        type,
        amount: toNumber(amount),
        notes: String(notes || "").trim(),
        monthKey,
        createdAt,
        createdBy: user?.name || "",
      });

      await logActivity({
        type: "employee_tx_create",
        title: "حركة موظف",
        entityType: "employee",
        entityId: employeeId,
        entityLabel: employeeName || "",
        action: "create",
        meta: { txType: type, amount: toNumber(amount), notes: String(notes || "").trim() },
      });

      window.alert("تم حفظ العملية ✅");
    } catch (e) {
      window.alert(e?.message || "خطأ أثناء حفظ العملية");
    } finally {
      setSavingEmployeeTx(false);
    }
  };

  const getEmployeeLedger = (employeeId, monthKey = "") => {
    return (employeeTransactions || [])
      .filter((t) => t.employeeId === employeeId)
      .filter((t) => (monthKey ? t.monthKey === monthKey : true))
      .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  };

  const currentMonthKey = useMemo(() => getMonthKey(Date.now()), []);
  const totalMonthlySalaries = useMemo(() => (employees || []).filter((e) => e.isActive).reduce((s, e) => s + toNumber(e.monthlySalary), 0), [employees]);

  const currentMonthTxTotals = useMemo(() => {
    const list = (employeeTransactions || []).filter((t) => t.monthKey === currentMonthKey);
    const bonus = list.filter((t) => t.type === "bonus").reduce((s, t) => s + toNumber(t.amount), 0);
    const deduction = list.filter((t) => t.type === "deduction").reduce((s, t) => s + toNumber(t.amount), 0);
    const advance = list.filter((t) => t.type === "advance").reduce((s, t) => s + toNumber(t.amount), 0);
    return { bonus, deduction, advance };
  }, [employeeTransactions, currentMonthKey]);

  const netCurrentMonthPayroll = useMemo(() => {
    return totalMonthlySalaries + currentMonthTxTotals.bonus - currentMonthTxTotals.deduction - currentMonthTxTotals.advance;
  }, [totalMonthlySalaries, currentMonthTxTotals]);

  /* =============================
     Exports helpers
  ============================= */
  const exportInvoicesCsv = () => {
    const headers = ["رقم الفاتورة", "التاريخ", "العميل", "طريقة الدفع", "الإجمالي", "المدفوع", "المتبقي"];
    const rows = (invoices || []).map((i) => [
      i.invoiceNumber || "",
      i.createdAt ? new Date(i.createdAt).toLocaleString("ar-EG") : "",
      i.customerName || "",
      i.paymentMethod || "",
      toNumber(i.total),
      toNumber(i.paidAmount),
      toNumber(i.remainingAmount),
    ]);
    downloadCsv("karma-invoices.csv", headers, rows);
  };

  const exportProductsCsv = (rows = products) => {
    const headers = ["الاسم", "الباركود", "الفئة", "قطع", "عبوات", "إجمالي قطع", "الصلاحية"];
    const data = (rows || []).map((p) => [
      p.name || "",
      p.barcode || "",
      p.categoryName || p.category || "",
      toNumber(p.itemQty),
      toNumber(p.packageQty),
      toNumber(p.totalItems),
      p.expiryDate || "",
    ]);
    downloadCsv("karma-products.csv", headers, data);
  };

  /* =============================
     Context value (MUST include everything pages need)
  ============================= */
  const value = {
    // settings
    settings,
    setSettings,

    // taxes
    taxSettings,
    setTaxSettings,
    savingTaxSettings,
    saveTaxSettings,

    // ✅ Activity Log
    activityLogs,
    logActivity,

    // master data
    categories,
    categoryForm,
    setCategoryForm,
    savingCategory,
    saveCategory,
    deleteCategory,

    units,
    unitForm,
    setUnitForm,
    savingUnit,
    saveUnit,
    deleteUnit,

    warehouses,
    warehouseForm,
    setWarehouseForm,
    savingWarehouse,
    saveWarehouse,
    deleteWarehouse,
    setDefaultWarehouse,

    activeWarehouseId,
    setActiveWarehouseId,
    defaultWarehouse,

    // inventory
    inventoryMap,
    stockMovements,

    // products
    products,
    productsBase,
    filteredProducts,
    lowStockProducts,
    inventoryValue,
    productForm,
    setProductForm,
    editingProductId,
    startEditProduct,
    cancelEditProduct,
    savingProduct,
    saveProduct,
    deleteProduct,
    exportProductsCsv,

    // POS
    search,
    setSearch,
    cart,
    cartTotal,
    addToCart,
    increaseCartItem,
    decreaseCartItem,
    removeCartItem,
    clearCart,

    selectedCustomerId,
    setSelectedCustomerId,
    selectedCustomer,

    paymentMethod,
    setPaymentMethod,
    paidAmount,
    setPaidAmount,
    salePaidAmount,
    saleRemainingAmount,

    // sales
    invoices,
    salesReturns,
    checkoutLoading,
    checkout,
    createSalesReturn,
    exportInvoicesCsv,

    todayInvoices,
    todaySales,
    totalSalesReturns,
    todaySalesReturns,
    netTodaySales,

    // credit sales
    creditInvoices,
    creditStats,
    payCreditInstallment,
    exportCreditInvoicesCsv,

    // purchases
    purchaseInvoices,
    purchaseInvoiceForm,
    setPurchaseInvoiceForm,
    purchaseCart,
    setPurchaseCart,
    addPurchaseItem,
    increasePurchaseItem,
    decreasePurchaseItem,
    updatePurchaseItemPrice,
    removePurchaseItem,
    clearPurchaseCart,
    purchaseSubtotal,
    purchasePaidAmount,
    purchaseRemainingAmount,
    savingPurchaseInvoice,
    savePurchaseInvoice,

    // customers
    customers,
    customerForm,
    setCustomerForm,
    savingCustomer,
    saveCustomer,
    customerPayments,
    addCustomerPayment,
    customerBalances,
    getCustomerLedger,

    // suppliers
    suppliers,
    supplierForm,
    setSupplierForm,
    savingSupplier,
    saveSupplier,
    supplierPayments,
    addSupplierPayment,
    supplierBalances,
    getSupplierLedger,

    // wallet
    walletTransfers,
    walletTransferForm,
    setWalletTransferForm,
    savingWalletTransfer,
    saveWalletTransfer,

    // expenses
    expenses,
    expenseForm,
    setExpenseForm,
    savingExpense,
    saveExpense,
    exportExpensesCsv,
    totalExpenses,
    todayExpenses,
    currentMonthExpenses,

    // charging
    chargingOperations,
    chargingForm,
    setChargingForm,
    savingCharging,
    saveChargingOperation,

    // treasury
    treasuryTransactions,
    treasuryForm,
    setTreasuryForm,
    savingTreasury,
    saveTreasuryTransaction,
    exportTreasuryCsv,

    // offers
    offers,
    offerForm,
    setOfferForm,
    savingOffer,
    saveOffer,
    editingOfferId,
    startEditOffer,
    cancelEditOffer,
    deleteOffer,
    exportOffersCsv,

    // shipments
    shipments,
    shipmentForm,
    setShipmentForm,
    savingShipment,
    saveShipment,
    updateShipmentStatus,
    exportShipmentsCsv,

    // employees
    employees,
    employeeTransactions,
    employeeForm,
    setEmployeeForm,
    savingEmployee,
    saveEmployee,
    savingEmployeeTx,
    addEmployeeTransaction,
    getEmployeeLedger,
    totalMonthlySalaries,
    netCurrentMonthPayroll,
    currentMonthTxTotals,

    // cash drawer
    cashSessions,
    cashTransactions,
    activeCashSession,
    openCashSession,
    closeCashSession,
    addCashInOut,
    getSessionSummary,

    // print
    receiptData,
    setReceiptData,
    invoiceResetTick,
  };

  return <PosContext.Provider value={value}>{children}</PosContext.Provider>;
}