import Link from "next/link";
import { billplzConfig } from "@/lib/env";
import { SignatureData, verifyXSignature } from "@/lib/signature";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function flattenSearchParams(
  params: Record<string, string | string[] | undefined>,
): SignatureData {
  const result: SignatureData = {};
  for (const [key, value] of Object.entries(params)) {
    result[key] = Array.isArray(value) ? value[0] ?? "" : value ?? "";
  }
  return result;
}

export default async function PaymentResult({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const data = flattenSearchParams(raw);

  let verified = false;
  let configError = false;

  try {
    const config = billplzConfig();
    verified = verifyXSignature(data, config.xSignatureKey);
  } catch {
    configError = true;
  }

  const billId = String(data["billplz[id]"] ?? "");
  const paid = String(data["billplz[paid]"] ?? "").toLowerCase() === "true";
  const paidAt = String(data["billplz[paid_at]"] ?? "");
  const transactionId = String(data["billplz[transaction_id]"] ?? "");

  const success = verified && paid;
  const title = success
    ? "Bayaran berjaya"
    : verified
      ? "Bayaran belum berjaya"
      : "Status tidak dapat disahkan";

  return (
    <main className="shell">
      <section className="result-card">
        <div className={`status-icon ${success ? "success" : "neutral"}`}>
          {success ? "✓" : "!"}
        </div>
        <p className="eyebrow">Billplz FPX</p>
        <h1>{title}</h1>

        {configError ? (
          <div className="alert error">
            Environment Variables Billplz belum lengkap pada deployment ini.
          </div>
        ) : null}

        {!verified && !configError ? (
          <div className="alert error">
            X Signature redirect tidak sepadan. Jangan anggap transaksi ini sebagai paid.
          </div>
        ) : null}

        <dl className="result-list">
          <div>
            <dt>Bill ID</dt>
            <dd>{billId || "-"}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{verified ? (paid ? "PAID" : "NOT PAID") : "UNVERIFIED"}</dd>
          </div>
          {paidAt ? (
            <div>
              <dt>Paid at</dt>
              <dd>{paidAt}</dd>
            </div>
          ) : null}
          {transactionId ? (
            <div>
              <dt>Transaction ID</dt>
              <dd>{transactionId}</dd>
            </div>
          ) : null}
        </dl>

        <Link className="secondary-button" href="/">
          Kembali ke checkout
        </Link>
      </section>
    </main>
  );
}
