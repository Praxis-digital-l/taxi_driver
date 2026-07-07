import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { logDevInteraction } from "@/shared/monitoring/devLogger";

if (import.meta.env.DEV) {
  window.addEventListener("error", (event) => {
    logDevInteraction("runtime.error", {
      message: event.message,
      filename: event.filename,
      line: event.lineno,
      column: event.colno,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason instanceof Error ? event.reason.message : String(event.reason);
    logDevInteraction("runtime.unhandled_rejection", { reason });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
