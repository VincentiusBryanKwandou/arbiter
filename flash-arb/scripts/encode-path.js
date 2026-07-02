/**
 * encode-path.js — encode Uniswap V3 multi-hop swap paths
 *
 * Usage:
 *   node scripts/encode-path.js \
 *     --tokens 0xUSDA,0xWETH,0xUSDB \
 *     --fees 500,3000
 *
 * Output: hex-encoded bytes path ready for exactInput
 *
 * Path format: tokenA (20B) | fee (3B) | tokenB (20B) | fee (3B) | tokenC (20B) ...
 */

const { ethers } = require("ethers");

function encodePath(tokens, fees) {
  if (tokens.length !== fees.length + 1) {
    throw new Error(`tokens.length (${tokens.length}) must be fees.length+1 (${fees.length + 1})`);
  }

  let encoded = tokens[0];
  for (let i = 0; i < fees.length; i++) {
    // fee as 3-byte hex (24 bits)
    const feePadded = fees[i].toString(16).padStart(6, "0");
    encoded = encoded + feePadded + tokens[i + 1].slice(2);
  }
  return encoded.toLowerCase();
}

// CLI usage
const args = process.argv.slice(2);
const tokensFlag = args.indexOf("--tokens");
const feesFlag   = args.indexOf("--fees");

if (tokensFlag !== -1 && feesFlag !== -1) {
  const tokens = args[tokensFlag + 1].split(",");
  const fees   = args[feesFlag + 1].split(",").map(Number);
  console.log("Encoded path:", encodePath(tokens, fees));
}

// Export for use in tests / bot
module.exports = { encodePath };
