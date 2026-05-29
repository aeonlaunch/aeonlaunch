import { ethers } from "ethers";

const RPC_URL = "https://mainnet.base.org";
const TX_HASH = "0x0438eb44d844ecea4298436884db0352f21a240e8fa9082fb6ac544c6a8b0bfc";

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const tx = await provider.getTransaction(TX_HASH);
  const receipt = await provider.getTransactionReceipt(TX_HASH);

  console.log("Tx From:", tx.from);
  console.log("Tx To:", tx.to);
  console.log("Value:", ethers.formatEther(tx.value), "ETH");
  console.log("Block:", tx.blockNumber);
  console.log("Status:", receipt ? receipt.status : "Pending");
}

main().catch(console.error);
