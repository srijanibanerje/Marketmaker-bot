const { ethers } = require("ethers");
require("dotenv").config();

/* =======================
   BNB CHAIN CONSTANTS
======================= */

const WBNB_ADDRESS = "0x00a8042f6fefb2457ac2911ce215ea882ab27f72";
const PANCAKE_ROUTER_ADDRESS = "0x10ED43C718714eb63d5aA57B78B54704E256024E";

// 🔴 CHANGE THIS TO YOUR TOKEN (BSC)
const tokenAddress = "0xYourBscTokenAddressHere";

/* =======================
   TRADE CONFIG
======================= */

const buyAmount = ethers.parseEther("0.01"); // 0.01 BNB
const targetPrice = BigInt(35);               // your logic
const targetAmountOut = buyAmount * targetPrice;
const sellAmount = buyAmount / targetPrice;
const tradeFrequency = 3600 * 1000; // 1 hour

/* =======================
   PROVIDER & WALLET
======================= */

const provider = new ethers.JsonRpcProvider(
  "https://bsc-dataseed.binance.org/"
);

const wallet = new ethers.Wallet(process.env.PRIVATE_KEY);
const account = wallet.connect(provider);

/* =======================
   TOKEN CONTRACT
======================= */

const token = new ethers.Contract(
  tokenAddress,
  [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)"
  ],
  account
);

/* =======================
   PANCAKESWAP ROUTER
======================= */

const router = new ethers.Contract(
  PANCAKE_ROUTER_ADDRESS,
  [
    "function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)",
    "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) payable returns (uint[] memory amounts)",
    "function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) returns (uint[] memory amounts)"
  ],
  account
);

/* =======================
   BUY TOKENS
======================= */

const buyTokens = async () => {
  console.log("🟢 Buying Tokens");

  const path = [WBNB_ADDRESS, tokenAddress];
  const deadline = Math.floor(Date.now() / 1000) + 600;

  const tx = await router.swapExactETHForTokens(
    0,          // ❗ no slippage protection (dangerous in prod)
    path,
    wallet.address,
    deadline,
    { value: buyAmount }
  );

  await tx.wait();
  console.log("✅ Buy TX:", tx.hash);
};

/* =======================
   SELL TOKENS
======================= */

const sellTokens = async () => {
  console.log("🔴 Selling Tokens");

  const allowance = await token.allowance(
    wallet.address,
    PANCAKE_ROUTER_ADDRESS
  );

  if (allowance < sellAmount) {
    console.log("🔓 Approving tokens...");
    const approveTx = await token.approve(
      PANCAKE_ROUTER_ADDRESS,
      sellAmount
    );
    await approveTx.wait();
  }

  const path = [tokenAddress, WBNB_ADDRESS];
  const deadline = Math.floor(Date.now() / 1000) + 600;

  const tx = await router.swapExactTokensForETH(
    sellAmount,
    0, // ❗ no slippage protection
    path,
    wallet.address,
    deadline
  );

  await tx.wait();
  console.log("✅ Sell TX:", tx.hash);
};

/* =======================
   CHECK PRICE
======================= */

const checkPrice = async () => {
  const path = [WBNB_ADDRESS, tokenAddress];

  const amounts = await router.getAmountsOut(buyAmount, path);
  const amountOut = amounts[1];

  console.log("📈 Current AmountOut:", amountOut.toString());
  console.log("🎯 Target AmountOut:", targetAmountOut.toString());

  if (amountOut < targetAmountOut) await buyTokens();
  if (amountOut > targetAmountOut) await sellTokens();
};

/* =======================
   RUN BOT
======================= */

checkPrice();
setInterval(checkPrice, tradeFrequency);
