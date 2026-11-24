# ADR-0010: scrypt password hashing from node:crypto

- Status: Accepted
- Date: 2026-11-24

## Context

Passwords must be stored with a memory-hard KDF. Native add-ons (bcrypt, argon2) complicate installs on locked-down servers.

## Decision Drivers

- Memory-hard
- No native dependencies
- Upgradable parameters

## Considered Options

1. **`crypto.scrypt` N=16384 r=8 p=1, 16-byte salt, 64-byte key, parameters stored in the hash string** — Built in.
2. **argon2id via native module** — Stronger default, native build.
3. **bcrypt** — CPU-hard only, 72-byte limit.

## Decision Outcome

Chosen: **scrypt** with format `scrypt$N$r$p$salt$hash`, `timingSafeEqual` comparison, and a dummy hash verified for unknown emails to equalise timing.

## Consequences

- Parameters can be raised later; old hashes still verify
- ~50 ms per hash on a modern core limits online guessing further

## Status

Accepted.
