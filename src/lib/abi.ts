// blackout/lib/abi.ts
// Minimal ABIs. Each function/event was cross-checked against the docs
// (wrapper-registry.md and confidential-wrapper.md).

export const REGISTRY_ABI = [
  {
    inputs: [],
    name: "getTokenConfidentialTokenPairs",
    outputs: [
      {
        components: [
          { internalType: "address", name: "tokenAddress", type: "address" },
          { internalType: "address", name: "confidentialTokenAddress", type: "address" },
          { internalType: "bool", name: "isValid", type: "bool" },
        ],
        internalType: "struct TokenWrapperPair[]",
        name: "",
        type: "tuple[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "erc20", type: "address" }],
    name: "getConfidentialTokenAddress",
    outputs: [
      { internalType: "bool", name: "isValid", type: "bool" },
      { internalType: "address", name: "confidentialToken", type: "address" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "confidentialWrapper", type: "address" }],
    name: "getTokenAddress",
    outputs: [
      { internalType: "bool", name: "isValid", type: "bool" },
      { internalType: "address", name: "token", type: "address" },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

export const ERC20_ABI = [
  {
    inputs: [{ internalType: "address", name: "who", type: "address" }],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "symbol",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "name",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "spender", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "owner", type: "address" },
      { internalType: "address", name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  // Mock underlyings expose a public mint(to, amount) — max 1M per call.
  {
    inputs: [
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "mint",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "from", type: "address" },
      { indexed: true, internalType: "address", name: "to", type: "address" },
      { indexed: false, internalType: "uint256", name: "value", type: "uint256" },
    ],
    name: "Transfer",
    type: "event",
  },
] as const;

export const WRAPPER_ABI = [
  {
    inputs: [
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "wrap",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // Unwrap with input proof: encrypted amount from a browser-created input.
  {
    inputs: [
      { internalType: "address", name: "from", type: "address" },
      { internalType: "address", name: "to", type: "address" },
      { internalType: "externalEuint64", name: "encryptedAmount", type: "bytes32" },
      { internalType: "bytes", name: "inputProof", type: "bytes" },
    ],
    name: "unwrap",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // Unwrap without input proof: caller passes an existing euint64 handle they control.
  {
    inputs: [
      { internalType: "address", name: "from", type: "address" },
      { internalType: "address", name: "to", type: "address" },
      { internalType: "euint64", name: "encryptedAmount", type: "bytes32" },
    ],
    name: "unwrap",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "bytes32", name: "unwrapRequestId", type: "bytes32" },
      { internalType: "uint64", name: "unwrapAmountCleartext", type: "uint64" },
      { internalType: "bytes", name: "decryptionProof", type: "bytes" },
    ],
    name: "finalizeUnwrap",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "who", type: "address" }],
    name: "confidentialBalanceOf",
    outputs: [{ internalType: "euint64", name: "", type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "rate",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "symbol",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "inferredTotalSupply",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "bytes32", name: "requestId", type: "bytes32" }],
    name: "unwrapAmount",
    outputs: [{ internalType: "euint64", name: "", type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "bytes32", name: "requestId", type: "bytes32" }],
    name: "unwrapRequester",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "to", type: "address" },
      { indexed: false, internalType: "uint256", name: "roundedAmount", type: "uint256" },
      { indexed: false, internalType: "euint64", name: "encryptedWrappedAmount", type: "bytes32" },
    ],
    name: "Wrap",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "receiver", type: "address" },
      { indexed: true, internalType: "bytes32", name: "unwrapRequestId", type: "bytes32" },
      { indexed: false, internalType: "euint64", name: "encryptedAmount", type: "bytes32" },
    ],
    name: "UnwrapRequested",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "receiver", type: "address" },
      { indexed: true, internalType: "bytes32", name: "unwrapRequestId", type: "bytes32" },
      { indexed: false, internalType: "euint64", name: "encryptedAmount", type: "bytes32" },
      { indexed: false, internalType: "uint64", name: "cleartextAmount", type: "uint64" },
    ],
    name: "UnwrapFinalized",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "from", type: "address" },
      { indexed: true, internalType: "address", name: "to", type: "address" },
      { indexed: false, internalType: "euint64", name: "encryptedAmount", type: "bytes32" },
    ],
    name: "ConfidentialTransfer",
    type: "event",
  },
] as const;
