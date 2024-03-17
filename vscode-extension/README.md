# Markdown Code Features

Support diagnostics and completion in markdown code blocks.

https://marketplace.visualstudio.com/items?itemName=mizchi.markdown-code-features

![](https://raw.githubusercontent.com/mizchi/markdown-code-features/main/vscode-extension/demo.png)


## Features

- Show typescript diagnostics in markdown.
  - use `tsconfig.json` at project root
- Import other `.ts` files
  - `import Foo from "./index";`
- Import self code block file
  - Code block with `ts:foo.ts` and `import {} from "./self.md@foo.ts";`

## Settings

Install and `markdown-code-features.enabled: true` in .vscode/settings.json

```json
{
  "markdown-code-features.enable": true,
  // to enable completion in markdown
  "[markdown]": {
    "editor.quickSuggestions": {
        "comments": true,
        "strings": true,
        "other": true
    }
  }
}
```

## TODO

- [x] activate in `.md` and `.mdx`
- [x] typescript: completion
- [x] typescript: diagnostics
- [ ] typescript: pop over tooltip
- [x] diagnostics: on load
- [x] diagnostics: on change other contents
- [ ] mdx: import/export completion
- [x] css: completion
- [x] html: completion
- [ ] perf: selective update
- [ ] vite/vitest plugin
- [ ] compiler: run
- [ ] compiler: run tests
- [ ] compiler: run with mdx component
- [ ] cli: type-checker

## Develop

```bash
# for test
code vscode-extensions
```

- Run and Debug on Vscode > Run (F5)

## Local install

```bash
# cd vscode-extenions
$ pnpm install
$ pnpm build
$ pnpm package # generate markdown-code-features-x.x.x.vsix
```

Local install

- Install `ctrl-shift-p` in vscode
- `Extensions: Install from VSIX` and select it

