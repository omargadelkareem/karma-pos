
    import React, { useContext, useMemo, useState } from "react";
import {
  SmartphoneCharging,
  Save,
  Printer,
  Search,
  Receipt,
  CircleDollarSign,
} from "lucide-react";
import { PosContext } from "../context/PosContext";
import { currency } from "../utils/format";
import Card from "../components/Card";
import SectionTitle from "../components/SectionTitle";

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

function todayInputValue() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getLocalDateInputValue(timestamp) {
  if (!timestamp) return "";
  const d = new Date(timestamp);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function Charging() {
  const {
    settings,
    chargingOperations,
    chargingForm,
    setChargingForm,
    savingCharging,
    saveChargingOperation,
    receiptData,
  } = useContext(PosContext);

  const [query, setQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState(todayInputValue());

  const filteredOperations = useMemo(() => {
    const q = String(query || "").trim().toLowerCase();

    return chargingOperations.filter((item) => {
      const matchesDate = selectedDate
        ? getLocalDateInputValue(item.createdAt) === selectedDate
        : true;

      const matchesQuery = q
        ? `${item.targetNumber || ""} ${item.referenceNumber || ""} ${item.cashierName || ""}`.toLowerCase().includes(q)
        : true;

      return matchesDate && matchesQuery;
    });
  }, [chargingOperations, selectedDate, query]);

  const operationsTotal = useMemo(() => {
    return filteredOperations.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  }, [filteredOperations]);

  const feesTotal = useMemo(() => {
    return filteredOperations.reduce((sum, item) => sum + Number(item.fee || 0), 0);
  }, [filteredOperations]);

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      <Card className="xl:col-span-4">
        <SectionTitle
          title="الشحن والخدمات"
          subtitle="شحن رصيد وفواتير وخدمات أخرى"
          icon={SmartphoneCharging}
        />

        <div className="space-y-4">
          <select
            value={chargingForm.serviceType}
            onChange={(e) => setChargingForm((s) => ({ ...s, serviceType: e.target.value }))}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          >
            <option value="mobile_recharge">شحن رصيد</option>
            <option value="scratch_card">كارت شحن</option>
            <option value="landline">فاتورة أرضي</option>
            <option value="internet">فاتورة إنترنت</option>
            <option value="electricity">كهرباء</option>
            <option value="water">مياه</option>
            <option value="gas">غاز</option>
          </select>

          <select
            value={chargingForm.company}
            onChange={(e) => setChargingForm((s) => ({ ...s, company: e.target.value }))}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          >
            <option value="vodafone">فودافون</option>
            <option value="orange">أورنج</option>
            <option value="etisalat">اتصالات</option>
            <option value="we">WE</option>
          </select>

          <input
            value={chargingForm.targetNumber}
            onChange={(e) => setChargingForm((s) => ({ ...s, targetNumber: e.target.value }))}
            placeholder="رقم الموبايل / الأرضي / الحساب"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          />

          <div className="grid grid-cols-2 gap-4">
            <input
              type="number"
              value={chargingForm.amount}
              onChange={(e) => setChargingForm((s) => ({ ...s, amount: e.target.value }))}
              placeholder="المبلغ"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            />

            <input
              type="number"
              value={chargingForm.fee}
              onChange={(e) => setChargingForm((s) => ({ ...s, fee: e.target.value }))}
              placeholder="العمولة / الربح"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            />
          </div>

          <input
            value={chargingForm.referenceNumber}
            onChange={(e) => setChargingForm((s) => ({ ...s, referenceNumber: e.target.value }))}
            placeholder="رقم المرجع (اختياري)"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          />

          <textarea
            rows={3}
            value={chargingForm.notes}
            onChange={(e) => setChargingForm((s) => ({ ...s, notes: e.target.value }))}
            placeholder="ملاحظات"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          />

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <button
              onClick={saveChargingOperation}
              disabled={savingCharging}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white"
            >
              <Save className="h-4 w-4" />
              {savingCharging ? "جاري الحفظ..." : "حفظ العملية"}
            </button>

            <button
              onClick={() => window.print()}
              disabled={!receiptData}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700"
            >
              <Printer className="h-4 w-4" />
              طباعة إيصال
            </button>
          </div>
        </div>
      </Card>

      <Card className="xl:col-span-8">
        <SectionTitle
          title="سجل عمليات الشحن"
          subtitle="متابعة عمليات الشحن والخدمات"
          icon={Receipt}
        />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          />

          <div className="relative md:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحث بالرقم أو المرجع أو الكاشير"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 outline-none"
            />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-slate-500">
              <Receipt className="h-4 w-4" />
              <span className="text-sm">عدد العمليات</span>
            </div>
            <p className="mt-2 text-2xl font-black">{filteredOperations.length}</p>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-slate-500">
              <CircleDollarSign className="h-4 w-4" />
              <span className="text-sm">إجمالي المبالغ</span>
            </div>
            <p className="mt-2 text-xl font-black">
              {currency(operationsTotal, settings.currencyCode)}
            </p>
          </div>

          <div className="rounded-2xl bg-emerald-50 p-4">
            <div className="flex items-center gap-2 text-emerald-700">
              <CircleDollarSign className="h-4 w-4" />
              <span className="text-sm">إجمالي العمولات</span>
            </div>
            <p className="mt-2 text-xl font-black text-emerald-700">
              {currency(feesTotal, settings.currencyCode)}
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {filteredOperations.map((item) => (
            <div key={item.id} className="rounded-2xl bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-slate-900">
                    {getServiceTypeLabel(item.serviceType)} - {getCompanyLabel(item.company)}
                  </p>
                  <p className="text-sm text-slate-500">الرقم: {item.targetNumber}</p>
                  <p className="text-xs text-slate-500">
                    {item.createdAt ? new Date(item.createdAt).toLocaleString("ar-EG") : ""}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    المرجع: {item.referenceNumber || "—"} • الكاشير: {item.cashierName || "—"}
                  </p>
                </div>

                <div className="text-left text-sm">
                  <p>المبلغ: {currency(item.amount, settings.currencyCode)}</p>
                  <p>العمولة: {currency(item.fee, settings.currencyCode)}</p>
                  <p>الحالة: {item.status === "success" ? "ناجحة" : item.status}</p>
                </div>
              </div>
            </div>
          ))}

          {filteredOperations.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
              لا توجد عمليات في هذا اليوم
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}