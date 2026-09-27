# Phone-login cutover runbook

Ends the santri name + phone login and locks Firestore, Storage and Cloud
Functions down to signed-in santri (Google or email link) and staff. Background:
[ACCESS_AUDIT.md](ACCESS_AUDIT.md).

## Where things stand (2026-09-27)

| Piece | State |
| --- | --- |
| Firestore rules | **Transition rules live** (`firebase-rules/firestore.rules`, ruleset `cd4698f8-81d3-4642-89b0-83fc05c8ba29`). Replaced the open test-mode rules (`42bcf9d1-922b-4a1e-b2f3-69a619e37930`). |
| Storage rules | **Transition rules live** (`firebase-rules/storage.rules`, ruleset `dd4c7c5d-366e-4ca7-b11c-d347bf3e91db`). Replaced `e24d1948-b201-4bed-b219-ccc707fa39a3`. |
| `linkSantriAccount` function | Deployed. |
| Web client with Google / email-link santri login | In this branch, not deployed. |
| Function caller checks (`functions/src/access.ts`) | **Deployed 2026-09-27** with all 21 functions (now Node 20). Phone login is still tolerated (`ALLOW_UNAUTHENTICATED_SANTRI = true`). `ssresantren` is not in this repo and was left untouched. |
| Lockdown rules | Ready in `firebase-rules/cutover/`, tested, not published. |
| Santri readiness | 25 of 425 active santri have an email on file; 0 have linked an account. |

## 1. Before the cutover (can happen now, breaks nothing)

1. **Deploy the updated web client** with `PHONE_LOGIN_ENABLED = true`. It adds
   the Google / email-link santri login and the facility reports, sends
   `inviteId` when staff claim an invitation, sends an ID token to the staff
   HTTP functions, and stops santri sessions from running the semester sync.
2. **Function caller checks — done 2026-09-27.** For a later redeploy (safe
   while `ALLOW_UNAUTHENTICATED_SANTRI = true`; closes the staff-only functions
   to non-staff), deploy the functions by name so `ssresantren` (not in this
   repo) isn't offered for deletion:
   ```sh
   firebase deploy --project e-santren --only functions:deleteInvoiceFunction,functions:addSantrisToInvoiceFunction,functions:removeSantrisFromInvoiceFunction,functions:getInvoicePaymentStatuses,functions:getInvoicePayments,functions:getSantriPaymentHistory,functions:getSantriPayments,functions:debugSantriStructure,functions:submitPaymentInstallment,functions:deleteInvoiceHttp,functions:addSantrisToInvoiceHttp,functions:removeSantrisFromInvoiceHttp
   ```
   The 2026-09-27 deploy also moved the ~15 functions last deployed in April
   2025 (Node 18) to the current repo code and Node 20. The rekapitulasi page
   calls a `deleteInvoice` callable that is not deployed at all (only
   `deleteInvoiceFunction` and `deleteInvoiceHttp` are) — export it if that
   button should work.
3. **Turn on email-link sign-in:** Firebase console → Authentication →
   Sign-in method → Email/Password → enable *Email link (passwordless sign-in)*.
4. **Close the staff invitation gap** once step 1 is live: in
   `firebase-rules/firestore.rules`, delete the line
   `|| !('inviteId' in data)` from `isInvitationClaim`, then
   `firebase deploy --only firestore:rules --project e-santren`.
5. **Get every active santri linked.** Staff fill in missing emails in Data
   Santri; santri then sign in once with Google or an email link. Track it:
   ```sh
   node scripts/cutover-readiness.mjs
   ```
   Cut over when "would be locked out at cutover" is 0 (or a number you accept —
   those santri will need staff to add their email before they can sign in).

## 2. The cutover (one sitting, in this order)

1. Flip both switches:
   - `src/constants/index.ts` → `PHONE_LOGIN_ENABLED = false`
   - `functions/src/access.ts` → `ALLOW_UNAUTHENTICATED_SANTRI = false`
2. Deploy the functions from step 1.2 again, then the web client — close
   together, since phone-login santri can't submit payments once the functions
   are switched.
3. Publish the lockdown rules:
   ```sh
   firebase deploy --only firestore:rules,storage --config firebase.cutover.json --project e-santren
   ```
   The Storage rules read staff roles from Firestore; accept if the CLI asks to
   let Storage access Firestore.
4. Make the default config match production: copy
   `firebase-rules/cutover/*.rules` over `firebase-rules/*.rules` (so a plain
   `firebase deploy` never re-publishes the transition rules).

## 3. Verify

- Emulator tests (both must pass before publishing):
  ```sh
  firebase emulators:exec --only firestore,storage,auth --project demo-esantren-rules 'node --test tests/security-rules.emulator.cjs'
  RULES_SET=cutover firebase emulators:exec --only firestore,storage,auth --project demo-esantren-rules --config firebase.cutover.json 'node --test tests/security-rules.emulator.cjs'
  ```
- After publishing: a santri signs in with Google and with an email link; a
  staff member signs in; an anonymous read of `SantriCollection` now fails.

## Rollback

Functions: the pre-2026-09-27 live versions came from the April 2025 source
(`git show 9181cb3:functions/src/...`) for all but `submitPaymentInstallment`,
`processInvoiceCreation` and `reviewPaymentInstallment`. Check out that source
into `functions/src`, build, and deploy by name as above.

Firebase console → Firestore / Storage → Rules → history → restore the previous
version (or `firebase deploy --only firestore:rules,storage` with the transition
files). Flip both switches back to `true` and redeploy the client and functions.
