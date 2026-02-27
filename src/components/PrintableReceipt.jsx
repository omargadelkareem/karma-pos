import React, { useContext } from "react";
import { PosContext } from "../context/PosContext";
import { currency } from "../utils/format";

export default function PrintableReceipt() {
  const { settings, receiptData } = useContext(PosContext);

  if (!receiptData) return null;

  return (
    <div id="print-receipt" className="hidden print:block">
      <div className="mx-auto w-[320px] bg-white p-4 text-black">
        <div className="text-center">
          <h2 className="text-xl font-black">{settings.storeName || "كرمة ماركت"}</h2>
          <p className="text-xs">فاتورة بيع</p>
          <p className="text-xs">
            {receiptData?.createdAt
              ? new Date(receiptData.createdAt).toLocaleString("ar-EG")
              : ""}
          </p>
          {receiptData?.invoiceNumber ? (
            <p className="text-xs">رقم الفاتورة: {receiptData.invoiceNumber}</p>
          ) : null}
        </div>

        <div className="my-3 border-t border-dashed border-black" />

        <div className="space-y-2 text-sm">
          {(receiptData?.items || []).map((item, index) => (
            <div key={`${item.productId}-${item.unitType}-${index}`}>
              <div className="flex items-center justify-between gap-2">
                <span>{item.productName}</span>
                <span>{currency(item.total, settings.currencyCode)}</span>
              </div>
              <div className="text-xs">
                {item.qty} × {item.unitName} × {currency(item.unitPrice, settings.currencyCode)}
              </div>
            </div>
          ))}
        </div>

        <div className="my-3 border-t border-dashed border-black" />

        <div className="space-y-1 text-sm">
          {receiptData?.paidAmount !== undefined ? (
            <div className="flex justify-between">
              <span>المدفوع</span>
              <span>{currency(receiptData.paidAmount, settings.currencyCode)}</span>
            </div>
          ) : null}

          {receiptData?.remainingAmount !== undefined ? (
            <div className="flex justify-between">
              <span>المتبقي</span>
              <span>{currency(receiptData.remainingAmount, settings.currencyCode)}</span>
            </div>
          ) : null}

          <div className="flex justify-between text-base font-black">
            <span>الإجمالي</span>
            <span>{currency(receiptData?.total, settings.currencyCode)}</span>
          </div>
        </div>

        <div className="mt-4 text-center text-xs">شكرًا لتسوقكم معنا</div>
      </div>
    </div>
  );
}