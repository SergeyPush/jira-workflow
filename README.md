# Slot QA Checklist

A lightweight QA acceptance testing tool for slot games. Built for QA engineers to run through a standardised checklist, mark results, and copy a formatted report to Jira.

**Live:** https://sergeypush.github.io/jira-workflow/

---

## Features

- **Checklist** — 33 test cases across 7 categories (Game Loading, Basic Gameplay, Bet Settings, Autoplay, Bonus/Free Spins, UI/UX, Responsible Gambling)
- **Step-by-step instructions** — each test has a `?` button that reveals numbered steps, useful for new testers unfamiliar with the game
- **Status buttons** — mark each test as Pass ✓, Fail ✗, or Skip –
- **Category completion indicator** — header turns green (all pass), amber (no fails but some skipped), or red (has failures) when all tests in a section are reviewed
- **Progress bar & stats** — live counter of reviewed / total, pass / fail / skip counts
- **Jira output** — copies a formatted wiki-markup report to clipboard, with a preview panel
- **Persistent state** — progress and game name saved to localStorage, survives page refresh

## Stack

- [Vite](https://vitejs.dev/) — build tool
- Vanilla JS + CSS — no framework
- YAML — test definitions in [`tests.yaml`](tests.yaml)

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:5174

## Adding or editing tests

Edit [`tests.yaml`](tests.yaml). Each test can be a simple label or an object with steps:

```yaml
- category: My Category
  tests:
    - Simple test without steps
    - label: Test with steps
      steps:
        - Open the game
        - Verify something
        - Check the result
```

## Deploy to GitHub Pages

```bash
npm run deploy
```

Builds the project and pushes the `dist/` folder to the `gh-pages` branch.
