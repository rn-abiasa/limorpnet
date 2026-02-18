import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider, createBrowserRouter } from "react-router-dom";
import Home from "./pages";
import Blocks from "./pages/blocks";
import BlockDetail from "./pages/blockDetail";
import AddressDetail from "./pages/addressDetail";
import Transactions from "./pages/transactions";
import "./index.css";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Home />,
  },
  {
    path: "/blocks",
    element: <Blocks />,
  },
  {
    path: "/block/:height",
    element: <BlockDetail />,
  },
  {
    path: "/address/:address",
    element: <AddressDetail />,
  },
  {
    path: "/txs",
    element: <Transactions />,
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
