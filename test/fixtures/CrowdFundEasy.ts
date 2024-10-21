import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import hre, { ethers } from "hardhat";

async function crowdFundEasyFixture() {
    const [owner, tokenOwner, campaignCreator, contributor] = await hre.ethers.getSigners();

    const myTokenFactory = await hre.ethers.getContractFactory("MyToken");
    const myTokenContract = await myTokenFactory
        .connect(tokenOwner)
        .deploy("myToken", "MTK", ethers.parseEther("1"));

    const mintTokensForContributorTx = await myTokenContract
        .connect(tokenOwner)
        .mint(contributor.address, ethers.parseEther("100"));
    await mintTokensForContributorTx.wait();

    const crowdFundEasyFactory = await hre.ethers.getContractFactory("CrowdFundEasy");
    const crowdFundEasyContract = await crowdFundEasyFactory
        .connect(owner)
        .deploy(await myTokenContract.getAddress());

    const approveTokensForCrowdFundEasyContractTx = await myTokenContract
        .connect(contributor)
        .approve(await crowdFundEasyContract.getAddress(), ethers.parseEther("100"));
    approveTokensForCrowdFundEasyContractTx.wait();

    return {
        campaignCreator,
        contributor,
        crowdFundEasyContract,
        myTokenContract,
        owner,
    };
}

export default async function loadCrowdFundEasyFixture() {
    return await loadFixture(crowdFundEasyFixture);
}
