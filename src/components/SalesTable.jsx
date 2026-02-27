import React from "react";
import { currency } from "../utils/format";

export default function SalesTable({ invoices, currencyCode = "EGP" }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-right text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-slate-500">
            <th className="pb-3 pl-4 font-medium">رقم الفاتورة</th>
            <th className="pb-3 pl-4 font-medium">التاريخ</th>
            <th className="pb-3 pl-4 font-medium">عدد الأصناف</th>
            <th className="pb-3 pl-4 font-medium">الكاشير</th>
            <th className="pb-3 font-medium">الإجمالي</th>
          </tr>
        </thead>

        <tbody>
          {invoices.length === 0 ? (
            <tr>
              <td colSpan={5} className="py-8 text-center text-slate-500">
                لا توجد فواتير
              </td>
            </tr>
          ) : (
            invoices.map((item) => (
              <tr key={item.id} className="border-b border-slate-100">
                <td className="py-4 pl-4 font-semibold text-slate-900">{item.invoiceNumber}</td>
                <td className="py-4 pl-4 text-slate-600">
                  {item.createdAt ? new Date(item.createdAt).toLocaleString("ar-EG") : "—"}
                </td>
                <td className="py-4 pl-4 text-slate-600">{(item.items || []).length}</td>
                <td className="py-4 pl-4 text-slate-600">{item.cashierName || "—"}</td>
                <td className="py-4 font-bold text-slate-900">
                  {currency(item.total, currencyCode)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}