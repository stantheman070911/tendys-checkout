"use client";

import { useEffect, useRef, useState } from "react";
import { getCsvExportErrorMessage } from "@/lib/admin/csv-export";

export function useAdminCsvExport(args: {
  roundId: string;
  onError: (message: string) => void;
}) {
  const { roundId, onError } = args;
  const [csvCooldown, setCsvCooldown] = useState(false);
  const [csvExporting, setCsvExporting] = useState(false);
  const csvCooldownTimerRef = useRef<number | null>(null);
  const csvFrameRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(
    () => () => {
      if (csvCooldownTimerRef.current != null) {
        window.clearTimeout(csvCooldownTimerRef.current);
      }
      if (csvFrameRef.current) {
        csvFrameRef.current.remove();
        csvFrameRef.current = null;
      }
    },
    [],
  );

  async function startCsvExport() {
    if (csvCooldown || csvExporting) {
      return;
    }

    setCsvExporting(true);
    const exportUrl = `/api/export-csv?roundId=${encodeURIComponent(roundId)}`;

    try {
      const preflight = await fetch(exportUrl, {
        method: "HEAD",
        credentials: "include",
      });

      if (!preflight.ok) {
        throw new Error(getCsvExportErrorMessage(preflight.status));
      }

      let iframe = csvFrameRef.current;
      if (!iframe || !document.body.contains(iframe)) {
        iframe = document.createElement("iframe");
        iframe.name = "admin-csv-download";
        iframe.setAttribute("aria-hidden", "true");
        iframe.style.display = "none";
        document.body.appendChild(iframe);
        csvFrameRef.current = iframe;
      }

      iframe.src = "about:blank";
      iframe.src = exportUrl;

      setCsvCooldown(true);
      csvCooldownTimerRef.current = window.setTimeout(() => {
        setCsvCooldown(false);
        csvCooldownTimerRef.current = null;
      }, 1500);
    } catch (error) {
      onError(error instanceof Error ? error.message : "匯出失敗");
    } finally {
      setCsvExporting(false);
    }
  }

  return {
    csvCooldown,
    csvExporting,
    startCsvExport,
  };
}
