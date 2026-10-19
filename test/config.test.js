/**
 * Copyright 2021-present, Facebook, Inc. All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use strict";

const assert = require("node:assert/strict");
const {spawnSync} = require("node:child_process");
const test = require("node:test");
const path = require("node:path");

const appRoot = path.resolve(__dirname, "..");
const configPath = path.resolve(appRoot, "services/config.js");
const validEnvironment = {
  ...process.env,
  ACCESS_TOKEN: "test-access-token",
  APP_SECRET: "test-app-secret",
  VERIFY_TOKEN: "test-verify-token",
};

function runConfigCheck(environment = validEnvironment) {
  return spawnSync(
    process.execPath,
    ["-e", `require(${JSON.stringify(configPath)}).checkEnvVariables()`],
    {
      cwd: __dirname,
      encoding: "utf8",
      env: environment,
    },
  );
}

test("exports the core application configuration", () => {
  const result = spawnSync(
    process.execPath,
    [
      "-e",
      `const config = require(${JSON.stringify(configPath)});
       process.stdout.write(JSON.stringify({
         appSecret: config.appSecret,
         accessToken: config.accessToken,
         verifyToken: config.verifyToken,
         port: config.port,
       }));`,
    ],
    {
      cwd: __dirname,
      encoding: "utf8",
      env: validEnvironment,
    },
  );

  assert.equal(result.status, 0);
  assert.deepEqual(JSON.parse(result.stdout), {
    appSecret: "test-app-secret",
    accessToken: "test-access-token",
    verifyToken: "test-verify-token",
    port: 8080,
  });
});

test("checkEnvVariables does not throw when all required variables are set", () => {
  const result = runConfigCheck();

  assert.equal(result.status, 0, result.stderr);
});

test("checkEnvVariables warns (but does not fail) when a variable is missing", () => {
  const environment = { ...validEnvironment };
  delete environment.ACCESS_TOKEN;

  const result = runConfigCheck(environment);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /Missing the environment variable ACCESS_TOKEN/);
});
