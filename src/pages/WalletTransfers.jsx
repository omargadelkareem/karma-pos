import React, { useContext } from "react";
import { Save, Wallet } from "lucide-react";
import { PosContext } from "../context/PosContext";
import { currency } from "../utils/format";
import Card from "../components/Card";
import SectionTitle from "../components/SectionTitle";

export default function WalletTransfers() {
  const {
    settings,
    walletTransferForm,
    setWalletTransferForm,
    saveWalletTransfer,
    savingWalletTransfer,
    walletTransfers,
  } = useContext(PosContext);

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      <Card className="xl:col-span-4">
        <SectionTitle title="تحويل محفظة" subtitle="تسجيل تحويل أو استلام" icon={Wallet} />

        <div className="space-y-4">
          <input
            value={walletTransferForm.personName}
            onChange={(e) => setWalletTransferForm((s) => ({ ...s, personName: e.target.value }))}
            placeholder="الاسم"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          />
          <input
            value={walletTransferForm.walletNumber}
            onChange={(e) => setWalletTransferForm((s) => ({ ...s, walletNumber: e.target.value }))}
            placeholder="رقم المحفظة"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          />
          <input
            type="number"
            value={walletTransferForm.amount}
            onChange={(e) => setWalletTransferForm((s) => ({ ...s, amount: e.target.value }))}
            placeholder="المبلغ"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          />
          <select
            value={walletTransferForm.transactionType}
            onChange={(e) => setWalletTransferForm((s) => ({ ...s, transactionType: e.target.value }))}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          >
            <option value="send">تحويل صادر</option>
            <option value="receive">تحويل وارد</option>
          </select>
          <select
            value={String(walletTransferForm.isPaid)}
            onChange={(e) => setWalletTransferForm((s) => ({ ...s, isPaid: e.target.value === "true" }))}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          >
            <option value="true">تم الدفع</option>
            <option value="false">لم يتم الدفع</option>
          </select>
          <input
            value={walletTransferForm.receiptNumber}
            onChange={(e) => setWalletTransferForm((s) => ({ ...s, receiptNumber: e.target.value }))}
            placeholder="رقم العملية / الإيصال"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          />
          <textarea
            rows={3}
            value={walletTransferForm.notes}
            onChange={(e) => setWalletTransferForm((s) => ({ ...s, notes: e.target.value }))}
            placeholder="ملاحظات"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
          />

          <button
            onClick={saveWalletTransfer}
            disabled={savingWalletTransfer}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white"
          >
            <Save className="h-4 w-4" />
            {savingWalletTransfer ? "جاري الحفظ..." : "حفظ التحويل"}
          </button>
        </div>
      </Card>

      <Card className="xl:col-span-8">
        <SectionTitle title="سجل التحويلات" subtitle="كل الحركات المحفوظة" icon={Wallet} />

        <div className="space-y-3">
          {walletTransfers.map((item) => (
            <div key={item.id} className="rounded-2xl bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-bold">{item.personName}</p>
                  <p className="text-sm text-slate-500">{item.walletNumber}</p>
                  <p className="text-xs text-slate-500">
                    {item.createdAt ? new Date(item.createdAt).toLocaleString("ar-EG") : ""}
                  </p>
                </div>

                <div className="text-left text-sm">
                  <p>{currency(item.amount, settings.currencyCode)}</p>
                  <p>{item.transactionType === "send" ? "صادر" : "وارد"}</p>
                  <p>{item.isPaid ? "مدفوع" : "غير مدفوع"}</p>
                  <p>{item.receiptNumber || "بدون رقم عملية"}</p>
                </div>
              </div>
            </div>
          ))}

          {walletTransfers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-slate-500">
              لا توجد تحويلات بعد
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}