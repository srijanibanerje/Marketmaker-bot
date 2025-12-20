const { ethers } = require("ethers");
require("dotenv").config();

/* =======================
   BNB CHAIN CONSTANTS
======================= */

const RPC_URL = "https://bsc-dataseed.binance.org/";

const WBNB = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";
const PANCAKE_ROUTER = "0x10ED43C718714eb63d5aA57B78B54704E256024E";

// 🔴 CHANGE TO YOUR TOKEN (BSC)
const TOKEN = "0x485F66f20F6732017345ff3437377EC84Ea75039";

/* =======================
   TRADE CONFIG
======================= */

const BUY_AMOUNT = ethers.parseEther("0.0001"); // BNB per trade
const SLIPPAGE = 10n; // 10%
// const TRADE_INTERVAL = 60 * 60 * 1000; // 1 hour

/* =======================
   PROVIDER & WALLET
======================= */

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

(async () => {
  const network = await provider.getNetwork();
  console.log("🌐 Network:", network.name, network.chainId.toString());
})();

/* =======================
   CONTRACTS
======================= */

const router = new ethers.Contract(
  PANCAKE_ROUTER,
  [
    "function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)",
    "function swapExactETHForTokensSupportingFeeOnTransferTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) payable",
    "function swapExactTokensForETHSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline)"
  ],
  wallet
);

// const token = new ethers.Contract(
//   TOKEN,
//   [
//     "function approve(address spender, uint amount) external returns (bool)",
//     "function allowance(address owner, address spender) view returns (uint)"
//   ],
//   wallet
// );
const token = new ethers.Contract(
  TOKEN,
  [
    "function approve(address spender, uint amount) external returns (bool)",
    "function allowance(address owner, address spender) view returns (uint)",
    "function balanceOf(address owner) view returns (uint)"
  ],
  wallet
);

/* =======================
   BUY TOKENS
======================= */

async function buyTokens() {
  console.log("🟢 BUYING TOKENS");

  const path = [WBNB, TOKEN];
  const deadline = Math.floor(Date.now() / 1000) + 300;

  // 🔹 Get real AMM output
  const amounts = await router.getAmountsOut(BUY_AMOUNT, path);
  const expectedOut = amounts[1];

  // 🔹 Apply slippage
  const amountOutMin =
    (expectedOut * (100n - SLIPPAGE)) / 100n;

  console.log("Expected Out:", expectedOut.toString());
  console.log("Min Out:", amountOutMin.toString());

  const tx = await router.swapExactETHForTokensSupportingFeeOnTransferTokens(
    amountOutMin,
    path,
    wallet.address,
    deadline,
    { value: BUY_AMOUNT }
  );

  await tx.wait();
  console.log("✅ BUY TX:", tx.hash);
}

/* =======================
   SELL TOKENS
======================= */

async function sellTokens(amountToSell) {
  console.log("🔴 SELLING TOKENS");

  const allowance = await token.allowance(
    wallet.address,
    PANCAKE_ROUTER
  );

  if (allowance < amountToSell) {
    console.log("🔓 Approving token...");
    const approveTx = await token.approve(
      PANCAKE_ROUTER,
      ethers.MaxUint256
    );
    await approveTx.wait();
  }

  const path = [TOKEN, WBNB];
  const deadline = Math.floor(Date.now() / 1000) + 300;

  const tx = await router.swapExactTokensForETHSupportingFeeOnTransferTokens(
    amountToSell,
    0, // tax-safe
    path,
    wallet.address,
    deadline
  );

  await tx.wait();
  console.log("✅ SELL TX:", tx.hash);
}

/* =======================
   CHECK PRICE LOGIC
======================= */

// async function checkPrice() {
//   try {
//     console.log("🔍 Checking price...");

//     const path = [WBNB, TOKEN];
//     const amounts = await router.getAmountsOut(BUY_AMOUNT, path);
//     const expectedOut = amounts[1];

//     console.log("📈 Tokens for buy:", expectedOut.toString());

//     // 🔹 SIMPLE STRATEGY (example)
//     // Replace with your logic
//     if (expectedOut > 0n) {
//       await buyTokens();
//     }
//     if (expectedOut < 0n) {
//       await sellTokens();
//     }

//   } catch (err) {
//     console.error("❌ Error:", err.reason || err.message);
//   }
// }
let lastBuyAmountOut = 0n; // track last bought amount

async function checkPrice() {
  try {
    console.log("🔍 Checking price...");

    const path = [WBNB, TOKEN];
    const amounts = await router.getAmountsOut(BUY_AMOUNT, path);
    const currentAmountOut = amounts[1];

    console.log("📈 Current token amount for buy:", currentAmountOut.toString());
    console.log("💰 Last buy amount out:", lastBuyAmountOut.toString());

    // 🔹 BUY CONDITION: token is cheap (more tokens for same BNB)
    if (currentAmountOut > lastBuyAmountOut) {
      console.log("🟢 BUY condition met");
      await buyTokens();
      lastBuyAmountOut = currentAmountOut; // update last buy
    }

    // 🔹 SELL CONDITION: token is expensive (less tokens for same BNB)
    if (lastBuyAmountOut > 0n && currentAmountOut < lastBuyAmountOut) {
      console.log("🔴 SELL condition met");
      const balance = await token.balanceOf(wallet.address);
      if (balance > 0n) {
        await sellTokens(balance);
        lastBuyAmountOut = 0n; // reset after sell
      } else {
        console.log("⚠️ No tokens to sell");
      }
    }

  } catch (err) {
    console.error("❌ Error:", err.reason || err.message);
  }
}


/* =======================
   RUN BOT
======================= */

// checkPrice();
// setTimeout(checkPrice, 5000);

// setInterval(checkPrice, TRADE_INTERVAL);
// const START_DELAY = 5000; // 5 seconds

// console.log("⏳ Bot will start in 5 seconds...");

// setTimeout(() => {
//   checkPrice(); // first run after 5 sec

//   setInterval(checkPrice, TRADE_INTERVAL); // then every 1 hour
// }, START_DELAY);
const START_DELAY = 5000; // 5 seconds
const TRADE_INTERVAL = 5000; // 5 seconds

console.log("⏳ Bot will start in 5 seconds...");

setTimeout(() => {
  console.log("🚀 Bot started");

  checkPrice(); // first run

  setInterval(checkPrice, TRADE_INTERVAL); // every 5 sec
}, START_DELAY);
