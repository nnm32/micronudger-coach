# micronudger-coach
A lightweight, patient-facing **AI obesity coaching** web app with built-in **guardrails**, **password lock**, and **local memory**. Pure HTML/CSS/JS — drop into GitHub Pages or any static host.

> Coaching only — **no medical advice**. If users request medication changes or express self-harm intent, the app blocks and redirects to proper care.

## Features
- 🛡️ Safety guardrails for crisis language and medication advice.
- 🔐 User-set passphrase (hashed in localStorage). Lock/Unlock any time.
- 🧠 Local memory (name, nudge time, timezone offset, chat history); **Wipe** to erase.
- 👋 Timezone-aware greetings + uses your name in each reply.
- 🖼️ Animated gradient background.
- 📦 100% static (no backend).

## Run locally
Open `index.html` in a modern browser.

## Deploy to GitHub
1. Create a repo named `micronudger-coach`.
2. Upload these files (or create them via “Add file → Create new file”).
3. Enable GitHub Pages (Settings → Pages → Deploy from branch).
