import React from "react";
import { Plus, Trash2 } from "lucide-react";

export default function ProductCard({ product, onAdd, onDelete }) {
  const outOfStock = Number(product.stock || 0) <= 0;
  const lowStock = Number(product.stock || 0) <= Number(product.minStock || 5);

  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900">{product.name}</h3>
          <p className="mt-1 text-xs text-slate-500">
            {product.category || "General"} • Barcode: {product.barcode || "—"}
          </p>
        </div>

        {onDelete ? (
          <button
            onClick={() => onDelete(product.id)}
            className="rounded-xl p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
            title="Delete product"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-lg font-black">{Number(product.price || 0).toFixed(2)}</p>
          <p className={`text-xs ${lowStock ? "text-amber-600" : "text-slate-500"}`}>Stock: {product.stock}</p>
        </div>

        {onAdd ? (
          <button
            onClick={() => onAdd(product)}
            disabled={outOfStock}
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        ) : null}
      </div>
    </div>
  );
}