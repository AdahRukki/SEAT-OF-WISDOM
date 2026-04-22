import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== "undefined" && navigator.onLine === false
  );

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

    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
      window.removeEventListener("app:api-offline", goOffline);
      window.removeEventListener("app:api-online", goOnline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="offline-banner"
      className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full bg-amber-500 px-4 py-2 text-white shadow-lg text-sm font-medium max-w-[90vw]"
    >
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>You are offline — data may be outdated</span>
    </div>
  );
}
