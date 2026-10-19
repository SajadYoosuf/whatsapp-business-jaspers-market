/**
 * Copyright 2021-present, Facebook, Inc. All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const graphApiPath = require.resolve("../services/graph-api");
const graphApiCalls = [];

function recordGraphApiCall(method, args, responseMessageId) {
  graphApiCalls.push({args, method});
  return Promise.resolve({messages: [{id: responseMessageId}]});
}

require.cache[graphApiPath] = {
  exports: {
    messageWithText(...args) {
      return recordGraphApiCall("messageWithText", args, "wamid.outbound-text");
    },
  },
};

const constants = require("../services/constants");
const Conversation = require("../services/conversation");

async function captureLogs(callback) {
  const logLines = [];
  const originalConsoleLog = console.log;
  console.log = value => logLines.push(value);

  try {
    await callback();
  } finally {
    console.log = originalConsoleLog;
  }

  return logLines;
}

test("phrase attribution is logged without changing the plain-text reply", async () => {
  graphApiCalls.length = 0;
  const logLines = await captureLogs(() =>
    Conversation.handleMessage("720611841146439", {
      id: "wamid.conversation-start",
      from: "15551234567",
      timestamp: "1770000005",
      type: "text",
      text: {
        body: "Try it out",
      },
    }),
  );

  assert.equal(logLines.length, 1);
  assert.deepEqual(JSON.parse(logLines[0]), {
    event_name: "entry_source_attributed",
    schema_version: 1,
    source_surface: "simplified_devx_onboarding",
    inbound_message_id: "wamid.conversation-start",
    receiver_phone_number_id: "720611841146439",
    event_timestamp: "1770000005",
  });
  assert.equal(graphApiCalls.length, 1);
  assert.equal(graphApiCalls[0].method, "messageWithText");
  assert.equal(graphApiCalls[0].args[0], "wamid.conversation-start");
  assert.equal(graphApiCalls[0].args[1], "720611841146439");
  assert.equal(graphApiCalls[0].args[2], "15551234567");
  assert.equal(graphApiCalls[0].args[3], constants.APP_DEFAULT_MESSAGE);
});

test("any inbound message type gets the same plain-text reply", async () => {
  graphApiCalls.length = 0;
  const logLines = await captureLogs(() =>
    Conversation.handleMessage("720611841146439", {
      id: "wamid.some-interactive-reply",
      from: "15551234567",
      timestamp: "1770000006",
      type: "interactive",
      interactive: {
        button_reply: {
          id: "anything",
        },
      },
    }),
  );

  assert.deepEqual(logLines, []);
  assert.equal(graphApiCalls.length, 1);
  assert.equal(graphApiCalls[0].method, "messageWithText");
  assert.equal(graphApiCalls[0].args[0], "wamid.some-interactive-reply");
  assert.equal(graphApiCalls[0].args[1], "720611841146439");
  assert.equal(graphApiCalls[0].args[2], "15551234567");
  assert.equal(graphApiCalls[0].args[3], constants.APP_DEFAULT_MESSAGE);
});

test("sendTestMessage sends a plain-text message to the given recipient", async () => {
  graphApiCalls.length = 0;
  await Conversation.sendTestMessage("720611841146439", "15551234567", "Hello from the dashboard");

  assert.equal(graphApiCalls.length, 1);
  assert.equal(graphApiCalls[0].method, "messageWithText");
  assert.equal(graphApiCalls[0].args[0], undefined);
  assert.equal(graphApiCalls[0].args[1], "720611841146439");
  assert.equal(graphApiCalls[0].args[2], "15551234567");
  assert.equal(graphApiCalls[0].args[3], "Hello from the dashboard");
});
