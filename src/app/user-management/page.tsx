"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/firebase/auth";
import type { UserRole } from "@/firebase/auth";
import { db } from "@/firebase/config";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { KODE_ASRAMA } from "@/constants";
import SearchSelect, {
  SearchSelectOption,
} from "@/components/registration/SearchSelect";
import { EyeIcon } from "@heroicons/react/24/outline";

type ManagedUser = {
  id: string;
  email?: string;
  name?: string;
  role?: string;
  kodeAsrama?: string;
  santriId?: string;
};

type SantriCandidate = {
  id: string;
  nama: string;
  statusAktif?: string;
  kodeAsrama?: string;
  email?: string;
  nomorTelpon?: string;
  namaPanggilan?: string;
  honoraryName?: string;
  honoraryPronoun?: string;
  tanggalLahir?: string;
  tglLahir?: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const asOptionalString = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

export default function UserManagementPage() {
  // Always use the real, authenticated identity on this page (never the
  // previewed one) so starting a UI preview from here can't affect this
  // page's own admin permission checks or its CRUD actions.
  const { realUser: user, createNewUser, loading: authLoading, startUiPreview } =
    useAuth();
  const router = useRouter();

  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [allUsers, setAllUsers] = useState<ManagedUser[]>([]);
  const [santris, setSantris] = useState<SantriCandidate[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole>("pengurus");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [honoraryPronoun, setHonoraryPronoun] = useState("Pak");
  const [namaPanggilan, setNamaPanggilan] = useState("");
  const [tanggalLahir, setTanggalLahir] = useState("");

  const [selectedSantriId, setSelectedSantriId] = useState("");
  const [selectedSantri, setSelectedSantri] =
    useState<SantriCandidate | null>(null);
  const [upgradeEmail, setUpgradeEmail] = useState("");
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [previewingUserId, setPreviewingUserId] = useState<string | null>(
    null
  );

  const [previewSantriId, setPreviewSantriId] = useState("");
  const [selectedPreviewSantri, setSelectedPreviewSantri] =
    useState<SantriCandidate | null>(null);
  const [isPreviewingSantri, setIsPreviewingSantri] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    if (user.role !== "superAdmin") {
      router.replace("/");
    }
  }, [authLoading, router, user]);

  const loadManagementData = useCallback(async () => {
    setIsLoadingData(true);
    setError(null);

    try {
      const [usersSnapshot, santrisSnapshot] = await Promise.all([
        getDocs(collection(db, "PengurusCollection")),
        getDocs(
          query(
            collection(db, "SantriCollection"),
            where("kodeAsrama", "==", KODE_ASRAMA)
          )
        ),
      ]);

      const allUsersList = usersSnapshot.docs.map((userDoc) => {
        const data = userDoc.data();
        return {
          id: userDoc.id,
          email: asOptionalString(data.email),
          name: asOptionalString(data.name),
          role: asOptionalString(data.role),
          kodeAsrama: asOptionalString(data.kodeAsrama),
          santriId: asOptionalString(data.santriId),
        } satisfies ManagedUser;
      });

      const santriList = santrisSnapshot.docs
        .map((santriDoc) => {
          const data = santriDoc.data();
          return {
            id: santriDoc.id,
            nama: asOptionalString(data.nama) || "Tanpa Nama",
            statusAktif: asOptionalString(data.statusAktif),
            kodeAsrama: asOptionalString(data.kodeAsrama),
            email: asOptionalString(data.email),
            nomorTelpon: asOptionalString(data.nomorTelpon),
            namaPanggilan: asOptionalString(data.namaPanggilan),
            honoraryName: asOptionalString(data.honoraryName),
            honoraryPronoun: asOptionalString(data.honoraryPronoun),
            tanggalLahir: asOptionalString(data.tanggalLahir),
            tglLahir: asOptionalString(data.tglLahir),
          } satisfies SantriCandidate;
        })
        .sort((a, b) => a.nama.localeCompare(b.nama, "id-ID"));

      setAllUsers(allUsersList);
      setUsers(
        allUsersList.filter(
          (managedUser) => managedUser.kodeAsrama === KODE_ASRAMA
        )
      );
      setSantris(santriList);
    } catch (loadError) {
      console.error("Error fetching user-management data:", loadError);
      setError(
        getErrorMessage(loadError, "Failed to load users and Santri data")
      );
    } finally {
      setIsLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && user?.role === "superAdmin") {
      void loadManagementData();
    }
  }, [authLoading, loadManagementData, user]);

  const upgradedSantriIds = useMemo(
    () =>
      new Set(
        allUsers
          .map((managedUser) => managedUser.santriId)
          .filter((santriId): santriId is string => Boolean(santriId))
      ),
    [allUsers]
  );

  const upgradeableSantris = useMemo(
    () =>
      santris.filter(
        (santri) =>
          santri.statusAktif === "Aktif" && !upgradedSantriIds.has(santri.id)
      ),
    [santris, upgradedSantriIds]
  );

  const santriSearchOptions = useMemo<SearchSelectOption[]>(
    () =>
      upgradeableSantris.map((santri) => ({
        kode: santri.id,
        nama: santri.nama,
        subtitle: santri.email || santri.nomorTelpon,
      })),
    [upgradeableSantris]
  );

  // Santri accounts aren't Firebase Auth/PengurusCollection records, so they
  // never show up in the "Existing Users" table. To let a superAdmin preview
  // the waliSantri role's UI/UX anyway, any Santri (active or not) can be
  // picked here and previewed as they would see the app.
  const santriPreviewOptions = useMemo<SearchSelectOption[]>(
    () =>
      santris.map((santri) => ({
        kode: santri.id,
        nama: santri.nama,
        subtitle: [
          santri.statusAktif,
          santri.email || santri.nomorTelpon,
        ]
          .filter(Boolean)
          .join(" • "),
      })),
    [santris]
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      await createNewUser({
        email: normalizeEmail(email),
        name: name.trim(),
        role,
        phoneNumber: phoneNumber.trim(),
        honoraryPronoun,
        kodeAsrama: KODE_ASRAMA,
        namaPanggilan: namaPanggilan.trim(),
        tanggalLahir,
      });

      setSuccess(
        `User ${normalizeEmail(email)} successfully created with role: ${role}`
      );

      setEmail("");
      setName("");
      setRole("pengurus");
      setPhoneNumber("");
      setHonoraryPronoun("Pak");
      setNamaPanggilan("");
      setTanggalLahir("");

      await loadManagementData();
    } catch (submitError) {
      console.error("Error creating user:", submitError);
      setError(getErrorMessage(submitError, "Failed to create user"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectSantri = (santriId: string) => {
    setSelectedSantriId(santriId);
    const santri = upgradeableSantris.find(
      (candidate) => candidate.id === santriId
    );
    setSelectedSantri(santri || null);
  };

  const openUpgradeModal = () => {
    if (!selectedSantri) return;

    setError(null);
    setSuccess(null);
    setUpgradeEmail(selectedSantri.email || "");
    setIsUpgradeModalOpen(true);
  };

  const closeUpgradeModal = (force = false) => {
    if (isUpgrading && !force) return;

    setIsUpgradeModalOpen(false);
    setSelectedSantri(null);
    setSelectedSantriId("");
    setUpgradeEmail("");
  };

  const handleUpgradeSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedSantri || !user) return;

    const normalizedUpgradeEmail = normalizeEmail(upgradeEmail);
    if (!EMAIL_PATTERN.test(normalizedUpgradeEmail)) {
      setError("Please enter a valid Google email address.");
      return;
    }

    setError(null);
    setSuccess(null);
    setIsUpgrading(true);

    try {
      // Re-read the source record so a stale page cannot upgrade an inactive
      // or moved Santri, and check the live staff collection for duplicates.
      const [santriSnapshot, linkedUsersSnapshot, emailUsersSnapshot] =
        await Promise.all([
          getDoc(doc(db, "SantriCollection", selectedSantri.id)),
          getDocs(
            query(
              collection(db, "PengurusCollection"),
              where("santriId", "==", selectedSantri.id)
            )
          ),
          getDocs(
            query(
              collection(db, "PengurusCollection"),
              where("email", "==", normalizedUpgradeEmail)
            )
          ),
        ]);

      if (!santriSnapshot.exists()) {
        throw new Error("The selected Santri record no longer exists.");
      }

      const currentSantri = {
        ...selectedSantri,
        ...santriSnapshot.data(),
        id: selectedSantri.id,
      } as SantriCandidate;

      if (currentSantri.kodeAsrama !== KODE_ASRAMA) {
        throw new Error("The selected Santri belongs to another asrama.");
      }

      if (currentSantri.statusAktif !== "Aktif") {
        throw new Error("Only active Santri accounts can be upgraded.");
      }

      const hasLinkedUser =
        linkedUsersSnapshot.docs.length > 0 ||
        allUsers.some(
          (managedUser) => managedUser.santriId === selectedSantri.id
        );
      if (hasLinkedUser) {
        throw new Error("This Santri is already linked to a Pengurus account.");
      }

      const emailAlreadyUsed =
        emailUsersSnapshot.docs.length > 0 ||
        allUsers.some(
          (managedUser) =>
            managedUser.email &&
            normalizeEmail(managedUser.email) === normalizedUpgradeEmail
        );
      if (emailAlreadyUsed) {
        throw new Error("A user with this email already exists.");
      }

      const pengurusRef = doc(collection(db, "PengurusCollection"));
      const accountData = {
        email: normalizedUpgradeEmail,
        name: currentSantri.nama,
        role: "pengurus",
        phoneNumber: currentSantri.nomorTelpon || null,
        honoraryPronoun:
          currentSantri.honoraryPronoun || currentSantri.honoraryName || "Mbak",
        kodeAsrama: KODE_ASRAMA,
        namaPanggilan: currentSantri.namaPanggilan || currentSantri.nama,
        tanggalLahir:
          currentSantri.tanggalLahir || currentSantri.tglLahir || "",
        santriId: currentSantri.id,
        accountSource: "santri-upgrade",
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        upgradedAt: serverTimestamp(),
      };

      await setDoc(pengurusRef, accountData);

      const newUser = {
        id: pengurusRef.id,
        email: accountData.email,
        name: accountData.name,
        role: accountData.role,
        kodeAsrama: accountData.kodeAsrama,
        santriId: accountData.santriId,
      } satisfies ManagedUser;

      setAllUsers((currentUsers) => [...currentUsers, newUser]);
      setUsers((currentUsers) => [...currentUsers, newUser]);
      setSuccess(
        `${currentSantri.nama} has been pre-registered as Pengurus. They must sign in with Google using ${normalizedUpgradeEmail}.`
      );
      closeUpgradeModal(true);
    } catch (upgradeError) {
      console.error("Error upgrading Santri to Pengurus:", upgradeError);
      setError(
        getErrorMessage(upgradeError, "Failed to upgrade the Santri account")
      );
    } finally {
      setIsUpgrading(false);
    }
  };

  const handleDeleteUser = async (managedUser: ManagedUser) => {
    if (
      !window.confirm(
        `Are you sure you want to delete the user ${
          managedUser.name || managedUser.email || "this user"
        }?`
      )
    ) {
      return;
    }

    setError(null);
    setSuccess(null);
    setDeletingUserId(managedUser.id);

    try {
      await deleteDoc(doc(db, "PengurusCollection", managedUser.id));
      setAllUsers((currentUsers) =>
        currentUsers.filter((currentUser) => currentUser.id !== managedUser.id)
      );
      setUsers((currentUsers) =>
        currentUsers.filter((currentUser) => currentUser.id !== managedUser.id)
      );
      setSuccess("User deleted successfully");
    } catch (deleteError) {
      console.error("Error deleting user:", deleteError);
      setError(getErrorMessage(deleteError, "Failed to delete user"));
    } finally {
      setDeletingUserId(null);
    }
  };

  const handleStartPreview = (managedUser: ManagedUser) => {
    if (!managedUser.role || !user || managedUser.id === user.uid) return;

    setError(null);
    setSuccess(null);
    setPreviewingUserId(managedUser.id);

    try {
      const previewed = startUiPreview({
        uid: managedUser.id,
        email: managedUser.email,
        name: managedUser.name,
        role: managedUser.role as UserRole,
        santriId: managedUser.santriId,
      });

      router.push(previewed.role === "waliSantri" ? "/payment-history" : "/rekapitulasi");
    } catch (previewError) {
      console.error("Error starting UI preview:", previewError);
      setError(getErrorMessage(previewError, "Failed to start UI preview"));
    } finally {
      setPreviewingUserId(null);
    }
  };

  const handleSelectPreviewSantri = (santriId: string) => {
    setPreviewSantriId(santriId);
    const santri = santris.find((candidate) => candidate.id === santriId);
    setSelectedPreviewSantri(santri || null);
  };

  const handlePreviewAsWaliSantri = () => {
    if (!selectedPreviewSantri) return;

    setError(null);
    setSuccess(null);
    setIsPreviewingSantri(true);

    try {
      startUiPreview({
        // Mirrors the synthetic uid a Santri's own self-service login uses,
        // so pages that key off it (payment history, izin, vouchers) behave
        // the same way for a preview as they would for a real waliSantri.
        uid: `wali_${selectedPreviewSantri.id}`,
        email: selectedPreviewSantri.email || null,
        name:
          selectedPreviewSantri.namaPanggilan || selectedPreviewSantri.nama,
        role: "waliSantri",
        santriId: selectedPreviewSantri.id,
      });

      router.push("/payment-history");
    } catch (previewError) {
      console.error("Error starting Santri UI preview:", previewError);
      setError(getErrorMessage(previewError, "Failed to start UI preview"));
    } finally {
      setIsPreviewingSantri(false);
    }
  };

  if (authLoading || !user || user.role !== "superAdmin") {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-center text-gray-600 dark:text-gray-300">
          Checking access...
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h2 className="text-2xl font-bold mb-6 dark:text-white">User Management</h2>

      {error && (
        <div
          role="alert"
          className="bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded mb-4"
        >
          {error}
        </div>
      )}

      {success && (
        <div
          role="status"
          className="bg-green-100 dark:bg-green-900/30 border border-green-400 dark:border-green-800 text-green-700 dark:text-green-400 px-4 py-3 rounded mb-4"
        >
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 shadow-md rounded px-8 pt-6 pb-8 mb-4">
          <h3 className="text-xl font-semibold mb-4 dark:text-white">
            Create New User
          </h3>
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label
                className="block text-gray-700 dark:text-gray-200 text-sm font-bold mb-2"
                htmlFor="email"
              >
                Email <span className="text-red-500 dark:text-red-400">*</span>
              </label>
              <input
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 dark:text-white dark:bg-gray-700 dark:border-gray-600 leading-tight focus:outline-none focus:shadow-outline"
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="user@example.com"
                required
              />
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                This email will be used to sign in with Google
              </p>
            </div>

            <div className="mb-4">
              <label
                className="block text-gray-700 dark:text-gray-200 text-sm font-bold mb-2"
                htmlFor="name"
              >
                Full Name <span className="text-red-500 dark:text-red-400">*</span>
              </label>
              <input
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 dark:text-white dark:bg-gray-700 dark:border-gray-600 leading-tight focus:outline-none focus:shadow-outline"
                id="name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Full Name"
                required
              />
            </div>

            <div className="mb-4">
              <label
                className="block text-gray-700 dark:text-gray-200 text-sm font-bold mb-2"
                htmlFor="role"
              >
                Role <span className="text-red-500 dark:text-red-400">*</span>
              </label>
              <select
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 dark:text-white dark:bg-gray-700 dark:border-gray-600 leading-tight focus:outline-none focus:shadow-outline"
                id="role"
                value={role}
                onChange={(event) => setRole(event.target.value as UserRole)}
                required
              >
                <option value="pengurus">Pengurus</option>
                <option value="pengasuh">Pengasuh</option>
                <option value="superAdmin">Super Admin</option>
              </select>
            </div>

            <div className="mb-4">
              <label
                className="block text-gray-700 dark:text-gray-200 text-sm font-bold mb-2"
                htmlFor="phoneNumber"
              >
                Phone Number
              </label>
              <input
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 dark:text-white dark:bg-gray-700 dark:border-gray-600 leading-tight focus:outline-none focus:shadow-outline"
                id="phoneNumber"
                type="tel"
                value={phoneNumber}
                onChange={(event) => setPhoneNumber(event.target.value)}
                placeholder="Phone Number (Optional)"
              />
            </div>

            <div className="mb-4">
              <label
                className="block text-gray-700 dark:text-gray-200 text-sm font-bold mb-2"
                htmlFor="honoraryPronoun"
              >
                Honorary Pronoun <span className="text-red-500 dark:text-red-400">*</span>
              </label>
              <select
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 dark:text-white dark:bg-gray-700 dark:border-gray-600 leading-tight focus:outline-none focus:shadow-outline"
                id="honoraryPronoun"
                value={honoraryPronoun}
                onChange={(event) => setHonoraryPronoun(event.target.value)}
                required
              >
                <option value="Ustad">Ustad</option>
                <option value="Ustadzah">Ustadzah</option>
                <option value="Ning">Ning</option>
                <option value="Abah">Abah</option>
                <option value="Ayah">Ayah</option>
                <option value="Bapak">Bapak</option>
                <option value="Gus">Gus</option>
                <option value="Pak">Pak</option>
                <option value="Cak">Cak</option>
                <option value="Mbak">Mbak</option>
              </select>
            </div>

            <div className="mb-4">
              <label
                className="block text-gray-700 dark:text-gray-200 text-sm font-bold mb-2"
                htmlFor="namaPanggilan"
              >
                Nama Panggilan <span className="text-red-500 dark:text-red-400">*</span>
              </label>
              <input
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 dark:text-white dark:bg-gray-700 dark:border-gray-600 leading-tight focus:outline-none focus:shadow-outline"
                id="namaPanggilan"
                type="text"
                value={namaPanggilan}
                onChange={(event) => setNamaPanggilan(event.target.value)}
                placeholder="Nama Panggilan"
                required
              />
            </div>

            <div className="mb-6">
              <label
                className="block text-gray-700 dark:text-gray-200 text-sm font-bold mb-2"
                htmlFor="tanggalLahir"
              >
                Tanggal Lahir <span className="text-red-500 dark:text-red-400">*</span>
              </label>
              <input
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 dark:text-white dark:bg-gray-700 dark:border-gray-600 leading-tight focus:outline-none focus:shadow-outline"
                id="tanggalLahir"
                type="date"
                value={tanggalLahir}
                onChange={(event) => setTanggalLahir(event.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              className="bg-blue-500 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-800 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline w-full transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Creating User..." : "Create User"}
            </button>
          </form>
        </div>

        <div className="bg-white dark:bg-gray-800 shadow-md rounded px-8 pt-6 pb-8 mb-4">
          <h3 className="text-xl font-semibold mb-2 dark:text-white">
            Existing Users
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Staff accounts registered for {KODE_ASRAMA}.
          </p>
          {isLoadingData ? (
            <p className="text-center py-4 dark:text-gray-300">
              Loading users...
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white dark:bg-gray-800">
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-700">
                    <th className="py-2 px-4 border-b dark:border-gray-600 text-left dark:text-gray-200">
                      Name
                    </th>
                    <th className="py-2 px-4 border-b dark:border-gray-600 text-left dark:text-gray-200">
                      Email
                    </th>
                    <th className="py-2 px-4 border-b dark:border-gray-600 text-left dark:text-gray-200">
                      Role
                    </th>
                    <th className="py-2 px-4 border-b dark:border-gray-600 text-center dark:text-gray-200">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="dark:text-gray-300">
                  {users.map((managedUser) => (
                    <tr
                      key={managedUser.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <td className="py-2 px-4 border-b dark:border-gray-600">
                        {managedUser.name || "-"}
                      </td>
                      <td className="py-2 px-4 border-b dark:border-gray-600">
                        {managedUser.email || "-"}
                      </td>
                      <td className="py-2 px-4 border-b dark:border-gray-600">
                        {managedUser.role || "-"}
                      </td>
                      <td className="py-2 px-4 border-b dark:border-gray-600 text-center">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => handleStartPreview(managedUser)}
                            title={`Preview UI/UX sebagai ${
                              managedUser.name || managedUser.email
                            }`}
                            className="inline-flex items-center gap-1 bg-amber-500 hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-700 text-white font-bold py-1 px-3 rounded focus:outline-none focus:shadow-outline text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                            disabled={
                              managedUser.id === user.uid ||
                              !managedUser.role ||
                              previewingUserId === managedUser.id
                            }
                          >
                            <EyeIcon className="h-4 w-4" />
                            Preview
                          </button>
                          <button
                            onClick={() => void handleDeleteUser(managedUser)}
                            className="bg-red-500 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-800 text-white font-bold py-1 px-3 rounded focus:outline-none focus:shadow-outline text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                            disabled={deletingUserId === managedUser.id}
                          >
                            {deletingUserId === managedUser.id ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="py-4 px-4 text-center text-gray-500 dark:text-gray-400"
                      >
                        No users found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 shadow-md rounded px-8 pt-6 pb-8 mb-6">
        <h3 className="text-xl font-semibold mb-2 dark:text-white">
          Upgrade Santri to Pengurus
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 max-w-3xl">
          Select an active Santri to pre-register the same person as a Pengurus.
          Their Santri record and payment history stay in place; only the staff
          access record is added.
        </p>

        {isLoadingData ? (
          <p className="text-gray-600 dark:text-gray-300">Loading Santri...</p>
        ) : (
          <div className="max-w-2xl">
            <label
              htmlFor="santriToUpgrade"
              className="block text-gray-700 dark:text-gray-200 text-sm font-bold mb-2"
            >
              Active Santri
            </label>
            <SearchSelect
              id="santriToUpgrade"
              options={santriSearchOptions}
              value={selectedSantriId}
              onChange={(santriId) => handleSelectSantri(santriId)}
              inputClassName="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 dark:text-white dark:bg-gray-700 dark:border-gray-600 leading-tight focus:outline-none focus:shadow-outline disabled:opacity-60"
              placeholder="Search by name, email, or phone..."
              disabledPlaceholder="No active Santri available"
              disabled={upgradeableSantris.length === 0 || isUpgrading}
              maxResults={100}
            />

            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Type to search by name, email, or phone, then select a result.
            </p>

            {selectedSantri && (
              <div className="mt-3 rounded border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 px-4 py-3 text-sm text-blue-900 dark:text-blue-200">
                <p className="font-semibold">{selectedSantri.nama}</p>
                <p>
                  Nomor telepon: {selectedSantri.nomorTelpon || "Belum tersedia"}
                </p>
                <p>
                  Email saat ini: {selectedSantri.email || "Belum tersedia"}
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={openUpgradeModal}
              disabled={!selectedSantri || isUpgrading}
              className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Upgrade to Pengurus
            </button>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              {upgradeableSantris.length} active Santri account(s) available.
            </p>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 shadow-md rounded px-8 pt-6 pb-8 mb-6">
        <h3 className="text-xl font-semibold mb-2 dark:text-white">
          Preview as Santri
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 max-w-3xl">
          Santri accounts aren&apos;t staff records, so they never appear in
          the Existing Users table above. Pick any Santri here to preview the
          app exactly as they would see it &mdash; nothing is created or
          changed.
        </p>

        {isLoadingData ? (
          <p className="text-gray-600 dark:text-gray-300">Loading Santri...</p>
        ) : (
          <div className="max-w-2xl">
            <label
              htmlFor="santriToPreview"
              className="block text-gray-700 dark:text-gray-200 text-sm font-bold mb-2"
            >
              Santri
            </label>
            <SearchSelect
              id="santriToPreview"
              options={santriPreviewOptions}
              value={previewSantriId}
              onChange={(santriId) => handleSelectPreviewSantri(santriId)}
              inputClassName="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 dark:text-white dark:bg-gray-700 dark:border-gray-600 leading-tight focus:outline-none focus:shadow-outline disabled:opacity-60"
              placeholder="Search by name, email, or phone..."
              disabledPlaceholder="No Santri available"
              disabled={santris.length === 0 || isPreviewingSantri}
              maxResults={100}
            />

            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Type to search by name, email, or phone, then select a result.
            </p>

            {selectedPreviewSantri && (
              <div className="mt-3 rounded border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
                <p className="font-semibold">{selectedPreviewSantri.nama}</p>
                <p>Status: {selectedPreviewSantri.statusAktif || "Tidak diketahui"}</p>
                <p>
                  Nomor telepon:{" "}
                  {selectedPreviewSantri.nomorTelpon || "Belum tersedia"}
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={handlePreviewAsWaliSantri}
              disabled={!selectedPreviewSantri || isPreviewingSantri}
              className="mt-4 inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <EyeIcon className="h-4 w-4" />
              Preview as Santri
            </button>
          </div>
        )}
      </div>

      <div className="bg-yellow-50 dark:bg-yellow-900/30 border-l-4 border-yellow-400 dark:border-yellow-600 p-4 mb-6">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg
              className="h-5 w-5 text-yellow-400 dark:text-yellow-300"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-yellow-700 dark:text-yellow-200">
              Users must sign in with Google using the registered email address.
              Their access is determined by the assigned role.
            </p>
          </div>
        </div>
      </div>

      {isUpgradeModalOpen && selectedSantri && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="upgrade-dialog-title"
        >
          <div className="w-full max-w-lg rounded-xl bg-white dark:bg-gray-800 shadow-xl p-6">
            <h3
              id="upgrade-dialog-title"
              className="text-xl font-semibold text-gray-900 dark:text-white"
            >
              Upgrade {selectedSantri.nama}?
            </h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              This creates a Pengurus access record linked to the existing Santri
              record. Enter the Google email this person will use to sign in.
            </p>

            <form onSubmit={handleUpgradeSubmit} className="mt-5">
              <label
                htmlFor="upgradeEmail"
                className="block text-gray-700 dark:text-gray-200 text-sm font-bold mb-2"
              >
                Google email <span className="text-red-500">*</span>
              </label>
              <input
                id="upgradeEmail"
                type="email"
                value={upgradeEmail}
                onChange={(event) => setUpgradeEmail(event.target.value)}
                placeholder="user@example.com"
                required
                autoFocus
                disabled={isUpgrading}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 dark:text-white dark:bg-gray-700 dark:border-gray-600 leading-tight focus:outline-none focus:shadow-outline disabled:opacity-60"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                The email is normalized to lowercase and must not already belong
                to another Pengurus account.
              </p>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => closeUpgradeModal()}
                  disabled={isUpgrading}
                  className="rounded border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpgrading}
                  className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed"
                  aria-busy={isUpgrading}
                >
                  {isUpgrading ? "Upgrading..." : "Confirm Upgrade"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
