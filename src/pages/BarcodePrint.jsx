import React, { useMemo, useState } from "react";
import Barcode from "react-barcode";
import { Barcode as BarcodeIcon, Printer, RefreshCw } from "lucide-react";
import Card from "../components/Card";
import SectionTitle from "../components/SectionTitle";

function safeNumber(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

// تحويل mm إلى px تقريبًا للطباعة/المعاينة (96dpi)
function mmToPx(mm) {
  return (mm * 96) / 25.4;
}

export default function BarcodePrint() {
  const [value, setValue] = useState("");
  const [widthMm, setWidthMm] = useState("50");
  const [heightMm, setHeightMm] = useState("25");
  const [copies, setCopies] = useState("1");

  const parsed = useMemo(() => {
    const wMm = Math.max(10, safeNumber(widthMm, 50));
    const hMm = Math.max(10, safeNumber(heightMm, 25));
    const c = Math.max(1, safeNumber(copies, 1));
    return { wMm, hMm, c };
  }, [widthMm, heightMm, copies]);

  const previewSizePx = useMemo(() => {
    return {
      w: Math.round(mmToPx(parsed.wMm)),
      h: Math.round(mmToPx(parsed.hMm)),
    };
  }, [parsed.wMm, parsed.hMm]);

  const canRender = useMemo(() => {
    const v = String(value || "").trim();
    return v.length > 0;
  }, [value]);

  const onPrint = () => {
    if (!canRender) {
      window.alert("من فضلك أدخل رقم الباركود");
      return;
    }
    window.print();
  };

  const onReset = () => {
    setValue("");
    setWidthMm("50");
    setHeightMm("25");
    setCopies("1");
  };

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      {/* إعدادات */}
      <Card className="xl:col-span-4 print:hidden">
        <SectionTitle
          title="طباعة باركود"
          subtitle="أدخل رقم الباركود واختر المقاس وعدد النسخ"
          icon={BarcodeIcon}
        />

        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">رقم الباركود</label>
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="مثال: 6221234567890"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-slate-400"
              autoComplete="off"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">العرض (mm)</label>
              <input
                type="number"
                value={widthMm}
                onChange={(e) => setWidthMm(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">الارتفاع (mm)</label>
              <input
                type="number"
                value={heightMm}
                onChange={(e) => setHeightMm(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">عدد النسخ</label>
            <input
              type="number"
              min="1"
              value={copies}
              onChange={(e) => setCopies(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <button
              onClick={onPrint}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
            >
              <Printer className="h-4 w-4" />
              طباعة
            </button>

            <button
              onClick={onReset}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
            >
              <RefreshCw className="h-4 w-4" />
              إعادة ضبط
            </button>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
            المعاينة بالأسفل تعتمد على مقاس mm الذي أدخلته.
            <br />
            لو الطابعة حرارية (Label Printer) قد تحتاج ضبط Page Size من إعدادات الطباعة.
          </div>
        </div>
      </Card>

      {/* معاينة + طباعة */}
      <Card className="xl:col-span-8">
        <SectionTitle
          title="معاينة الباركود"
          subtitle="تأكد من الشكل قبل الطباعة"
          icon={BarcodeIcon}
        />

        {!canRender ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-500">
            أدخل رقم الباركود لعرض المعاينة
          </div>
        ) : (
          <div className="space-y-5">
            {/* Preview */}
            <div className="rounded-2xl bg-slate-50 p-6">
              <div className="mx-auto w-fit rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <div
                  style={{
                    width: previewSizePx.w,
                    height: previewSizePx.h,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Barcode
                    value={String(value).trim()}
                    format="CODE128"
                    displayValue={true}
                    height={Math.max(20, previewSizePx.h - 18)}
                    width={Math.max(1, previewSizePx.w / 180)} // تقدير عرض الخطوط حسب العرض الكلي
                    margin={0}
                  />
                </div>
              </div>

              <div className="mt-4 text-sm text-slate-600">
                المقاس: <span className="font-bold">{parsed.wMm}mm</span> ×{" "}
                <span className="font-bold">{parsed.hMm}mm</span> — النسخ:{" "}
                <span className="font-bold">{parsed.c}</span>
              </div>
            </div>

            {/* Print-only area */}
            <div className="hidden print:block">
              <style>
                {`
                  @page { margin: 0; }
                  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                `}
              </style>

              <div
                className="p-0"
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr",
                  gap: 0,
                }}
              >
                {Array.from({ length: parsed.c }).map((_, idx) => (
                  <div
                    key={idx}
                    style={{
                      width: `${parsed.wMm}mm`,
                      height: `${parsed.hMm}mm`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      pageBreakInside: "avoid",
                      breakInside: "avoid",
                    }}
                  >
                    <Barcode
                      value={String(value).trim()}
                      format="CODE128"
                      displayValue={true}
                      height={Math.max(10, mmToPx(parsed.hMm) - 18)}
                      width={Math.max(1, mmToPx(parsed.wMm) / 180)}
                      margin={0}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="print:hidden rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
              عند الضغط على <span className="font-bold">طباعة</span> سيتم طباعة الباركود فقط (بدون باقي النظام).
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}