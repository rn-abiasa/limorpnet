import vm from "node:vm";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("ContractVM");

const MAX_EXECUTION_MS = 100; // 100ms gas limit

export class ContractVM {
  /**
   * Deploy a contract (run constructor / init logic)
   * @param {string} code - contract source code (JS)
   * @param {object} ctx  - { sender, value, address, block, storage }
   * @returns {{ ok: boolean, storage?: object, error?: string }}
   */
  async deploy(code, ctx) {
    return this._execute(code, null, ctx);
  }

  /**
   * Call a contract method
   * @param {string} code     - contract source code
   * @param {string} calldata - JSON string: { method, args }
   * @param {object} ctx      - { sender, value, address, block, storage }
   * @returns {{ ok: boolean, storage?: object, result?: any, transfers?: Array, error?: string }}
   */
  async call(code, calldata, ctx) {
    let parsed;
    try {
      parsed = typeof calldata === "string" ? JSON.parse(calldata) : calldata;
    } catch {
      return { ok: false, error: "Invalid calldata JSON" };
    }
    return this._execute(code, parsed, ctx);
  }

  _execute(code, calldata, ctx) {
    const storage = { ...ctx.storage };
    const transfers = [];

    const sandbox = {
      // Contract state
      storage,

      // Transaction context
      msg: {
        sender: ctx.sender,
        value: ctx.value,
      },

      // Block context
      block: {
        number: ctx.block.number,
        timestamp: ctx.block.timestamp,
      },

      // Contract address
      self: ctx.address,

      // Transfer LMR from contract to address
      transfer(to, amount) {
        transfers.push({ to, amount: BigInt(amount) });
      },

      // Emit event (logged, not stored)
      emit(event, data) {
        logger.debug("Contract event", { event, data, contract: ctx.address });
      },

      // Utility
      BigInt,
      JSON,
      Math,
      parseInt,
      parseFloat,
      String,
      Number,
      Boolean,
      Array,
      Object,
      Error,
    };

    // Inject calldata if this is a call (not deploy)
    if (calldata) {
      sandbox.msg.method = calldata.method;
      sandbox.msg.args = calldata.args ?? [];
    }

    try {
      const script = new vm.Script(`
        (function() {
          ${code}
          ${
            calldata
              ? `
          if (typeof ${calldata.method} === 'function') {
            return ${calldata.method}(...msg.args);
          } else {
            throw new Error('Method not found: ${calldata.method}');
          }
          `
              : `
          if (typeof init === 'function') {
            init();
          }
          `
          }
        })()
      `);

      const context = vm.createContext(sandbox);
      const result = script.runInContext(context, {
        timeout: MAX_EXECUTION_MS,
      });

      return { ok: true, storage, result, transfers };
    } catch (err) {
      logger.warn("Contract execution error", {
        error: err.message,
        contract: ctx.address,
      });
      return { ok: false, error: err.message };
    }
  }
}
