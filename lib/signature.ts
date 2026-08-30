import { createHmac, timingSafeEqual } from "node:crypto";

export type SignatureValue = string | number | boolean | null | undefined;
export type SignatureData = Record<string, SignatureValue>;

function normalizedKey(key: string): string {
  // Redirect parameters arrive as billplz[id], billplz[paid], etc.
  // Billplz constructs the signature source as billplzid, billplzpaid, etc.
  return key.replace(/[\[\]]/g, "");
}

function normalizedValue(value: SignatureValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

function isSignatureKey(key: string): boolean {
  return normalizedKey(key).toLowerCase() === "x_signature" ||
    normalizedKey(key).toLowerCase() === "billplzx_signature";
}

export function computeXSignature(data: SignatureData, key: string): string {
  const parts = Object.entries(data)
    .filter(([field]) => !isSignatureKey(field))
    .map(([field, value]) => `${normalizedKey(field)}${normalizedValue(value)}`)
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

  return createHmac("sha256", key).update(parts.join("|")).digest("hex");
}

export function extractXSignature(data: SignatureData): string {
  const direct = data.x_signature;
  if (typeof direct === "string") return direct;

  const redirect = data["billplz[x_signature]"];
  return typeof redirect === "string" ? redirect : "";
}

export function verifyXSignature(
  data: SignatureData,
  key: string,
  provided = extractXSignature(data),
): boolean {
  if (!provided) return false;

  const expected = computeXSignature(data, key);
  const a = Buffer.from(expected.toLowerCase(), "utf8");
  const b = Buffer.from(provided.toLowerCase(), "utf8");

  return a.length === b.length && timingSafeEqual(a, b);
}
