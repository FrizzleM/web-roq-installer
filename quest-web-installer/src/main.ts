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

async function downloadApkDirect(apkAsset: any): Promise<Response> {
  log("[ROQ] Downloading via browser_download_url...");

  try {
    const response = await fetch(apkAsset.browser_download_url, {
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
  log("[ROQ] Step 2: Starting GitHub release lookup.");

  const latestUrl =
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;

  const releasesUrl =
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases`;

  const githubHeaders = {
    Accept: "application/vnd.github+json"
  };

  const findApkAsset = (release: any) => {
    const assets = Array.isArray(release?.assets) ? release.assets : [];
    return assets.find((asset: any) =>
      typeof asset?.name === "string" &&
      asset.name.toLowerCase().endsWith(".apk") &&
      typeof asset?.browser_download_url === "string"
    );
  };

  const pickBestReleaseWithApk = (releases: any[]) => {
    const candidates = releases.filter(
      (release) => !release?.draft && !!findApkAsset(release)
    );

    const stable = candidates.find((release) => !release?.prerelease);
    return stable ?? candidates[0] ?? null;
  };

  let releaseData: any;
  let response = await fetch(latestUrl, { headers: githubHeaders });

  if (!response.ok) {
    log(`[ROQ] Latest release endpoint returned ${response.status}. Falling back...`);

    response = await fetch(releasesUrl, { headers: githubHeaders });

    if (!response.ok) {
      throw new Error(`Could not fetch releases from GitHub (${response.status}).`);
    }

    const releases = await response.json();

    if (!Array.isArray(releases) || releases.length === 0) {
      throw new Error("No releases found for rookie-on-quest.");
    }

    releaseData = pickBestReleaseWithApk(releases);

    if (!releaseData) {
      throw new Error("No release with an APK asset was found.");
    }

  } else {
    releaseData = await response.json();

    if (!findApkAsset(releaseData)) {
      log("[ROQ] Latest release has no APK asset. Searching all releases…");

      const releasesResponse = await fetch(releasesUrl, { headers: githubHeaders });

      if (!releasesResponse.ok) {
        throw new Error(`Could not fetch releases from GitHub (${releasesResponse.status}).`);
      }

      const releases = await releasesResponse.json();

      releaseData = pickBestReleaseWithApk(releases);

      if (!releaseData) {
        throw new Error("No release with an APK asset was found.");
      }
    }
  }

  const releaseName =
    releaseData?.name || releaseData?.tag_name || "Unknown release";

  const apkAsset = findApkAsset(releaseData);

  if (!apkAsset) {
    throw new Error("Latest release does not contain an APK asset.");
  }

  log(`[ROQ] using release: ${releaseName}`);
  log(`[ROQ] selected APK asset: ${apkAsset.name}`);
  log(`[ROQ] APK URL: ${apkAsset.browser_download_url}`);

  log("[ROQ] Downloading APK binary...");

  const apkResponse = await downloadApkDirect(apkAsset);

  log(`[ROQ] APK download status=${apkResponse.status} ok=${apkResponse.ok}`);

  if (!apkResponse.ok) {
    throw new Error(`Could not download APK asset (${apkResponse.status}).`);
  }

  const blob = await apkResponse.blob();

  log(`[ROQ] APK blob size=${blob.size}`);

  const type = blob.type || "application/vnd.android.package-archive";

  log("[ROQ] APK file object created.");

  return new File([blob], apkAsset.name, { type });
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
    log("[ROQ] Fetching latest ROQ APK...");
    const apk = await fetchLatestRoqApk();

    if (!connected || !getCurrentAdb()) {
      if (DEBUG_ALLOW_APK_DOWNLOAD_WITHOUT_DEVICE) {
        log("⚠️ Debug mode: APK downloaded without headset. Skipping install.");
        return;
      }
      throw new Error("No device connected. Click Connect first.");
    }

    await installApkFile(apk);

    log("[ROQ] Install flow completed.");

  } catch (e) {
    log("[ROQ] Install flow failed.");
    logErr(e);
  }
};
