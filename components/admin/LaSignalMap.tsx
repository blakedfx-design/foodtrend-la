"use client";

import dynamic from "next/dynamic";

import type { LaSignalMapProps } from "./LaSignalMapImpl";

export type { LaSignalMapNeighborhood, LaSignalMapPlaceCluster, LaSignalMapPlacePoint } from "@/lib/admin/laSignalMapLayout";

const LaSignalMapImpl = dynamic(() => import("./LaSignalMapImpl"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[420px] items-center justify-center rounded-xl border-2 border-[#cfc3aa] bg-[#f5f2eb] text-sm text-[#64748b]">
      Loading map…
    </div>
  ),
});

export default function LaSignalMap(props: LaSignalMapProps) {
  return <LaSignalMapImpl {...props} />;
}
