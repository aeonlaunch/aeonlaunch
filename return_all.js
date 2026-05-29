import fs from "fs";
import path from "path";
import { createPublicClient, createWalletClient, http, formatEther, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

const WALLET_DIR = path.join(process.env.HOME || "/root", ".aeon");
const RECIPIENT = "0x70eC7EC74c1dE750bD9dEf06614d1e7f4E21dee1";
const RPC = "https://mainnet.base.org";

const wallets = [
  "wallet_agent1.json",
  "wallet_agent2.json",
  "wallet_agent3.json",
  "wallet_agent4.json",
  "wallet_agent5.json"
];

async function main() {
  console.log(`=== Returning Funds to ${RECIPIENT} ===`);
  
  const publicClient = createPublicClient({
    chain: base,
    transport: http(RPC)
  });

  for (const walletFile of wallets) {
    const filePath = path.join(WALLET_DIR, walletFile);
    if (!fs.existsSync(filePath)) continue;

    const content = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const account = privateKeyToAccount(content.privateKey);

    const walletClient = createWalletClient({
      account,
      chain: base,
      transport: http(RPC)
    });

    const balance = await publicClient.getBalance({ address: account.address });
    console.log(`\n${walletFile} (${account.address})`);
    console.log(`Balance: ${formatEther(balance)} ETH`);

    if (balance === 0n) {
      console.log("Empty, skipping.");
      continue;
    }

    // Estimate gas
    try {
      const gas = await publicClient.estimateGas({
        account,
        to: RECIPIENT,
        value: 1n // dummy value to estimate
      });

      // Base is an OP Stack L2. Transactions have an L1 data fee which viem accounts for.
      // We will subtract a flat 0.0001 ETH to safely cover the L2 gas + L1 data fee.
      const safeBuffer = parseEther("0.0001");

      if (balance <= safeBuffer) {
        console.log(`Insufficient balance to cover gas fee buffer. Skipping.`);
        continue;
      }

      const sendAmount = balance - safeBuffer;
      console.log(`Sending: ${formatEther(sendAmount)} ETH...`);

      const hash = await walletClient.sendTransaction({
        to: RECIPIENT,
        value: sendAmount,
        gas
      });

      console.log(`Sent! Tx: https://basescan.org/tx/${hash}`);
      
      // Wait for receipt
      await publicClient.waitForTransactionReceipt({ hash });
      console.log("Confirmed!");
    } catch (err) {
      console.log(`❌ Failed to send from ${walletFile}: ${err.message}`);
    }
  }
  console.log("\n=== Finished Returning Funds ===");
}

main().catch(console.error);
