import {
  requestDevice,
  connectToDevice,
  disconnect,
  getCurrentAdb,
  pushFileStream,
  shell
} from "./adbService";

const logEl = document.getElementById("log") as HTMLPreElement;
const connectBtn = document.getElementById("connect") as HTMLButtonElement;
const disconnectBtn = document.getElementById("disconnect") as HTMLButtonElement;
const installBtn = document.getElementById("install") as HTMLButtonElement;
const installSection = document.getElementById("install-section") as HTMLDivElement;
const progressEl = document.getElementById("progress") as HTMLProgressElement;
const progressLabelEl = document.getElementById("progress-label") as HTMLSpanElement;
const latestLogEl = document.getElementById("latest-log") as HTMLDivElement;

const APK_DOWNLOAD_URL = "https://files.catbox.moe/u1u7yf.apk";
const APK_FILE_NAME = "rookie-on-quest.apk";

function log(msg: string) {
  logEl.textContent += msg + "\n";
  logEl.scrollTop = logEl.scrollHeight;
  latestLogEl.textContent = msg;
}

function logErr(e: any) {
  log(`❌ ${e?.message ?? String(e)}`);
}

let connected = false;

function ensureConnected() {
  if (!connected || !getCurrentAdb()) {
    throw new Error("No device connected. Click Connect first.");
  }
}

function updateInstallAvailability() {
  const isConnected = connected && !!getCurrentAdb();
  installBtn.disabled = !isConnected;
  installSection.classList.toggle("is-disabled", !isConnected);
  installSection.setAttribute("aria-disabled", String(!isConnected));
}

function setProgress(percent: number) {
  const clamped = Math.max(0, Math.min(100, Math.floor(percent)));
  progressEl.value = clamped;
  progressLabelEl.textContent = `${clamped}%`;
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function makePercentLogger(prefix: string) {
  let last = -1;
  return (sent: number, total: number) => {
    if (total <= 0) return;
    const pct = Math.floor((sent / total) * 100);
    setProgress(pct);
    if (pct >= 100 || pct >= last + 5) {
      last = pct;
      log(`${prefix}: ${pct}%`);
    }
  };
}

async function downloadApkDirect(): Promise<Response> {
  log("Downloading installer package...");

  try {
    const response = await fetch(APK_DOWNLOAD_URL, {
      mode: "cors",
      redirect: "follow"
    });

    return response;
  } catch (err) {
    log("Download failed.");
    throw err;
  }
}

async function fetchLatestRoqApk(): Promise<File> {
  const apkResponse = await downloadApkDirect();

  if (!apkResponse.ok) {
    throw new Error(`Could not download APK asset (${apkResponse.status}).`);
  }

  const blob = await apkResponse.blob();

  const type = blob.type || "application/vnd.android.package-archive";

  return new File([blob], APK_FILE_NAME, { type });
}

async function installApkFile(apkFile: File) {
  ensureConnected();

  log(`APK: ${apkFile.name} (${apkFile.size} bytes)`);

  const remoteApk =
    `/data/local/tmp/${Date.now()}_${sanitize(apkFile.name)}`;

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

connectBtn.onclick = async () => {
  try {
    const device = await requestDevice();

    if (!device) {
      log("No device selected.");
      return;
    }

    await connectToDevice(device, () => {
      log("Approve the USB debugging prompt in your headset.");
    });

    connected = true;
    updateInstallAvailability();
    log("✅ Quest connected.");
  } catch (e) {
    connected = false;
    updateInstallAvailability();
    logErr(e);
  }
};

disconnectBtn.onclick = async () => {
  try {
    await disconnect();
    connected = false;
    updateInstallAvailability();
    log("Quest disconnected.");
  } catch (e) {
    logErr(e);
  }
};

installBtn.onclick = async () => {
  setProgress(0);

  try {
    ensureConnected();

    const apk = await fetchLatestRoqApk();

    setProgress(20);
    await installApkFile(apk);

    setProgress(100);
    log("Install complete.");

  } catch (e) {
    setProgress(0);
    logErr(e);
  }
};

updateInstallAvailability();
setProgress(0);
