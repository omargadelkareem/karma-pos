        import React, { useContext, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, X } from "lucide-react";
import { PosContext } from "../context/PosContext";

function daysBetween(fromDate, toDate) {
  const ms = toDate.getTime() - fromDate.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function getExpiryType(expiryDateStr, thresholdDays = 30) {
  if (!expiryDateStr) return "none";
  const exp = new Date(`${expiryDateStr}T12:00:00`);
  if (Number.isNaN(exp.getTime())) return "none";

  const today = new Date();
  today.setHours(12, 0, 0, 0);

  const diff = daysBetween(today, exp);

  if (diff < 0) return "expired";
  if (diff <= thresholdDays) return "soon";
  return "ok";
}

export default function ExpiryAlerts({ thresholdDays = 30, onOpenReport }) {
  const { products } = useContext(PosContext);
  const [dismissed, setDismissed] = useState(false);

  const { expired, soon } = useMemo(() => {
    const expired = [];
    const soon = [];

    products.forEach((p) => {
      const t = getExpiryType(p.expiryDate, thresholdDays);
      if (t === "expired") expired.push(p);
      if (t === "soon") soon.push(p);
    });

    return { expired, soon };
  }, [products, thresholdDays]);

  // منع تكرار التنبيه يومياً
  useEffect(() => {
    const key = `expiry_alert_last_${new Date().toISOString().slice(0, 10)}`;
    const already = localStorage.getItem(key) === "1";

    if ((expired.length > 0 || soon.length > 0) && !already) {
      localStorage.setItem(key, "1");
      setDismissed(false);

      // (اختياري) Browser Notification
      try {
        if ("Notification" in window) {
          if (Notification.permission === "granted") {
            new Notification("تنبيه صلاحية المنتجات", {
              body: expired.length
                ? `يوجد ${expired.length} منتج منتهي الصلاحية`
                : `يوجد ${soon.length} منتج قارب على الانتهاء`,
            });
          }
        }
      } catch {}
    }
  }, [expired.length, soon.length]);

  if (dismissed) return null;
  if (expired.length === 0 && soon.length === 0) return null;

  return (
    <div className="mb-4 rounded-3xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-white p-2 ring-1 ring-amber-200">
            <AlertTriangle className="h-5 w-5 text-amber-700" />
          </div>

          <div className="min-w-0">
            <p className="font-black text-amber-900">تنبيه انتهاء الصلاحية</p>
            <p className="mt-1 text-sm text-amber-800">
              {expired.length > 0 ? (
                <>
                  يوجد <span className="font-bold">{expired.length}</span> منتج{" "}
                  <span className="font-bold text-red-700">منتهي الصلاحية</span>.
                </>
              ) : null}
              {soon.length > 0 ? (
                <>
                  {expired.length > 0 ? " " : ""}
                  ويوجد <span className="font-bold">{soon.length}</span> منتج{" "}
                  <span className="font-bold">قارب على الانتهاء</span> (≤ {thresholdDays} يوم).
                </>
              ) : null}
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => {
                  // طلب اذن Notification (اختياري)
                  if ("Notification" in window && Notification.permission === "default") {
                    Notification.requestPermission();
                  }
                }}
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-xs font-bold text-amber-900 ring-1 ring-amber-200 hover:bg-amber-100"
                type="button"
              >
                <CalendarDays className="h-4 w-4" />
                تفعيل تنبيه المتصفح
              </button>

              <button
                onClick={onOpenReport}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
                type="button"
              >
                عرض تقرير الصلاحية
              </button>
            </div>
          </div>
        </div>

        <button
          onClick={() => setDismissed(true)}
          className="rounded-2xl p-2 text-amber-800 hover:bg-amber-100"
          type="button"
          title="إخفاء"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}