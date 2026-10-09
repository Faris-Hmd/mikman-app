# MikMan Project Rules & Architecture Guidelines

## 1. UI, Badges & Content Rules
- **No Unsolicited Badges, Tags, or Pills**: NEVER add badges, pill labels, status tags, or chip indicators unless the user explicitly asks for them.
- **No Filler Text or Space Fillers**: Do NOT insert random subtitle blurbs, placeholder text, or decorative chips just to fill up empty screen space. Layouts must remain clean, direct, high-density, and purposeful.
- **No Outline/Ghost Buttons**: NEVER use thin, hollow, or faded outline button styles (`border: 1px solid ...; background: transparent`).
- **Solid High-Contrast Buttons**: Always use solid, filled button themes with distinct background fills (`var(--primary)`, `#2563eb`, `#10b981`, `#334155`), bold typography, and clear contrast on mobile and desktop.
- **Language & Communication**: Always communicate in English clearly, directly, and concisely.

## 2. Server-Side Data Normalization (MVC Architecture)
- **Aggregation on Server**: The backend (`Mk-server` Node.js REST API) performs data aggregation and normalization directly on the VPS by querying RouterOS:
  - `/ip/hotspot/active` (active user sessions and bandwidth)
  - `/ip/hotspot/host` (physical layer host table)
  - `/ip/hotspot/user` (voucher details and quota limits)
  - `/ip/dhcp-server/lease` (DHCP lease table, hostnames, and Option 82 metadata)
  - `/interface/bridge/host` (bridge ingress port mapping)
- **Normalized Client Response**: The server returns clean, normalized client payloads (`id`, `user`, `mac`, `ip`, `port`, `apName`, `isOnline`, `uptime`, `remainingTime`, `remainingBytes`, `dhcpHostName`, `dhcpServer`).
- **Client App Role**: The client application consumes pre-normalized server data directly, maintaining minimal local state only for user overrides.

## 3. WireGuard VPN & Peer Telemetry
- **Actual Server Peer Data**: Display real-time status (`online` vs `offline`) and exact uptime / connection duration for each connected router and WireGuard peer directly from server telemetry (`/api/routers` and `/api/routers/:id/status`).

## 4. Rule Enforcement Engine
- This file (`AGENTS.md`) is loaded dynamically by the Antigravity agent system into the active prompt's `<user_rules>` block on every turn and has top-level precedence over any default behavior.
