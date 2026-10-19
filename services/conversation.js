/**
 * Copyright 2021-present, Facebook, Inc. All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use strict";

const constants = require("./constants");
const Attribution = require('./attribution');
const GraphApi = require('./graph-api');
const Message = require('./message');
const Status = require('./status');
const activityLog = require('./activity-log');


function sendReply(messageId, senderPhoneNumberId, recipientPhoneNumber, messageBody) {
  return GraphApi.messageWithText(
    messageId,
    senderPhoneNumberId,
    recipientPhoneNumber,
    messageBody
  );
}


module.exports = class Conversation {
  constructor(phoneNumberId) {
    this.phoneNumberId = phoneNumberId;
  }

  // Any inbound message gets a simple plain-text reply.
  static async handleMessage(senderPhoneNumberId, rawMessage) {
    const message = new Message(rawMessage);
    Attribution.logAttributionEvent(message, senderPhoneNumberId);
    activityLog.record(
      "in",
      `Received "${message.type}" from ${message.senderPhoneNumber}`,
      rawMessage
    );

    await sendReply(
      message.id,
      senderPhoneNumberId,
      message.senderPhoneNumber,
      constants.APP_DEFAULT_MESSAGE
    );
  }

  // Lets the dashboard trigger a test text message without waiting for an
  // inbound webhook first.
  static async sendTestMessage(senderPhoneNumberId, recipientPhoneNumber, messageBody) {
    return sendReply(
      undefined,
      senderPhoneNumberId,
      recipientPhoneNumber,
      messageBody || constants.APP_DEFAULT_MESSAGE
    );
  }

  static async handleStatus(senderPhoneNumberId, rawStatus) {
    const status = new Status(rawStatus);
    activityLog.record(
      "in",
      `Status update: ${status.status} for message to ${status.recipientPhoneNumber}`,
      rawStatus
    );
  }
};
