# ⛓️ Limorp Blockchain

**A Next-Generation Proof-of-Stake Blockchain**

Limorp is a high-performance, production-ready blockchain protocol built from the ground up with modern architecture, sustainable tokenomics, and enterprise-grade security.

---

## 🚀 Core Features

### 🔐 Proof-of-Stake Consensus

- **Stake-Weighted Validator Selection** — Fair, deterministic validator rotation based on stake proportion
- **5-Second Block Time** — Fast finality for real-time applications
- **Minimum Stake**: 1000 LMR to become a validator
- **Energy Efficient** — Environmentally sustainable consensus mechanism

### 💰 Advanced Tokenomics

#### Inflationary Model with Controlled Decay

- **No Fixed Supply Cap** — Sustainable inflation for long-term security
- **Block Reward Decay**: 20% reduction every ~1 year (1,051,200 blocks)
- **Initial Reward**: 500 LMR per block
- **Minimum Reward**: 0.1 LMR (never reaches zero)

#### LMR-0534 Fee Mechanism

- **Base Fee Burning**: 100% of base fees are burned, creating deflationary pressure
- **Initial Base Fee**: 1,000 limo (gas unit)
- **Target Gas per Block**: 15M gas
- **Maximum Gas per Block**: 30M gas

### 🏗️ Modular Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Limorp Node Core                        │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  ContractVM  │  │ StateManager │  │  Blockchain  │      │
│  │  (WASM/EVM)  │  │   (Merkle)   │  │   (Chain)    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │    Mempool   │  │  PoS Engine  │  │ BlockProducer│      │
│  │  (Tx Queue)  │  │  (Consensus) │  │  (Mining)    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  ┌──────────────┐  ┌──────────────┐                        │
│  │   P2P Net    │  │   RPC API    │                        │
│  │  (libp2p)    │  │  (JSON-RPC)  │                        │
│  └──────────────┘  └──────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

### 🛡️ Security Features

- **Cryptographic Signatures** — ECDSA (secp256k1) for transaction authentication
- **Merkle State Trees** — Efficient state verification and light client support
- **Deterministic Execution** — Reproducible smart contract execution across all nodes
- **KeyStore Encryption** — Secure validator key management with password protection

---

## 📊 Network Specifications

| Parameter                | Value          |
| ------------------------ | -------------- |
| **Chain ID**             | `limorp-I35`   |
| **Block Time**           | 5 seconds      |
| **Consensus**            | Proof-of-Stake |
| **Min Validator Stake**  | 1000 LMR       |
| **Initial Block Reward** | 500 LMR        |
| **Reward Decay**         | 20% per year   |
| **Base Fee Burn**        | 100%           |
| **Target Gas/Block**     | 15M            |
| **Max Gas/Block**        | 30M            |
| **Max Tx/Block**         | 1,000          |

---

## 🏁 Quick Start

### Prerequisites

- Node.js >= 18.x
- npm >= 9.x

### Installation

```bash
# Clone the repository
git clone https://github.com/rn-abiasa/limorpnet.git
cd limorp

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your settings
```

### Running a Node

```bash
# Start as observer node
npm start

# Start as validator node
VALIDATOR_KEY_PATH=./wallet.json VALIDATOR_PASSWORD=your_password npm start
```

### Environment Variables

| Variable             | Description            | Default  |
| -------------------- | ---------------------- | -------- |
| `DATA_DIR`           | Database storage path  | `./data` |
| `P2P_PORT`           | P2P network port       | `6001`   |
| `RPC_PORT`           | RPC API port           | `3000`   |
| `VALIDATOR_KEY_PATH` | Path to validator key  | -        |
| `VALIDATOR_PASSWORD` | Validator key password | -        |

---

## 🔧 Core Components

### Blockchain

Immutable ledger with full block validation, state root verification, and chain reorganization support.

### StateManager

Merkle Patricia Trie-based state management with efficient proof generation and verification.

### ContractVM

Sandboxed virtual machine for smart contract execution with gas metering and deterministic execution.

### Mempool

Transaction queue with gas-based prioritization and spam protection.

### PoS Consensus

Stake-weighted validator selection with slot-based block production and fork choice rules.

### P2P Network

Decentralized peer discovery and block propagation using libp2p-compatible protocols.

### RPC API

JSON-RPC compatible API for querying chain data, submitting transactions, and network interaction.

---

## 📜 Genesis Configuration

The genesis block pre-allocates tokens for:

- **Validator Nodes** — Pre-staked validators for network bootstrap
- **Foundation/Treasury** — Ecosystem development and grants

All amounts use 18 decimal precision (1 LMR = 10¹⁸ limo).

---

## 🛠️ CLI Commands

```bash
# Create a new wallet
npm run cli

---

## 📖 Architecture Overview

Limorp blockchain follows a layered architecture:

1. **Storage Layer** — LevelDB-based key-value storage with efficient serialization
2. **State Layer** — Merkle Patricia Trie for account state and storage
3. **Execution Layer** — ContractVM for smart contract execution
4. **Consensus Layer** — PoS engine for block production and validation
5. **Network Layer** — P2P gossip protocol for block/transaction propagation
6. **API Layer** — JSON-RPC server for external interaction

---

## 🤝 Running a Validator

To become a validator:

1. **Generate Keys**: Create a validator wallet using the CLI
2. **Acquire Stake**: Ensure you have at least 10 LMR tokens
3. **Configure Node**: Set `VALIDATOR_KEY_PATH` and `VALIDATOR_PASSWORD`
4. **Start Node**: Run the node with validator configuration
5. **Monitor**: Watch for block production opportunities

---

## 🔗 Resources

- **Documentation**: [Coming Soon]
- **API Reference**: [Coming Soon]
- **Whitepaper**: [Coming Soon]

---

<p align="center">
  <strong>Built for the decentralized future</strong>
</p>
```
