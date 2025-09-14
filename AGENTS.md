# Repository Guidelines

## Project Structure & Module Organization

- `vsce/`: VS Code extension (TypeScript). Entry `src/extension.ts`; bundled to `out/`.
- `sql-extraction/ts/`: TS utilities to extract raw SQL from code.
- `sql-extraction/rs/`: Rust + wasm-pack SQL extractor; tests via `cargo`.
- `vsce-test/`: E2E runner using `@vscode/test-electron`.
- Root configs: `biome.json`, `lefthook.yaml`, `cspell.yaml`, `compose.yaml` (local DBs).

## Build, Test, and Development Commands

- `pnpm build:pkg`: Build all workspace packages.
- `pnpm -F sqlsurge run watch`: Rebuild the extension on changes.
- `pnpm -F sqlsurge run compile`: One-off webpack build for the extension.
- `pnpm -r test`: Run unit tests across packages (Jest + Cargo).
- `pnpm test:e2e` or `xvfb-run -a pnpm test:e2e` (Linux CI): Launch VS Code E2E tests.
- Rust: `pnpm -F @senken/sql-extraction-rs exec cargo test`.

## Coding Style & Naming Conventions

- Formatter/Linter: Biome (`pnpm biome check --apply`). Indent with spaces; organize imports.
- Spellcheck: cspell via pre-commit.
- TypeScript: prefer explicit types, avoid `any` when possible; tests named `*.test.ts`.
- Rust: idiomatic Rust, small focused modules; keep `lib.rs` thin and test via `tests` or unit tests.

## Testing Guidelines

- Frameworks: Jest for TS (`vsce`, `sql-extraction/ts`), Cargo for Rust, and VS Code E2E in `vsce-test`.
- Run quickly: `pnpm -r test` for unit; `pnpm test:e2e` for integration.
- Aim to cover SQL extraction edge cases and extension activation paths.

## Commit & Pull Request Guidelines

- Commits: imperative present (“Add extractor for template literals”); group coherent changes; reference issues (`#123`).
- PRs: include summary, motivation, screenshots/GIFs for UX, reproduction steps, and linked issues.
- Checks: ensure pre-commit hooks pass, CI green on unit/Rust/E2E.

## Security & Configuration Tips

- Do not commit secrets; use `.env`-style local files only.
- Local DBs: `docker compose up -d` using `compose.yaml` (MySQL/Postgres/MSSQL).
- Extension settings: see `sqlsurge.*` in `vsce/package.json` (e.g., `sqlLanguageServerFlags`, `customRawSqlQuery`).
