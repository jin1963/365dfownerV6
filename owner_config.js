// owner_config.js
window.OWNER_CONFIG = {
  // --- Chain ---
  CHAIN_ID_DEC: 56,
  CHAIN_ID_HEX: "0x38",
  CHAIN_NAME: "BSC Mainnet",
  RPC_URL: "https://bsc-dataseed.binance.org/",
  BLOCK_EXPLORER: "https://bscscan.com",

  // --- Tokens ---
  USDT: "0x55d398326f99059fF775485246999027B3197955",
  DF:   "0x36579d7eC4b29e875E3eC21A55F71C822E03A992",

  // --- Core System ---
  CORE:       "0xe6E204B20Be44f984773d4F02DBe73e5E018f0fF", // CoreV6
  VAULT:      "0x2bc3dB5AdB26ef1F192f7Bd6b0B3359d0E796D9a", // VaultV6
  BINARY:     "0xD78043E993D0F6cC95F5f81eE927883BbFc41Ac6", // BinaryV4
  STAKING_V5: "0xa960B32A137EfDE9c35f34C169EefeE6F4D5DD2d", // StakingV5

  // --- Wallets (from your CoreV6 screen) ---
  TREASURY_WALLET: "0xbfD941B45f6E9850Ba82510284426dFD3fBf25E2",
  COMPANY_WALLET:  "0x85EFe209769B183d41A332872Ac1cF57bd3d8300",

  // --- Minimal ERC20 ABI ---
  ERC20_ABI: [
    "function decimals() view returns(uint8)",
    "function balanceOf(address) view returns(uint256)",
    "function allowance(address,address) view returns(uint256)",
    "function approve(address,uint256) returns(bool)",
    "function symbol() view returns(string)",
  ],

  // --- CoreV6 ABI (subset for admin/read) ---
  CORE_ABI: [
    "function owner() view returns(address)",
    "function VAULT() view returns(address)",
    "function BINARY() view returns(address)",
    "function STAKING() view returns(address)",
    "function treasury() view returns(address)",
    "function COMPANY_WALLET() view returns(address)",
    "function setConfig(address vault,address binary,address staking,address treasury_,address companyWallet) external",
  ],

  // --- VaultV6 ABI (subset) ---
  VAULT_ABI: [
    "function owner() view returns(address)",
    "function core() view returns(address)",
    "function setCore(address c) external",
  ],

  // --- BinaryV4 ABI (subset) ---
  BINARY_ABI: [
    "function owner() view returns(address)",
    "function core() view returns(address)",
    "function setCore(address c) external",
  ],

  // --- StakingV5 ABI (subset) ---
  STAKING_V5_ABI: [
    "function owner() view returns(address)",
    "function mlm() view returns(address)",
    "function setMLM(address _mlm) external",
  ],
};
