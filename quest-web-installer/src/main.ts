import {
  requestDevice,
  connectToDevice,
  disconnect,
  getCurrentAdb,
  pushFileStream,
  shell
} from "./adbService";

const logEl = document.getElementById("log") as HTMLPreElement;

const GITHUB_OWNER = "LeGeRyChEeSe";
const GITHUB_REPO = "rookie-on-quest";

function browserSupportsWebUsb(): boolean {
  return typeof navigator !== "undefined" && "usb" in navigator;
}

function isSecureContextForWebUsb(): boolean {
  return typeof window !== "undefined" && window.isSecureContext;
}

function showWebUsbUnsupportedModal() {
  const blocker = document.createElement("div");
  blocker.id = "webusb-blocker";
  blocker.setAttribute("role", "dialog");
  blocker.setAttribute("aria-modal", "true");
  blocker.setAttribute("aria-labelledby", "webusb-blocker-title");

  blocker.innerHTML = `
    <div id="webusb-blocker-card">
      <h2 id="webusb-blocker-title">Browser not supported</h2>
      <p>
        This installer requires <strong>WebUSB</strong>, which is not available in your current browser.
      </p>
      <p>
        Please open this page in a Chromium-based browser (for example, Chrome, Edge, or Opera) on a computer (Windows, Mac, Linux)
        and try again.
      </p>
    </div>
  `;

  const style = document.createElement("style");
  style.textContent = `
    #webusb-blocker {
      position: fixed;
      inset: 0;
      z-index: 9999;
      display: grid;
      place-items: center;
      padding: 24px;
      background: rgba(0, 0, 0, 0.55);
      backdrop-filter: blur(8px);
    }

    #webusb-blocker-card {
      width: min(560px, 100%);
      border: 1px solid #fff;
      background: #050505;
      color: #fff;
      padding: 24px;
      box-shadow: 0 12px 36px rgba(0, 0, 0, 0.45);
    }

    #webusb-blocker-card h2 {
      margin: 0 0 12px;
      font-size: 24px;
      letter-spacing: 0.02em;
    }

    #webusb-blocker-card p {
      margin: 0;
      color: rgba(255, 255, 255, 0.9);
      line-height: 1.5;
    }

    #webusb-blocker-card p + p {
      margin-top: 12px;
    }
  `;

  document.head.appendChild(style);
  document.body.appendChild(blocker);

  const controls = Array.from(document.querySelectorAll("button, input, [role='button']")) as HTMLElement[];
  for (const control of controls) {
    control.setAttribute("aria-disabled", "true");
    if (control instanceof HTMLButtonElement || control instanceof HTMLInputElement) {
      control.disabled = true;
    }
  }
}

function showSecureContextRequiredModal() {
  const blocker = document.createElement("div");
  blocker.id = "webusb-blocker";
  blocker.setAttribute("role", "dialog");
  blocker.setAttribute("aria-modal", "true");
  blocker.setAttribute("aria-labelledby", "webusb-blocker-title");

  blocker.innerHTML = `
    <div id="webusb-blocker-card">
      <h2 id="webusb-blocker-title">Secure context required</h2>
      <p>
        WebUSB only works when this page is loaded from <strong>HTTPS</strong> (or <strong>localhost</strong> during local development).
      </p>
      <p>
        Reopen the installer using a secure URL and try again.
      </p>
    </div>
  `;

  document.body.appendChild(blocker);

  const controls = Array.from(document.querySelectorAll("button, input, [role='button']")) as HTMLElement[];
  for (const control of controls) {
    control.setAttribute("aria-disabled", "true");
    if (control instanceof HTMLButtonElement || control instanceof HTMLInputElement) {
      control.disabled = true;
    }
  }
}

if (!browserSupportsWebUsb()) {
  showWebUsbUnsupportedModal();
  throw new Error("WebUSB is not supported in this browser.");
}

if (!isSecureContextForWebUsb()) {
  showSecureContextRequiredModal();
  throw new Error("This page must be served over HTTPS (or localhost) for WebUSB to work.");
}

function log(msg: string) {
  console.log(msg);
  logEl.textContent += msg + "\n";
  logEl.scrollTop = logEl.scrollHeight;
}

function logErr(e: any) {
  console.error(e);
  log(`❌ ${e?.message ?? String(e)}`);
  if (e?.name) log(`   name: ${e.name}`);
  if (e?.stack) log(`   stack: ${String(e.stack).split("\n")[0]}`);
}

async function collectWebUsbDebugInfo() {
  const details: Record<string, string | number | boolean> = {
    time: new Date().toISOString(),
    href: window.location.href,
    origin: window.location.origin,
    protocol: window.location.protocol,
    host: window.location.host,
    secureContext: window.isSecureContext,
    hasNavigatorUsb: "usb" in navigator,
    topLevelFrame: window.top === window.self,
    visibilityState: document.visibilityState,
    documentHasFocus: document.hasFocus(),
    userAgent: navigator.userAgent,
    platform: navigator.platform,
  };

  if ("usb" in navigator && navigator.usb?.getDevices) {
    try {
      const previouslyGrantedDevices = await navigator.usb.getDevices();
      details.previouslyGrantedUsbDevices = previouslyGrantedDevices.length;
    } catch (e: any) {
      details.previouslyGrantedUsbDevicesError = `${e?.name ?? "Error"}: ${e?.message ?? String(e)}`;
    }
  }

  return details;
}

function logDebugHeader(stage: string) {
  log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  log(`🛠️ DEBUG (${stage})`);
}

async function logWebUsbDebug(stage: string) {
  logDebugHeader(stage);
  const info = await collectWebUsbDebugInfo();
  for (const [key, value] of Object.entries(info)) {
    log(`   ${key}: ${value}`);
  }
}

window.addEventListener("error", (event) => {
  log(`❌ window error: ${event.message}`);
});

window.addEventListener("unhandledrejection", (event) => {
  log(`❌ unhandled rejection: ${String(event.reason)}`);
});

if (navigator.usb) {
  navigator.usb.addEventListener("connect", (event: Event) => {
    const device = (event as USBConnectionEvent).device;
    log(`ℹ️ USB connect event: ${device.productName ?? "Unknown device"}`);
  });

  navigator.usb.addEventListener("disconnect", (event: Event) => {
    const device = (event as USBConnectionEvent).device;
    log(`ℹ️ USB disconnect event: ${device.productName ?? "Unknown device"}`);
  });
}

let connected = false;

function ensureConnected() {
  if (!connected || !getCurrentAdb()) throw new Error("No device connected. Click Connect first.");
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function makePercentLogger(prefix: string) {
  let last = -1;
  return (sent: number, total: number) => {
    if (total <= 0) return;
    const pct = Math.floor((sent / total) * 100);
    if (pct >= 100 || pct >= last + 5) {
      last = pct;
      log(`${prefix}: ${pct}%`);
    }
  };
}

async function fetchLatestRoqApk(): Promise<File> {
  log("Checking latest Rookie-on-Quest release from GitHub…");

  const latestUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
  const releasesUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases`;

  let releaseData: any;
  let response = await fetch(latestUrl, { headers: { Accept: "application/vnd.github+json" } });

  if (!response.ok) {
    log(`Latest release endpoint returned ${response.status}. Falling back to full release list…`);
    response = await fetch(releasesUrl, { headers: { Accept: "application/vnd.github+json" } });
    if (!response.ok) {
      throw new Error(`Could not fetch releases from GitHub (${response.status}).`);
    }

    const releases = await response.json();
    if (!Array.isArray(releases) || releases.length === 0) {
      throw new Error("No releases found for rookie-on-quest.");
    }

    releaseData = releases[0];
  } else {
    releaseData = await response.json();
  }

  const releaseName = releaseData?.name || releaseData?.tag_name || "Unknown release";
  const assets = Array.isArray(releaseData?.assets) ? releaseData.assets : [];

  const apkAsset = assets.find((asset: any) =>
    typeof asset?.name === "string"
    && asset.name.toLowerCase().endsWith(".apk")
    && typeof asset?.browser_download_url === "string"
  );

  if (!apkAsset) {
    throw new Error("Latest release does not contain an APK asset.");
  }

  log(`Latest release: ${releaseName}`);
  log(`Downloading ${apkAsset.name}…`);

  const apkResponse = await fetch(apkAsset.browser_download_url);
  if (!apkResponse.ok) {
    throw new Error(`Could not download APK asset (${apkResponse.status}).`);
  }

  const blob = await apkResponse.blob();
  const type = blob.type || "application/vnd.android.package-archive";
  return new File([blob], apkAsset.name, { type });
}

async function installApkFile(apkFile: File) {
  ensureConnected();

  log(`APK: ${apkFile.name} (${apkFile.size} bytes)`);

  const remoteApk = `/data/local/tmp/${Date.now()}_${sanitize(apkFile.name)}`;
  log(`Pushing APK → ${remoteApk}`);

  await pushFileStream(remoteApk, apkFile, makePercentLogger("APK push"));

  log("Installing APK (pm install -r) …");
  const out = await shell(["pm", "install", "-r", remoteApk]);
  log(`pm output: ${out.trim() || "(no output)"}`);

  log("Cleaning temp APK…");
  await shell(["rm", "-f", remoteApk]);

  if (out.toLowerCase().includes("success")) {
    log("✅ APK install success. Quest → Apps → Unknown Sources.");
  } else {
    log("⚠️ APK install may have failed (see pm output above).");
  }
}

(document.getElementById("connect") as HTMLButtonElement).onclick = async () => {
  const connectButton = document.getElementById("connect") as HTMLButtonElement;
  try {
    connectButton.disabled = true;
    log("Connect clicked.");
    await logWebUsbDebug("before requestDevice");

    if (!isSecureContextForWebUsb()) {
      throw new Error("WebUSB needs a secure context. Open this installer over HTTPS or localhost.");
    }

    const dev = await requestDevice();
    if (!dev) {
      log("User cancelled device picker.");
      await logWebUsbDebug("picker cancelled");
      return;
    }

    log(`USB device selected. Serial: ${dev.serial}`);
    log("Connecting to ADB… (put headset on and accept USB debugging)");

    await connectToDevice(dev, () => {
      log("Auth pending: accept the prompt inside the headset.");
    });

    connected = true;

    const model = (await shell(["getprop", "ro.product.model"])).trim();
    const manufacturer = (await shell(["getprop", "ro.product.manufacturer"])).trim();
    log(`✅ Connected to ${manufacturer || "Unknown"} ${model || ""}`);
    await logWebUsbDebug("connected");
  } catch (e: any) {
    if (e instanceof DOMException && e.name === "SecurityError") {
      log("❌ Browser blocked the USB picker.");
      log("   - Open the installer directly (not inside an iframe).\n   - Use HTTPS or localhost.\n   - Ensure no extension is blocking popups/USB prompts.");
    }
    await logWebUsbDebug("connect error");
    logErr(e);
  } finally {
    connectButton.disabled = false;
  }
};

(document.getElementById("disconnect") as HTMLButtonElement).onclick = async () => {
  try {
    await disconnect();
    connected = false;
    log("Disconnected.");
  } catch (e) {
    logErr(e);
  }
};

(document.getElementById("install") as HTMLButtonElement).onclick = async () => {
  try {
    ensureConnected();
    const apk = await fetchLatestRoqApk();
    await installApkFile(apk);
  } catch (e) {
    logErr(e);
  }
};
