import vm from "node:vm";
import { createLogger } from "../utils/logger.js";
import { sha256 } from "../utils/crypto.js";

const logger = createLogger("ContractVM");

const MAX_EXECUTION_MS = 100; // 100ms gas limit

export class ContractVM {
  /**
   * Deploy a contract (run constructor / init logic)
   * @param {string} code - contract source code (JS)
   * @param {object} ctx  - { sender, value, address, block, storage }
   * @returns {{ ok: boolean, storage?: object, error?: string }}
   */
  async deploy(code, args, ctx) {
    return this._execute(code, { method: "init", args }, ctx);
  }

  async call(code, calldata, ctx) {
    let parsed;
    try {
      parsed = typeof calldata === "string" ? JSON.parse(calldata) : calldata;
    } catch {
      return { ok: false, error: "Invalid calldata JSON" };
    }
    return this._execute(code, parsed, ctx);
  }

  async _execute(code, calldata, ctx) {
    let gasUsed = 0n;
    const gasLimit = BigInt(ctx.gasLimit || 0n);

    const consumeGas = (amount) => {
      gasUsed += BigInt(amount);
      if (gasUsed > gasLimit) {
        throw new Error(`Gas limit exceeded: ${gasUsed} > ${gasLimit}`);
      }
    };

    // Proxy storage to track gas for reads/writes
    const storageProxy = new Proxy(
      { ...ctx.storage },
      {
        get(target, prop) {
          consumeGas(2100); // Cost of STORAGE_READ
          return target[prop];
        },
        set(target, prop, value) {
          consumeGas(20000); // Cost of STORAGE_WRITE
          target[prop] = value;
          return true;
        },
      },
    );

    const transfers = [];

    const sandbox = {
      // Contract state
      storage: storageProxy,

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
        consumeGas(21000); // Cost of TRANSFER
        transfers.push({ to, amount: BigInt(amount) });
      },

      // Alias for transfer to avoid shadowing in token contracts
      send(to, amount) {
        consumeGas(21000); // Cost of TRANSFER
        transfers.push({ to, amount: BigInt(amount) });
      },

      // Call another contract
      async call(address, method, args = [], value = 0n) {
        if (!ctx.call)
          throw new Error("Cross-contract calls not supported in this context");

        // Forward gas is complex, for now we just let it consume from parent
        const res = await ctx.call(address, method, args, BigInt(value));
        if (!res.ok) throw new Error(res.error);
        return res.result;
      },

      // Emit event
      emit(event, data) {
        consumeGas(1000); // Event cost
        if (ctx.events) {
          ctx.events.push({ event, data });
        }
        logger.debug("Contract event", { event, data, contract: ctx.address });
      },

      // Deploy another contract
      async deploy(code, args = [], value = 0n) {
        if (!ctx.deploy)
          throw new Error("Internal deployment not supported in this context");

        const remaining = gasLimit - gasUsed;
        const res = await ctx.deploy(code, args, BigInt(value), remaining);
        if (!res.ok) throw new Error(res.error);
        consumeGas(res.gasUsed || 0n);
        return res.contractAddress;
      },

      // Call another contract
      async call(address, method, args = [], value = 0n) {
        if (!ctx.call)
          throw new Error("Cross-contract calls not supported in this context");

        const remaining = gasLimit - gasUsed;
        const res = await ctx.call(
          address,
          method,
          args,
          BigInt(value),
          remaining,
        );
        if (!res.ok) throw new Error(res.error);
        consumeGas(res.gasUsed || 0n);
        return res.result;
      },

      // Utility
      BigInt,
      JSON,
      Math: (() => {
        const m = { ...Math };
        delete m.random; // Ensure no non-determinism via random
        return Object.freeze(m);
      })(),
      Date: class extends Date {
        constructor() {
          super(ctx.block.timestamp);
        }
        static now() {
          return ctx.block.timestamp;
        }
      },
      sha256: (data) => {
        consumeGas(500); // Cost of hashing
        return sha256(data);
      },
      parseInt,
      parseFloat,
      String,
      Number,
      console: {
        log: (...args) => {
          logger.info(`[VM-LOG] ${ctx.address}:`, ...args);
        },
      },
      Boolean,
      Array,
      Object,
      Error,
      // Blacklist potentially dangerous constructors/globals
      global: undefined,
      process: undefined,
      Buffer: undefined, // Encourage using TypedArrays for binary data
    };

    // Inject calldata
    if (calldata) {
      sandbox.msg.method = calldata.method;
      sandbox.msg.args = calldata.args ?? [];
    }

    try {
      const script = new vm.Script(`
        (async function() {
          ${code}
          ${
            calldata
              ? `
          if (typeof ${calldata.method} === 'function') {
            return await ${calldata.method}(...msg.args);
          } else {
            throw new Error('Method not found: ${calldata.method}');
          }
          `
              : `
          if (typeof init === 'function') {
            await init();
          }
          `
          }
        })()
      `);

      const context = vm.createContext(sandbox);
      const resultPromise = script.runInContext(context, {
        timeout: MAX_EXECUTION_MS,
      });

      const result = await resultPromise;

      return {
        ok: true,
        storage: { ...storageProxy },
        result,
        transfers,
        gasUsed,
      };
    } catch (err) {
      logger.warn("Contract execution error", {
        error: err.message,
        contract: ctx.address,
      });
      return { ok: false, error: err.message, gasUsed };
    }
  }
}
