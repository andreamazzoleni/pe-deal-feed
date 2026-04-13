# PE Deal Analyzer

A browser-based private equity deal sourcing tool. Paste any company website URL and get an instant investment-grade briefing powered by Claude AI with live web search.

## What it does

Enter a company URL and receive a structured four-part analysis:

- **Industry** — concise vertical label (e.g. "B2B SaaS / HR Tech")
- **Company Snapshot** — 3-4 sentence investment-grade description of the business model, market position, size, and traction
- **Comparable Companies** — 4-6 named peers or competitors with one-line descriptions
- **Suggested Experts** — 5-6 real, named advisors (academics, ex-operators, consultants, analysts) with their current affiliation and why they're relevant to a PE firm evaluating this space

Claude searches the web in real time to produce accurate, up-to-date results for any company.

## Getting an Anthropic API Key

1. Go to [console.anthropic.com](https://console.anthropic.com/)
2. Sign up or log in
3. Navigate to **API Keys** → **Create Key**
4. Copy the key — it starts with `sk-ant-`

Your key is stored only in your browser's `localStorage` and is sent exclusively to Anthropic's API. It is never sent to any other server.

**Estimated cost:** each analysis uses roughly 2,000–4,000 tokens plus a few web search calls, typically costing $0.01–0.04 at current Anthropic pricing.

## Using the Tool

1. Open the app (locally or via GitHub Pages)
2. Paste your `sk-ant-...` API key when prompted — it's saved for future visits
3. Enter a company website URL and click **Analyze**
4. Results appear as four cards with a staggered fade-in

To update your key at any time, click **Change API key** in the footer.

## Deploying to GitHub Pages

1. Push this repo to GitHub (or fork it)
2. Go to **Settings → Pages**
3. Under **Source**, select **Deploy from a branch**
4. Set branch to `main` and folder to `/ (root)`
5. Click **Save**

GitHub Pages will serve `index.html` from the repo root within about a minute. Your URL will be:

```
https://<your-username>.github.io/<repo-name>/
```

## Running Locally

No build step required. Just open `index.html` directly in your browser:

```bash
open index.html
# or on Linux:
xdg-open index.html
```

Or serve it with any static file server:

```bash
npx serve .
python3 -m http.server 8080
```

## Privacy

- API key stored in `localStorage` (browser-local only, never transmitted except to Anthropic)
- No analytics, no tracking, no backend
- All processing happens client-side via direct calls to `api.anthropic.com`
