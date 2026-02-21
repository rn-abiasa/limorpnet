import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider, createBrowserRouter } from "react-router-dom";
import "./index.css";

import App from "./App";
import Swap from "./pages/Swap";
import Tokens from "./pages/Tokens";
import Liquidity from "./pages/Liquidity";
import TokenDetail from "./pages/TokenDetail";
import Launchpad from "./pages/Launchpad";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      {
        index: true,
        element: <Swap />,
      },
      {
        path: "tokens",
        element: <Tokens />,
      },
      {
        path: "liquidity",
        element: <Liquidity />,
      },
      {
        path: "token/:symbol",
        element: <TokenDetail />,
      },
      {
        path: "launchpad",
        element: <Launchpad />,
      },
    ],
  },
]);

import { WalletProvider } from "./context/WalletContext";
import { SocketProvider } from "./context/SocketContext";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <WalletProvider>
      <SocketProvider>
        <RouterProvider router={router} />
      </SocketProvider>
    </WalletProvider>
  </StrictMode>,
);
