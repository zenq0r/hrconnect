export type BillplzEnvironment = "sandbox" | "production";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function billplzConfig() {
  const rawEnv = (process.env.BILLPLZ_ENV ?? "sandbox").trim().toLowerCase();
  const environment: BillplzEnvironment =
    rawEnv === "production" ? "production" : "sandbox";

  return {
    environment,
    baseUrl:
      environment === "production"
        ? "https://www.billplz.com"
        : "https://www.billplz-sandbox.com",
    secretKey: required("BILLPLZ_SECRET_KEY"),
    xSignatureKey: required("BILLPLZ_X_SIGNATURE_KEY"),
    collectionId: required("BILLPLZ_COLLECTION_ID"),
  };
}

export function appConfig() {
  const raw = process.env.APP_URL?.trim();
  if (!raw) return { appUrl: null as string | null };

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("APP_URL must be a valid absolute URL.");
  }

  if (url.protocol !== "https:" && url.hostname !== "localhost") {
    throw new Error("APP_URL must use HTTPS outside localhost.");
  }

  return { appUrl: url.toString().replace(/\/$/, "") };
}

export function checkoutConfig() {
  const productName = (process.env.PRODUCT_NAME ?? "ZenTec Gateway").trim();
  const financeEmail = (process.env.FINANCE_NOTIFICATION_EMAIL ?? "finance@zenqor.com.my").trim();

  return {
    productName: productName || "ZenTec Gateway",
    financeEmail: financeEmail || "finance@zenqor.com.my",
  };
}

export function mailConfig() {
  const host = process.env.SMTP_HOST?.trim();
  const port = process.env.SMTP_PORT?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const secureRaw = (process.env.SMTP_SECURE ?? "true").trim().toLowerCase();
  const fromEmail = (process.env.MAIL_FROM_EMAIL ?? user ?? "").trim();
  const fromName = (process.env.MAIL_FROM_NAME ?? "ZenTec Gateway").trim();
  const financeEmail = (process.env.FINANCE_NOTIFICATION_EMAIL ?? "finance@zenqor.com.my").trim();

  if (!host || !port || !user || !pass || !fromEmail || !financeEmail) {
    return { enabled: false as const };
  }

  const parsedPort = Number(port);
  if (!Number.isFinite(parsedPort) || parsedPort <= 0) {
    throw new Error("SMTP_PORT must be a valid positive number.");
  }

  return {
    enabled: true as const,
    host,
    port: parsedPort,
    secure: secureRaw !== "false",
    user,
    pass,
    fromEmail,
    fromName,
    financeEmail,
  };
}
