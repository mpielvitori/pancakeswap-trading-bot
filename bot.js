/* eslint-disable max-len */
const ethers = require('ethers');
const config = require('config');

// First address of this mnemonic must have enough BNB to pay for tx fess
const myGasPrice = ethers.utils.parseUnits('1000', 'gwei');
const myGasLimit = {
  gasPrice: myGasPrice,
  gasLimit: '162445',
};

const provider = new ethers.providers.JsonRpcProvider(config[config.network].node);
const wallet = new ethers.Wallet(config[config.network].privateKey);
const account = wallet.connect(provider);

const factory = new ethers.Contract(
  config[config.network].addresses.factory,
  ['event PairCreated(address indexed token0, address indexed token1, address pair, uint)'],
  account,
);
const router = new ethers.Contract(
  config[config.network].addresses.router,
  [
    'function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)',
    'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
  ],
  account,
);

const wbnb = new ethers.Contract(
  config[config.network].addresses.WBNB,
  [
    'function approve(address spender, uint amount) public returns(bool)',
  ],
  account,
);

console.log('Before Approve');
const valueToApprove = ethers.utils.parseUnits('0.5', 'ether');
const init = async () => {
  const tx = await wbnb.approve(
    router.address,
    valueToApprove,
    myGasLimit,
  );
  console.log('After Approve');
  const receipt = await tx.wait();
  console.log('Transaction receipt', receipt);
};


factory.on('PairCreated', async (token0, token1, pairAddress) => {
  console.log(`New pair detected ================= token0: ${token0} token1: ${token1} pairAddress: ${pairAddress}`);

  // The quote currency needs to be WBNB (we will pay with WBNB)
  let tokenIn;
  let tokenOut;
  if (token0 === config[config.network].addresses.WBNB) {
    tokenIn = token0;
    tokenOut = token1;
  }

  if (token1 === config[config.network].addresses.WBNB) {
    tokenIn = token1;
    tokenOut = token0;
  }

  // // The quote currency is not WBNB
  if (typeof tokenIn === 'undefined') {
    return;
  }

  // We buy for 0.1 BNB of the new token
  // ethers was originally created for Ethereum, both also work for BSC
  // 'ether' === 'bnb' on BSC
  const amountIn = ethers.utils.parseUnits('1', 'ether');
  const amounts = await router.getAmountsOut(amountIn, [tokenIn, tokenOut]);
  // Our execution price will be a bit different, we need some flexbility
  const amountOutMin = amounts[1].sub(amounts[1].div(10));

  console.log(`Buying new token ================= tokenIn: ${amountIn} `
  + `${tokenIn} (WBNB) tokenOut: ${amountOutMin} ${tokenOut}`);

  const tx = await router.swapExactTokensForTokens(
    amountIn,
    amountOutMin,
    [tokenIn, tokenOut],
    config[config.network].addresses.recipient,
    Math.floor(Date.now() / 1000) + 60 * 3, // 1 minutes from the current Unix time
    myGasLimit,
  );
  const receipt = await tx.wait();
  console.log('Transaction receipt', receipt);
});


process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, p) => {
  console.error('Unhandled Rejection', {
    unhandledRejection: p,
    reason,
  });
});

init();
