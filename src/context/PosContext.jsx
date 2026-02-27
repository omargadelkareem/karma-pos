import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onValue, push, ref, remove, set, update } from "firebase/database";
import { db } from "../firebase/db";
import { AuthContext } from "./AuthContext";
import { todayKey } from "../utils/date";
import { downloadCsv } from "../utils/csv";

export const PosContext = createContext(null);

const initialProductForm = {
  name: "",
  barcode: "",
  category: "",
  packageName: "",
  itemsPerPackage: "",
  purchasePackagePrice: "",
  saleItemPrice: "",
  salePackagePrice: "",
  packageQty: "",
  itemQty: "",
  minPackageQty: "",
};

const initialCustomerForm = {
  name: "",
  phone: "",
  address: "",
  notes: "",
};

const initialSupplierForm = {
  name: "",
  phone: "",
  address: "",
  notes: "",
};

const initialWalletTransferForm = {
  personName: "",
  walletNumber: "",
  amount: "",
  transactionType: "send",
  isPaid: true,
  receiptNumber: "",
  notes: "",
};

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeProduct(product) {
  const itemsPerPackage = Math.max(1, toNumber(product.itemsPerPackage, 1));
  const purchasePackagePrice = Math.max(0, toNumber(product.purchasePackagePrice));
  const saleItemPrice = Math.max(0, toNumber(product.saleItemPrice));
  const salePackagePrice = Math.max(0, toNumber(product.salePackagePrice));
  const packageQty = Math.max(0, toNumber(product.packageQty));
  const itemQty = Math.max(0, toNumber(product.itemQty));
  const minPackageQty = Math.max(0, toNumber(product.minPackageQty));

  const purchaseItemPrice = purchasePackagePrice / itemsPerPackage;
  const totalItems = packageQty * itemsPerPackage + itemQty;
  const minItems = minPackageQty * itemsPerPackage;
  const isLowStock = totalItems <= minItems;
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
  };
}

function applySaleStockDeduction(product, invoiceItems) {
  const itemsPerPackage = Math.max(1, toNumber(product.itemsPerPackage, 1));
  let packageQty = Math.max(0, toNumber(product.packageQty));
  let itemQty = Math.max(0, toNumber(product.itemQty));

  const sellPackageQty = invoiceItems
    .filter((item) => item.unitType === "package")
    .reduce((sum, item) => sum + toNumber(item.qty), 0);

  const sellItemQty = invoiceItems
    .filter((item) => item.unitType === "item")
    .reduce((sum, item) => sum + toNumber(item.qty), 0);

  if (sellPackageQty > packageQty) {
    throw new Error(`الكمية غير كافية من ${product.name} (${product.packageName})`);
  }

  packageQty -= sellPackageQty;

  if (sellItemQty > itemQty) {
    const neededItems = sellItemQty - itemQty;
    const packagesToOpen = Math.ceil(neededItems / itemsPerPackage);

    if (packagesToOpen > packageQty) {
      throw new Error(`الكمية غير كافية من ${product.name} (قطعة)`);
    }

    packageQty -= packagesToOpen;
    itemQty += packagesToOpen * itemsPerPackage;
  }

  itemQty -= sellItemQty;

  return {
    packageQty,
    itemQty,
  };
}

function applySaleReturnToStock(product, returnItems) {
  let packageQty = Math.max(0, toNumber(product.packageQty));
  let itemQty = Math.max(0, toNumber(product.itemQty));

  const returnedPackageQty = returnItems
    .filter((item) => item.unitType === "package")
    .reduce((sum, item) => sum + toNumber(item.qty), 0);

  const returnedItemQty = returnItems
    .filter((item) => item.unitType === "item")
    .reduce((sum, item) => sum + toNumber(item.qty), 0);

  packageQty += returnedPackageQty;
  itemQty += returnedItemQty;

  return {
    packageQty,
    itemQty,
  };
}

export function PosProvider({ children }) {
  const { user } = useContext(AuthContext);

  const [settings, setSettings] = useState({
    storeName: "كرمة ماركت",
    currencyCode: "EGP",
  });

  const [products, setProducts] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [salesReturns, setSalesReturns] = useState([]);
  const [purchaseInvoices, setPurchaseInvoices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [customerPayments, setCustomerPayments] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [supplierPayments, setSupplierPayments] = useState([]);
  const [walletTransfers, setWalletTransfers] = useState([]);

  const [productForm, setProductForm] = useState(initialProductForm);
  const [customerForm, setCustomerForm] = useState(initialCustomerForm);
  const [supplierForm, setSupplierForm] = useState(initialSupplierForm);
  const [walletTransferForm, setWalletTransferForm] = useState(initialWalletTransferForm);

  const [search, setSearch] = useState("");
  const [cart, setCart] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paidAmount, setPaidAmount] = useState("");

  const [savingProduct, setSavingProduct] = useState(false);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [savingSupplier, setSavingSupplier] = useState(false);
  const [savingWalletTransfer, setSavingWalletTransfer] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const [invoiceResetTick, setInvoiceResetTick] = useState(0);

  const [purchaseInvoiceForm, setPurchaseInvoiceForm] = useState({
    supplierId: "",
    paidAmount: "",
    notes: "",
  });
  const [purchaseCart, setPurchaseCart] = useState([]);
  const [savingPurchaseInvoice, setSavingPurchaseInvoice] = useState(false);

  useEffect(() => {
    if (!user) return;

    const unsubProducts = onValue(ref(db, "products"), (snapshot) => {
      const data = snapshot.val() || {};
      const parsed = Object.entries(data)
        .map(([id, value]) => normalizeProduct({ id, ...value }))
        .sort((a, b) => (a.name || "").localeCompare(b.name || "", "ar"));
      setProducts(parsed);
    });

    const unsubInvoices = onValue(ref(db, "invoices"), (snapshot) => {
      const data = snapshot.val() || {};
      const parsed = Object.entries(data)
        .map(([id, value]) => ({ id, ...value }))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setInvoices(parsed);
    });

    const unsubSalesReturns = onValue(ref(db, "salesReturns"), (snapshot) => {
      const data = snapshot.val() || {};
      const parsed = Object.entries(data)
        .map(([id, value]) => ({ id, ...value }))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setSalesReturns(parsed);
    });

    const unsubPurchaseInvoices = onValue(ref(db, "purchaseInvoices"), (snapshot) => {
      const data = snapshot.val() || {};
      const parsed = Object.entries(data)
        .map(([id, value]) => ({ id, ...value }))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setPurchaseInvoices(parsed);
    });

    const unsubCustomers = onValue(ref(db, "customers"), (snapshot) => {
      const data = snapshot.val() || {};
      const parsed = Object.entries(data)
        .map(([id, value]) => ({ id, ...value }))
        .sort((a, b) => (a.name || "").localeCompare(b.name || "", "ar"));
      setCustomers(parsed);
    });

    const unsubCustomerPayments = onValue(ref(db, "customerPayments"), (snapshot) => {
      const data = snapshot.val() || {};
      const parsed = Object.entries(data)
        .map(([id, value]) => ({ id, ...value }))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setCustomerPayments(parsed);
    });

    const unsubSuppliers = onValue(ref(db, "suppliers"), (snapshot) => {
      const data = snapshot.val() || {};
      const parsed = Object.entries(data)
        .map(([id, value]) => ({ id, ...value }))
        .sort((a, b) => (a.name || "").localeCompare(b.name || "", "ar"));
      setSuppliers(parsed);
    });

    const unsubSupplierPayments = onValue(ref(db, "supplierPayments"), (snapshot) => {
      const data = snapshot.val() || {};
      const parsed = Object.entries(data)
        .map(([id, value]) => ({ id, ...value }))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setSupplierPayments(parsed);
    });

    const unsubWalletTransfers = onValue(ref(db, "walletTransfers"), (snapshot) => {
      const data = snapshot.val() || {};
      const parsed = Object.entries(data)
        .map(([id, value]) => ({ id, ...value }))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setWalletTransfers(parsed);
    });

    const unsubSettings = onValue(ref(db, "settings/general"), (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setSettings((prev) => ({ ...prev, ...data }));
      }
    });

    return () => {
      unsubProducts();
      unsubInvoices();
      unsubSalesReturns();
      unsubPurchaseInvoices();
      unsubCustomers();
      unsubCustomerPayments();
      unsubSuppliers();
      unsubSupplierPayments();
      unsubWalletTransfers();
      unsubSettings();
    };
  }, [user]);

  const filteredProducts = useMemo(() => {
    const q = String(search || "").trim().toLowerCase();
    if (!q) return products;

    return products.filter((item) => {
      const text = `${item.name || ""} ${item.barcode || ""} ${item.category || ""}`.toLowerCase();
      return text.includes(q);
    });
  }, [products, search]);

  const selectedCustomer = useMemo(
    () => customers.find((item) => item.id === selectedCustomerId) || null,
    [customers, selectedCustomerId]
  );

  const selectedSupplier = useMemo(
    () => suppliers.find((item) => item.id === purchaseInvoiceForm.supplierId) || null,
    [suppliers, purchaseInvoiceForm.supplierId]
  );

  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + toNumber(item.total), 0);
  }, [cart]);

  const salePaidAmount = useMemo(() => {
    if (paymentMethod === "credit") return 0;

    if (paymentMethod === "cash" || paymentMethod === "wallet" || paymentMethod === "card") {
      const num = toNumber(paidAmount, cartTotal);
      return Math.max(0, Math.min(num, cartTotal));
    }

    return Math.max(0, Math.min(toNumber(paidAmount), cartTotal));
  }, [paymentMethod, paidAmount, cartTotal]);

  const saleRemainingAmount = useMemo(() => {
    return Math.max(0, cartTotal - salePaidAmount);
  }, [cartTotal, salePaidAmount]);

  const inventoryValue = useMemo(() => {
    return products.reduce((sum, item) => sum + toNumber(item.stockValue), 0);
  }, [products]);

  const lowStockProducts = useMemo(() => {
    return products.filter((item) => item.isLowStock);
  }, [products]);

  const todayInvoices = useMemo(() => {
    return invoices.filter((item) => item.dateKey === todayKey());
  }, [invoices]);

  const todaySales = useMemo(() => {
    return todayInvoices.reduce((sum, item) => sum + toNumber(item.total), 0);
  }, [todayInvoices]);

  const totalSalesReturns = useMemo(() => {
    return salesReturns.reduce((sum, item) => sum + toNumber(item.total), 0);
  }, [salesReturns]);

  const todaySalesReturns = useMemo(() => {
    return salesReturns
      .filter((item) => {
        const date = item.createdAt
          ? new Date(item.createdAt).toISOString().slice(0, 10)
          : "";
        return date === todayKey();
      })
      .reduce((sum, item) => sum + toNumber(item.total), 0);
  }, [salesReturns]);

  const netTodaySales = useMemo(() => {
    return todaySales - todaySalesReturns;
  }, [todaySales, todaySalesReturns]);

  const customerBalances = useMemo(() => {
    const map = {};
    customers.forEach((c) => {
      map[c.id] = 0;
    });

    invoices.forEach((inv) => {
      if (inv.customerId) {
        map[inv.customerId] = (map[inv.customerId] || 0) + toNumber(inv.remainingAmount);
      }
    });

    customerPayments.forEach((pay) => {
      if (pay.customerId) {
        map[pay.customerId] = (map[pay.customerId] || 0) - toNumber(pay.amount);
      }
    });

    return map;
  }, [customers, invoices, customerPayments]);

  const supplierBalances = useMemo(() => {
    const map = {};
    suppliers.forEach((s) => {
      map[s.id] = 0;
    });

    purchaseInvoices.forEach((inv) => {
      if (inv.supplierId) {
        map[inv.supplierId] = (map[inv.supplierId] || 0) + toNumber(inv.remainingAmount);
      }
    });

    supplierPayments.forEach((pay) => {
      if (pay.supplierId) {
        map[pay.supplierId] = (map[pay.supplierId] || 0) - toNumber(pay.amount);
      }
    });

    return map;
  }, [suppliers, purchaseInvoices, supplierPayments]);

  const addToCart = (product, unitType) => {
    if (!product || !product.id) {
      window.alert("بيانات المنتج غير صحيحة");
      return;
    }

    const unitName = unitType === "package" ? product.packageName : "قطعة";
    const unitPrice =
      unitType === "package"
        ? toNumber(product.salePackagePrice)
        : toNumber(product.saleItemPrice);

    const key = `${product.id}-${unitType}`;
    const availablePackageQty = toNumber(product.packageQty);
    const availableTotalItems = toNumber(product.totalItems);

    if (unitType === "package" && availablePackageQty <= 0) {
      window.alert(`لا يوجد مخزون متاح من ${product.packageName}`);
      return;
    }

    if (unitType === "item" && availableTotalItems <= 0) {
      window.alert("لا يوجد مخزون متاح من هذا المنتج");
      return;
    }

    setCart((prev) => {
      const exists = prev.find((item) => item.key === key);

      if (exists) {
        return prev.map((item) =>
          item.key === key
            ? {
                ...item,
                qty: item.qty + 1,
                total: (item.qty + 1) * item.unitPrice,
              }
            : item
        );
      }

      return [
        ...prev,
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

  const increaseCartItem = (key) => {
    setCart((prev) =>
      prev.map((item) =>
        item.key === key
          ? {
              ...item,
              qty: item.qty + 1,
              total: (item.qty + 1) * item.unitPrice,
            }
          : item
      )
    );
  };

  const decreaseCartItem = (key) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.key === key
            ? {
                ...item,
                qty: item.qty - 1,
                total: (item.qty - 1) * item.unitPrice,
              }
            : item
        )
        .filter((item) => item.qty > 0)
    );
  };

  const removeCartItem = (key) => {
    setCart((prev) => prev.filter((item) => item.key !== key));
  };

  const clearCart = () => {
    setCart([]);
    setSelectedCustomerId("");
    setPaymentMethod("cash");
    setPaidAmount("");
  };

  const saveProduct = async () => {
    if (!productForm.name.trim()) {
      window.alert("من فضلك أدخل اسم المنتج");
      return;
    }

    if (!productForm.packageName.trim()) {
      window.alert("من فضلك أدخل اسم العبوة");
      return;
    }

    if (toNumber(productForm.itemsPerPackage) <= 0) {
      window.alert("من فضلك أدخل عدد القطع داخل العبوة");
      return;
    }

    if (toNumber(productForm.purchasePackagePrice) <= 0) {
      window.alert("من فضلك أدخل سعر شراء العبوة");
      return;
    }

    if (toNumber(productForm.saleItemPrice) <= 0) {
      window.alert("من فضلك أدخل سعر بيع القطعة");
      return;
    }

    if (toNumber(productForm.salePackagePrice) <= 0) {
      window.alert("من فضلك أدخل سعر بيع العبوة");
      return;
    }

    setSavingProduct(true);

    try {
      const payload = normalizeProduct({
        name: productForm.name.trim(),
        barcode: productForm.barcode.trim(),
        category: productForm.category.trim(),
        packageName: productForm.packageName.trim(),
        itemsPerPackage: Math.max(1, toNumber(productForm.itemsPerPackage, 1)),
        purchasePackagePrice: Math.max(0, toNumber(productForm.purchasePackagePrice)),
        saleItemPrice: Math.max(0, toNumber(productForm.saleItemPrice)),
        salePackagePrice: Math.max(0, toNumber(productForm.salePackagePrice)),
        packageQty: Math.max(0, toNumber(productForm.packageQty)),
        itemQty: Math.max(0, toNumber(productForm.itemQty)),
        minPackageQty: Math.max(0, toNumber(productForm.minPackageQty)),
        createdAt: Date.now(),
      });

      const newRef = push(ref(db, "products"));
      await set(newRef, {
        name: payload.name,
        barcode: payload.barcode,
        category: payload.category,
        packageName: payload.packageName,
        itemsPerPackage: payload.itemsPerPackage,
        purchasePackagePrice: payload.purchasePackagePrice,
        saleItemPrice: payload.saleItemPrice,
        salePackagePrice: payload.salePackagePrice,
        packageQty: payload.packageQty,
        itemQty: payload.itemQty,
        minPackageQty: payload.minPackageQty,
        createdAt: payload.createdAt,
      });

      setProductForm(initialProductForm);
    } catch (error) {
      window.alert(error?.message || "حدث خطأ أثناء حفظ المنتج");
    } finally {
      setSavingProduct(false);
    }
  };

  const deleteProduct = async (id) => {
    const ok = window.confirm("هل تريد حذف هذا المنتج؟");
    if (!ok) return;

    await remove(ref(db, `products/${id}`));
    setCart((prev) => prev.filter((item) => item.productId !== id));
  };

  const saveCustomer = async () => {
    if (!customerForm.name.trim()) {
      window.alert("من فضلك أدخل اسم العميل");
      return;
    }

    setSavingCustomer(true);
    try {
      const newRef = push(ref(db, "customers"));
      await set(newRef, {
        name: customerForm.name.trim(),
        phone: customerForm.phone.trim(),
        address: customerForm.address.trim(),
        notes: customerForm.notes.trim(),
        createdAt: Date.now(),
      });
      setCustomerForm(initialCustomerForm);
    } catch (error) {
      window.alert(error?.message || "حدث خطأ أثناء حفظ العميل");
    } finally {
      setSavingCustomer(false);
    }
  };

  const saveSupplier = async () => {
    if (!supplierForm.name.trim()) {
      window.alert("من فضلك أدخل اسم المورد");
      return;
    }

    setSavingSupplier(true);
    try {
      const newRef = push(ref(db, "suppliers"));
      await set(newRef, {
        name: supplierForm.name.trim(),
        phone: supplierForm.phone.trim(),
        address: supplierForm.address.trim(),
        notes: supplierForm.notes.trim(),
        createdAt: Date.now(),
      });
      setSupplierForm(initialSupplierForm);
    } catch (error) {
      window.alert(error?.message || "حدث خطأ أثناء حفظ المورد");
    } finally {
      setSavingSupplier(false);
    }
  };

  const addCustomerPayment = async ({ customerId, customerName, amount, notes }) => {
  if (!customerId || toNumber(amount) <= 0) {
    window.alert("من فضلك اختر العميل وأدخل مبلغ صحيح");
    return;
  }

  const createdAt = Date.now();
  const receiptNumber = `CP-${createdAt}`;

  const newRef = push(ref(db, "customerPayments"));
  const payload = {
    customerId,
    customerName,
    amount: toNumber(amount),
    notes: notes || "",
    createdAt,
    createdBy: user?.name || "",
    receiptNumber,
  };

  await set(newRef, payload);

  // لتجهيز إيصال طباعة السداد
  setReceiptData({
    type: "customer_payment",
    createdAt,
    receiptNumber,
    customerName,
    total: toNumber(amount),
    paidAmount: toNumber(amount),
    remainingAmount: 0,
    items: [
      {
        productName: "سداد من العميل",
        unitName: "عملية سداد",
        unitPrice: toNumber(amount),
        qty: 1,
        total: toNumber(amount),
      },
    ],
  });
};
  const addSupplierPayment = async ({ supplierId, supplierName, amount, notes }) => {
    if (!supplierId || toNumber(amount) <= 0) {
      window.alert("من فضلك اختر المورد وأدخل مبلغ صحيح");
      return;
    }

    const newRef = push(ref(db, "supplierPayments"));
    await set(newRef, {
      supplierId,
      supplierName,
      amount: toNumber(amount),
      notes: notes || "",
      createdAt: Date.now(),
      createdBy: user?.name || "",
    });
  };

  const saveWalletTransfer = async () => {
    if (!walletTransferForm.personName.trim()) {
      window.alert("من فضلك أدخل الاسم");
      return;
    }

    if (!walletTransferForm.walletNumber.trim()) {
      window.alert("من فضلك أدخل رقم المحفظة");
      return;
    }

    if (toNumber(walletTransferForm.amount) <= 0) {
      window.alert("من فضلك أدخل مبلغ صحيح");
      return;
    }

    setSavingWalletTransfer(true);
    try {
      const newRef = push(ref(db, "walletTransfers"));
      await set(newRef, {
        personName: walletTransferForm.personName.trim(),
        walletNumber: walletTransferForm.walletNumber.trim(),
        amount: toNumber(walletTransferForm.amount),
        transactionType: walletTransferForm.transactionType,
        isPaid: !!walletTransferForm.isPaid,
        receiptNumber: walletTransferForm.receiptNumber.trim(),
        notes: walletTransferForm.notes.trim(),
        createdAt: Date.now(),
        createdBy: user?.name || "",
      });
      setWalletTransferForm(initialWalletTransferForm);
    } catch (error) {
      window.alert(error?.message || "حدث خطأ أثناء حفظ التحويل");
    } finally {
      setSavingWalletTransfer(false);
    }
  };

  const addPurchaseItem = (productId) => {
    const product = products.find((item) => item.id === productId);
    if (!product) return;

    setPurchaseCart((prev) => {
      const exists = prev.find((item) => item.productId === product.id);
      if (exists) {
        return prev.map((item) =>
          item.productId === product.id
            ? {
                ...item,
                packageQty: item.packageQty + 1,
                total: (item.packageQty + 1) * item.purchasePackagePrice,
              }
            : item
        );
      }

      return [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          packageName: product.packageName,
          packageQty: 1,
          purchasePackagePrice: toNumber(product.purchasePackagePrice),
          total: toNumber(product.purchasePackagePrice),
        },
      ];
    });
  };

  const increasePurchaseItem = (productId) => {
    setPurchaseCart((prev) =>
      prev.map((item) =>
        item.productId === productId
          ? {
              ...item,
              packageQty: item.packageQty + 1,
              total: (item.packageQty + 1) * item.purchasePackagePrice,
            }
          : item
      )
    );
  };

  const decreasePurchaseItem = (productId) => {
    setPurchaseCart((prev) =>
      prev
        .map((item) =>
          item.productId === productId
            ? {
                ...item,
                packageQty: item.packageQty - 1,
                total: (item.packageQty - 1) * item.purchasePackagePrice,
              }
            : item
        )
        .filter((item) => item.packageQty > 0)
    );
  };

  const updatePurchaseItemPrice = (productId, price) => {
    setPurchaseCart((prev) =>
      prev.map((item) =>
        item.productId === productId
          ? {
              ...item,
              purchasePackagePrice: toNumber(price),
              total: item.packageQty * toNumber(price),
            }
          : item
      )
    );
  };

  const removePurchaseItem = (productId) => {
    setPurchaseCart((prev) => prev.filter((item) => item.productId !== productId));
  };

  const clearPurchaseCart = () => {
    setPurchaseCart([]);
    setPurchaseInvoiceForm({
      supplierId: "",
      paidAmount: "",
      notes: "",
    });
  };

  const purchaseSubtotal = useMemo(() => {
    return purchaseCart.reduce((sum, item) => sum + toNumber(item.total), 0);
  }, [purchaseCart]);

  const purchasePaidAmount = useMemo(() => {
    return Math.max(0, Math.min(toNumber(purchaseInvoiceForm.paidAmount), purchaseSubtotal));
  }, [purchaseInvoiceForm.paidAmount, purchaseSubtotal]);

  const purchaseRemainingAmount = useMemo(() => {
    return Math.max(0, purchaseSubtotal - purchasePaidAmount);
  }, [purchaseSubtotal, purchasePaidAmount]);

  const savePurchaseInvoice = async () => {
    if (!selectedSupplier) {
      window.alert("من فضلك اختر المورد");
      return;
    }

    if (purchaseCart.length === 0) {
      window.alert("من فضلك أضف منتجات إلى فاتورة الشراء");
      return;
    }

    setSavingPurchaseInvoice(true);

    try {
      const stockUpdates = {};

      purchaseCart.forEach((item) => {
        const product = products.find((p) => p.id === item.productId);
        if (!product) return;

        stockUpdates[`products/${item.productId}/packageQty`] =
          toNumber(product.packageQty) + toNumber(item.packageQty);

        stockUpdates[`products/${item.productId}/purchasePackagePrice`] =
          toNumber(item.purchasePackagePrice);
      });

      const createdAt = Date.now();
      const invoiceRef = push(ref(db, "purchaseInvoices"));
      const invoiceNumber = `شراء-${createdAt}`;

      const payload = {
        invoiceNumber,
        createdAt,
        supplierId: selectedSupplier.id,
        supplierName: selectedSupplier.name,
        items: purchaseCart.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          packageName: item.packageName,
          packageQty: toNumber(item.packageQty),
          purchasePackagePrice: toNumber(item.purchasePackagePrice),
          total: toNumber(item.total),
        })),
        subtotal: purchaseSubtotal,
        paidAmount: purchasePaidAmount,
        remainingAmount: purchaseRemainingAmount,
        paymentStatus:
          purchaseRemainingAmount === 0
            ? "paid"
            : purchasePaidAmount > 0
            ? "partial"
            : "credit",
        notes: purchaseInvoiceForm.notes || "",
        createdBy: user?.name || "",
      };

      await set(invoiceRef, payload);
      await update(ref(db), stockUpdates);
      clearPurchaseCart();
    } catch (error) {
      window.alert(error?.message || "حدث خطأ أثناء حفظ فاتورة الشراء");
    } finally {
      setSavingPurchaseInvoice(false);
    }
  };

  const checkout = async () => {
    if (cart.length === 0) {
      window.alert("الفاتورة فارغة");
      return;
    }

    if (saleRemainingAmount > 0 && !selectedCustomer) {
      window.alert("من فضلك اختر العميل لأن هناك مبلغًا متبقيًا");
      return;
    }

    setCheckoutLoading(true);

    try {
      const groupedByProduct = cart.reduce((acc, item) => {
        if (!acc[item.productId]) acc[item.productId] = [];
        acc[item.productId].push(item);
        return acc;
      }, {});

      const stockUpdates = {};
      const invoiceItems = cart.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        unitType: item.unitType,
        unitName: item.unitName,
        unitPrice: toNumber(item.unitPrice),
        qty: toNumber(item.qty),
        total: toNumber(item.total),
        barcode: item.barcode || "",
      }));

      for (const productId of Object.keys(groupedByProduct)) {
        const product = products.find((item) => item.id === productId);
        if (!product) {
          throw new Error("أحد المنتجات غير موجود");
        }

        const nextStock = applySaleStockDeduction(product, groupedByProduct[productId]);
        stockUpdates[`products/${productId}/packageQty`] = nextStock.packageQty;
        stockUpdates[`products/${productId}/itemQty`] = nextStock.itemQty;
      }

      const createdAt = Date.now();
      const invoiceRef = push(ref(db, "invoices"));
      const invoiceNumber = `فاتورة-${createdAt}`;

      const invoicePayload = {
        invoiceNumber,
        createdAt,
        dateKey: todayKey(),
        cashierId: user?.id || "",
        cashierName: user?.name || "",
        cashierPhone: user?.phone || "",
        customerId: selectedCustomer?.id || "",
        customerName: selectedCustomer?.name || "",
        paymentMethod,
        items: invoiceItems,
        total: cartTotal,
        paidAmount: salePaidAmount,
        remainingAmount: saleRemainingAmount,
        paymentStatus:
          saleRemainingAmount === 0
            ? "paid"
            : salePaidAmount > 0
            ? "partial"
            : "credit",
      };

      await set(invoiceRef, invoicePayload);
      await update(ref(db), stockUpdates);

      setReceiptData(invoicePayload);
      clearCart();
      setSearch("");
      setInvoiceResetTick((prev) => prev + 1);
    } catch (error) {
      window.alert(error?.message || "حدث خطأ أثناء حفظ الفاتورة");
    } finally {
      setCheckoutLoading(false);
    }
  };

  const createSalesReturn = async ({ invoice, items }) => {
    if (!invoice || !invoice.id) {
      window.alert("الفاتورة غير صحيحة");
      return;
    }

    if (!items || items.length === 0) {
      window.alert("لا توجد أصناف مرتجعة");
      return;
    }

    try {
      const stockUpdates = {};

      const groupedByProduct = items.reduce((acc, item) => {
        if (!acc[item.productId]) acc[item.productId] = [];
        acc[item.productId].push(item);
        return acc;
      }, {});

      for (const productId of Object.keys(groupedByProduct)) {
        const product = products.find((p) => p.id === productId);
        if (!product) continue;

        const nextStock = applySaleReturnToStock(product, groupedByProduct[productId]);
        stockUpdates[`products/${productId}/packageQty`] = nextStock.packageQty;
        stockUpdates[`products/${productId}/itemQty`] = nextStock.itemQty;
      }

      const total = items.reduce((sum, item) => sum + toNumber(item.total), 0);

      const returnRef = push(ref(db, "salesReturns"));
      const payload = {
        originalInvoiceId: invoice.id,
        originalInvoiceNumber: invoice.invoiceNumber || "",
        createdAt: Date.now(),
        createdBy: user?.name || "",
        customerId: invoice.customerId || "",
        customerName: invoice.customerName || "",
        items: items.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          unitType: item.unitType,
          unitName: item.unitName,
          unitPrice: toNumber(item.unitPrice),
          qty: toNumber(item.qty),
          total: toNumber(item.total),
        })),
        total,
      };

      await set(returnRef, payload);
      await update(ref(db), stockUpdates);

      window.alert("تم حفظ مرتجع البيع وإرجاع الكمية للمخزن");
    } catch (error) {
      window.alert(error?.message || "حدث خطأ أثناء حفظ المرتجع");
    }
  };

  const getCustomerLedger = (customerId) => {
  const salesEntries = invoices
    .filter((item) => item.customerId === customerId)
    .map((item) => ({
      id: item.id,
      type: "sale_invoice",
      label: `فاتورة بيع - ${item.invoiceNumber}`,
      debit: toNumber(item.remainingAmount), // عليه
      credit: 0, // له
      totalInvoice: toNumber(item.total),
      paidAmount: toNumber(item.paidAmount),
      remainingAmount: toNumber(item.remainingAmount),
      paymentMethod: item.paymentMethod || "",
      items: item.items || [],
      invoiceNumber: item.invoiceNumber || "",
      createdAt: item.createdAt,
    }));

  const paymentEntries = customerPayments
    .filter((item) => item.customerId === customerId)
    .map((item) => ({
      id: item.id,
      type: "payment",
      label: "سداد عميل",
      debit: 0,
      credit: toNumber(item.amount),
      amount: toNumber(item.amount),
      notes: item.notes || "",
      createdAt: item.createdAt,
      receiptNumber: item.receiptNumber || "",
    }));

  return [...salesEntries, ...paymentEntries].sort((a, b) => a.createdAt - b.createdAt);
};

  const getSupplierLedger = (supplierId) => {
    const invoiceEntries = purchaseInvoices
      .filter((item) => item.supplierId === supplierId)
      .map((item) => ({
        id: item.id,
        type: "purchase_invoice",
        label: `فاتورة شراء - ${item.invoiceNumber}`,
        debit: toNumber(item.remainingAmount),
        credit: 0,
        createdAt: item.createdAt,
      }));

    const paymentEntries = supplierPayments
      .filter((item) => item.supplierId === supplierId)
      .map((item) => ({
        id: item.id,
        type: "payment",
        label: "سداد مورد",
        debit: 0,
        credit: toNumber(item.amount),
        createdAt: item.createdAt,
      }));

    return [...invoiceEntries, ...paymentEntries].sort((a, b) => a.createdAt - b.createdAt);
  };

  const exportInvoicesCsv = () => {
    const headers = [
      "رقم الفاتورة",
      "التاريخ",
      "العميل",
      "طريقة الدفع",
      "الإجمالي",
      "المدفوع",
      "المتبقي",
    ];

    const rows = invoices.map((item) => [
      item.invoiceNumber,
      item.createdAt ? new Date(item.createdAt).toLocaleString("ar-EG") : "",
      item.customerName || "",
      item.paymentMethod || "",
      item.total || 0,
      item.paidAmount || 0,
      item.remainingAmount || 0,
    ]);

    downloadCsv("karma-invoices.csv", headers, rows);
  };

  const value = {
    settings,
    setSettings,

    products,
    filteredProducts,
    lowStockProducts,
    invoices,
    salesReturns,
    purchaseInvoices,
    customers,
    customerPayments,
    suppliers,
    supplierPayments,
    walletTransfers,

    productForm,
    setProductForm,
    customerForm,
    setCustomerForm,
    supplierForm,
    setSupplierForm,
    walletTransferForm,
    setWalletTransferForm,

    search,
    setSearch,

    cart,
    cartTotal,
    receiptData,
    invoiceResetTick,

    selectedCustomerId,
    setSelectedCustomerId,
    selectedCustomer,
    paymentMethod,
    setPaymentMethod,
    paidAmount,
    setPaidAmount,
    salePaidAmount,
    saleRemainingAmount,

    purchaseInvoiceForm,
    setPurchaseInvoiceForm,
    purchaseCart,
    purchaseSubtotal,
    purchasePaidAmount,
    purchaseRemainingAmount,

    inventoryValue,
    todayInvoices,
    todaySales,
    totalSalesReturns,
    todaySalesReturns,
    netTodaySales,
    customerBalances,
    supplierBalances,

    savingProduct,
    savingCustomer,
    savingSupplier,
    savingWalletTransfer,
    checkoutLoading,
    savingPurchaseInvoice,

    addToCart,
    increaseCartItem,
    decreaseCartItem,
    removeCartItem,
    clearCart,

    saveProduct,
    deleteProduct,
    saveCustomer,
    saveSupplier,
    addCustomerPayment,
    addSupplierPayment,

    addPurchaseItem,
    increasePurchaseItem,
    decreasePurchaseItem,
    updatePurchaseItemPrice,
    removePurchaseItem,
    clearPurchaseCart,
    savePurchaseInvoice,

    saveWalletTransfer,
    checkout,
    createSalesReturn,
    exportInvoicesCsv,

    getCustomerLedger,
    getSupplierLedger,
  };

  return <PosContext.Provider value={value}>{children}</PosContext.Provider>;
}