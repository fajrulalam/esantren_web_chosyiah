"use client";

import { use } from "react";
import IzinDetail from "@/components/izin/IzinDetail";

export default function IzinAdminDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <IzinDetail id={id} admin />;
}
