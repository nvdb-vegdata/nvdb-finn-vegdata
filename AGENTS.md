---
description: Use Bun instead of Node.js, npm, pnpm, or vite.
globs: '*.ts, *.tsx, *.html, *.css, *.js, *.jsx, package.json'
alwaysApply: false
---

## Project Rules

- `SPEC.md` is the source of truth for feature behavior. Keep feature-specific details there.
- Update `SPEC.md` whenever functional behavior changes.
- Default to Bun tooling:
  - `bun <file>`, `bun run <script>`, `bunx <pkg> <cmd>`, `bun test`, `bun build`
  - Avoid Node/npm/yarn/pnpm equivalents unless strictly needed.

## API Rules

- Use Uberiket API for vegobjekt data: `https://nvdbapiles.atlas.vegvesen.no/uberiket/api/v1`
- Include `X-Client: nvdb-finn-vegdata` when calling NVDB APIs.

## Verification

- After changes, run:
  - `bun run typecheck`
  - `bun test`

## Generated Code

- Never edit files under `src/api/generated` directly.
- Regenerate generated clients with `bun run generate:api` when specs/config change.
