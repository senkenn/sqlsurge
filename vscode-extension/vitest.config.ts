// import {defineConfig} from "vite";
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // inclu
    include: ["src/**/*.test.ts"],
  }
})