import React from "react";

export default function Card({ children, className = "" }) {
  return (
    <div className={`rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 ${className}`}>
      {children}
    </div>
  );
}