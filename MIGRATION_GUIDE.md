# ZENQOR Enterprise v3.0 — Panduan Deployment Keselamatan

## Perubahan Kritikal Yang Dilakukan

### [ISU #1] Firestore Rules — `isAuthenticated()` Dibuang `|| true`
**SEBELUM:** `return request.auth != null || true;` ← Semua orang boleh akses!
**SELEPAS:** `return request.auth != null;` ← Firebase Auth wajib

### [ISU #2] Password Tidak Lagi Disimpan Plaintext
- `users` collection dalam Firestore kini hanya menyimpan: `name`, `email`, `role`
- Password diurus sepenuhnya oleh Firebase Authentication
- Backup JSON tidak lagi mengandungi password

### [ISU #3] Login Menggunakan Firebase Auth
- `signInWithEmailAndPassword()` — semakan berlaku di server Google
- `onAuthStateChanged()` — session dipantau secara selamat
- Feature tukar kata laluan dengan `reauthenticateWithCredential` + `updatePassword`

### [ISU #4] API Key Protection
- Firebase App Check belum diaktifkan dalam runtime dan perlu dilaksanakan sebelum enforcement.
- Domain restriction perlu diset di Google Cloud Console.

---

## LANGKAH WAJIB SEBELUM DEPLOY

### Langkah 1: Migrate Pengguna ke Firebase Authentication

Gunakan `Add Access` dalam Portal Access Management sebagai Superadmin atau Director.
Portal mencipta akaun Firebase Authentication melalui secondary auth instance supaya sesi admin tidak terganggu.

Kemudian, untuk setiap pengguna, simpan metadata di Firestore
di bawah path `users/{uid}` (bukan email lagi, tapi UID Firebase):

```json
{
  "name": "Nama Pengguna",
  "email": "nama@zenqor.com.my",
  "role": "Superadmin"
}
```

**PENTING:** Document ID dalam `users/` collection kini mestilah **Firebase UID**
(contoh: `abc123xyz`) bukan email. Ini penting supaya Firestore rules berfungsi.

### Langkah 2: Aktifkan Firebase App Check

1. Pergi ke https://www.google.com/recaptcha/admin/create
2. Pilih reCAPTCHA v3, masukkan domain anda
3. Salin Site Key
4. Tambah integrasi `initializeAppCheck` dalam `firebase-config.js` menggunakan site key production.
5. Uji dahulu tanpa enforcement, kemudian aktifkan enforcement di Firebase Console → App Check.

### Langkah 3: Restrict API Key di Google Cloud

1. Buka https://console.cloud.google.com/apis/credentials
2. Klik pada "Browser key (auto created by Firebase)"
3. Dalam "Application restrictions" → pilih "HTTP referrers"
4. Tambah domain:
   - `https://www.hrct.portal.zenqor.com.my/*`
   - `http://localhost/*` (development sahaja)
5. Simpan

### Langkah 4: Deploy Firestore Rules Baharu

```bash
firebase deploy --only firestore:rules
```

### Langkah 5: Padam Data Lama Yang Mengandungi Password

Di Firebase Console → Firestore → `users` collection:
- Semak setiap dokumen dan pastikan tiada field `password`
- Padam field `password` jika masih ada

---

## NOTA TAMBAHAN

- Portal Access Management mencipta akaun baharu dan metadata role; kemas kini akses tidak mengubah password.
- Rekod Authentication lama tanpa UID metadata menggunakan `pending_access` dan dimigrasi ketika login.
- Lampiran Claims/Payment Voucher/Payslip (PNG/JPG/JPEG) dipampatkan dalam browser dan disimpan sebagai base64 dalam Firestore.
- Client Documents (Client Portal) pula guna Firebase Storage sebenar — lihat `storage.rules` dan `api/sync-user-claims.js` untuk cara role/ownership disahkan melalui Auth custom claims.
- Fungsi "Tukar Kata Laluan" tersedia dalam Profile tab
