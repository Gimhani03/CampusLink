/**
 * Server-Sent Events (SSE) connection manager.
 *
 * Maintains a registry of all active SSE connections keyed by userId.
 * Each student can have multiple simultaneous connections (multiple browser
 * tabs) — modelled as a Set<Response> per userId.
 *
 * ─── Why SSE instead of WebSockets? ──────────────────────────────────────────
 *   Notifications are server → client only. SSE is simpler, works over standard
 *   HTTP/1.1, requires no handshake upgrade, and auto-reconnects natively.
 *   This file is the only thing that needs to change to swap the transport —
 *   the service layer calls pushToUser() without knowing about the wire protocol.
 *
 * ─── Upgrade path to Socket.io ───────────────────────────────────────────────
 *   Replace pushToUser() and broadcast() with socket.io room emits.
 *   The Notification service, controller, and model remain untouched.
 *
 * ─── Multi-instance deployments ──────────────────────────────────────────────
 *   This in-process Map is only correct for single-instance Node.js.
 *   For horizontally-scaled deployments, replace this module with a
 *   Redis Pub/Sub adapter: publish to a channel, each instance subscribes
 *   and delivers to its own local connections.
 *
 * SSE wire format (WHATWG EventSource spec):
 *   event: <eventName>\n
 *   data: <JSON string>\n
 *   \n
 */

/** @type {Map<string, Set<import('express').Response>>} */
const clients = new Map();

// ─── Connection lifecycle ─────────────────────────────────────────────────────

/**
 * Registers a new SSE connection for a user.
 *
 * @param {string}                       userId  Stringified ObjectId.
 * @param {import('express').Response}   res     Express response object.
 */
export const addClient = (userId, res) => {
  if (!clients.has(userId)) {
    clients.set(userId, new Set());
  }
  clients.get(userId).add(res);
};

/**
 * Removes an SSE connection (called when the client disconnects).
 *
 * @param {string}                       userId
 * @param {import('express').Response}   res
 */
export const removeClient = (userId, res) => {
  const userConnections = clients.get(userId);
  if (!userConnections) return;

  userConnections.delete(res);

  // Remove the user entry entirely when all their tabs are closed.
  if (userConnections.size === 0) {
    clients.delete(userId);
  }
};

// ─── Message delivery ─────────────────────────────────────────────────────────

/**
 * Serialises data into the SSE wire format.
 *
 * @param {string} eventName  SSE event name (e.g. "notification", "heartbeat").
 * @param {object} payload    JSON-serialisable payload.
 * @returns {string}
 */
const formatMessage = (eventName, payload) =>
  `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;

/**
 * Pushes a real-time event to all active connections for a specific user.
 * Silently removes broken connections (client tab closed without clean disconnect).
 *
 * @param {string} userId     Stringified ObjectId.
 * @param {string} eventName  SSE event name.
 * @param {object} payload    JSON-serialisable payload.
 */
export const pushToUser = (userId, eventName, payload) => {
  const userConnections = clients.get(userId.toString());
  if (!userConnections || userConnections.size === 0) return;

  const message = formatMessage(eventName, payload);

  for (const res of userConnections) {
    try {
      res.write(message);
    } catch {
      // Connection broke without a clean close event — remove stale entry.
      userConnections.delete(res);
    }
  }
};

/**
 * Broadcasts an event to ALL currently connected users.
 * Used for platform-wide announcements.
 *
 * @param {string} eventName
 * @param {object} payload
 */
export const broadcast = (eventName, payload) => {
  for (const userId of clients.keys()) {
    pushToUser(userId, eventName, payload);
  }
};

// ─── Diagnostics ──────────────────────────────────────────────────────────────

/** Total number of active SSE connections across all users. */
export const totalConnections = () => {
  let count = 0;
  for (const connections of clients.values()) count += connections.size;
  return count;
};

/** Number of distinct users with at least one active SSE connection. */
export const connectedUsers = () => clients.size;
