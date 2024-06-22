module.exports = {
  /**
   * @param {string} testPath
   * @param {string} snapshotExtension
   */
  resolveSnapshotPath: (testPath, snapshotExtension) =>
    testPath.replace(/\/out\//, "/test/").replace(/\.js/, ".ts") +
    snapshotExtension,

  /**
   * @param {string} snapshotFilePath
   * @param {string} snapshotExtension
   */
  resolveTestPath: (snapshotFilePath, snapshotExtension) =>
    snapshotFilePath.slice(0, -snapshotExtension.length),

  // Example test path, used for preflight consistency check of the implementation above
  testPathForConsistencyCheck: "some/__tests__/example.test.ts",
};

// Results in:
// .
// ├── test
// │   ├── suite-ts
// │   │   ├── extension.test.ts
// │   │   ├── extension.test.ts.snap
