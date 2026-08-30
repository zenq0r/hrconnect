"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Bank = {
  code: string;
  name: string;
};

type ApiError = {
  error?: string;
};

function bankInitials(name: string): string {
  const cleaned = name
    .replace(/[^A-Za-z0-9 ]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (cleaned.length === 0) return "FPX";
  if (cleaned[0].startsWith("B2B1")) return "B2B";

  const joined = cleaned
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return joined || cleaned[0].slice(0, 3).toUpperCase();
}

function bankTone(code: string): string {
  const tones = ["gold", "emerald", "blue", "purple", "rose", "slate"] as const;
  let hash = 0;
  for (const char of code) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return tones[hash % tones.length];
}

function bankType(code: string): string {
  return code.startsWith("B2B1-") ? "Korporat / B2B" : "Perbankan Runcit / B2C";
}

export default function CheckoutForm() {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loadingBanks, setLoadingBanks] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [selectedBankCode, setSelectedBankCode] = useState("");
  const [openBankPicker, setOpenBankPicker] = useState(false);
  const [search, setSearch] = useState("");
  const pickerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadBanks() {
      try {
        const response = await fetch("/api/banks", {
          signal: controller.signal,
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
        const data = (await response.json()) as { banks?: Bank[]; error?: string };

        if (!response.ok || !Array.isArray(data.banks)) {
          throw new Error(data.error || "Tidak dapat memuatkan senarai bank.");
        }

        setBanks(data.banks);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError((err as Error).message || "Tidak dapat memuatkan senarai bank.");
        }
      } finally {
        setLoadingBanks(false);
      }
    }

    loadBanks();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!pickerRef.current?.contains(event.target as Node)) {
        setOpenBankPicker(false);
      }
    }

    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenBankPicker(false);
    }

    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onEscape);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onEscape);
    };
  }, []);

  const selectedBank = useMemo(
    () => banks.find((bank) => bank.code === selectedBankCode) ?? null,
    [banks, selectedBankCode],
  );

  const filteredBanks = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return banks;
    return banks.filter(
      (bank) =>
        bank.name.toLowerCase().includes(keyword) || bank.code.toLowerCase().includes(keyword),
    );
  }, [banks, search]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!selectedBankCode) {
      setError("Sila pilih bank FPX terlebih dahulu.");
      return;
    }

    setSubmitting(true);

    const form = new FormData(event.currentTarget);
    const payload = {
      amount: String(form.get("amount") ?? "").trim(),
      name: String(form.get("name") ?? "").trim(),
      email: String(form.get("email") ?? "").trim(),
      phone: String(form.get("phone") ?? "").trim(),
      bankCode: selectedBankCode,
    };

    try {
      const response = await fetch("/api/create-payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as ApiError & { paymentUrl?: string };
      if (!response.ok || !data.paymentUrl) {
        throw new Error(data.error || "Bayaran tidak dapat dicipta.");
      }

      window.location.assign(data.paymentUrl);
    } catch (err) {
      setError((err as Error).message || "Bayaran tidak dapat dicipta.");
      setSubmitting(false);
    }
  }

  return (
    <form className="payment-form" onSubmit={submit} noValidate>
      <section className="section-card intro-strip">
        <div>
          <p className="section-kicker">Portal rasmi pembayaran</p>
          <h2>Bayaran FPX yang lebih selamat, kemas dan profesional</h2>
          <p>
            Lengkapkan jumlah bayaran, butiran pembayar dan pilih bank FPX untuk terus ke
            sesi pembayaran Billplz.
          </p>
        </div>
        <ul className="trust-list">
          <li><span className="trust-icon">🔒</span>TLS / HTTPS dilindungi</li>
          <li><span className="trust-icon">🛡️</span>X Signature diverifikasi</li>
          <li><span className="trust-icon">📧</span>Rekod dihantar ke Finance</li>
        </ul>
      </section>

      <section className="section-card compact-note">
        <p>
          Transaksi berjaya akan direkodkan dan notifikasi akan dihantar ke
          <strong> finance@zenqor.com.my</strong>.
        </p>
      </section>

      <section className="section-card form-section">
        <div className="section-head">
          <div>
            <p className="section-kicker">Maklumat pembayaran</p>
            <h3>Butiran pembayar</h3>
          </div>
          <div className="section-badge">Data minimum sahaja diminta</div>
        </div>

        <label>
          <span>Jumlah Bayaran (RM)</span>
          <input
            name="amount"
            type="number"
            min="1"
            step="0.01"
            inputMode="decimal"
            required
            placeholder="Contoh: 150.00"
          />
        </label>

        <div className="grid-two">
          <label>
            <span>Nama Penuh</span>
            <input
              name="name"
              type="text"
              autoComplete="name"
              minLength={2}
              maxLength={80}
              required
              placeholder="Nama pelanggan"
            />
          </label>

          <label>
            <span>No. Telefon</span>
            <input
              name="phone"
              type="tel"
              autoComplete="tel"
              minLength={8}
              maxLength={20}
              required
              placeholder="Contoh: 0123456789"
            />
          </label>
        </div>

        <label>
          <span>Email</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            maxLength={120}
            required
            placeholder="nama@email.com"
          />
        </label>
      </section>

      <section className="section-card bank-section">
        <div className="section-head bank-header">
          <div>
            <p className="section-kicker">Pilihan pembayaran</p>
            <h3>Bank FPX</h3>
          </div>
          {!loadingBanks && banks.length > 0 ? (
            <div className="section-badge">{banks.length} bank aktif</div>
          ) : null}
        </div>

        <input type="hidden" name="bankCode" value={selectedBankCode} />

        <div className="bank-picker" ref={pickerRef}>
          <button
            type="button"
            className={`bank-trigger${openBankPicker ? " open" : ""}`}
            onClick={() => !loadingBanks && setOpenBankPicker((value) => !value)}
            disabled={loadingBanks || submitting}
            aria-haspopup="listbox"
            aria-expanded={openBankPicker}
          >
            <div className="bank-trigger-content">
              {selectedBank ? (
                <>
                  <span className={`bank-badge ${bankTone(selectedBank.code)}`} aria-hidden="true">
                    {bankInitials(selectedBank.name)}
                  </span>
                  <span className="bank-meta">
                    <strong>{selectedBank.name}</strong>
                    <small>{bankType(selectedBank.code)}</small>
                  </span>
                </>
              ) : (
                <span className="bank-placeholder">
                  {loadingBanks ? "Memuatkan bank..." : "Pilih bank FPX"}
                </span>
              )}
            </div>
            <span className="caret" aria-hidden="true">▾</span>
          </button>

          {openBankPicker ? (
            <div className="bank-popover">
              <input
                className="bank-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari bank atau kod bank"
                autoFocus
              />

              <div className="bank-list" role="listbox" aria-label="Senarai bank FPX">
                {filteredBanks.length === 0 ? (
                  <div className="bank-empty">Tiada bank dijumpai untuk carian ini.</div>
                ) : (
                  filteredBanks.map((bank) => (
                    <button
                      key={bank.code}
                      type="button"
                      className={`bank-item${selectedBankCode === bank.code ? " selected" : ""}`}
                      onClick={() => {
                        setSelectedBankCode(bank.code);
                        setOpenBankPicker(false);
                        setSearch("");
                      }}
                    >
                      <span className={`bank-badge ${bankTone(bank.code)}`} aria-hidden="true">
                        {bankInitials(bank.name)}
                      </span>
                      <span className="bank-meta">
                        <strong>{bank.name}</strong>
                        <small>{bank.code}</small>
                      </span>
                      <span className="bank-tag">{bankType(bank.code)}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : null}
        </div>

        {!loadingBanks && banks.length > 0 ? (
          <p className="bank-status">Semua bank aktif diambil terus daripada Billplz untuk akaun semasa.</p>
        ) : null}
      </section>

      <section className="section-card security-card">
        <div className="section-head">
          <div>
            <p className="section-kicker">Keselamatan & privasi</p>
            <h3>Perlindungan butiran pembayar</h3>
          </div>
        </div>
        <div className="security-grid">
          <article>
            <strong>HTTPS / TLS</strong>
            <p>Semua trafik portal disulitkan semasa penghantaran.</p>
          </article>
          <article>
            <strong>Billplz X Signature</strong>
            <p>Callback dan redirect diverifikasi sebelum status bayaran diterima.</p>
          </article>
          <article>
            <strong>Validasi pelayan</strong>
            <p>Nama, email, telefon, jumlah dan bank diperiksa semula di server.</p>
          </article>
          <article>
            <strong>Rekod minimum</strong>
            <p>Portal hanya menggunakan butiran yang diperlukan untuk pembayaran dan rekod kewangan.</p>
          </article>
        </div>
      </section>

      {error ? <div className="alert error">{error}</div> : null}

      <button className="primary-button" type="submit" disabled={loadingBanks || submitting || banks.length === 0}>
        {submitting ? "Menyediakan FPX..." : "Teruskan ke Billplz FPX"}
      </button>
    </form>
  );
}
