# Run Stockroom Locally

## Requirements

- Node.js 22.13.0 or later within version 22.
- pnpm installed.
- Expo Go compatible with Expo SDK 58.
- For the iOS Simulator: macOS, Xcode, and an installed iOS simulator runtime.

For a compatible simulator version of Expo Go, visit [expo.dev/go](https://expo.dev/go) and select SDK 58 and iOS Simulator.

## Install and Start

Open a terminal in `ims-mobile-app/`, the folder containing `package.json`.

Install dependencies:

```sh
pnpm install
```

Start Expo:

```sh
pnpm run start
```

- **iOS Simulator:** Open Simulator, then press **i** in the Expo terminal.
- **Android emulator:** Open the emulator, then press **a** in the Expo terminal.
- **Physical device:** Connect the phone and computer to the same network, then open the displayed QR code using Expo Go compatible with SDK 58.

Keep the terminal running while using the development server. Installation creates `node_modules/`; Expo generates local caches and development files.
