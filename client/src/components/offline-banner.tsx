import { useEffect, useState } from "react";
import { WifiOff, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";
import {
  addSyncListener,
  getPendingCount,
  processOfflineQueue,
  type SyncStatus,
} from "@/lib/offline-queue";

type Feedback = {
  kind: "success" | "partial" | "error";
  message: string;
} | null;

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== "undefined" && navigator.onLine === false
  );
  const [pendingCount, setPendingCount] = useState<number>(() =>
    typeof window === "undefined" ? 0 : getPendingCount()
  );
  const [syncing, setSyncing] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => {
      if (typeof navigator === "undefined" || navigator.onLine) {
        setIsOffline(false);
      }
    };

    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    window.addEventListener("app:api-offline", goOffline);
    window.addEventListener("app:api-online", goOnline);

    const refreshCount = () => setPendingCount(getPendingCount());
    window.addEventListener("storage", refreshCount);
    const interval = setInterval(refreshCount, 1500);

    const unsubscribe = addSyncListener((status: SyncStatus) => {
      setSyncing(status.syncing);
      setPendingCount(status.pendingCount);
      if (status.justSynced) {
        const succeeded = status.succeededCount ?? 0;
        const dropped = status.droppedCount ?? 0;
        const stillPending = status.stillPendingFailures ?? 0;
        const networkFails = status.networkFailures ?? 0;

        if (succeeded === 0 && dropped === 0 && stillPending === 0 && networkFails > 0) {
          setFeedback({
            kind: "error",
            message: `Still offline — ${networkFails} action${networkFails === 1 ? "" : "s"} kept for retry.`,
          });
        } else if (dropped > 0 && succeeded === 0) {
          setFeedback({
            kind: "error",
            message: `${dropped} action${dropped === 1 ? "" : "s"} couldn't be saved after several tries.`,
          });
        } else if (dropped > 0 || stillPending > 0) {
          const parts: string[] = [];
          if (succeeded > 0) parts.push(`${succeeded} saved`);
          if (stillPending > 0) parts.push(`${stillPending} will retry`);
          if (dropped > 0) parts.push(`${dropped} failed`);
          setFeedback({ kind: "partial", message: parts.join(", ") + "." });
        } else if (succeeded > 0) {
          setFeedback({
            kind: "success",
            message: `${succeeded} action${succeeded === 1 ? "" : "s"} synced.`,
          });
        }
      } else if (!status.syncing && status.pendingCount === 0) {
        setFeedback(null);
      }
    });

    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
      window.removeEventListener("app:api-offline", goOffline);
      window.removeEventListener("app:api-online", goOnline);
      window.removeEventListener("storage", refreshCount);
      clearInterval(interval);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(t);
  }, [feedback]);

  const handleRetry = () => {
    setFeedback(null);
    processOfflineQueue({ force: true });
  };

  const showBanner = isOffline || pendingCount > 0 || syncing || !!feedback;
  if (!showBanner) return null;

  let bgClass = "bg-amber-500";
  let Icon = WifiOff;
  let label = "You are offline — data may be outdated";

  if (syncing) {
    bgClass = "bg-blue-600";
    Icon = RefreshCw;
    label = `Syncing ${pendingCount} action${pendingCount === 1 ? "" : "s"}…`;
  } else if (feedback) {
    if (feedback.kind === "success") {
      bgClass = "bg-emerald-600";
      Icon = CheckCircle2;
    } else if (feedback.kind === "partial") {
      bgClass = "bg-amber-600";
      Icon = AlertTriangle;
    } else {
      bgClass = "bg-red-600";
      Icon = AlertTriangle;
    }
    label = feedback.message;
  } else if (isOffline && pendingCount > 0) {
    label = `Offline — ${pendingCount} action${pendingCount === 1 ? "" : "s"} waiting to sync`;
  } else if (pendingCount > 0) {
    bgClass = "bg-amber-600";
    Icon = AlertTriangle;
    label = `${pendingCount} action${pendingCount === 1 ? "" : "s"} waiting to sync`;
  }

  const showRetry = !syncing && pendingCount > 0 && !isOffline;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="offline-banner"
      className={`fixed top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full ${bgClass} px-4 py-2 text-white shadow-lg text-sm font-medium max-w-[92vw]`}
    >
      <Icon className={`h-4 w-4 shrink-0 ${syncing ? "animate-spin" : ""}`} />
      <span className="truncate">{label}</span>
      {showRetry && (
        <button
          type="button"
          onClick={handleRetry}
          data-testid="offline-banner-retry"
          className="ml-1 rounded-full bg-white/20 px-3 py-0.5 text-xs font-semibold hover:bg-white/30 focus:outline-none focus:ring-2 focus:ring-white/60"
        >
          Retry now
        </button>
      )}
    </div>
  );
}
