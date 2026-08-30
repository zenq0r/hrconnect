# Deploy ZenTec Gateway to Vercel

## 1. Import repository

Import `zenq0r/zenqor-gateway` into Vercel.

## 2. Framework settings

- Framework: `Next.js`
- Root Directory: `./`
- Build / Output settings: default

## 3. Environment Variables

Add all variables from `.env.example`.

Recommended values:

```env
BILLPLZ_ENV=sandbox
PRODUCT_NAME="ZenTec Gateway"
APP_URL=https://zentec-gateway.zenqor.com.my
FINANCE_NOTIFICATION_EMAIL=finance@zenqor.com.my
MAIL_FROM_NAME="ZenTec Gateway"
MAIL_FROM_EMAIL=finance@zenqor.com.my
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=finance@zenqor.com.my
SMTP_PASS=your_google_app_password
```

For custom domain production deployment:

- Apply `APP_URL` to **Production**
- Other variables can apply to **Production and Preview**

## 4. Custom domain

Add the domain:

- `zentec-gateway.zenqor.com.my`

inside Vercel → Project → Settings → Domains.

## 5. Redeploy after changes

Any environment variable change requires a fresh deployment.
