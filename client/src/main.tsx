import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { ensureFirebaseReady } from "@/lib/firebase";

// Show loading indicator while Firebase initializes
const rootElement = document.getElementById("root")!;
rootElement.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui;color:#666;"><div style="text-align:center;"><div style="width:40px;height:40px;border:3px solid #e5e7eb;border-top-color:#3b82f6;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 16px;"></div><div>Loading...</div></div></div><style>@keyframes spin{to{transform:rotate(360deg)}}</style>';

// Initialize Firebase before rendering the app
ensureFirebaseReady()
  .then(() => {
    createRoot(rootElement).render(<App />);
  })
  .catch((error) => {
    console.error('Failed to initialize Firebase:', error);
    // Render app anyway - Firebase features may be degraded but app should still work
    createRoot(rootElement).render(<App />);
  });
