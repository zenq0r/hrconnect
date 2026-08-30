import { NextRequest, NextResponse } from "next/server";
import { billplzConfig } from "@/lib/env";
import { sendFinanceNotification } from "@/lib/notify";
import { SignatureData, verifyXSignature } from "@/lib/signature";

export const runtime = "nodejs";

function formToObject(form: FormData): SignatureData {
  const result: SignatureData = {};
  for (const [key, value] of form.entries()) {
    result[key] = typeof value === "string" ? value : value.name;
  }
  return result;
}

function stringField(data: SignatureData, key: string): string {
  const value = data[key];
  return typeof value === "string" ? value : value === undefined || value === null ? "" : String(value);
}

function numberField(data: SignatureData, key: string): number {
  const value = Number(stringField(data, key));
  return Number.isFinite(value) ? value : 0;
}

export async function POST(request: NextRequest) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return new NextResponse("Invalid callback body", { status: 400 });
  }

  const data = formToObject(form);

  try {
    const config = billplzConfig();
    if (!verifyXSignature(data, config.xSignatureKey)) {
      console.warn("Rejected Billplz callback: invalid X Signature");
      return new NextResponse("Invalid signature", { status: 401 });
    }

    if (String(data.collection_id ?? "") !== config.collectionId) {
      console.warn("Rejected Billplz callback: collection mismatch", {
        billId: data.id,
      });
      return new NextResponse("Collection mismatch", { status: 400 });
    }

    const paid = stringField(data, "paid").toLowerCase() === "true";

    console.info("Verified Billplz callback", {
      billId: data.id,
      paid: data.paid,
      state: data.state,
      amount: data.amount,
      paidAmount: data.paid_amount,
      transactionId: data.transaction_id,
      transactionStatus: data.transaction_status,
      bankCode: data.reference_1,
      orderId: data.reference_2,
    });

    if (paid) {
      try {
        await sendFinanceNotification({
          billId: stringField(data, "id"),
          orderId: stringField(data, "reference_2"),
          amountSen: numberField(data, "amount"),
          paidAmountSen: numberField(data, "paid_amount"),
          payerName: stringField(data, "name"),
          payerEmail: stringField(data, "email"),
          payerPhone: stringField(data, "mobile"),
          bankCode: stringField(data, "reference_1"),
          transactionId: stringField(data, "transaction_id"),
          transactionStatus: stringField(data, "transaction_status") || "PAID",
          paidAt: stringField(data, "paid_at"),
          state: stringField(data, "state") || "paid",
        });
      } catch (error) {
        console.error("Failed to send finance notification email", error);
      }
    }

    return new NextResponse("OK", { status: 200 });
  } catch (error) {
    console.error("Billplz callback configuration error", error);
    return new NextResponse("Server configuration error", { status: 500 });
  }
}
