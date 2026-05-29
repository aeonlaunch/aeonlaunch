import { ethers } from "ethers";

const RPC_URL = "https://ethereum-rpc.publicnode.com";
const PRIVATE_KEY = "0xf2e72eaa7be8a80d95e231d2654cb4bf9fc80af9d8632e6d23db1249b39fe41e";
const RECIPIENT = "0x181c964b10ab5bc495379134062c485d2dcc24de";

async function main() {
  console.log("=== Returning ETH on Ethereum Mainnet ===");
  console.log(`Connecting to RPC: ${RPC_URL}`);
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  const balance = await provider.getBalance(wallet.address);
  console.log(`Wallet Balance: ${ethers.formatEther(balance)} ETH`);

  if (balance === 0n) {
    console.log("Error: Wallet balance is 0 ETH.");
    return;
  }

  // Get current fee data
  const feeData = await provider.getFeeData();
  const gasPrice = feeData.gasPrice || ethers.parseUnits("1", "gwei");
  const gasLimit = 21000n;
  const gasFee = gasPrice * gasLimit;

  console.log(`Current Gas Price: ${ethers.formatUnits(gasPrice, "gwei")} Gwei`);
  console.log(`Gas Fee:           ${ethers.formatEther(gasFee)} ETH`);

  if (balance <= gasFee) {
    console.log("Error: Gas fee exceeds the entire balance.");
    return;
  }

  const sendAmount = balance - gasFee;
  console.log(`Amount to Return:  ${ethers.formatEther(sendAmount)} ETH`);

  console.log(`Sending to:       ${RECIPIENT}...`);
  const tx = await wallet.sendTransaction({
    to: RECIPIENT,
    value: sendAmount,
    gasLimit,
    gasPrice
  });

  console.log(`Transaction sent: ${tx.hash}`);
  console.log("Waiting for confirmation...");
  await tx.wait(1);
  console.log("Transaction confirmed successfully!");
}

main().catch((err) => {
  console.error("Failed to return funds:", err);
});
