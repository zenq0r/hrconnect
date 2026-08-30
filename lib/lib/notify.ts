import nodemailer from "nodemailer";
import { mailConfig } from "@/lib/env";

type NotificationInput = {
  billId: string;
  orderId: string;
  amountSen: number;
  paidAmountSen: number;
  payerName: string;
  payerEmail: string;
  payerPhone: string;
  bankCode: string;
  transactionId: string;
  transactionStatus: string;
  paidAt: string;
  state: string;
};

function formatRM(amountSen: number): string {
  return `RM ${(amountSen / 100).toFixed(2)}`;
}

export async function sendFinanceNotification(input: NotificationInput): Promise<void> {
  const config = mailConfig();
  if (!config.enabled) {
    console.info("Finance email notification skipped: SMTP is not configured.");
    return;
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });

  const subject = `[ZenTec Gateway] Bayaran berjaya - ${input.billId}`;
  const lines = [
    "Transaksi Billplz telah berjaya.",
    "",
    `Bill ID: ${input.billId}`,
    `Order ID: ${input.orderId || "-"}`,
    `Status: ${input.transactionStatus || input.state || "PAID"}`,
    `Transaction ID: ${input.transactionId || "-"}`,
    `Jumlah Bil: ${formatRM(input.amountSen)}`,
    `Jumlah Dibayar: ${formatRM(input.paidAmountSen || input.amountSen)}`,
    `Nama Pelanggan: ${input.payerName || "-"}`,
    `Email Pelanggan: ${input.payerEmail || "-"}`,
    `No. Telefon: ${input.payerPhone || "-"}`,
    `Kod Bank FPX: ${input.bankCode || "-"}`,
    `Tarikh Bayaran: ${input.paidAt || "-"}`,
  ].join("\n");

  const html = `
    <div style="font-family: Arial, Helvetica, sans-serif; line-height: 1.6; color: #17212b;">
      <h2 style="margin:0 0 16px;">ZenTec Gateway - Rekod Bayaran Berjaya</h2>
      <p style="margin:0 0 16px;">Transaksi Billplz telah berjaya dan direkodkan untuk pasukan kewangan.</p>
      <table cellpadding="8" cellspacing="0" border="1" style="border-collapse: collapse; width: 100%; max-width: 700px; border-color: #dce3e8;">
        <tr><td><strong>Bill ID</strong></td><td>${escapeHtml(input.billId)}</td></tr>
        <tr><td><strong>Order ID</strong></td><td>${escapeHtml(input.orderId || "-")}</td></tr>
        <tr><td><strong>Status</strong></td><td>${escapeHtml(input.transactionStatus || input.state || "PAID")}</td></tr>
        <tr><td><strong>Transaction ID</strong></td><td>${escapeHtml(input.transactionId || "-")}</td></tr>
        <tr><td><strong>Jumlah Bil</strong></td><td>${escapeHtml(formatRM(input.amountSen))}</td></tr>
        <tr><td><strong>Jumlah Dibayar</strong></td><td>${escapeHtml(formatRM(input.paidAmountSen || input.amountSen))}</td></tr>
        <tr><td><strong>Nama Pelanggan</strong></td><td>${escapeHtml(input.payerName || "-")}</td></tr>
        <tr><td><strong>Email Pelanggan</strong></td><td>${escapeHtml(input.payerEmail || "-")}</td></tr>
        <tr><td><strong>No. Telefon</strong></td><td>${escapeHtml(input.payerPhone || "-")}</td></tr>
        <tr><td><strong>Kod Bank FPX</strong></td><td>${escapeHtml(input.bankCode || "-")}</td></tr>
        <tr><td><strong>Tarikh Bayaran</strong></td><td>${escapeHtml(input.paidAt || "-")}</td></tr>
      </table>
    </div>
  `;

  await transporter.sendMail({
    from: `${config.fromName} <${config.fromEmail}>`,
    to: config.financeEmail,
    subject,
    text: lines,
    html,
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
