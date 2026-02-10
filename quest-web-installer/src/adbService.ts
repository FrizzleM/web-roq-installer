import { Adb, AdbDaemonTransport } from "@yume-chan/adb";
import { AdbDaemonWebUsbDeviceManager, type AdbDaemonWebUsbDevice } from "@yume-chan/adb-daemon-webusb";
import AdbWebCredentialStore from "@yume-chan/adb-credential-web";

let credentialStore: AdbWebCredentialStore | null = null;
let deviceManager: AdbDaemonWebUsbDeviceManager | null = null;

let currentAdb: Adb | null = null;
let currentDevice: AdbDaemonWebUsbDevice | null = null;

export function isWebUsbSupported(): boolean {
  return typeof navigator !== "undefined" && "usb" in navigator;
}

async function getCredentialStore(): Promise<AdbWebCredentialStore> {
  if (!credentialStore) credentialStore = new AdbWebCredentialStore();
  return credentialStore;
}

function getDeviceManager(): AdbDaemonWebUsbDeviceManager {
  if (!isWebUsbSupported()) throw new Error("WebUSB not supported (use Chrome/Edge).");
  if (!deviceManager) deviceManager = new AdbDaemonWebUsbDeviceManager(navigator.usb);
  return deviceManager;
}

export async function requestDevice(): Promise<AdbDaemonWebUsbDevice | null> {
  const manager = getDeviceManager();
  try {
    const device = await manager.requestDevice();
    return device ?? null;
  } catch (e: any) {
    if (e instanceof DOMException && e.name === "NotFoundError") return null;
    throw e;
  }
}

export async function connectToDevice(device: AdbDaemonWebUsbDevice, onAuthPending?: () => void): Promise<Adb> {
  const store = await getCredentialStore();
  const connection = await device.connect();
  onAuthPending?.();

  const transport = await AdbDaemonTransport.authenticate({
    serial: device.serial,
    connection,
    credentialStore: store,
  });

  const adb = new Adb(transport);
  currentAdb = adb;
  currentDevice = device;
  return adb;
}

export async function disconnect(): Promise<void> {
  const adb = currentAdb;
  currentAdb = null;
  currentDevice = null;
  if (adb) {
    try { await adb.close(); } catch {}
  }
}

export function getCurrentAdb(): Adb | null {
  return currentAdb;
}

export async function shell(argv: string[]): Promise<string> {
  if (!currentAdb) throw new Error("No device connected.");

  if (currentAdb.subprocess.shellProtocol) {
    const res = await currentAdb.subprocess.shellProtocol.spawnWaitText(argv);
    return res.stdout;
  } else {
    return currentAdb.subprocess.noneProtocol.spawnWaitText(argv);
  }
}

export async function pushFileStream(
  remotePath: string,
  file: File,
  onProgress?: (sent: number, total: number) => void
): Promise<void> {
  if (!currentAdb) throw new Error("No device connected.");

  const total = file.size;
  let sent = 0;

  const src = file.stream().getReader();

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await src.read();
      if (done) {
        controller.close();
        return;
      }
      sent += value.byteLength;
      onProgress?.(sent, total);
      controller.enqueue(value);
    },
    async cancel() {
      try { await src.cancel(); } catch {}
    }
  });

  const sync = await currentAdb.sync();
  try {
    await sync.write({
      filename: remotePath,
      file: stream as any,
    });
  } finally {
    await sync.dispose();
  }
}
