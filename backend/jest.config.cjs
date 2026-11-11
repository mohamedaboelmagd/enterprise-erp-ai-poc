/** @type {import("jest").Config} */
module.exports = {
  testEnvironment: "node",
  rootDir: ".",
  testMatch: ["<rootDir>/test/**/*.spec.ts"],
  transform: { "^.+\\.ts$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.spec.json" }] },
  moduleFileExtensions: ["ts", "js", "json"],
  collectCoverageFrom: ["src/domain/**/*.ts"],
};
