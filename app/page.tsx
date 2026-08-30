import CheckoutForm from "@/components/CheckoutForm";
import { ZENQOR_BACKGROUND_DATA_URL, ZENQOR_LOGO_DATA_URL } from "@/lib/brandAssets";
import { checkoutConfig } from "@/lib/env";

export const dynamic = "force-dynamic";

export default function Home() {
  const checkout = checkoutConfig();

  return (
    <main
      className="shell"
      style={{
        backgroundImage: `linear-gradient(rgba(3, 3, 3, 0.9), rgba(3, 3, 3, 0.97)), url(${ZENQOR_BACKGROUND_DATA_URL})`,
      }}
    >
      <section className="checkout-card">
        <div
          className="hero-banner"
          style={{ backgroundImage: `url(${ZENQOR_BACKGROUND_DATA_URL})` }}
        >
          <div className="hero-overlay" />
          <div className="hero-content">
            <div className="logo-wrap">
              <img
                src={ZENQOR_LOGO_DATA_URL}
                alt="Zenqor Technologies Finance Team"
                width={72}
                height={72}
                className="logo-image"
              />
            </div>
            <div className="hero-copy-block">
              <p className="eyebrow">Secure online payment portal</p>
              <h1>{checkout.productName}</h1>
              <p className="hero-copy">
                Portal rasmi pembayaran FPX Zenqor Technologies untuk kutipan bayaran pelanggan,
                invois dan rekod kewangan.
              </p>
              <div className="hero-pills">
                <span>Billplz Hosted Payment</span>
                <span>FPX Malaysia</span>
                <span>Audit-ready finance record</span>
              </div>
            </div>
          </div>
        </div>

        <CheckoutForm />

        <p className="fine-print">
          Pembayaran diproses oleh Billplz. Pelanggan akan dihantar ke saluran pembayaran rasmi,
          dan status transaksi diverifikasi melalui X Signature sebelum direkodkan.
        </p>
      </section>
    </main>
  );
}
