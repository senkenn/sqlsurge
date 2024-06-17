/** @type {import('jest').Config} */
module.exports = {
  clearMocks: true,
  preset: "ts-jest",
  // transformIgnorePatterns: ["/node_modules/(?!three/examples/)"],
  // transform: {
  //   "node_modules/three/examples/.+.(j|t)sx?$": "ts-jest",
  // },
  testMatch: ["<rootDir>/src/*.test.ts"],
};
