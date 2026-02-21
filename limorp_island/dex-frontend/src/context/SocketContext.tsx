import {
  useEffect,
  useState,
  createContext,
  useContext,
  type ReactNode,
} from "react";
import { io, Socket } from "socket.io-client";

interface SocketContextType {
  socket: Socket | null;
  lastEvent: any;
}

const SocketContext = createContext<SocketContextType | null>(null);

export const SocketProvider = ({ children }: { children: ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [lastEvent, setLastEvent] = useState<any>(null);

  useEffect(() => {
    const s = io(import.meta.env.VITE_INDEXER_URL || "http://localhost:4001");
    setSocket(s);

    s.on("dex_event", (event: any) => {
      console.log("[DEX Socket] New Event:", event);
      setLastEvent(event);
    });

    return () => {
      s.close();
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, lastEvent }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useDEXSocket = () => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error("useDEXSocket must be used within a SocketProvider");
  }
  return context;
};
