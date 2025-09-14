# Repository Guidelines

## Project Structure & Module Organization

- `vsce/`: VS Code extension (TypeScript). Entry `src/extension.ts`; bundled to `out/`.
- `sql-extraction/ts/`: TypeScript utilities for extracting raw SQL from code.
- `sql-extraction/rs/`: Rust + wasm-pack SQL extractor; tests via `cargo`.
- `vsce-test/`: E2E tests using `@vscode/test-electron`.
- Root configs: `biome.json`, `lefthook.yaml`, `cspell.yaml`, `compose.yaml`.

## Build, Test, and Development Commands

- Build packages: `pnpm build:pkg`.
- Watch extension: `pnpm -F sqlsurge run watch`.
- One-off compile (webpack): `pnpm -F sqlsurge run compile`.
- Run unit tests (all packages): `pnpm -r test`.
- Rust tests only: `pnpm -F @senken/sql-extraction-rs exec cargo test`.
- VS Code E2E: `pnpm test:e2e` (or `xvfb-run -a pnpm test:e2e` on Linux CI).
- Local DBs for manual testing: `docker compose up -d` (see `compose.yaml`).

## Coding Style & Naming Conventions

- Formatter/Linter: Biome. Run `pnpm biome check --apply` before pushing.
- TypeScript: explicit types, avoid `any`; tests named `*.test.ts`.
- Rust: idiomatic style; small modules; keep `lib.rs` thin; place tests in `tests/` or unit tests next to code.
- Imports: organized and sorted by Biome. Indent with spaces.

## Testing Guidelines

- Frameworks: Jest for TS (`vsce`, `sql-extraction/ts`), Cargo for Rust, and VS Code E2E in `vsce-test`.
- Scope: cover SQL extraction edge cases and extension activation paths.
- Quick runs: `pnpm -r test` (unit) and `pnpm test:e2e` (integration).

## Commit & Pull Request Guidelines

- Commits: imperative present (e.g., “Add extractor for template literals”); group coherent changes; reference issues (e.g., `#123`).
- PRs: include a summary, motivation, reproduction steps, linked issues, and screenshots/GIFs for UX changes.
- Checks: ensure pre-commit hooks pass (Biome, cspell) and CI is green across unit/Rust/E2E.

## Security & Configuration Tips

- Do not commit secrets; use local `.env` files only.
- Local DBs: use `compose.yaml` (MySQL/Postgres/MSSQL) for integration testing.
- Extension settings: see `vsce/package.json` (`sqlsurge.*`, e.g., `sqlLanguageServerFlags`, `customRawSqlQuery`).
