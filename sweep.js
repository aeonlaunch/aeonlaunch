import { ethers } from "ethers";
import fs from "fs";
import path from "path";

const RPC_URL = "https://mainnet.base.org";
const RECIPIENT = "0x70eC7EC74c1dE750bD9dEf06614d1e7f4E21dee1";
const WALLET_DIR = path.join(process.env.HOME || "/root", ".aeon");

async function main() {
  console.log("=== Sweeping ETH on Base Mainnet ===");
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
    const balance = await provider.getBalance(wallet.address);
    
    if (balance > 0n) {
      console.log(`Wallet ${wallet.address} has ${ethers.formatEther(balance)} ETH`);
      try {
        // Base rollup has an L1 data fee on top of L2 execution gas
        // Leave a safe buffer of 0.0005 ETH (~$1.50)
        const SAFE_FEE_BUFFER = ethers.parseEther("0.0005");
        
        if (balance > SAFE_FEE_BUFFER) {
          const sendAmount = balance - SAFE_FEE_BUFFER;
          console.log(`  Sending ${ethers.formatEther(sendAmount)} ETH to ${RECIPIENT}...`);
          
          const tx = await wallet.sendTransaction({
            to: RECIPIENT,
            value: sendAmount,
            // don't set explicit gasLimit/gasPrice so ethers uses EIP-1559 and estimates correctly
          });
          
          console.log(`  Tx sent: ${tx.hash}`);
          await tx.wait(1);
          console.log("  Confirmed!");
        } else {
          console.log("  Balance too low to cover L1/L2 gas fees.");
        }
      } catch (err) {
        console.error(`  Error sweeping wallet ${wallet.address}: ${err.message}`);
      }
    }
  }
}

main().catch(console.error);
