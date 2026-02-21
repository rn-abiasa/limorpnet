import { useState, useCallback, useMemo } from "react";
import axios from "axios";

const RPC_URL = import.meta.env.VITE_RPC_URL || "http://localhost:3000";

export const useLimorpRPC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const call = useCallback(async (method: string, params: any[] = []) => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.post(RPC_URL, {
        jsonrpc: "2.0",
        id: Date.now(),
        method,
        params,
      });
      if (res.data.error) throw new Error(res.data.error.message);
      return res.data.result;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const readContract = useCallback(
    async (address: string, method: string, args: any[] = []) => {
      return await call("callContract", [address, method, args]);
    },
    [call],
  );

  return useMemo(
    () => ({ call, readContract, loading, error }),
    [call, readContract, loading, error],
  );
};
