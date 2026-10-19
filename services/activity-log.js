/**
 * Simple in-memory activity log + live broadcaster for the dashboard.
 * Not persisted — resets whenever the server restarts.
 */

"use strict";

const EventEmitter = require("events");

const MAX_EVENTS = 100;
const events = [];
const emitter = new EventEmitter();

function record(direction, summary, detail) {
  const event = {
    id: events.length + 1,
    ts: new Date().toISOString(),
    direction, // "in" | "out" | "system" | "error"
    summary,
    detail: detail || null,
  };

  events.push(event);
  if (events.length > MAX_EVENTS) {
    events.shift();
  }

  emitter.emit("event", event);
  return event;
}

function getAll() {
  return events.slice();
}

function subscribe(listener) {
  emitter.on("event", listener);
  return () => emitter.off("event", listener);
}

module.exports = {
  record,
  getAll,
  subscribe,
};
