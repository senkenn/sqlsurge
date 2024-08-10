//@ts-check
const { execSync } = require("node:child_process");

const buildType = process.env.BUILD;

if (buildType === "dev") {
  execSync("pnpm build:dev", { stdio: "inherit" });
} else {
  execSync("pnpm build:release", { stdio: "inherit" });
}

execSync("tsc -p .", { stdio: "inherit" });
