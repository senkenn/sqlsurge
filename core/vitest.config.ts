import { defineConfig } from 'vitest/config'
import { markdownRunner } from "./src/rollup.mts";

export default defineConfig({
  plugins: [
    markdownRunner(),
  ],
  test: {
    include: ["src/**/*.test.ts", "spec/**/*.md", "spec/**/*.mdx"],
  }
})