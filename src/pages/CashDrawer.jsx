
    import React, { useContext, useMemo, useState } from "react";
import {
  Wallet,
  PlayCircle,
  StopCircle,
  PlusCircle,
  MinusCircle,
  Receipt,
  ArrowDownCircle,
  ArrowUpCircle,
  Clock,
} from "lucide-react";
import { PosContext } from "../context/PosContext";
import { currency } from "../utils/format";
import Card from "../components/Card";
import SectionTitle from "../components/SectionTitle";

function toNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function fmt(ts) {
  return ts ? new Date(ts).toLocaleString("ar-EG") : "";
}

function typeLabel(t) {
  switch (t) {
    case "opening":
      return "رصيد افتتاحي";
    case "sale_cash":
      return "مبيعات نقدي";
    case "charging_cash":
      return "شحن وخدمات نقدي";
    case "expense_cash":
      return "مصروفات نقدي";
    case "customer_payment_cash":
      return "سداد عميل نقدي";
    case "refund_cash":
      return "مرتجع نقدي";
    case "cash_in":
      return "إيداع (Cash In)";
    case "cash_out":
      return "سحب (Cash Out)";
    default:
      return t || "عملية";
  }
}

export default function CashDrawer() {
  const {
    settings,
    cashSessions,
    cashTransactions,
    activeCashSession,
    openCashSession,
    closeCashSession,
    addCashInOut,
    getSessionSummary,
  } = useContext(PosContext);

  const [openingCash, setOpeningCash] = useState("");
  const [openNotes, setOpenNotes] = useState("");

  const [countedCash, setCountedCash] = useState("");
  const [closeNotes, setCloseNotes] = useState("");

  const [manualType, setManualType] = useState("cash_in"); // cash_in | cash_out
  const [manualAmount, setManualAmount] = useState("");
  const [manualNotes, setManualNotes] = useState("");

  // عرض آخر ورديات (الأحدث)
  const sessionsSorted = useMemo(() => {
    return [...cashSessions].sort((a, b) => (b.openedAt || 0) - (a.openedAt || 0));
  }, [cashSessions]);

  // جلسة حالية للعرض (لو في open نعرضها، غير كدا نعرض آخر واحدة)
  const currentSession = activeCashSession || sessionsSorted[0] || null;

  const summary = useMemo(() => {
    if (!currentSession) return null;
    return getSessionSummary(currentSession.id);
  }, [currentSession, getSessionSummary]);

  const sessionTx = useMemo(() => {
    if (!currentSession) return [];
    return cashTransactions
      .filter((t) => t.sessionId === currentSession.id)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [cashTransactions, currentSession]);

  const onOpen = async () => {
    await openCashSession({
      openingCash,
      notes: openNotes,
    });
    setOpeningCash("");
    setOpenNotes("");
  };

  const onClose = async () => {
    await closeCashSession({
      countedCash,
      notes: closeNotes,
    });
    setCountedCash("");
    setCloseNotes("");
  };

  const onAddManual = async () => {
    await addCashInOut({
      type: manualType,
      amount: manualAmount,
      notes: manualNotes,
    });
    setManualAmount("");
    setManualNotes("");
  };

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      {/* التحكم في الوردية */}
      <Card className="xl:col-span-4">
        <SectionTitle
          title="درج النقدية - الوردية"
          subtitle="فتح/إغلاق وردية 12 ساعة + حركة نقدية"
          icon={Wallet}
        />

        {!activeCashSession ? (
          <div className="space-y-4">
            <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              لا توجد وردية مفتوحة الآن. افتح وردية قبل أي عمليات نقدية.
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                رصيد افتتاحي (فكة)
              </label>
              <input
                type="number"
                value={openingCash}
                onChange={(e) => setOpeningCash(e.target.value)}
                placeholder="مثال: 500"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                ملاحظات (اختياري)
              </label>
              <input
                value={openNotes}
                onChange={(e) => setOpenNotes(e.target.value)}
                placeholder="مثال: وردية صباح"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
              />
            </div>

            <button
              onClick={onOpen}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700"
            >
              <PlayCircle className="h-4 w-4" />
              فتح وردية
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800">
              وردية مفتوحة الآن ✅
              <div className="mt-2 text-xs text-emerald-700">
                <Clock className="inline h-4 w-4" /> تم الفتح: {fmt(activeCashSession.openedAt)}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">افتتاحي</p>
                <p className="mt-2 font-black">
                  {currency(activeCashSession.openingCash || 0, settings.currencyCode)}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">المفروض في الدرج</p>
                <p className="mt-2 font-black">
                  {currency(summary?.expectedCash || 0, settings.currencyCode)}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="mb-3 font-black text-slate-900">إضافة حركة يدوية</p>

              <div className="grid grid-cols-1 gap-3">
                <select
                  value={manualType}
                  onChange={(e) => setManualType(e.target.value)}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
                >
                  <option value="cash_in">إيداع (Cash In)</option>
                  <option value="cash_out">سحب (Cash Out)</option>
                </select>

                <input
                  type="number"
                  value={manualAmount}
                  onChange={(e) => setManualAmount(e.target.value)}
                  placeholder="المبلغ"
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
                />

                <input
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                  placeholder="سبب العملية (اختياري)"
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
                />

                <button
                  onClick={onAddManual}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800"
                >
                  {manualType === "cash_in" ? <PlusCircle className="h-4 w-4" /> : <MinusCircle className="h-4 w-4" />}
                  حفظ الحركة
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="mb-3 font-black text-slate-900">إغلاق الوردية</p>

              <div className="space-y-3">
                <input
                  type="number"
                  value={countedCash}
                  onChange={(e) => setCountedCash(e.target.value)}
                  placeholder="الفلوس الفعلية في الدرج (بعد العد)"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
                />
                <input
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  placeholder="ملاحظات (اختياري)"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
                />

                <button
                  onClick={onClose}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-red-600 px-5 py-3 text-sm font-bold text-white hover:bg-red-700"
                >
                  <StopCircle className="h-4 w-4" />
                  إغلاق الوردية
                </button>

                <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                  <div className="flex items-center justify-between">
                    <span>المفروض:</span>
                    <b>{currency(summary?.expectedCash || 0, settings.currencyCode)}</b>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span>بعد العد:</span>
                    <b>{currency(toNumber(countedCash), settings.currencyCode)}</b>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span>الفرق:</span>
                    <b className={toNumber(countedCash) - (summary?.expectedCash || 0) >= 0 ? "text-emerald-700" : "text-red-700"}>
                      {currency(toNumber(countedCash) - (summary?.expectedCash || 0), settings.currencyCode)}
                    </b>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* ملخص + سجل الحركات */}
      <Card className="xl:col-span-8">
        <SectionTitle
          title="ملخص الدرج وسجل الحركات"
          subtitle="كل حركة نقدية مرتبطة بالوردية"
          icon={Receipt}
        />

        {!currentSession ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
            لا توجد ورديات بعد
          </div>
        ) : (
          <div className="space-y-5">
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-black text-slate-900">
                    وردية: {currentSession.sessionNumber || currentSession.id}
                  </p>
                  <p className="text-xs text-slate-600">
                    فتح: {fmt(currentSession.openedAt)}{" "}
                    {currentSession.closedAt ? `• إغلاق: ${fmt(currentSession.closedAt)}` : ""}
                  </p>
                  <p className="text-xs text-slate-600">
                    الكاشير: {currentSession.cashierName || "—"}
                  </p>
                </div>

                <div className="rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-900">
                  الحالة:{" "}
                  {currentSession.status === "open" ? (
                    <span className="text-emerald-700">مفتوحة</span>
                  ) : (
                    <span className="text-slate-700">مغلقة</span>
                  )}
                </div>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                <p className="text-sm text-slate-500">مبيعات نقدي</p>
                <p className="mt-2 text-xl font-black">
                  {currency(summary?.cashSales || 0, settings.currencyCode)}
                </p>
              </div>

              <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                <p className="text-sm text-slate-500">مصروفات نقدي</p>
                <p className="mt-2 text-xl font-black text-red-700">
                  {currency(summary?.cashExpenses || 0, settings.currencyCode)}
                </p>
              </div>

              <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                <p className="text-sm text-slate-500">المفروض في الدرج</p>
                <p className="mt-2 text-xl font-black text-emerald-700">
                  {currency(summary?.expectedCash || 0, settings.currencyCode)}
                </p>
              </div>
            </div>

            {/* Transactions */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="mb-3 font-black">سجل الحركات (الأحدث)</p>

              <div className="space-y-3">
                {sessionTx.slice(0, 40).map((t) => {
                  const isIn = t.type === "cash_in" || t.type === "sale_cash" || t.type === "charging_cash" || t.type === "customer_payment_cash" || t.type === "opening";
                  const Icon = isIn ? ArrowDownCircle : ArrowUpCircle;

                  return (
                    <div key={t.id} className="rounded-2xl bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Icon className={`h-4 w-4 ${isIn ? "text-emerald-700" : "text-red-700"}`} />
                            <p className="font-bold text-slate-900">{typeLabel(t.type)}</p>
                          </div>
                          <p className="mt-1 text-xs text-slate-500">{fmt(t.createdAt)}</p>
                          {t.notes ? <p className="mt-2 text-sm text-slate-600">{t.notes}</p> : null}
                          {t.referenceId ? (
                            <p className="mt-1 text-xs text-slate-500">
                              مرجع: {t.referenceType} • {t.referenceId}
                            </p>
                          ) : null}
                        </div>

                        <div className={`shrink-0 text-left text-sm font-black ${isIn ? "text-emerald-700" : "text-red-700"}`}>
                          {isIn ? "+" : "-"} {currency(t.amount || 0, settings.currencyCode)}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {sessionTx.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-slate-500">
                    لا توجد حركات لهذه الوردية
                  </div>
                ) : null}
              </div>
            </div>

            {/* Sessions list */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="mb-3 font-black">سجل الورديات</p>

              <div className="space-y-3">
                {sessionsSorted.slice(0, 20).map((s) => (
                  <div key={s.id} className="rounded-2xl bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-bold text-slate-900">
                          وردية: {s.sessionNumber || s.id} • {s.cashierName || "—"}
                        </p>
                        <p className="text-xs text-slate-500">
                          فتح: {fmt(s.openedAt)} {s.closedAt ? `• إغلاق: ${fmt(s.closedAt)}` : "• مفتوحة"}
                        </p>
                      </div>
                      <div className="text-left text-sm font-bold">
                        {s.status === "open" ? (
                          <span className="text-emerald-700">مفتوحة</span>
                        ) : (
                          <span className="text-slate-700">مغلقة</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {cashSessions.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-slate-500">
                    لا توجد ورديات بعد
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}