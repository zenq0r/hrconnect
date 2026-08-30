# ZenTec Gateway

ZenTec Gateway is a Next.js + Vercel-ready Billplz FPX checkout for `https://zentec-gateway.zenqor.com.my`.

## Included features

- Billplz FPX direct payment gateway
- Dynamic amount input with no fixed/default amount shown
- Required payer fields: amount, full name, email, phone number
- Active FPX bank list loaded from Billplz `GET /api/v4/payment_gateways`
- Bank-code bypass using `reference_1` + `?auto_submit=true`
- X Signature verification for callback and redirect
- Custom Zenqor logo and branded background
- Email notification to `finance@zenqor.com.my` for successful payments
- Ready for GitHub → Vercel deployment

## Required environment variables

Copy `.env.example` into Vercel Environment Variables.

### Billplz
- `BILLPLZ_ENV` = `sandbox` or `production`
- `BILLPLZ_SECRET_KEY`
- `BILLPLZ_X_SIGNATURE_KEY`
- `BILLPLZ_COLLECTION_ID`

### Checkout
- `PRODUCT_NAME`
- `APP_URL`

### Email notification
- `FINANCE_NOTIFICATION_EMAIL`
- `MAIL_FROM_NAME`
- `MAIL_FROM_EMAIL`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`

## Gmail Workspace recommendation

For Google Workspace / Gmail SMTP use:

- `SMTP_HOST=smtp.gmail.com`
- `SMTP_PORT=465`
- `SMTP_SECURE=true`
- `SMTP_USER=finance@zenqor.com.my`
- `SMTP_PASS=<Google app password>`

> Use a Google App Password instead of your normal Gmail password.

## Local development

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Production URL

This project is designed to run at:

- Checkout: `https://zentec-gateway.zenqor.com.my`
- Callback: `https://zentec-gateway.zenqor.com.my/api/billplz/callback`
- Result page: `https://zentec-gateway.zenqor.com.my/payment/result`

## Notes

- Successful payment emails are triggered inside the verified Billplz callback route.
- Billplz may retry callbacks; for strict anti-duplicate email control, add a database or KV store later.

## FPX bank diagnostics

If the bank dropdown cannot load:

- HTTP `401`: Secret Key does not match `BILLPLZ_ENV`.
  - key from `billplz-sandbox.com` -> `BILLPLZ_ENV=sandbox`
  - key from `billplz.com` -> `BILLPLZ_ENV=production`
- Sandbox and Production use separate Secret Keys and Collection IDs.
- The app tries V4 payment gateways first (including active FPX B2C/B2B), then V3 `/fpx_banks` as fallback.
