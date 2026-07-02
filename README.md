# Gillie

Gillie is a mobile-first quit vaping companion. Users hatch a small aquarium buddy, track clean time, complete cravings/SOS moments, and watch the tank get cleaner as they stay consistent.

## Live Test

https://lavish9999.github.io/-Gillie/

## Current Build

- Single-file static prototype
- Local-only data through `localStorage`
- Mobile web app meta tags for iPhone home-screen testing
- Stubbed Gillie Plus paywall flow for later StoreKit/RevenueCat wiring

## Run Locally

Open `index.html` in a browser, or serve the folder with a simple static server:

```bash
python3 -m http.server 5173
```

Then open:

```text
http://localhost:5173
```

## GitHub Pages

This repo publishes from the root of the `main` branch.

1. Go to repository settings.
2. Open **Pages**.
3. Set source to **Deploy from a branch** or use the included GitHub Actions workflow.
4. Choose `main` and `/root` if deploying from a branch.
5. Save.
