type DevLogDetails = Record<string, unknown>;

interface DevLogPayload {
  timestamp: string;
  event: string;
  details: DevLogDetails;
}

const DEV_LOG_ENDPOINT = "/__devlog";

const toPayload = (event: string, details: DevLogDetails): DevLogPayload => ({
  timestamp: new Date().toISOString(),
  event,
  details,
});

export function logDevInteraction(event: string, details: DevLogDetails = {}): void {
  if (!import.meta.env.DEV) return;

  const payload = toPayload(event, details);
  const body = JSON.stringify(payload);

  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      const sent = navigator.sendBeacon(DEV_LOG_ENDPOINT, blob);
      if (sent) return;
    }

    void fetch(DEV_LOG_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    });
  } catch {
    // Avoid breaking the app due to logging failures.
  }
}
