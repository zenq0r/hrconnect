import { bankName } from "@/lib/banks";
import { billplzConfig } from "@/lib/env";

type Gateway = {
  code?: string;
  active?: boolean;
  category?: string;
};

type GatewayResponse = {
  payment_gateways?: Gateway[];
};

type FpxBankIndexResponse = {
  banks?: Array<{
    name?: string;
    active?: boolean;
  }>;
};

export type FpxBank = {
  code: string;
  name: string;
  active: true;
};

type Bill = {
  id?: string;
  url?: string;
  paid?: boolean;
  state?: string;
  paid_at?: string | null;
  amount?: number;
  paid_amount?: number;
  email?: string | null;
  mobile?: string | null;
  name?: string | null;
  reference_1?: string | null;
  reference_2?: string | null;
};

export class BillplzApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "BillplzApiError";
    this.status = status;
  }
}

function authHeader(secretKey: string): string {
  return `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let data: unknown;

  try {
    data = JSON.parse(text);
  } catch {
    throw new BillplzApiError(
      `Billplz returned a non-JSON response (HTTP ${response.status}).`,
      response.status,
    );
  }

  if (!response.ok) {
    const record = data as Record<string, unknown>;
    const error = record?.error;
    let message = `Billplz API error (HTTP ${response.status}).`;

    if (typeof error === "string") {
      message = error;
    } else if (error && typeof error === "object") {
      const errorRecord = error as Record<string, unknown>;
      const rawMessage = errorRecord.message;
      if (Array.isArray(rawMessage)) message = rawMessage.join("; ");
      else if (typeof rawMessage === "string") message = rawMessage;
    } else if (typeof record?.message === "string") {
      message = record.message;
    }

    throw new BillplzApiError(message, response.status);
  }

  return data as T;
}

async function billplzGet<T>(path: string, noStore = false): Promise<T> {
  const config = billplzConfig();
  const response = await fetch(`${config.baseUrl}${path}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: authHeader(config.secretKey),
    },
    ...(noStore ? { cache: "no-store" as const } : { next: { revalidate: 300 } }),
  });

  return parseResponse<T>(response);
}

async function fetchFpxBankIndex(noStore = false): Promise<FpxBankIndexResponse> {
  return billplzGet<FpxBankIndexResponse>("/api/v3/fpx_banks", noStore);
}

async function fetchGateways(noStore = false): Promise<GatewayResponse> {
  return billplzGet<GatewayResponse>("/api/v4/payment_gateways", noStore);
}

function sortBanks(banks: FpxBank[]): FpxBank[] {
  const deduped = new Map<string, FpxBank>();
  for (const bank of banks) deduped.set(bank.code, bank);
  return Array.from(deduped.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function gatewayLooksLikeFpx(gateway: Gateway): boolean {
  const code = typeof gateway.code === "string" ? gateway.code : "";
  const category = typeof gateway.category === "string" ? gateway.category.toLowerCase() : "";

  // Billplz Retail/B2C uses category "fpx". Corporate codes are B2B1-* and
  // may be represented by an FPX-B2B category depending on account/gateway data.
  return category.startsWith("fpx") || code.startsWith("B2B1-");
}

export async function getFpxBanks(options?: { fresh?: boolean }): Promise<FpxBank[]> {
  const noStore = options?.fresh === true;
  let firstError: unknown = null;

  // V4 is the complete payment-gateway list and is preferred for B2C + B2B.
  try {
    const data = await fetchGateways(noStore);
    const gateways = Array.isArray(data.payment_gateways) ? data.payment_gateways : [];

    const activeBanks = gateways
      .filter(
        (gateway) =>
          gateway.active === true &&
          gatewayLooksLikeFpx(gateway) &&
          typeof gateway.code === "string" &&
          gateway.code.length > 0,
      )
      .map((gateway) => ({
        code: gateway.code as string,
        name: bankName(gateway.code as string),
        active: true as const,
      }));

    if (activeBanks.length > 0) return sortBanks(activeBanks);
  } catch (error) {
    firstError = error;
    console.warn("Billplz V4 payment gateways failed; trying V3 FPX banks", error);
  }

  // V3 is retained as a fallback specifically for FPX bank codes.
  try {
    const data = await fetchFpxBankIndex(noStore);
    const banks = Array.isArray(data.banks) ? data.banks : [];

    const activeBanks = banks
      .filter(
        (bank) =>
          bank.active === true &&
          typeof bank.name === "string" &&
          bank.name.length > 0,
      )
      .map((bank) => ({
        code: bank.name as string,
        name: bankName(bank.name as string),
        active: true as const,
      }));

    if (activeBanks.length > 0) return sortBanks(activeBanks);
  } catch (error) {
    console.error("Billplz V3 FPX bank index failed", error);
    if (firstError instanceof BillplzApiError) throw firstError;
    throw error;
  }

  if (firstError instanceof Error) throw firstError;
  throw new Error("Billplz returned no active FPX banks for this account.");
}

export async function createBill(input: {
  name: string;
  email: string;
  mobile: string;
  amountSen: number;
  description: string;
  callbackUrl: string;
  redirectUrl: string;
  bankCode: string;
  orderId: string;
}): Promise<Bill> {
  const config = billplzConfig();
  const body = new URLSearchParams({
    collection_id: config.collectionId,
    email: input.email,
    mobile: input.mobile,
    name: input.name,
    amount: String(input.amountSen),
    description: input.description.slice(0, 200),
    callback_url: input.callbackUrl,
    redirect_url: input.redirectUrl,
    reference_1_label: "Bank Code",
    reference_1: input.bankCode,
    reference_2_label: "Order ID",
    reference_2: input.orderId,
  });

  const response = await fetch(`${config.baseUrl}/api/v3/bills`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: authHeader(config.secretKey),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });

  return parseResponse<Bill>(response);
}
