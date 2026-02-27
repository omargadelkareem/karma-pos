import React, { useContext, useState } from "react";
import { Store, RefreshCw, Phone } from "lucide-react";
import { AuthContext } from "../context/AuthContext";

export default function Login() {
  const { login } = useContext(AuthContext);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async () => {
    setLoading(true);
    setError("");

    try {
      await login(phone);
    } catch (e) {
      setError(e?.message || "فشل تسجيل الدخول");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-[32px] bg-white shadow-2xl ring-1 ring-slate-200 lg:grid-cols-2">
        <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-8 text-white md:p-12">
          <div className="inline-flex rounded-3xl bg-white/10 p-4">
            <Store className="h-8 w-8" />
          </div>
          <h1 className="mt-6 text-4xl font-black">كرمة ماركت</h1>
          <p className="mt-3 max-w-lg text-sm leading-7 text-slate-300">
            نظام عربي بسيط لإدارة المخزن والبيع وحفظ الفواتير بسرعة
          </p>
        </div>

        <div className="p-8 md:p-12">
          <div className="mx-auto max-w-md">
            <h2 className="text-3xl font-black text-slate-900">تسجيل الدخول</h2>
            <p className="mt-2 text-sm text-slate-500">أدخل رقم الهاتف المسجل في النظام</p>

            <div className="mt-8 space-y-4">
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 outline-none transition focus:border-slate-400"
                  placeholder="01012345678"
                />
              </div>

              {error ? (
                <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              <button
                onClick={onSubmit}
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:bg-slate-400"
              >
                {loading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Phone className="h-4 w-4" />
                )}
                دخول
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}