import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { REVENUE_MANAGER_ADDRESS, CHAIN } from "./src/lib/config.js";

const RPC_URL = CHAIN.mainnet.rpcUrl;
const WALLET_DIR = path.join(process.env.HOME || "/root", ".aeon");
const REVENUE_MANAGER_ABI = [
  "function balances(address) external view returns (uint256)",
  "function claim() external returns (uint256)"
];

async function main() {
  console.log("=== Claiming Fees for All Agents ===");
  const provider = new ethers.JsonRpcProvider(RPC_URL);

  const files = fs.readdirSync(WALLET_DIR).filter(f => f.endsWith(".json") && f !== "launches.json");
  const privateKeys = new Set();
  
  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(path.join(WALLET_DIR, file), "utf8"));
    if (data.privateKey) {
      privateKeys.add(data.privateKey);
    }
  }

  for (const pk of privateKeys) {
    const wallet = new ethers.Wallet(pk, provider);
    const rm = new ethers.Contract(REVENUE_MANAGER_ADDRESS, REVENUE_MANAGER_ABI, wallet);

    const claimable = await rm.balances(wallet.address);
    if (claimable > 0n) {
      console.log(`Wallet ${wallet.address} has ${ethers.formatEther(claimable)} ETH claimable. Submitting claim...`);
      try {
        const tx = await rm.claim();
        console.log(`  Tx sent: ${tx.hash}`);
        await tx.wait(1);
        console.log(`  Confirmed!`);
      } catch (err) {
        console.error(`  Error claiming for ${wallet.address}: ${err.message}`);
      }
    } else {
      console.log(`Wallet ${wallet.address} has no fees to claim.`);
    }
  }
}

main().catch(console.error);
