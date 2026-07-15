# Kirim

**Settlement infrastructure for Indonesian migrant workers — Malaysia to Indonesia, powered by Stellar & Soroban.**

Submission for the APAC Stellar Hackathon — Payment Consumer Applications track.

---

## The Problem

Every year, millions of Indonesian migrant workers (Pekerja Migran Indonesia / PMI) in Malaysia send money home to support their families. Traditional remittance channels are slow, expensive, and often split across multiple transfers — one to a spouse, one to parents, one to a child's school fee — each carrying its own fee.

**Kirim** rebuilds this flow on Stellar: one transaction, multiple recipients, transparent settlement, and an optional path to grow idle savings — all without ever exposing the end user to the complexity of crypto.

## What Kirim Does

| Capability | Description |
|---|---|
| **Split disbursement** | A single on-chain transaction distributes funds to up to 5 recipients at once — a spouse, parents, and children's savings, settled atomically in one call |
| **Yield-linked savings** | Idle balances can be deposited into [Blend Protocol](https://blend.capital)'s lending pool to earn yield, and withdrawn on demand |
| **Fiat delivery, invisible settlement** | The stablecoin settlement layer is a backend implementation detail. End recipients see Rupiah, not crypto — in line with Bank Indonesia regulation, which does not permit crypto as a payment instrument |

> **Regulatory framing matters.** Kirim is built and positioned as **settlement infrastructure**, not a consumer crypto payment app. Stellar is the rail; the user experience is fiat-in, fiat-out.

## Why This Corridor

Malaysia hosts one of the largest populations of Indonesian migrant workers globally, and the Malaysia → Indonesia remittance corridor carries meaningful transaction volume with fees that remain high relative to the amounts sent — a pattern well documented in the World Bank's Remittance Prices Worldwide data. Kirim targets this corridor first, with an architecture designed to extend to other PMI corridors (Hong Kong, Taiwan, Singapore, and the Gulf states) without structural rework.

---

## Architecture

```
┌─────────────┐      ┌──────────────────┐      ┌───────────────────────┐
│  Frontend   │◄────►│  Backend (Node)  │◄────►│  Soroban Smart Contract│
│  (sender &  │      │  - Custodial-lite│      │  (Kirim, Rust)        │
│  recipient  │      │    key management│      │                       │
│  dashboards)│      │  - Fee sponsorship│      │  - Split disbursement │
└─────────────┘      │  - SEP-24 sim.   │      │  - Yield deposit/     │
                      └──────────────────┘      │    withdraw           │
                                                 └──────────┬────────────┘
                                                            │
                                                            ▼
                                                 ┌───────────────────────┐
                                                 │  Blend Protocol Pool  │
                                                 │  (testnet, external)  │
                                                 └───────────────────────┘
```

**Custodial-lite model:** users never hold XLM or manage keys directly. Account creation, transaction fees, and reserve requirements are sponsored by the backend's treasury account — the same pattern used by production custodial wallets on Stellar mainnet.

---

## Smart Contract

Located at [`contracts/kirim/src/`](./contracts/kirim/src/). Written in Rust against `soroban-sdk 26.1.0`.

### Deployed addresses (Testnet)

| Item | Address |
|---|---|
| Kirim contract | `CBJFVOVHSACBXWVJRRNU6TK3DIDOGDUSMPYV7VDQNC2BGUHORSHPNFVQ` |
| TESTUSD (SAC) | `CAOP7G6SU66NSJQ6PLDGASAR6WT6QQLHBRQBBF53U6EVW4KEKGRZXNZS` |
| Blend Pool (TestnetV2) | `CCEBVDYM32YNYCVNRXQKDFFPISJJCV557CDZEIRBEE4NCV4KHPQ44HGF` |
| Blend testnet USDC | `CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU` |

### Contract interface

| Function | Description |
|---|---|
| `initialize(admin, asset)` | One-time setup: sets admin and the allowed settlement asset |
| `create_and_execute_disbursement(sender, total_amount, recipients)` | Splits and transfers `total_amount` to up to 5 recipients in one atomic call. Remainder from percentage rounding is allocated to the first recipient |
| `get_disbursement(id)` | Read a single disbursement record |
| `get_disbursements_by_sender(sender)` | List all disbursement IDs created by a sender |
| `get_disbursements_by_recipient(recipient)` | List all disbursement IDs a recipient has received |
| `deposit_to_blend(user, amount)` | Supplies USDC as collateral to the Blend testnet pool on the user's behalf |
| `withdraw_from_blend(user, amount)` | Withdraws previously supplied collateral back to the user |

### Notable engineering decisions

- **Multi-recipient split** is capped at `MAX_RECIPIENTS = 5` and enforces percentages summing to exactly `PERCENTAGE_TOTAL_BPS = 10000` (basis points). Rounding remainder is deterministically assigned to the first recipient.
- **Atomic by design.** `create_and_execute_disbursement` either fully succeeds or fully reverts — there is no partial-failure state to reconcile.
- **Blend integration bypasses `blend-contract-sdk`.** The official SDK requires `soroban-sdk ^25.x`, which conflicts with this project's `soroban-sdk 26.1.0`. Instead, `deposit_to_blend` / `withdraw_from_blend` call the Blend pool directly via `env.invoke_contract()`, manually constructing the `Request` payload Blend's `submit()` entrypoint expects. Both paths are validated end-to-end on testnet.
- **Yield settlement uses Blend's testnet USDC**, not Kirim's TESTUSD — the Blend `TestnetV2` pool has no reserve for custom assets. This is a testnet demonstration of the integration pattern; extending it to TESTUSD (or a production stablecoin) requires a corresponding reserve on Blend's side, which is outside this project's scope.

### Test coverage

15 unit tests covering initialization, single and multi-recipient splits, percentage-rounding behavior, disbursement counting, event emission, and rejection paths (uninitialized contract, empty/oversized recipient lists, invalid percentage totals, zero amounts, insufficient balance, and unauthorized callers).

```bash
cd contracts/kirim
cargo test
```

---

## Repository Structure

```
Kirim/
├── contracts/
│   └── kirim/
│       ├── src/
│       │   ├── lib.rs       # Contract entrypoints
│       │   ├── types.rs     # Structs, storage keys, error types
│       │   └── test.rs      # Unit tests
│       └── Cargo.toml
├── backend/                 # Node.js API, custodial key management, SEP-24 simulation
├── frontend/                 # Sender & recipient dashboards
└── README.md
```

---

## Getting Started (Smart Contract)

```bash
# Install Rust + WASM target
rustup target add wasm32v1-none

# Install Stellar CLI
cargo install --locked stellar-cli

# Build
cd contracts/kirim
stellar contract build

# Test
cargo test

# Deploy to testnet
stellar contract deploy \
  --wasm target/wasm32v1-none/release/kirim.wasm \
  --source admin \
  --network testnet
```

---

## Roadmap

- **Multi-corridor support** — generalize beyond MYR–IDR to other PMI corridors
- **Production Blend integration** — pending a TESTUSD (or equivalent) reserve on Blend's lending pool
- **Real-time notifications** — WebSocket push when funds arrive
- **Yield history** — historical accrual charts for savings positions

## Team

- **Smart contract (Rust / Soroban):** Razaqi Alkautsar
- **Backend (Node.js):** Akio Afifian Ahsan
- **Frontend:** Bayu Rahmat Kurnia

## Compliance Note

Kirim is designed as settlement infrastructure. The stablecoin layer used for on-chain settlement is not exposed to end recipients, who send and receive Rupiah through a simulated fiat on/off-ramp — consistent with Bank Indonesia's position that cryptocurrency is not a valid payment instrument in Indonesia.