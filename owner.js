// owner.js
;(() => {
  "use strict";

  const C = window.OWNER_CONFIG;
  const $ = (id) => document.getElementById(id);

  const setText = (id, t) => { const el = $(id); if (el) el.textContent = String(t ?? "-"); };
  const toast = (msg, type="ok") => {
    const el = $("toast");
    if(!el) return;
    el.classList.remove("show");
    el.textContent = msg;
    el.style.background = type === "err" ? "#7f1d1d" : "#0b1220";
    el.classList.add("show");
    setTimeout(() => el.classList.remove("show"), 2200);
  };

  function setStatus(t){ setText("status", t); }

  // ---- ABIs (ethers v5 fragments) ----
  const OWNABLE_ABI = [
    "function owner() view returns(address)"
  ];

  const ERC20_ABI = [
    "function decimals() view returns(uint8)",
    "function balanceOf(address) view returns(uint256)",
  ];

  const CORE_ABI = [
    "function owner() view returns(address)",

    "function VAULT() view returns(address)",
    "function BINARY() view returns(address)",
    "function STAKING() view returns(address)",
    "function treasury() view returns(address)",
    "function COMPANY_WALLET() view returns(address)",

    "function setConfig(address vault,address binary,address staking,address treasury_,address companyWallet) external",
  ];

  const VAULT_ABI = [
    "function owner() view returns(address)",
    "function core() view returns(address)",
    "function setCore(address c) external",

    "function surplusUSDT() view returns(uint256)",
    "function surplusDF() view returns(uint256)",
    "function withdrawSurplusUSDT(address to, uint256 amount) external",
    "function withdrawSurplusDF(address to, uint256 amount) external",
  ];

  const BINARY_ABI = [
    "function owner() view returns(address)",
    "function core() view returns(address)",
    "function setCore(address c) external",
  ];

  const STAKINGV5_ABI = [
    "function owner() view returns(address)",
    "function mlm() view returns(address)",
    "function setMLM(address _mlm) external",
  ];

  // ---- State ----
  let provider=null, signer=null, me=null;
  let core=null, vault=null, binary=null, staking=null;
  let usdt=null, df=null;
  let usdtDec=18, dfDec=18;

  const short = (a) => a ? (a.slice(0,6)+"..."+a.slice(-4)) : "-";

  async function ensureBSC(){
    if(!window.ethereum) throw new Error("Wallet not found. Open in MetaMask/Bitget DApp Browser.");
    const want = C.CHAIN_ID_HEX || "0x38";

    // request accounts first (some wallets require it)
    try { await window.ethereum.request({ method:"eth_requestAccounts" }); } catch {}

    const cur = await window.ethereum.request({ method:"eth_chainId" });
    if(cur === want) return;

    try{
      await window.ethereum.request({ method:"wallet_switchEthereumChain", params:[{ chainId: want }] });
    }catch(e){
      const msg = String(e?.message || e);
      if(e?.code === 4902 || msg.includes("4902")){
        await window.ethereum.request({
          method:"wallet_addEthereumChain",
          params:[{
            chainId: want,
            chainName: C.CHAIN_NAME || "BSC Mainnet",
            nativeCurrency: { name:"BNB", symbol:"BNB", decimals:18 },
            rpcUrls:[ C.RPC_URL || "https://bsc-dataseed.binance.org/" ],
            blockExplorerUrls:[ C.EXPLORER || "https://bscscan.com" ],
          }]
        });
        await window.ethereum.request({ method:"wallet_switchEthereumChain", params:[{ chainId: want }] });
      } else if(e?.code === 4001){
        throw new Error("คุณยกเลิกการสลับเครือข่าย");
      } else {
        throw new Error("กรุณาสลับเครือข่ายเป็น BSC ก่อน");
      }
    }
  }

  function fillStatic(){
    setText("coreAddr", C.CORE);
    setText("vaultAddr", C.VAULT);
    setText("binaryAddr", C.BINARY);
    setText("stakingAddr", C.STAKING);

    setText("usdtAddr", C.USDT);
    setText("dfAddr", C.DF);

    setText("treasuryAddr", C.TREASURY);
    setText("companyAddr", C.COMPANY);
  }

  async function connect(){
    try{
      setStatus("Connecting...");
      await ensureBSC();

      provider = new ethers.providers.Web3Provider(window.ethereum, "any");
      await provider.send("eth_requestAccounts", []);
      signer = provider.getSigner();
      me = await signer.getAddress();

      setText("walletAddr", short(me));
      setText("netText", "BSC (56)");

      // contracts
      core   = new ethers.Contract(C.CORE,   CORE_ABI,   signer);
      vault  = new ethers.Contract(C.VAULT,  VAULT_ABI,  signer);
      binary = new ethers.Contract(C.BINARY, BINARY_ABI, signer);
      staking= new ethers.Contract(C.STAKING,STAKINGV5_ABI, signer);

      usdt = new ethers.Contract(C.USDT, ERC20_ABI, signer);
      df   = new ethers.Contract(C.DF,   ERC20_ABI, signer);

      try { usdtDec = await usdt.decimals(); } catch {}
      try { dfDec = await df.decimals(); } catch {}

      $("btnConnect").textContent = "Connected";
      $("btnConnect").disabled = true;

      fillStatic();
      await refreshOwnerData();
      await refreshWiring();
      await refreshSurplus();

      window.ethereum.on?.("accountsChanged", () => location.reload());
      window.ethereum.on?.("chainChanged", () => location.reload());

      setStatus("✅ Connected");
      toast("Connected ✅");
    }catch(e){
      console.error(e);
      setStatus("❌ Connect failed: " + (e?.reason || e?.message || e));
      toast("Connect failed", "err");
    }
  }

  async function refreshOwnerData(){
    try{
      if(!me) return;
      setText("ownerStatus", "Refreshing...");
      setText("me", me);

      const [co, vo, bo, so] = await Promise.all([
        core.owner(),
        vault.owner(),
        binary.owner(),
        staking.owner(),
      ]);

      setText("coreOwner", co);
      setText("vaultOwner", vo);
      setText("binaryOwner", bo);
      setText("stakingOwner", so);

      setText("isCoreOwner",   co.toLowerCase() === me.toLowerCase() ? "✅ YES" : "❌ NO");
      setText("isVaultOwner",  vo.toLowerCase() === me.toLowerCase() ? "✅ YES" : "❌ NO");
      setText("isBinaryOwner", bo.toLowerCase() === me.toLowerCase() ? "✅ YES" : "❌ NO");
      setText("isStakingOwner",so.toLowerCase() === me.toLowerCase() ? "✅ YES" : "❌ NO");

      setText("ownerStatus", "Updated ✅");
    }catch(e){
      console.error(e);
      setText("ownerStatus", "❌ " + (e?.reason || e?.message || e));
    }
  }

  async function refreshWiring(){
    try{
      if(!me) return;
      setText("wiringStatus", "Refreshing...");

      const [vAddr, bAddr, sAddr, tAddr, cAddr] = await Promise.all([
        core.VAULT(),
        core.BINARY(),
        core.STAKING(),
        core.treasury(),
        core.COMPANY_WALLET(),
      ]);

      setText("coreVAULT", vAddr);
      setText("coreBINARY", bAddr);
      setText("coreSTAKING", sAddr);
      setText("coreTreasury", tAddr);
      setText("coreCompany", cAddr);

      const [vaultCore, binCore, mlm] = await Promise.all([
        vault.core(),
        binary.core(),
        staking.mlm(),
      ]);

      setText("vaultCore", vaultCore);
      setText("binaryCore", binCore);
      setText("stakingMLM", mlm);

      setText("wiringStatus", "Updated ✅");
    }catch(e){
      console.error(e);
      setText("wiringStatus", "❌ " + (e?.reason || e?.message || e));
    }
  }

  function quickFillCore(){
    $("inVaultCore").value  = C.CORE;
    $("inBinaryCore").value = C.CORE;
    $("inStakingMLM").value = C.CORE;
    toast("Filled ✅");
  }

  function fillDefaultsForSetConfig(){
    $("inCoreVault").value     = C.VAULT;
    $("inCoreBinary").value    = C.BINARY;
    $("inCoreStaking").value   = C.STAKING;
    $("inCoreTreasury").value  = C.TREASURY;
    $("inCoreCompany").value   = C.COMPANY;
    toast("Defaults filled ✅");
  }

  async function setVaultCore(){
    try{
      await ensureBSC();
      const addr = ($("inVaultCore").value || "").trim();
      if(!ethers.utils.isAddress(addr)) throw new Error("core address invalid");
      const tx = await vault.setCore(addr);
      setText("wiringStatus", "⏳ Vault.setCore... " + tx.hash);
      await tx.wait();
      setText("wiringStatus", "✅ Vault.setCore success");
      await refreshWiring();
    }catch(e){
      console.error(e);
      setText("wiringStatus", "❌ Vault.setCore failed: " + (e?.reason || e?.message || e));
    }
  }

  async function setBinaryCore(){
    try{
      await ensureBSC();
      const addr = ($("inBinaryCore").value || "").trim();
      if(!ethers.utils.isAddress(addr)) throw new Error("core address invalid");
      const tx = await binary.setCore(addr);
      setText("wiringStatus", "⏳ Binary.setCore... " + tx.hash);
      await tx.wait();
      setText("wiringStatus", "✅ Binary.setCore success");
      await refreshWiring();
    }catch(e){
      console.error(e);
      setText("wiringStatus", "❌ Binary.setCore failed: " + (e?.reason || e?.message || e));
    }
  }

  async function setStakingMLM(){
    try{
      await ensureBSC();
      const addr = ($("inStakingMLM").value || "").trim();
      if(!ethers.utils.isAddress(addr)) throw new Error("core address invalid");
      const tx = await staking.setMLM(addr);
      setText("wiringStatus", "⏳ StakingV5.setMLM... " + tx.hash);
      await tx.wait();
      setText("wiringStatus", "✅ StakingV5.setMLM success");
      await refreshWiring();
    }catch(e){
      console.error(e);
      setText("wiringStatus", "❌ StakingV5.setMLM failed: " + (e?.reason || e?.message || e));
    }
  }

  async function coreSetConfig(){
    try{
      await ensureBSC();

      const vaultAddr = ($("inCoreVault").value || "").trim();
      const binAddr   = ($("inCoreBinary").value || "").trim();
      const stAddr    = ($("inCoreStaking").value || "").trim();
      const treas     = ($("inCoreTreasury").value || "").trim();
      const comp      = ($("inCoreCompany").value || "").trim();

      if(!ethers.utils.isAddress(vaultAddr)) throw new Error("vault invalid");
      if(!ethers.utils.isAddress(binAddr)) throw new Error("binary invalid");
      if(!ethers.utils.isAddress(stAddr)) throw new Error("staking invalid");
      if(!ethers.utils.isAddress(treas)) throw new Error("treasury invalid");
      if(!ethers.utils.isAddress(comp)) throw new Error("company invalid");

      const tx = await core.setConfig(vaultAddr, binAddr, stAddr, treas, comp);
      setText("setCfgStatus", "⏳ CoreV6.setConfig... " + tx.hash);
      await tx.wait();
      setText("setCfgStatus", "✅ CoreV6.setConfig success");
      toast("SetConfig success ✅");
      await refreshWiring();
    }catch(e){
      console.error(e);
      setText("setCfgStatus", "❌ setConfig failed: " + (e?.reason || e?.message || e));
      toast("setConfig failed", "err");
    }
  }

  function fmtUnits(x, d=18){
    try { return Number(ethers.utils.formatUnits(x, d)).toLocaleString(undefined, { maximumFractionDigits: 6 }); }
    catch { return String(x); }
  }

  async function refreshSurplus(){
    try{
      if(!me) return;
      setText("surplusStatus", "Refreshing...");
      const [sU, sD] = await Promise.all([
        vault.surplusUSDT(),
        vault.surplusDF(),
      ]);
      setText("surplusUSDT", fmtUnits(sU, usdtDec));
      setText("surplusDF", fmtUnits(sD, dfDec));
      setText("surplusStatus", "Updated ✅");
    }catch(e){
      console.error(e);
      setText("surplusStatus", "❌ " + (e?.reason || e?.message || e));
    }
  }

  async function withdrawSurplusUSDT(){
    try{
      await ensureBSC();
      const toRaw = ($("surpUsdtTo").value || "").trim();
      const amtRaw = ($("surpUsdtAmt").value || "").trim();

      const to = ethers.utils.isAddress(toRaw) ? toRaw : C.TREASURY;
      if(!ethers.utils.isAddress(to)) throw new Error("to invalid");
      if(!amtRaw) throw new Error("amount required");

      const amt = ethers.utils.parseUnits(amtRaw, usdtDec);

      const tx = await vault.withdrawSurplusUSDT(to, amt);
      setText("surplusStatus", "⏳ Withdraw USDT... " + tx.hash);
      await tx.wait();
      setText("surplusStatus", "✅ Withdraw USDT success");
      toast("Withdraw USDT ✅");
      await refreshSurplus();
    }catch(e){
      console.error(e);
      setText("surplusStatus", "❌ Withdraw USDT failed: " + (e?.reason || e?.message || e));
      toast("Withdraw USDT failed", "err");
    }
  }

  async function withdrawSurplusDF(){
    try{
      await ensureBSC();
      const toRaw = ($("surpDfTo").value || "").trim();
      const amtRaw = ($("surpDfAmt").value || "").trim();

      const to = ethers.utils.isAddress(toRaw) ? toRaw : C.TREASURY;
      if(!ethers.utils.isAddress(to)) throw new Error("to invalid");
      if(!amtRaw) throw new Error("amount required");

      const amt = ethers.utils.parseUnits(amtRaw, dfDec);

      const tx = await vault.withdrawSurplusDF(to, amt);
      setText("surplusStatus", "⏳ Withdraw 365DF... " + tx.hash);
      await tx.wait();
      setText("surplusStatus", "✅ Withdraw 365DF success");
      toast("Withdraw 365DF ✅");
      await refreshSurplus();
    }catch(e){
      console.error(e);
      setText("surplusStatus", "❌ Withdraw 365DF failed: " + (e?.reason || e?.message || e));
      toast("Withdraw 365DF failed", "err");
    }
  }

  function bindUI(){
    $("btnConnect")?.addEventListener("click", connect);

    $("btnRefreshOwner")?.addEventListener("click", refreshOwnerData);
    $("btnRefreshWiring")?.addEventListener("click", refreshWiring);

    $("btnQuickFill")?.addEventListener("click", quickFillCore);

    $("btnSetVaultCore")?.addEventListener("click", setVaultCore);
    $("btnSetBinaryCore")?.addEventListener("click", setBinaryCore);
    $("btnSetStakingMLM")?.addEventListener("click", setStakingMLM);

    $("btnFillDefaults")?.addEventListener("click", fillDefaultsForSetConfig);
    $("btnCoreSetConfig")?.addEventListener("click", coreSetConfig);

    $("btnRefreshSurplus")?.addEventListener("click", refreshSurplus);
    $("btnWithdrawSurplusUSDT")?.addEventListener("click", withdrawSurplusUSDT);
    $("btnWithdrawSurplusDF")?.addEventListener("click", withdrawSurplusDF);

    $("btnFillUsdtToTreasury")?.addEventListener("click", () => { $("surpUsdtTo").value = C.TREASURY; });
    $("btnFillDfToTreasury")?.addEventListener("click", () => { $("surpDfTo").value = C.TREASURY; });
  }

  // init
  window.addEventListener("load", () => {
    fillStatic();
    bindUI();

    // prefill inputs for set links & setConfig
    $("inVaultCore").value = C.CORE;
    $("inBinaryCore").value = C.CORE;
    $("inStakingMLM").value = C.CORE;

    fillDefaultsForSetConfig();
    setStatus("Ready.");
  });
})();
