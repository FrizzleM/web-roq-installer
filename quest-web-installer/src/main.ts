import {
  requestDevice,
  connectToDevice,
  disconnect,
  getCurrentAdb,
  pushFileStream,
  shell
} from "./adbService";

const logEl = document.getElementById("log") as HTMLPreElement;

const APK_DOWNLOAD_URL = "https://files.catbox.moe/u1u7yf.apk";
const APK_FILE_NAME = "rookie-on-quest.apk";
const DEBUG_ALLOW_APK_DOWNLOAD_WITHOUT_DEVICE = true;

function log(msg: string) {
  console.log(msg);
  logEl.textContent += msg + "\n";
  logEl.scrollTop = logEl.scrollHeight;
}

function logErr(e: any) {
  console.error(e);
  log(`❌ ${e?.message ?? String(e)}`);
  if (e?.name) log(`   name: ${e.name}`);
}

let connected = false;

function ensureConnected() {
  if (!connected || !getCurrentAdb()) {
    throw new Error("No device connected. Click Connect first.");
  }
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

async function downloadApkDirect(): Promise<Response> {
  log("[ROQ] Downloading APK from configured URL...");

  try {
    const response = await fetch(APK_DOWNLOAD_URL, {
      mode: "cors",
      redirect: "follow"
    });

    return response;
  } catch (err) {
    log("[ROQ] Direct download failed.");
    throw err;
  }
}


async function fetchLatestRoqApk(): Promise<File> {
  log("[ROQ] Step 2: Downloading configured APK.");
  log(`[ROQ] APK URL: ${APK_DOWNLOAD_URL}`);

  log("[ROQ] Downloading APK binary...");

  const apkResponse = await downloadApkDirect();

  log(`[ROQ] APK download status=${apkResponse.status} ok=${apkResponse.ok}`);

  if (!apkResponse.ok) {
    throw new Error(`Could not download APK asset (${apkResponse.status}).`);
  }

  const blob = await apkResponse.blob();

  log(`[ROQ] APK blob size=${blob.size}`);

  const type = blob.type || "application/vnd.android.package-archive";

  log("[ROQ] APK file object created.");

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


(document.getElementById("install") as HTMLButtonElement).onclick = async () => {
  log("[ROQ] Install button clicked.");

  try {
    ensureConnected();

    log("[ROQ] Fetching latest ROQ APK...");
    const apk = await fetchLatestRoqApk();

    await installApkFile(apk);

    log("[ROQ] Install flow completed.");

  } catch (e) {
    log("[ROQ] Install flow failed.");
    logErr(e);
  }
};
