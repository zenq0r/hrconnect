import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createBill, getFpxBanks } from "@/lib/billplz";
import { appConfig, checkoutConfig } from "@/lib/env";
import { clientIp, sameOriginRequest } from "@/lib/http";

export const runtime = "nodejs";

type CreateBody = {
  amount?: unknown;
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  bankCode?: unknown;
};

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizePhone(value: string): string {
  return value.replace(/[\s()-]/g, "");
}

function validPhone(value: string): boolean {
  return /^\+?[0-9]{8,20}$/.test(normalizePhone(value));
}

function parseAmountSen(value: string): number | null {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 1) return null;
  const amountSen = Math.round(amount * 100);
  if (amountSen < 100 || amountSen > 99999999) return null;
  return amountSen;
}

function orderId(): string {
  return `ORD-${Date.now().toString(36).toUpperCase()}-${randomBytes(4)
    .toString("hex")
    .toUpperCase()}`;
}

export async function POST(request: NextRequest) {
  if (!sameOriginRequest(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const amountRaw = typeof body.amount === "string" ? body.amount.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const bankCode = typeof body.bankCode === "string" ? body.bankCode.trim() : "";

  const amountSen = parseAmountSen(amountRaw);

  if (!amountSen) {
    return NextResponse.json(
      { error: "Masukkan jumlah bayaran yang sah. Minimum RM1.00." },
      { status: 422 },
    );
  }
  if (name.length < 2 || name.length > 80) {
    return NextResponse.json({ error: "Masukkan nama yang sah." }, { status: 422 });
  }
  if (email.length > 120 || !validEmail(email)) {
    return NextResponse.json({ error: "Masukkan alamat email yang sah." }, { status: 422 });
  }
  if (!validPhone(phone)) {
    return NextResponse.json({ error: "Masukkan nombor telefon yang sah." }, { status: 422 });
  }
  if (!/^[A-Za-z0-9-]{3,30}$/.test(bankCode)) {
    return NextResponse.json({ error: "Kod bank tidak sah." }, { status: 422 });
  }

  try {
    const activeBanks = await getFpxBanks({ fresh: true });
    if (!activeBanks.some((bank) => bank.code === bankCode)) {
      return NextResponse.json(
        { error: "Bank yang dipilih sedang tidak tersedia. Sila pilih bank lain." },
        { status: 409 },
      );
    }

    const checkout = checkoutConfig();
    const id = orderId();
    const configuredAppUrl = appConfig().appUrl;
    const origin = configuredAppUrl ?? request.nextUrl.origin;
    const callbackUrl = `${origin}/api/billplz/callback`;
    const redirectUrl = `${origin}/payment/result`;

    const bill = await createBill({
      name,
      email,
      mobile: normalizePhone(phone),
      amountSen,
      description: `${checkout.productName} - ${id}`,
      callbackUrl,
      redirectUrl,
      bankCode,
      orderId: id,
    });

    if (!bill.id || !bill.url) {
      throw new Error("Billplz response is missing bill ID or URL.");
    }

    const paymentUrl = new URL(bill.url);
    paymentUrl.searchParams.set("auto_submit", "true");

    console.info("Billplz bill created", {
      orderId: id,
      billId: bill.id,
      bankCode,
      amount: amountSen,
      ip: clientIp(request),
    });

    return NextResponse.json({
      ok: true,
      orderId: id,
      billId: bill.id,
      paymentUrl: paymentUrl.toString(),
    });
  } catch (error) {
    console.error("Billplz create payment error", error);
    return NextResponse.json(
      { error: "Bayaran tidak dapat dicipta. Semak Billplz Environment Variables dan cuba lagi." },
      { status: 502 },
    );
  }
}
