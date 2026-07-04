import React from "react";
import ReactDOM from "react-dom/client";
import { createHashRouter, RouterProvider } from "react-router-dom";
import "@rainbow-me/rainbowkit/styles.css";
import { getDefaultConfig, RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { WagmiProvider, http } from "wagmi";
import { sepolia } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Layout from "./Layout";
import Home from "./pages/Home";
import Vault from "./pages/Vault";
import Portfolio from "./pages/Portfolio";
import Registry from "./pages/Registry";
import Faucet from "./pages/Faucet";
import Feed from "./pages/Feed";
import Reveal from "./pages/Reveal";
import "./styles.css";

const config = getDefaultConfig({
  appName: "BLACKOUT",
  projectId: "BLACKOUT_DEMO_REPLACE_ME",
  chains: [sepolia],
  transports: { [sepolia.id]: http("https://ethereum-sepolia-rpc.publicnode.com") },
  ssr: false,
});

const queryClient = new QueryClient();

const router = createHashRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <Home /> },
      { path: "vault", element: <Vault /> },
      { path: "portfolio", element: <Portfolio /> },
      { path: "registry", element: <Registry /> },
      { path: "faucet", element: <Faucet /> },
      { path: "feed", element: <Feed /> },
      { path: "reveal", element: <Reveal /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: "#e8e6df",
            accentColorForeground: "#0b0b0b",
            borderRadius: "small",
            fontStack: "system",
          })}
        >
          <RouterProvider router={router} />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>,
);
