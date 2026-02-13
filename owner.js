// owner.js
;(() => {
  "use strict";

  const C = window.OWNER_CONFIG;
  const $ = (id) => document.getElementById(id);

  const setText = (id, t) => { const el = $(id); if (el) el.textContent = String(t ?? "-"); };
  const shortAddr = (a) => a ? (a.slice(0, 6) + "..." + a.slice(-4)) : "-";

  function toast(msg, type = "ok") {
    const el = $("toast");
    if (!el) return;
    el.classList.remove("show");
    el.textContent = msg;
    el.style.background = (type === "err") ? "#7f1d1d" : "#0b1220";
    el.classList.add("show");
    setTimeout(() => el.classList.remove("show"), 2600);
  }

  function setPill(id, msg, ok = true) {
    const el = $(id);
    if (!el) return;
    el.textContent = msg;
    el.style.borderColor = ok ? "rgba(212,175,55,.55)" : "rgba(239,68,68,.55)";
    el.style.color = ok ? "#e7c35a" : "#fecaca";
  }

  let provider = null, signer = null, user = null;
  let core = null, vault = null, binary = null, stakingV5 = null;

  async function ensureBSC() {
    if (!window.ethereum) throw new Error("Wallet not found. Open in Bitget/MetaMask DApp browser.");
    const want = C.CHAIN_ID_HEX;

    // some wallets require requestAccounts before switching
    try { await window.ethereum.request({ method: "eth_requestAccounts" }); } catch {}

    const cur = await window.ethereum.request({ method: "eth_chainId" });
    if (cur === want) return;

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: want }],
      });
    } catch (e) {
      const msg = String(e?.message || e);
      if (e?.code === 4902 || msg.includes("4902")) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: want,
            chainName: C.CHAIN_NAME,
            nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
            rpcUrls: [C.RPC_URL],
            blockExplorerUrls: [C.BLOCK_EXPLORER],
          }],
        });
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: want }],
        });
      } else if (e?.code === 4001) {
        throw new Error("You rejected network switch.");
      } else {
        throw new Error("Please switch network to BSC (56).");
      }
    }
  }

  async function rebuildProviderSigner() {
    // IMPORTANT after switch chain (Bitget): rebuild provider
    provider = new ethers.providers.Web3Provider(window.ethereum, "any");
    await provider.send("eth_requestAccounts", []);
    signer = provider.getSigner();
    user = await signer.getAddress();
  }

  function fillStatic() {
    setText("cfgCore", C.CORE);
    setText("cfgVault", C.VAULT);
    setText("cfgBinary", C.BINARY);
    setText("cfgStakingV5", C.STAKING_V5);
    setText("cfgUSDT", C.USDT);
    setText("cfgDF", C.DF);
    setText("cfgTreasury", C.TREASURY_WALLET);
    setText("cfgCompany", C.COMPANY_WALLET);

    // prefill inputs
    $("inVaultCore").value = C.CORE;
    $("inBinaryCore").value = C.CORE;
    $("inStakingV5MLM").value = C.CORE;

    $("inCfgVault").value = C.VAULT;
    $("inCfgBinary").value = C.BINARY;
    $("inCfgStaking").value = C.STAKING_V5;
    $("inCfgTreasury").value = C.TREASURY_WALLET;
    $("inCfgCompany").value = C.COMPANY_WALLET;
  }

  function mountContracts() {
    core = new ethers.Contract(C.CORE, C.CORE_ABI, signer);
    vault = new ethers.Contract(C.VAULT, C.VAULT_ABI, signer);
    binary = new ethers.Contract(C.BINARY, C.BINARY_ABI, signer);
    stakingV5 = new ethers.Contract(C.STAKING_V5, C.STAKING_V5_ABI, signer);
  }

  async function connect() {
    try {
      setPill("statusPill", "Connecting...", true);

      await ensureBSC();
      await rebuildProviderSigner();
      mountContracts();

      setText("walletAddr", shortAddr(user));
      setText("netText", "BSC (56)");
      setText("meAddr", user);

      $("btnConnect").textContent = "Connected";
      $("btnConnect").disabled = true;

      // auto refresh owners + wiring
      await refreshOwners();
      await refreshWiring();

      // events
      window.ethereum.on?.("accountsChanged", () => location.reload());
      window.ethereum.on?.("chainChanged", () => location.reload());

      setPill("statusPill", "Connected ✅", true);
      toast("Connected ✅");
    } catch (e) {
      console.error(e);
      setPill("statusPill", "Connect failed ❌", false);
      toast(e?.message || String(e), "err");
    }
  }

  async function refreshOwners() {
    try {
      if (!user) throw new Error("Connect wallet first.");

      setPill("ownersStatus", "Refreshing...", true);

      const [oCore, oVault, oBinary, oSt5] = await Promise.all([
        core.owner(),
        vault.owner(),
        binary.owner(),
        stakingV5.owner(),
      ]);

      setText("coreOwner", oCore);
      setText("vaultOwner", oVault);
      setText("binaryOwner", oBinary);
      setText("stakingV5Owner", oSt5);

      const me = user.toLowerCase();
      setText("isCoreOwner", me === oCore.toLowerCase() ? "✅ YES" : "❌ NO");
      setText("isVaultOwner", me === oVault.toLowerCase() ? "✅ YES" : "❌ NO");
      setText("isBinaryOwner", me === oBinary.toLowerCase() ? "✅ YES" : "❌ NO");
      setText("isStakingV5Owner", me === oSt5.toLowerCase() ? "✅ YES" : "❌ NO");

      setPill("ownersStatus", "Updated ✅", true);
    } catch (e) {
      console.error(e);
      setPill("ownersStatus", "Error ❌", false);
      toast(e?.message || String(e), "err");
    }
  }

  async function refreshWiring() {
    try {
      if (!user) throw new Error("Connect wallet first.");

      setPill("wiringStatus", "Refreshing...", true);

      const [cv, cb, cs, ct, cc, vc, bc, mlm] = await Promise.all([
        core.VAULT(),
        core.BINARY(),
        core.STAKING(),
        core.treasury(),
        core.COMPANY_WALLET(),
        vault.core(),
        binary.core(),
        stakingV5.mlm(),
      ]);

      setText("coreVAULT", cv);
      setText("coreBINARY", cb);
      setText("coreSTAKING", cs);
      setText("coreTreasury", ct);
      setText("coreCompany", cc);

      setText("vaultCore", vc);
      setText("binaryCore", bc);
      setText("stakingV5MLM", mlm);

      setPill("wiringStatus", "Updated ✅", true);
    } catch (e) {
      console.error(e);
      setPill("wiringStatus", "Error ❌", false);
      toast(e?.message || String(e), "err");
    }
  }

  function requireOwner(which, ownerAddr) {
    if (!user) throw new Error("Connect wallet first.");
    if (user.toLowerCase() !== ownerAddr.toLowerCase()) {
      throw new Error(`Not owner for ${which}. Connect correct owner wallet.`);
    }
  }

  async function setVaultCore() {
    try {
      const o = await vault.owner();
      requireOwner("VaultV6", o);

      const coreAddr = ($("inVaultCore").value || "").trim();
      if (!ethers.utils.isAddress(coreAddr)) throw new Error("Invalid core address.");

      setPill("setLinksStatus", "Setting Vault.setCore...", true);
      const tx = await vault.setCore(coreAddr);
      toast("Tx sent: " + tx.hash);
      await tx.wait();

      setPill("setLinksStatus", "Vault.setCore ✅", true);
      await refreshWiring();
    } catch (e) {
      console.error(e);
      setPill("setLinksStatus", "Vault.setCore ❌", false);
      toast(e?.message || String(e), "err");
    }
  }

  async function setBinaryCore() {
    try {
      const o = await binary.owner();
      requireOwner("BinaryV4", o);

      const coreAddr = ($("inBinaryCore").value || "").trim();
      if (!ethers.utils.isAddress(coreAddr)) throw new Error("Invalid core address.");

      setPill("setLinksStatus", "Setting Binary.setCore...", true);
      const tx = await binary.setCore(coreAddr);
      toast("Tx sent: " + tx.hash);
      await tx.wait();

      setPill("setLinksStatus", "Binary.setCore ✅", true);
      await refreshWiring();
    } catch (e) {
      console.error(e);
      setPill("setLinksStatus", "Binary.setCore ❌", false);
      toast(e?.message || String(e), "err");
    }
  }

  async function setStakingV5MLM() {
    try {
      const o = await stakingV5.owner();
      requireOwner("StakingV5", o);

      const mlmAddr = ($("inStakingV5MLM").value || "").trim();
      if (!ethers.utils.isAddress(mlmAddr)) throw new Error("Invalid MLM address.");

      setPill("setLinksStatus", "Setting StakingV5.setMLM...", true);
      const tx = await stakingV5.setMLM(mlmAddr);
      toast("Tx sent: " + tx.hash);
      await tx.wait();

      setPill("setLinksStatus", "StakingV5.setMLM ✅", true);
      await refreshWiring();
    } catch (e) {
      console.error(e);
      setPill("setLinksStatus", "StakingV5.setMLM ❌", false);
      toast(e?.message || String(e), "err");
    }
  }

  async function setCoreConfig() {
    try {
      const o = await core.owner();
      requireOwner("CoreV6", o);

      const vaultAddr = ($("inCfgVault").value || "").trim();
      const binAddr   = ($("inCfgBinary").value || "").trim();
      const stAddr    = ($("inCfgStaking").value || "").trim();
      const treAddr   = ($("inCfgTreasury").value || "").trim();
      const compAddr  = ($("inCfgCompany").value || "").trim();

      for (const [k,v] of [["vault",vaultAddr],["binary",binAddr],["staking",stAddr],["treasury",treAddr],["company",compAddr]]) {
        if (!ethers.utils.isAddress(v)) throw new Error(`Invalid ${k} address.`);
      }

      const ok = confirm(
        "Confirm CoreV6.setConfig?\n\n" +
        `vault: ${vaultAddr}\n` +
        `binary: ${binAddr}\n` +
        `staking: ${stAddr}\n` +
        `treasury: ${treAddr}\n` +
        `company: ${compAddr}\n`
      );
      if (!ok) return;

      setPill("setCoreCfgStatus", "Setting Core.setConfig...", true);
      const tx = await core.setConfig(vaultAddr, binAddr, stAddr, treAddr, compAddr);
      toast("Tx sent: " + tx.hash);
      await tx.wait();

      setPill("setCoreCfgStatus", "Core.setConfig ✅", true);
      await refreshWiring();
    } catch (e) {
      console.error(e);
      setPill("setCoreCfgStatus", "Core.setConfig ❌", false);
      toast(e?.message || String(e), "err");
    }
  }

  function fillAllCore() {
    $("inVaultCore").value = C.CORE;
    $("inBinaryCore").value = C.CORE;
    $("inStakingV5MLM").value = C.CORE;
    toast("Filled CoreV6 ✅");
  }

  function fillConfigDefaults() {
    $("inCfgVault").value = C.VAULT;
    $("inCfgBinary").value = C.BINARY;
    $("inCfgStaking").value = C.STAKING_V5;
    $("inCfgTreasury").value = C.TREASURY_WALLET;
    $("inCfgCompany").value = C.COMPANY_WALLET;
    toast("Filled defaults ✅");
  }

  window.addEventListener("load", () => {
    fillStatic();
    setPill("statusPill", "Ready.", true);

    $("btnConnect").onclick = connect;
    $("btnRefreshOwners").onclick = refreshOwners;
    $("btnRefreshWiring").onclick = refreshWiring;

    $("btnSetVaultCore").onclick = setVaultCore;
    $("btnSetBinaryCore").onclick = setBinaryCore;
    $("btnSetStakingV5MLM").onclick = setStakingV5MLM;

    $("btnFillAllCore").onclick = fillAllCore;

    $("btnFillConfigDefaults").onclick = fillConfigDefaults;
    $("btnSetCoreConfig").onclick = setCoreConfig;
  });
})();
