# Spin2Win

Spin2Win is a OneChain reward-wheel game where each spin is finalized on-chain and logged via events for transparent reward tracking.

## Highlights

- Deterministic on-chain result emission
- Tiered reward classes: Common, Rare, Jackpot
- Shared wheel object model
- React wallet integration for gameplay
- Live event timeline in frontend

## Testnet Deployment

- Network: OneChain testnet
- RPC: https://rpc-testnet.onelabs.cc:443
- Explorer: https://onescan.cc/testnet
- Package ID: `0xe71849994dce6b51dc6303979d09423c4abb92863044c3bb9650b1c9d6a952d8`
- Publish Tx: `4hgXEyP3eJg9UYtHGMrWMjB2Yp4A2NjzTn79hH6eJSGL`
- Shared Wheel Object: `0x58378fcb2604f587fc8f8e830c6496d6b86a04cc1f1e3700f28a90f23fa652e9`

Smoke calls:
- `create_wheel`: `Aqeo3FrGS3TveQrfF43JQArWQfbPi4RWrWp6Wkn5kPz7` (Success)
- `spin`: `hkifssTNBddygoXeyqSizPJceHGrt8FdjR8ssQ87wQS` (Success)

## Project Layout

- `contracts/` Move package
- `contracts/sources/spin2win.move` wheel logic
- `frontend/` Vite + React + TypeScript app
- `frontend/src/components/GuessArena.tsx` gameplay and event UI

## Smart Contract API

Module file: `contracts/sources/spin2win.move`

Public entry functions:
- `create_wheel(ctx)`
- `spin(wheel, ctx)`

Main events:
- `WheelCreated`
- `Spun` with fields such as `wheel_id` and `tier`

Tier mapping used in UI:
- `0` -> Common
- `1` -> Rare
- `2` -> Jackpot

## Frontend Features

- Wallet connect and transaction signing
- Create or load wheel object
- Execute spin and show tx digest
- Keep wheel list synced from `WheelCreated` events
- Show spin history and reward tier badges

## Environment

Set `frontend/.env`:

```env
VITE_PACKAGE_ID=0xe71849994dce6b51dc6303979d09423c4abb92863044c3bb9650b1c9d6a952d8
```

## Build and Run

Contract:

```bash
cd contracts
one move build --path .
one client publish --gas-budget 50000000 .
```

Frontend:

```bash
cd frontend
npm install
npm run dev
npm run build
```

## Manual Test Flow

1. Connect wallet.
2. Create a wheel if one is not loaded.
3. Spin repeatedly.
4. Confirm every spin tx succeeds and appears on explorer.
5. Confirm `Spun` history updates with tier values.

## Troubleshooting

- `Package ID missing`: verify `VITE_PACKAGE_ID` in `frontend/.env`.
- `Wheel object not found`: recreate wheel and reload object id.
- `Transaction rejected`: verify active network and wallet gas balance.
- Vite chunk-size warnings are informative and do not block build output.
