/**
 * Copyright 2021-present, Facebook, Inc. All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use strict";

const crypto = require('crypto');

const { urlencoded, json } = require('body-parser');
require('dotenv').config();
const express = require('express');

const path = require('path');

const config = require('./services/config');
const Conversation = require('./services/conversation');
const Message = require('./services/message');
const activityLog = require('./services/activity-log');
const app = express();

// Parse application/x-www-form-urlencoded
app.use(
  urlencoded({
    extended: true
  })
);

// Parse application/json. Verify that callback came from Facebook
app.use(json({ verify: verifyRequestSignature }));

// Handle webhook verification handshake
app.get("/webhook", function (req, res) {
  if (
    req.query["hub.mode"] != "subscribe" ||
    req.query["hub.verify_token"] != config.verifyToken
  ) {
    res.sendStatus(403);
    return;
  }

  res.send(req.query["hub.challenge"]);
});

// Handle incoming messages
app.post('/webhook', (req, res) => {
  console.log(req.body);

  if (req.body.object === "whatsapp_business_account") {
    req.body.entry.forEach(entry => {
      entry.changes.forEach(change => {
        const value = change.value;
        if (value) {
          const senderPhoneNumberId = value.metadata.phone_number_id;

          if (value.statuses) {
            value.statuses.forEach(status => {
              // Handle message status updates
              Conversation.handleStatus(senderPhoneNumberId, status);
            });
          }

          if (value.messages) {
            value.messages.forEach(rawMessage => {
              // Respond to message
              Conversation.handleMessage(senderPhoneNumberId, rawMessage);
            });
          }
        }
      });
    });
  }

  res.status(200).send('EVENT_RECEIVED');
});

// Default route for health check
app.get('/', (req, res) => {
  res.json({
    message: 'Jasper\'s Market Server is running',
    endpoints: [
      'POST /webhook - WhatsApp webhook endpoint',
      'GET /dashboard - local monitoring dashboard'
    ]
  });
});

// --- Dashboard (local-only monitoring UI, not part of the WhatsApp flow) ---

app.use('/dashboard', express.static(path.join(__dirname, 'public')));

app.get('/api/status', (req, res) => {
  res.json({
    port: config.port,
    defaultSenderPhoneNumberId: process.env.PHONE_NUMBER_ID || null,
  });
});

app.get('/api/activity', (req, res) => {
  res.json(activityLog.getAll());
});

app.get('/api/activity/stream', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.flushHeaders();

  const unsubscribe = activityLog.subscribe((event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  });

  req.on('close', unsubscribe);
});

app.post('/api/test-send', async (req, res) => {
  const { to, senderPhoneNumberId, message } = req.body || {};

  if (!to || !senderPhoneNumberId || !message) {
    res.status(400).json({ error: '"to", "senderPhoneNumberId", and "message" are all required.' });
    return;
  }

  try {
    await Conversation.sendTestMessage(senderPhoneNumberId, to, message);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message || String(error) });
  }
});

// Check if all environment variables are set
config.checkEnvVariables();

// Verify that the callback came from Facebook.
function verifyRequestSignature(req, res, buf) {
  let signature = req.headers["x-hub-signature-256"];

  if (!signature) {
    console.warn(`Couldn't find "x-hub-signature-256" in headers.`);
  } else {
    let elements = signature.split("=");
    let signatureHash = elements[1];
    let expectedHash = crypto
      .createHmac("sha256", config.appSecret)
      .update(buf)
      .digest("hex");
    if (signatureHash != expectedHash) {
      throw new Error("Couldn't validate the request signature.");
    }
  }
}


var listener = app.listen(config.port, () => {
  console.log(`The app is listening on port ${listener.address().port}`);
  activityLog.record('system', `Server started on port ${listener.address().port}`);
});
