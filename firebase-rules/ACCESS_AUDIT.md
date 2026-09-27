# Firestore & Storage access audit

Derived from the client code (`src/`; paths built with template strings included) and Cloud Functions (`functions/src`) on
2026-09-27, against commit 88cf012 plus the facility-report and santri-login
changes. Use it when changing `firestore.rules` / `storage.rules`.

## Who the rules can see

| Session | How it signs in | What rules see |
| --- | --- | --- |
| Visitor (landing, registration, login) | none | `request.auth == null` |
| Santri / bendahara, phone login | name + phone, stored in `localStorage` | `request.auth == null` — **indistinguishable from a visitor** |
| Santri / bendahara, Google or email link | Firebase Auth + `linkSantriAccount` | `request.auth.token.santriId` |
| Staff (pengurus, pengasuh, superAdmin) | Firebase Auth, `PengurusCollection/{uid}.role` | role via `get()` |
| Cloud Functions | Admin SDK | **bypass rules entirely** |

Roles present in `PengurusCollection` (29 docs): pengurus 22, superAdmin 4,
pengasuh 2, bendahara 1. The bendahara record is an unclaimed invitation, so the
bendahara uses phone login today.

## Firestore

"Anon" means visitors and phone-login santri (the rules cannot tell them apart).

| Collection | Read | Write | Used by |
| --- | --- | --- | --- |
| `SantriCollection` | anon (login looks santri up by name/phone; payment history, izin, facility) | staff: all. anon: only `statusKehadiran`, `statusKepulangan`, `statusSakit` (izin report/complete). Bendahara phone sessions also run semester sync (`semester`, `kelas`, `semesterAutoUpdatedPeriod`) — redundant with staff sync; now skipped client-side | login, payment-history, izin, data-santri, denah, attendance, kegiatan, user-management, SantriSemesterSync |
| `PengurusCollection` | staff; a signed-in user's own doc; a signed-in user's invitation (query by own email); phone login's bendahara check (falls back to the santri doc's `isBendahara`) | superAdmin (create/update/delete); a signed-in user claiming their invitation (copies it to `/{uid}`) | auth, user-management, attendance, kegiatan, izin completion |
| `SakitDanPulangCollection` | anon (own izin list/detail), staff | anon: create a new report; complete it (status + return/recovery fields). staff: all | izin-santri, izin-admin, attendance |
| `CashflowTransactions`, `CashflowSettings` | anon (bendahara phone login), staff | anon + staff: create/update/delete | cashflow |
| `FacilityReports` (new) | anon | anon: create (pending) and withdraw pending; superAdmin: review/proof/delete | fasilitas-santri, fasilitas-admin |
| `vouchers` | anon (my-vouchers) | superAdmin | my-vouchers, voucher-asrama |
| `voucherGroup` | superAdmin | superAdmin | voucher-asrama |
| `Invoices` | anon: get by id (payment history); staff: list | staff | payment-history, rekapitulasi, data-santri |
| `PaymentStatuses` | anon (payment history), staff | staff (santri payments go through `submitPaymentInstallment`) | payment-history, rekapitulasi, data-santri |
| `AktivitasCollection/{kode}/PembayaranLogs/**` (legacy payment logs and their `PaymentStatusEachSantri`) | staff | none from clients (read-only; Cloud Functions write) | rekapitulasi, RekapDetailView, SantriPaymentStatusModal. **Missed by the first pass** because the path is a template string — its denial emptied the rekapitulasi dashboard until rule `AktivitasCollection` was added. |
| `AttendanceTypes`, `AttendanceRecords` | staff | staff | attendance |
| `KegiatanCollection` | staff | staff | kegiatan |
| `Counters` | — (Functions only) | — | Functions |

## Storage

| Path | Upload | Read (for `getDownloadURL`) |
| --- | --- | --- |
| `public-uploads/registration-proofs/{file}` | visitor registering (image/PDF) | uploader, right after upload |
| `payment_proofs/{santriName}/{file}` | santri (phone login) and staff; JPG/PNG/PDF ≤ 5 MB client-side | uploader, right after upload; staff |
| `public-uploads/facility-reports/{santriId}/{file}` | santri; JPEG ≤ 1 MB | uploader, right after upload |
| `public-uploads/facility-report-proofs/{uid}/{file}` | superAdmin | signed-in |
| `reports/{file}` | staff (kegiatan PDF; same name per date range, so overwrites) | signed-in |

Displaying an existing file uses its tokenized download URL, which is **not
subject to rules** — tightening read rules does not break stored links.

## Cloud Functions (bypass rules)

*Before 2026-09-27* only `reviewPaymentInstallment` checked the caller and all
others were callable by anyone with the project URL. Since that deploy the
staff-only functions (below) require a signed-in staff member, and the
santri-facing ones require the santri concerned or staff — except while
`ALLOW_UNAUTHENTICATED_SANTRI` is on, which still admits phone-login santri
(`getSantriPaymentHistory`, `submitPaymentInstallment`) and the staff HTTP
endpoints called without a token. The list of functions that were open: `deleteInvoice(Function|Http)`,
`add/removeSantrisToInvoice*`, `getSantriPayments`, `getSantriPaymentHistory`,
`getInvoicePayments`, `getInvoicePaymentStatuses`, `debugSantriStructure`,
`testCors`. `registerSantri` and `submitPaymentInstallment` are intentionally
public (visitor registration, phone-login payments). Rules cannot protect data
these functions expose or change; they need their own caller checks.

## Known gaps while phone login exists

1. Anything a phone-login santri can do, any visitor can do (rules can't tell
   them apart): read santri records, file izin, edit cashflow, withdraw pending
   facility reports.
2. Staff invitation claims can't be verified by the current client (it doesn't
   send the invitation id), so any Google account can create its own
   `PengurusCollection` record. The updated client sends `inviteId`; once it is
   live, `firestore.rules` drops the unverified branch.
3. Public Cloud Functions (above).

All three close at the phone-login cutover (`cutover/` rules + function checks).
Only 25 of 425 active santri have an email on file, which the cutover requires.
Status, order of operations and rollback: [CUTOVER.md](CUTOVER.md).
