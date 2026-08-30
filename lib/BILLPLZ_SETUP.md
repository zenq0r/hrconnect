# Billplz Setup for ZenTec Gateway

## 1) Required Billplz values

Fill these values in Vercel:

- `BILLPLZ_SECRET_KEY`
- `BILLPLZ_X_SIGNATURE_KEY`
- `BILLPLZ_COLLECTION_ID`
- `BILLPLZ_ENV`

Use matching Sandbox credentials together, or matching Production credentials together.

## 2) FPX bank list

This project loads active FPX banks from Billplz using:

- `GET /api/v4/payment_gateways`

It supports both retail and corporate FPX labels where available.

## 3) Create bill

This project creates bills using:

- `POST /api/v3/bills`

With these fields:

- `collection_id`
- `email`
- `mobile`
- `name`
- `amount`
- `description`
- `callback_url`
- `redirect_url`
- `reference_1_label=Bank Code`
- `reference_1=<selected bank code>`
- `reference_2_label=Order ID`
- `reference_2=<generated order ID>`

## 4) Direct bank redirect

After bill creation the app appends:

- `?auto_submit=true`

So the payer is sent directly to the selected FPX bank.

## 5) Callback verification

The callback route verifies:

- X Signature
- Collection ID

If the payment is verified as successful, the system sends an email notification to:

- `finance@zenqor.com.my`

provided SMTP is configured.
