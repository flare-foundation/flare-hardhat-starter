// Import necessary modules and types
import { BigNumber, BigNumberish, BytesLike } from 'ethers'
import { ethers } from 'ethers'
import { task } from 'hardhat/config'

import { types } from '@layerzerolabs/devtools-evm-hardhat'
import { EndpointId } from '@layerzerolabs/lz-definitions'
import { Options } from '@layerzerolabs/lz-v2-utilities'

// Define interfaces for task arguments and parameters
interface Args {
    message: string
    toEid: EndpointId
    extraOptions?: string
    contract?: string   // default to 'MyOApp'
  }

interface SendParam {
    dstEid: BigNumberish // Destination endpoint ID
    message: BytesLike // Encoded message payload
    extraOptions: BytesLike // Additional options
}

interface MessagingFee {
    nativeFee: BigNumberish
    lzTokenFee: BigNumberish
}

// Define the Hardhat task
task('lz:oapp:send', 'Sends a message using an OApp (from chain using Endpoint V2)')
  .addParam('message', 'The message to send', undefined, types.string)
  .addParam('toEid', 'Destination endpoint ID', undefined, types.bigint)
  .addOptionalParam('extraOptions', 'Extra options for the send operation (hex string)', '0x', types.string)
  .addOptionalParam('contract', 'OApp contract artifact name (default: MyOApp)', 'MyOApp', types.string)
  .setAction(async (taskArgs, hre) => {
    const contractName: string = taskArgs.contract || 'MyOApp'
    const message = taskArgs.message
    const dstEid = BigNumber.from(taskArgs.toEid)

    // Default to 200k receive gas if no extra options are provided
    let extraOptionsHex: string = taskArgs.extraOptions
    if (!extraOptionsHex || extraOptionsHex === '0x') {
      extraOptionsHex = Options.newOptions().addExecutorLzReceiveOption(200000, 0).toHex()
    }
    const extraOptions: BytesLike = ethers.utils.arrayify(extraOptionsHex)

    // Instantiate the OApp contract from deployments
    const oappDeployment = await hre.deployments.get(contractName)
    const oappContract = await hre.ethers.getContractAt(contractName, oappDeployment.address)

    // Prepare and quote
    const sendParam: SendParam = {
      dstEid,
      message: ethers.utils.toUtf8Bytes(message),
      extraOptions,
    }

    const feeQuote: MessagingFee = await oappContract.quote(sendParam.dstEid, message, sendParam.extraOptions)
    const nativeFee: BigNumber = BigNumber.from(feeQuote.nativeFee)
    const lzTokenFee: BigNumber = BigNumber.from(feeQuote.lzTokenFee)

    console.log(`Estimated fees: Native - ${ethers.utils.formatEther(nativeFee)} ETH, LZ Token - ${lzTokenFee.toString()}`)

    // Send and wait 1 confirmation
    const sendTx = await oappContract.sendMessage(sendParam.dstEid, message, sendParam.extraOptions, { value: nativeFee })
    const receipt = await sendTx.wait(1)

    console.log(`Send transaction confirmed in block ${receipt.blockNumber}.`)
    console.log(`LayerZero Scan: https://layerzeroscan.com/tx/${sendTx.hash}`)
  })