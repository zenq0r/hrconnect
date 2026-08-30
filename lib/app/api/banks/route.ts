import { NextResponse } from "next/server";
import { BillplzApiError, getFpxBanks } from "@/lib/billplz";
import { billplzConfig } from "@/lib/env";

export const runtime = "nodejs";

function userMessage(error: unknown): string {
  if (error instanceof BillplzApiError) {
    if (error.status === 401) {
      return "Billplz authentication failed (401). Secret Key tidak sepadan dengan BILLPLZ_ENV. Jika key daripada billplz.com gunakan production; jika daripada billplz-sandbox.com gunakan sandbox.";
    }
    if (error.status === 429) {
      return "Billplz rate limit (429). Tunggu beberapa minit dan cuba semula.";
    }
    if (error.status === 503) {
      return "Billplz sedang tidak tersedia (503). Cuba semula sebentar lagi.";
    }
    return `Billplz API gagal (HTTP ${error.status}). Semak konfigurasi Billplz.`;
  }

  return "Senarai bank FPX tidak dapat dimuatkan. Semak konfigurasi Billplz.";
}

export async function GET() {
  try {
    const banks = await getFpxBanks();
    const environment = billplzConfig().environment;

    return NextResponse.json(
      { banks, environment },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
        },
      },
    );
  } catch (error) {
    console.error("Billplz banks error", error);
    return NextResponse.json(
      { error: userMessage(error) },
      { status: error instanceof BillplzApiError ? error.status : 502 },
    );
  }
}
