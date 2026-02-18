import "dotenv/config";
import { Database } from "./state/Database.js";
import { StateManager } from "./state/StateManager.js";
import { ContractVM } from "./vm/ContractVM.js";
import { Blockchain } from "./core/Blockchain.js";
import { Mempool } from "./core/Mempool.js";
import { PoS } from "./consensus/PoS.js";
import { BlockProducer } from "./consensus/BlockProducer.js";
import { P2PServer } from "./network/P2PServer.js";
import { RpcServer } from "./api/RpcServer.js";
import { KeyStore } from "./wallet/KeyStore.js";
import { genesis } from "../config/genesis.js";
import { createLogger } from "./utils/logger.js";

const logger = createLogger("Node");

async function main() {
  logger.info("Starting Limorp node...");

  // ── Database ──────────────────────────────────────────────────────────────
  const dataDir = process.env.DATA_DIR || "./data";
  const db = new Database(dataDir);
  await db.open();

  // ── VM ────────────────────────────────────────────────────────────────────
  const contractVM = new ContractVM();

  // ── State ─────────────────────────────────────────────────────────────────
  const stateManager = new StateManager(db, contractVM);

  // ── Blockchain ────────────────────────────────────────────────────────────
  const blockchain = new Blockchain({ db, stateManager, genesis });
  await blockchain.init();

  // ── Mempool ───────────────────────────────────────────────────────────────
  const mempool = new Mempool();

  // ── Consensus ─────────────────────────────────────────────────────────────
  const pos = new PoS({
    minStake: BigInt(genesis.params.minStake),
    blockTime: genesis.params.blockTime,
  });

  // ── P2P Network ───────────────────────────────────────────────────────────
  const p2pPort = parseInt(process.env.P2P_PORT || "6001");
  const p2p = new P2PServer({ blockchain, mempool, port: p2pPort });
  p2p.start();
  p2p.connectToInitialPeers();

  // ── RPC Server ────────────────────────────────────────────────────────────
  const rpcPort = parseInt(process.env.RPC_PORT || "3000");
  const rpc = new RpcServer({ blockchain, mempool, p2p, port: rpcPort });
  rpc.start();

  // ── Validator (optional) ──────────────────────────────────────────────────
  const keyPath = process.env.VALIDATOR_KEY_PATH;
  const password = process.env.VALIDATOR_PASSWORD;

  if (keyPath && password) {
    try {
      const wallet = KeyStore.load(keyPath, password);
      const producer = new BlockProducer({
        blockchain,
        mempool,
        pos,
        p2p,
        stateManager,
        wallet,
      });
      producer.start();
      logger.info("Validator mode active", { address: wallet.address });
    } catch (err) {
      logger.warn("Could not load validator key, running in observer mode", {
        error: err.message,
      });
    }
  } else {
    logger.info("Running in observer mode (no validator key configured)");
  }

  // ── Graceful Shutdown ─────────────────────────────────────────────────────
  const shutdown = async (signal) => {
    logger.info(`Received ${signal}, shutting down...`);
    await db.close();
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  logger.info("Node ready", {
    p2pPort,
    rpcPort,
    chainId: genesis.chainId,
    height: blockchain.getHeight(),
  });
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
