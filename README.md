<div align="center">

# QuestLoad

**QuestLoad** is a browser‑based sideloader for Meta Quest headsets. It lets you install custom APKs on the Meta Quest directly from your web browser. Developer mode must be enabled on your headset.

<br/>
  <a href="https://frizzlem.github.io/QuestLoad/">
    <img alt="Launch QuestLoad" src="https://img.shields.io/badge/Launch-Open%20App-6cb6ff?style=for-the-badge">
  </a>

  <a href="https://github.com/FrizzleM/QuestLoad/issues">
    <img alt="Issues" src="https://img.shields.io/github/issues/FrizzleM/QuestLoad?style=for-the-badge&color=ef4444">
  </a>

</div>


<img width="1030" height="528" alt="Screenshot 2026-02-10 alle 17 50 13" src="https://github.com/user-attachments/assets/b2a618d7-3f28-44a9-8edc-6b8fe8e051fc" />

---

## Requirements

- **Meta Quest headset**
- **Developer mode enabled** on your headset
- **Modern browser with WebUSB support** 

---

## Quick Start

Follow these steps to sideload an app:

### 1. Launch QuestLoad
Open [frizzlem.github.io/QuestLoad](https://frizzlem.github.io/QuestLoad/).

### 2. Connect your Quest
Click **Connect Quest** in Step 1. Put on your headset and accept the USB debugging prompt when it appears. The log will confirm the device model on successful connection.

### 3. Select what to install
In Step 2, choose an **APK** file or a **bundle folder**:
- **APK** – click the “Choose an .apk” box and select a single `.apk` file. Drag‑and‑drop is also supported.
- **Bundle (BETA)** – click the “Choose a game bundle folder (BETA)” box and select a folder containing a `release.manifest`, the app’s APK, and any OBB files (`main.*.obb`).

### 4. Install
Click **Install APK** for single APKs or **Install Bundle (APK + OBB)** for bundles. The log will show progress and confirm success when finished:contentReference[oaicite:14]{index=14}.

### 5. Launch the app on your Quest
After a successful install, go to **Apps → Unknown Sources** on your headset and launch your newly installed app. Once done, you can click **Disconnect** in QuestLoad.

---

## Development

The web installer is built with **Vite**. To run it locally:

```bash
git clone https://github.com/FrizzleM/QuestLoad.git
cd quest-web-installer
npm install
npm run dev      # start development server
npm run build    # build for production
npm run preview  # preview built app
