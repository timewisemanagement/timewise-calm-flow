# Complete Guide: Creating Your .exe File

This guide walks you through creating a Windows installer for your app, step by step. No prior experience needed!

## 📋 What You'll Need

Before starting, make sure you have:
- A Windows computer (required to build Windows .exe files)
- Internet connection
- About 30 minutes for the first-time setup

## 🎯 Overview

Here's what we'll do:
1. Export your project from Lovable to GitHub
2. Download and install the necessary tools on your computer
3. Get your project code on your computer
4. Build the .exe file
5. Upload it so others can download it

---

## Step 1: Export Project to GitHub

### 1.1 In Lovable (where you are now):
1. Look at the **top-right corner** of the screen
2. Click the **"GitHub"** button
3. If this is your first time:
   - Click **"Connect to GitHub"**
   - Sign in to your GitHub account (or create one at github.com)
   - Authorize Lovable to access GitHub
4. Click **"Create Repository"**
5. Choose a repository name (like `timewise-app`)
6. Click **Create**

**What just happened?** Your code is now on GitHub. Think of GitHub like Google Drive for code - it stores your project online.

---

## Step 2: Install Required Tools

You need three tools on your computer. Follow these instructions carefully:

### 2.1 Install Git

**What is Git?** A tool to download code from GitHub to your computer.

1. Go to: https://git-scm.com/download/win
2. Download will start automatically
3. Run the installer (double-click the downloaded file)
4. **Important**: Just click "Next" through all the options - the defaults are fine
5. Click "Install"
6. Click "Finish"

### 2.2 Install Node.js

**What is Node.js?** The tool that will help build your .exe file.

1. Go to: https://nodejs.org/
2. Download the **LTS version** (the big green button on the left)
3. Run the installer
4. **Important**: Check the box that says "Automatically install the necessary tools"
5. Click "Next" through everything
6. Click "Install"
7. Wait (this takes 5-10 minutes)
8. Click "Finish"

### 2.3 Verify Installation

1. Press `Windows Key + R` on your keyboard
2. Type `cmd` and press Enter (this opens Command Prompt - a black window)
3. Type this and press Enter:
   ```
   node --version
   ```
4. You should see something like `v20.11.0` (the version number)
5. Type this and press Enter:
   ```
   git --version
   ```
6. You should see something like `git version 2.43.0`

**If both commands show version numbers, you're ready! If not, restart your computer and try Step 2.3 again.**

---

## Step 3: Download Your Project Code

### 3.1 Get Your Repository URL

1. Go to GitHub.com and sign in
2. Click on your profile picture (top-right)
3. Click "Your repositories"
4. Click on your project (the one you created in Step 1)
5. Click the green **"Code"** button
6. Click the **copy icon** next to the URL (it looks like two overlapping squares)
   - The URL will look like: `https://github.com/yourusername/timewise-app.git`

### 3.2 Create a Folder for Your Project

1. Open File Explorer (Windows Key + E)
2. Go to your Documents folder (or Desktop, wherever you want)
3. Right-click → New → Folder
4. Name it something like `MyProjects`
5. Open that folder

### 3.3 Open Command Prompt in That Folder

1. In File Explorer, click in the **address bar** at the top (where it shows the folder path)
2. Type `cmd` and press Enter
3. A black Command Prompt window opens

### 3.4 Download the Code

In the Command Prompt window:

1. Type `git clone ` (note the space after clone)
2. Right-click in the Command Prompt window → Paste (this pastes your GitHub URL)
3. Press Enter
4. Wait 10-30 seconds while it downloads

**You should see:** Messages about "Cloning into..." and "done"

### 3.5 Go Into Your Project Folder

1. In Command Prompt, type: `cd timewise-app` (or whatever you named your repo)
2. Press Enter

**Where are you now?** You're "inside" your project folder in the command prompt.

---

## Step 4: Prepare Your Project

### 4.1 Install Dependencies

**What are dependencies?** All the code libraries your project needs to work.

In Command Prompt (still inside your project folder):
1. Type: `npm install`
2. Press Enter
3. **Wait 3-5 minutes** - you'll see lots of text scrolling

**You should see:** Eventually it says "added XXX packages"

### 4.2 Edit package.json

**What is package.json?** A file that tells Node.js about your project.

1. In File Explorer, navigate to your project folder
2. Find the file called `package.json`
3. Right-click it → Open with → Notepad (or any text editor)
4. Look for the line that says `"scripts": {`
5. Inside the `scripts` section, you need to add some lines

**Find this section:**
```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview"
},
```

**Change it to this:**
```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview",
  "electron:dev": "concurrently \"npm run dev\" \"wait-on http://localhost:8080 && electron .\"",
  "electron:build": "npm run build && electron-builder",
  "electron:build:win": "npm run build && electron-builder --win"
},
```

**Also add this line at the very top of the file (after the first `{`):**
```json
"main": "electron/main.js",
```

6. **Save the file** (Ctrl + S)
7. **Close Notepad**

---

## Step 5: Build the .exe File

This is the exciting part!

### 5.1 Run the Build Command

In Command Prompt (still in your project folder):
1. Type: `npm run electron:build:win`
2. Press Enter
3. **Wait 5-10 minutes** - this is building your app!

**What you'll see:**
- Lots of text scrolling
- Messages about "building", "packaging", "creating installer"
- Eventually: "Done" or "Build complete"

**If you see errors:** Don't panic! Common issues:
- "electron-builder not found" → Run `npm install` again
- "Permission denied" → Right-click Command Prompt → Run as Administrator, then try again

### 5.2 Find Your .exe File

1. In File Explorer, go to your project folder
2. Look for a folder called `release`
3. Open it
4. **There it is!** You'll see a file like:
   - `TimeWise-Calm-Flow-Setup-1.0.0.exe` (around 150-200 MB)

---

## Step 6: Test Your .exe

Before sharing with others:

1. Double-click the .exe file
2. The installer should run
3. Follow the installation wizard
4. Your app should open!
5. Test that it works

---

## Step 7: Share Your .exe with Others

### Option A: GitHub Releases (Recommended)

1. Go to your GitHub repository page
2. Click **"Releases"** on the right side
3. Click **"Create a new release"**
4. Tag version: Type `v1.0.0`
5. Release title: Type `Version 1.0.0`
6. Click **"Attach binaries"** or drag your .exe file into the box
7. Add a description like: "Download TimeWise-Calm-Flow-Setup-1.0.0.exe and double-click to install"
8. Click **"Publish release"**

**Share this link with users:** `https://github.com/yourusername/yourproject/releases`

### Option B: Direct Download

Upload the .exe to:
- Google Drive (share with "Anyone with link")
- Dropbox
- Your own website

---

## 🎉 You're Done!

You now have:
- ✅ A Windows installer (.exe file)
- ✅ A way to share it with users
- ✅ Users can download and install with one click

## 🔄 Updating Your App

When you make changes in Lovable:
1. The changes automatically sync to GitHub
2. Go to your project folder on your computer
3. In Command Prompt: `git pull` (downloads the latest changes)
4. Run `npm run electron:build:win` again
5. Upload the new .exe to GitHub Releases as a new version (v1.0.1, v1.0.2, etc.)

---

## ❓ Troubleshooting

**Build takes forever:**
- First build is always slow (10+ minutes)
- Subsequent builds are faster (5 minutes)

**"command not found" errors:**
- Close Command Prompt
- Reopen it
- Make sure you're in the project folder (`cd` to it again)

**Build fails:**
- Run `npm install` again
- Make sure you edited package.json correctly
- Check that all files from Lovable are present

**Need help?**
- Check the error message carefully
- Google the specific error
- Ask in Lovable Discord community

---

## 📝 Quick Reference Commands

```bash
# Download project
git clone YOUR_GITHUB_URL
cd your-project-folder

# Install dependencies
npm install

# Build the .exe
npm run electron:build:win

# Update code from GitHub
git pull

# Rebuild after updates
npm run electron:build:win
```
