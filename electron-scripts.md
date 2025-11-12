# Electron Build Scripts

Add these scripts to your `package.json`:

```json
"scripts": {
  "electron:dev": "concurrently \"npm run dev\" \"wait-on http://localhost:8080 && electron .\"",
  "electron:build": "npm run build && electron-builder",
  "electron:build:win": "npm run build && electron-builder --win",
  "electron:build:mac": "npm run build && electron-builder --mac",
  "electron:build:linux": "npm run build && electron-builder --linux"
}
```

## How to use:

### Development Mode
```bash
npm run electron:dev
```
This runs the Vite dev server and Electron together for development.

### Build for Windows (creates .exe)
```bash
npm run electron:build:win
```
This will create a Windows installer (.exe) in the `release` folder.

### Build for all platforms
```bash
npm run electron:build
```

## Important Notes:

1. **GitHub Export Required**: To build the .exe, you need to:
   - Export your project to GitHub (click GitHub button in top right)
   - Clone the repository to your local machine
   - Run `npm install` to install dependencies
   - Run the build command

2. **Build Location**: The .exe file will be in the `release` folder after building

3. **File Size**: The .exe will be ~150MB because it includes Chromium browser

4. **Backend Connection**: The app will still connect to your Lovable Cloud backend, so users need internet connection

5. **Cross-platform Building**: 
   - Build Windows .exe on Windows
   - Build Mac .dmg on macOS
   - Build Linux AppImage on Linux
