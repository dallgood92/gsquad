# ChatApp Developer Guide

This guide explains how the application is organized, how data moves through it, and where to look when changing a feature. It is intentionally written for a developer learning the codebase rather than as generated API reference material.

## 1. Mental model

ChatApp is a React single-page client backed by an Express API, Prisma, PostgreSQL, Redis, S3-compatible attachment storage, and a WebSocket server.

The normal data path is:

```text
User interaction
  -> React component callback
  -> App orchestration or useConversations
  -> client/src/services/*Api.js
  -> Express route
  -> Prisma / storage / Redis
  -> JSON response
  -> local React state update

Other-user update
  -> server publishes a chat event
  -> WebSocket server delivers it
  -> useWebSocket parses it
  -> App.handleWebSocketEvent routes it
  -> useConversations updates the same local state
```

The important design idea is that `useConversations` owns the client-side conversation/message model. Components render that model and report user intent upward. `App` connects the model to authentication, presence, realtime events, and top-level UI.

## 2. Repository map

```text
client/src/
  App.jsx                 authenticated application shell and coordinator
  main.jsx                React entry point and global CSS import
  pages/                  page-level unauthenticated screens
  components/             visible UI units
  hooks/                  stateful application and browser integrations
  services/               HTTP calls grouped by backend domain
  styles/                 global CSS split in cascade order

server/
  index.js                process setup, middleware, dependency wiring, routes
  routes/                 HTTP controllers grouped by resource
  validation/             Zod request schemas
  middleware/auth.js      cookie/JWT authentication
  websocket.js            realtime connections, presence, and event delivery
  redis.js                cross-instance events and shared online-user state
  storage.js              attachment validation and signed URLs
  prisma/                 schema, migrations, and seed data
```

## 3. Frontend entry points

### `main.jsx`

Bootstraps React, imports `index.css`, and mounts `App`. `index.css` is now only an ordered import list. Do not reorder its imports casually: later styles intentionally refine earlier rules.

### `App.jsx`

`App` is the composition root for the signed-in experience. It does four jobs:

1. Gets the signed-in user from `useAuth`.
2. Gets conversation/message state and actions from `useConversations`.
3. connects WebSocket events to conversation and presence updates.
4. Composes the sidebar, chat header, message list, composer, panels, and dialogs.

Important local state:

| State | Purpose |
| --- | --- |
| `replyMessage` | Message currently selected as the reply target. |
| `sidebarCollapsed` | Controls the desktop sidebar presentation. |
| `showPinnedMessages` | Opens the pinned-message side panel. |
| revision counters | Tell independently loading popovers to refresh after a mutation or realtime event. |
| `groupInvites` / `groupInviteToast` | Tracks realtime group additions and transient feedback. |
| room-menu state | Controls the conversation menu, member popover, confirmation dialog, pending state, and errors. |

Important callbacks:

- `handleSelectConversation` clears conversation-specific transient UI before changing selection.
- `refreshAfterMemberChange` wraps a membership mutation, reports errors, and resynchronizes server state.
- `handleToggleNotifications` updates the current user's membership preferences locally after the API response.
- `handleArchiveConversation` archives, clears selection, refreshes the archive popover, and resyncs.
- `handleWebSocketEvent` is the frontend realtime event router. Add a new server event here when it must change React state.
- `handleTypingStart` and `handleTypingStop` translate composer activity into WebSocket events.

The authorization-derived values near the render (`currentMembership`, `isConversationAdmin`, and `isConversationCreator`) control which room actions are visible. The server must still enforce the same permissions; hiding a button is not authorization.

## 4. Components

### Conversation and people UI

#### `ConversationList.jsx`

Renders the left sidebar, separates group and direct conversations, owns the small group-creation form, selects conversations, and exposes archive/leave/delete actions. It also hosts the Friends view, direct-message entry point, and profile modal. Conversation data itself remains owned by `useConversations`.

#### `StartDirectMessage.jsx`

Loads friends, friend requests, and blocked users. Depending on `mode`, it presents friendship management or starts a direct conversation. It refreshes when the revision prop changes and uses short-lived toast state for feedback.

#### `AddMember.jsx`

Searches users for the active group and excludes existing member IDs. Selecting a result calls the member API, then passes the returned membership to `onMemberAdded` so the parent store can update without a full reload.

#### `ArchivedConversations.jsx`

Loads archived conversations when opened or when `revision` changes. Restoring updates the server and asks the parent to resync active conversations.

#### `ProfileModal.jsx`

Displays account details, supports display-name changes, shows friends, signs out, and applies the explicit light/dark preference to `document.documentElement.dataset.theme`.

#### `Avatar.jsx` and `Logo.jsx`

Small presentational primitives. `Avatar` chooses an image or initials and can add an online indicator. Keep these components free of fetching and business state.

### Messaging UI

#### `MessageList.jsx`

Owns message-list presentation and interaction state, not the canonical messages. Its responsibilities include:

- grouping consecutive messages by sender and time proximity;
- preserving scroll position while older messages are prepended;
- detecting whether the user is near the bottom;
- displaying the new-message affordance when appropriate;
- rendering delivery, edit, delete, reply, reaction, pin, attachment, and read-state UI;
- managing the context menu, inline editor, delete confirmation, and attachment lightbox;
- jumping to and briefly highlighting a referenced reply message.

The constants `LOAD_MORE_THRESHOLD` and `NEAR_BOTTOM_THRESHOLD` tune scroll behavior. The helper functions at the top format timestamps and derive stable sender colors. Mutations are delegated through props such as `onEditMessage`, `onDeleteMessage`, and `onToggleReaction`; successful server results ultimately update `useConversations` state.

Because this file is large, the safest future split is by visible responsibility: `MessageRow`, `MessageActions`, `MessageAttachment`, and the lightbox. Keep scroll measurement and list-level effects in `MessageList`.

#### `MessageInput.jsx`

Owns the draft text, typing debounce, attachment selection/upload progress, submit lifecycle, and reply preview. It accepts a finished attachment descriptor from the upload service and passes it with the message to `onSendMessage`. Typing starts on input activity and stops after inactivity, blur, submit, or unmount.

#### `MessageSearch.jsx`

Debounces the query, requests matching messages, and returns the selected result to `App`, which switches conversations. It also handles outside-click dismissal.

#### `ThreadPanel.jsx`

Loads the thread for a root message, combines it with relevant live messages, and sends replies using the root message ID. It is a focused alternate view over the same message-sending path.

#### `PinnedMessages.jsx`

Loads pinned messages for one conversation. `revision` forces a refresh after pin changes. Selecting a result delegates navigation back to the parent.

### Account and notifications

#### `GoogleLogin.jsx` and `LoginPage.jsx`

`GoogleLogin` loads the Google Identity script, receives a credential, exchanges it through `authApi`, and reports the authenticated user upward. `LoginPage` provides the unauthenticated layout.

#### `NotificationCenter.jsx`

Loads notifications when its revision changes, marks them read when opened, supports individual dismissal and clearing, and combines server notifications with current group invitations. Friend-related revision changes keep relationship actions current.

## 5. Hooks

### `useAuth.js`

Owns `user` and initial authentication loading. On mount it calls `/auth/me`; a `401` becomes an anonymous session rather than an error. `login`, `updateUser`, and `logout` update the single user object consumed by `App`.

### `usePresence.js`

Stores online user IDs in a `Set`. It can replace the initial presence snapshot or add/remove one user after realtime events. `isUserOnline` is the read interface used by avatars and headers.

### `useClickOutside.js`

Attaches a document pointer listener while active and invokes the supplied callback when the event target is outside the referenced element. Popovers use it to avoid duplicating dismissal logic.

### `useWebSocket.js`

Owns one authenticated realtime connection. It:

- derives the WebSocket URL from environment configuration;
- reports `connecting`, `connected`, `reconnecting`, or `disconnected`;
- parses inbound JSON and forwards valid events to `App`;
- sends heartbeat traffic and responds to connection lifecycle changes;
- reconnects with capped exponential backoff and jitter;
- calls the supplied resync callback after reconnecting so events missed while offline are recovered;
- exposes `sendEvent(type, data)` for typing and other client-originated events.

Refs hold the live socket, timers, retry count, and latest callbacks so the connection does not restart merely because a parent function identity changes.

### `useConversations.js`

This is the client-side domain store. Its public return value is the contract used by `App`.

Core state:

| State | Meaning |
| --- | --- |
| `conversations` | Conversation summaries plus locally loaded messages and pagination metadata. |
| `selectedConversationId` | Current conversation identity. |
| `typingUsers` | Map of conversation ID to user IDs currently typing. |
| loading flags | Initial list, selected-message load, older-page load, and reconnect resync states. |
| `error` | Latest conversation/message operation error. |

Pure helpers:

- `mergeMessages` deduplicates by message ID and returns chronological order.
- `sortConversations` orders conversations by their latest activity.
- `replaceMessageInConversation` replaces one message and keeps `lastMessage` consistent.

Lifecycle and loading:

- Initial loading fetches conversation summaries and decorates them with client-only message state.
- Selecting a conversation lazy-loads its messages once.
- `markConversationRead` persists the receipt, clears unread count, and updates the current membership's last-read ID.
- `loadOlderMessages` uses the server cursor, prepends a deduplicated page, and updates `hasMoreMessages`/`nextMessageCursor`.
- `resync` reloads authoritative summaries after a reconnect or membership-changing action while retaining already loaded message arrays where possible.

Realtime reducers:

- `receiveConversation` inserts a new conversation only once.
- `receiveConversationDelete` removes it and safely selects a fallback.
- `receiveMessage` deduplicates, updates last activity, increments unread state only for inactive conversations, and marks active messages read.
- update/delete handlers replace the message returned by the server.
- receipt and membership handlers update the relevant nested member record immutably.

Outgoing messages use an optimistic record with a temporary negative ID and `deliveryStatus: "sending"`. A successful response replaces it with the server message. A failure retains it with `deliveryStatus: "failed"`; `retryMessage` removes that failed record and sends the same content again.

A safe future refactor would first extract the three pure helpers and optimistic-message factory, then move data loading into a small internal hook. Do not split every callback into a separate hook: they coordinate the same normalized state and would become harder to follow.

## 6. HTTP services

Components and hooks import from `services/api.js`, which is a stable barrel. Implementations are grouped by backend domain:

- `authApi.js`: current session, Google login, logout.
- `usersApi.js`: profile update and user search.
- `friendsApi.js`: friends, requests, blocking, and acceptance.
- `conversationsApi.js`: lists, creation, membership settings, archive, and read receipts.
- `messagesApi.js`: pagination, send/edit/delete, reactions, threads, search, pins, and attachment upload.
- `notificationsApi.js`: load, mark read, dismiss, and clear.
- `healthApi.js`: server health probe.
- `apiClient.js`: shared API base URL.

These functions deliberately remain thin: build the request, check the response, return parsed JSON, and surface a useful error. React state belongs in hooks, while authorization and data integrity belong on the server.

## 7. Backend

### `server/index.js`

Creates shared dependencies (`PrismaClient`, storage, Redis), configures CORS/JSON/cookies, mounts authentication middleware and route modules, creates the HTTP server, then attaches WebSocket behavior. Route factories receive only the dependencies they need.

### Route responsibilities

| Module | Responsibility |
| --- | --- |
| `auth.js` | Verify Google credentials, create/find a user, issue the session cookie, return/logout the current session. |
| `users.js` | Update the current profile and search discoverable users. |
| `friends.js` | Requests, acceptance, removal, blocking, and direct-conversation cleanup. |
| `conversations.js` | Visible/archived lists, group/direct creation, rename, and deletion. |
| `members.js` | Add/remove members, roles, notification preferences, and archive membership state. |
| `messages.js` | Page messages, create/edit/delete, thread data, reactions, pins, notifications, and realtime publication. |
| `search.js` | Bounded message search across authorized conversations. |
| `notifications.js` | Notification inbox state. |
| `attachments.js` | Validate upload metadata and issue signed upload information. |

### `websocket.js`

Authenticates the upgrade request from the session cookie, tracks sockets by user, sends the initial online-user snapshot, handles heartbeat cleanup, accepts supported client events such as typing, and delivers events to relevant connected users. Redis is used when available so events and presence work across multiple server instances.

### `redis.js`

Wraps Redis setup, chat-event publish/subscribe, and the shared online-user set. The application can run without Redis in a single instance, but cross-instance realtime fan-out and shared presence depend on it.

### `storage.js`

Defines allowed image/video types and size limits, validates upload requests, and generates signed object-storage operations. The client uploads bytes directly after receiving permission; message creation stores attachment metadata rather than proxying the file through Express.

## 8. End-to-end feature examples

### Sending a message

1. `MessageInput` validates the draft and calls `App`'s supplied send callback.
2. `useConversations.sendMessage` inserts an optimistic message.
3. `messagesApi.sendMessage` posts to the conversation messages route.
4. The route verifies membership, validates content, writes with Prisma, and publishes a realtime event.
5. The sender replaces its optimistic record from the HTTP result.
6. Other clients receive `message_created`; `App` forwards it to `receiveMessage`.

### Receiving a realtime message

1. `useWebSocket` receives and parses the event.
2. `App.handleWebSocketEvent` selects the matching reducer.
3. `receiveMessage` deduplicates it, updates the conversation preview/order, and calculates unread state.
4. If that conversation is open, the read receipt is persisted immediately.

### Uploading an attachment

1. `MessageInput` validates local selection and shows a preview.
2. `uploadMessageAttachment` requests signed upload information.
3. The browser uploads directly and reports progress.
4. The resulting storage descriptor is included in the normal message request.
5. `MessageList` renders the attachment; opening it uses the in-app lightbox.

### Editing or deleting a message

1. `MessageList` owns the edit/delete interaction UI.
2. It calls the mutation prop supplied from `useConversations` through `App`.
3. The API route verifies ownership/permission and returns the updated message representation.
4. Local state replaces the message; realtime clients perform the same replacement after their event arrives.

## 9. CSS organization

The stylesheets are numbered because their order is part of the cascade:

1. `01-foundations.css` — tokens, reset, original layout, base responsive and theme rules.
2. `02-core-refinements.css` — login, message layout, application chrome, sidebar, and early refinements.
3. `03-app-features.css` — friends, grouping, menus, attachments, and feature surfaces.
4. `04-messages.css` — current chat canvas, bubbles, replies, actions, timestamps, and message menus.
5. `05-surfaces.css` — profile, creation/search popovers, notifications, archives, composer, and sidebar views.
6. `06-overlays.css` — dialogs, toasts, member summaries, reply highlighting, and the attachment viewer.

When adding a rule, put it beside the feature's current rules. Before creating a new selector, search all six files because several later sections intentionally override older base rules.

## 10. Where do I change…?

| Goal | Start here | Usually also involved |
| --- | --- | --- |
| Message bubble UI | `MessageList.jsx`, `styles/04-messages.css` | `useConversations.js` for behavior |
| Sending/drafts/uploads | `MessageInput.jsx` | `messagesApi.js`, message/attachment routes |
| Pagination or unread counts | `useConversations.js` | message/conversation routes |
| Realtime event | `websocket.js` | `App.handleWebSocketEvent`, `useConversations.js` |
| Conversation sidebar | `ConversationList.jsx` | conversation styles and API |
| Friends/blocking | `StartDirectMessage.jsx` | `friendsApi.js`, `routes/friends.js` |
| Group permissions | room UI in `App.jsx` | member/conversation routes |
| Authentication | `useAuth.js`, `GoogleLogin.jsx` | `authApi.js`, `routes/auth.js` |
| Presence/reconnect | `usePresence.js`, `useWebSocket.js` | `websocket.js`, `redis.js` |
| Theme | `ProfileModal.jsx` | foundation/surface styles |
| Database shape | `prisma/schema.prisma` | a new Prisma migration and affected routes |

## 11. Change checklist

Before considering a feature complete:

1. Identify who owns the state: component-local UI, `useConversations`, or the database.
2. Confirm the HTTP route enforces permissions even when the UI hides the action.
3. If other clients must see the change, publish and handle a realtime event.
4. Keep optimistic and server-confirmed message shapes compatible.
5. Check direct and group conversations separately.
6. Check light and dark themes plus narrow layouts.
7. Run `npm run lint` and `npm run build` in `client`.
8. If backend code changed, at minimum run syntax checks and exercise the affected endpoint locally.

## 12. Known cleanup opportunities

- Extract presentational message subcomponents from `MessageList.jsx` while leaving scroll ownership in the list.
- Extract pure conversation helpers and the optimistic-message factory from `useConversations.js` and unit test them.
- Move the conversation header/menu/dialog UI out of `App.jsx`; keep realtime routing and top-level composition in `App`.
- Add client tests for message merging, optimistic replacement, unread counts, pagination scroll retention, and reconnect resync.
- Add route-level tests for authorization boundaries around editing, deleting, roles, and membership.

These are deliberately incremental seams. Avoid introducing global state libraries or generic request abstractions until the existing requirements demonstrate a real need.
