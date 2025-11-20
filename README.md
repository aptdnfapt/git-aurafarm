# gitfetch-js

A Node.js based rewrite of [gitfetch](https://github.com/Matars/gitfetch), providing a beautiful, responsive terminal interface for your GitHub statistics.

## Features

- **Responsive Design**: The contribution calendar automatically scales to fit your terminal window.
- **Interactive**: Stays open as a dashboard (press `q` to quit).
- **Git Stats**: Fetches repositories, followers, and contribution graph.
- **Zero Config**: Uses your existing `gh` CLI authentication.

## Prerequisites

- Node.js (v14+)
- **Authentication** (choose one):
  - GitHub CLI (`gh`) installed and authenticated (`gh auth login`)
  - OR set `GITHUB_TOKEN` environment variable

## Usage

You can run it directly using `npx` (once published) or locally.

### Run Locally

1. Clone the repo (or use the created directory).
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build:
   ```bash
   npm run build
   ```
4. Run:
   ```bash
   npm start
   # OR
   node dist/cli.js
   ```

### Options

- `--mock`: Use mock data (useful for testing UI without API limits or auth).

```bash
npm start -- --mock
```

## Development

This project uses:
- [Ink](https://github.com/vadimdemedes/ink) for the React-based TUI.
- [Execa](https://github.com/sindresorhus/execa) to call `gh` CLI.

To build for production/npx:
```bash
npm run build
```
