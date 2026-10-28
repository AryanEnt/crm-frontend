/** Meta WhatsApp Embedded Signup (Facebook JS SDK). */

type FbAuthResponse = { code?: string };
type FbLoginResponse = { authResponse?: FbAuthResponse | null };

type FbSdk = {
  init: (opts: { appId: string; autoLogAppEvents: boolean; xfbml: boolean; version: string }) => void;
  login: (
    cb: (response: FbLoginResponse) => void,
    opts: Record<string, unknown>,
  ) => void;
};

declare global {
  interface Window {
    FB?: FbSdk;
    fbAsyncInit?: () => void;
  }
}

export type EmbeddedSignupSession = {
  phoneNumberId: string;
  wabaId: string;
  displayPhoneNumber?: string;
};

export type EmbeddedSignupResult = EmbeddedSignupSession & { code: string };

let sdkLoading: Promise<void> | null = null;

export function loadFacebookSdk(appId: string, graphApiVersion: string): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("Facebook SDK requires a browser"));
  if (window.FB) return Promise.resolve();
  if (sdkLoading) return sdkLoading;

  sdkLoading = new Promise((resolve, reject) => {
    window.fbAsyncInit = () => {
      try {
        window.FB?.init({
          appId,
          autoLogAppEvents: true,
          xfbml: true,
          version: graphApiVersion || "v21.0",
        });
        resolve();
      } catch (err) {
        reject(err);
      }
    };
    if (document.getElementById("facebook-jssdk")) {
      // Script tag exists; wait for init.
      const started = Date.now();
      const tick = () => {
        if (window.FB) {
          window.fbAsyncInit?.();
          return;
        }
        if (Date.now() - started > 15_000) {
          reject(new Error("Facebook SDK timed out"));
          return;
        }
        window.setTimeout(tick, 50);
      };
      tick();
      return;
    }
    const script = document.createElement("script");
    script.id = "facebook-jssdk";
    script.async = true;
    script.defer = true;
    script.crossOrigin = "anonymous";
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.onerror = () => reject(new Error("Failed to load Facebook SDK"));
    document.body.appendChild(script);
  });

  return sdkLoading;
}

/**
 * Opens Meta Embedded Signup. Captures phone_number_id / waba_id from the session
 * message, then the short-lived auth code from FB.login.
 */
export function launchWhatsAppEmbeddedSignup(configId: string): Promise<EmbeddedSignupResult> {
  return new Promise((resolve, reject) => {
    if (!window.FB) {
      reject(new Error("Facebook SDK is not ready"));
      return;
    }

    let session: EmbeddedSignupSession | null = null;

    const onMessage = (event: MessageEvent) => {
      if (typeof event.origin !== "string" || !event.origin.includes("facebook.com")) return;
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (!data || data.type !== "WA_EMBEDDED_SIGNUP") return;
        const payload = data.data ?? {};
        const phoneNumberId = String(payload.phone_number_id ?? "");
        const wabaId = String(payload.waba_id ?? "");
        if (phoneNumberId && wabaId) {
          session = {
            phoneNumberId,
            wabaId,
            displayPhoneNumber: payload.display_phone_number ? String(payload.display_phone_number) : undefined,
          };
        }
      } catch {
        // ignore non-JSON / unrelated messages
      }
    };

    window.addEventListener("message", onMessage);

    window.FB.login(
      (response) => {
        window.removeEventListener("message", onMessage);
        const code = response.authResponse?.code;
        if (!code) {
          reject(new Error("WhatsApp connection was cancelled"));
          return;
        }
        if (!session?.phoneNumberId || !session.wabaId) {
          reject(new Error("WhatsApp signup finished but no phone number was returned. Try again."));
          return;
        }
        resolve({ code, ...session });
      },
      {
        config_id: configId,
        response_type: "code",
        override_default_response_type: true,
        extras: {
          setup: {},
          featureType: "",
          sessionInfoVersion: "3",
        },
      },
    );
  });
}
