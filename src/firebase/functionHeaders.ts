import { auth } from "./config";

// The staff HTTP functions (deleteInvoiceHttp, add/removeSantrisToInvoiceHttp)
// verify the caller's Firebase ID token before touching invoices.
export async function jsonHeadersWithAuth(): Promise<Record<string, string>> {
  const token = await auth.currentUser?.getIdToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}
