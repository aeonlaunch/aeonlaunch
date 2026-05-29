import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { REVENUE_MANAGER_ADDRESS, CHAIN } from "./src/lib/config.js";

const RPC_URL = CHAIN.mainnet.rpcUrl;
const WALLET_DIR = path.join(process.env.HOME || "/root", ".aeon");
const REVENUE_MANAGER_ABI = [
  "function balances(address) external view returns (uint256)",
  "function protocolFee() external view returns (uint256)",
];

async function main() {
  console.log("=== Checking Fees for All Agents ===");
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const rm = new ethers.Contract(REVENUE_MANAGER_ADDRESS, REVENUE_MANAGER_ABI, provider);

  const files = fs.readdirSync(WALLET_DIR).filter(f => f.endsWith(".json") && f !== "launches.json");
  const addresses = new Set();
  
  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(path.join(WALLET_DIR, file), "utf8"));
    if (data.address) {
      addresses.add(data.address);
    }
  }

  let protocolFeeBps = 1000n;
  try { protocolFeeBps = await rm.protocolFee(); } catch { /* use default */ }

  for (const addr of addresses) {
    const claimable = await rm.balances(addr);
    const claimableEth = ethers.formatEther(claimable);

    const afterProtocol = claimable - (claimable * protocolFeeBps / 10000n);
    const afterProtocolEth = ethers.formatEther(afterProtocol);

    if (claimable > 0n) {
      console.log(`Wallet ${addr} has pending fees:`);
      console.log(`  Claimable: ${claimableEth} ETH`);
      console.log(`  After Protocol Fee: ~${afterProtocolEth} ETH\n`);
    } else {
      console.log(`Wallet ${addr} has 0 pending fees.\n`);
    }
  }
}

main().catch(console.error);
