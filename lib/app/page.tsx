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
        backgroundImage: `linear-gradient(rgba(4, 4, 4, 0.94), rgba(4, 4, 4, 0.97)), url(${ZENQOR_BACKGROUND_DATA_URL})`,
      }}
    >
      <section className="checkout-card">
        <header className="page-header">
          <div className="brand-row">
            <img
              src={ZENQOR_LOGO_DATA_URL}
              alt="Zenqor Technologies Finance Team"
              width={52}
              height={52}
              className="brand-logo"
            />
            <div>
              <p className="eyebrow">Pembayaran atas talian</p>
              <h1>{checkout.productName}</h1>
            </div>
          </div>
          <p className="lead-text">
            Sila isi jumlah bayaran, nama, email, nombor telefon dan pilih bank FPX untuk teruskan pembayaran.
          </p>
        </header>

        <CheckoutForm />

        <p className="fine-print">
          Pembayaran diproses melalui Billplz. Status transaksi disahkan melalui callback dan redirect yang diverifikasi menggunakan X Signature.
        </p>
      </section>
    </main>
  );
}
