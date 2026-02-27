export const currency = (value, currencyCode = "EGP") =>
  new Intl.NumberFormat("ar-EG", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 2,
  }).format(Number(value || 0));

export const numberFormat = (value) =>
  new Intl.NumberFormat("ar-EG", {
    maximumFractionDigits: 0,
  }).format(Number(value || 0));