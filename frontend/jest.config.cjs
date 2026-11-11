const path = require("node:path");

/** @type {import("jest").Config} */
module.exports = {
  testEnvironment: "jsdom",
  rootDir: ".",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testMatch: ["<rootDir>/src/**/*.test.tsx"],
  transform: { "^.+\\.(ts|tsx)$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.jest.json" }] },
  moduleNameMapper: {
    "^@core/(.*)$": "<rootDir>/../backend/src/$1",
    "\\.(css)$": "<rootDir>/test/style-mock.js",
  },
  testPathIgnorePatterns: ["<rootDir>/.next/", "<rootDir>/node_modules/", "<rootDir>/out/"],
};
