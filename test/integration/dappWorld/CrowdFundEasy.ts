import { time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("DAppWorld", async function () {
    describe("TestCase 3", async function () {
        it("Should pass testcase", async function () {
            const [owner, address1, address2] = await ethers.getSigners();

            const token1ContractFactory = await ethers.getContractFactory("MyToken");
            const token1Contract = await token1ContractFactory
                .connect(owner)
                .deploy("Token1", "T1", ethers.parseEther("5"));

            const CrowdFundEasyContractFactory = await ethers.getContractFactory("CrowdFundEasy");
            const crowdFundEasyContract = await CrowdFundEasyContractFactory.connect(owner).deploy(
                await token1Contract.getAddress(),
            );

            await expect(token1Contract.connect(owner).mint(address1, ethers.parseEther("100000")))
                .not.reverted;

            await expect(token1Contract.connect(owner).mint(address2, ethers.parseEther("100000")))
                .not.reverted;

            await expect(
                token1Contract
                    .connect(address1)
                    .approve(await crowdFundEasyContract.getAddress(), ethers.parseEther("100000")),
            ).not.reverted;

            await expect(
                token1Contract
                    .connect(address2)
                    .approve(await crowdFundEasyContract.getAddress(), ethers.parseEther("100000")),
            ).not.reverted;

            await expect(
                crowdFundEasyContract
                    .connect(address1)
                    .createCampaign(ethers.parseEther("1000"), 10_000),
            ).not.reverted;
            const compaign1Timestamp = await time.latest();

            await time.increaseTo(compaign1Timestamp + 2000);
            expect(await crowdFundEasyContract.connect(address1).getCampaign(1)).deep.equal([
                8000,
                ethers.parseEther("1000"),
                0,
            ]);

            await expect(
                crowdFundEasyContract
                    .connect(address1)
                    .createCampaign(ethers.parseEther("5"), 2000),
            ).not.reverted;

            await time.increaseTo(compaign1Timestamp + 3000);
            expect(await crowdFundEasyContract.connect(address1).getCampaign(1)).deep.equal([
                7000,
                ethers.parseEther("1000"),
                0,
            ]);

            expect(await crowdFundEasyContract.connect(address1).getCampaign(2)).deep.equal([
                1000,
                ethers.parseEther("5"),
                0,
            ]);

            await expect(
                crowdFundEasyContract.connect(address1).contribute(1, ethers.parseEther("1000")),
            ).reverted;

            await expect(crowdFundEasyContract.connect(address2).contribute(1, 0)).reverted;

            await expect(
                crowdFundEasyContract.connect(address2).contribute(0, ethers.parseEther("100")),
            ).reverted;

            await expect(
                crowdFundEasyContract.connect(address2).contribute(3, ethers.parseEther("100")),
            ).reverted;

            await expect(
                crowdFundEasyContract.connect(address2).contribute(1, ethers.parseEther("100")),
            ).not.reverted;

            await time.increaseTo(compaign1Timestamp + 5000);
            expect(await crowdFundEasyContract.connect(address1).getCampaign(1)).deep.equal([
                5000,
                ethers.parseEther("1000"),
                ethers.parseEther("500"),
            ]);

            await expect(crowdFundEasyContract.connect(address2).contribute(2, 100)).reverted;
        });
    });

    describe("TestCase 4", async function () {
        it("Should pass testcase", async function () {
            const [owner, address1, address2] = await ethers.getSigners();

            const token1ContractFactory = await ethers.getContractFactory("MyToken");
            const token1Contract = await token1ContractFactory
                .connect(owner)
                .deploy("Token1", "T1", ethers.parseEther("5"));

            const CrowdFundEasyContractFactory = await ethers.getContractFactory("CrowdFundEasy");
            const crowdFundEasyContract = await CrowdFundEasyContractFactory.connect(owner).deploy(
                await token1Contract.getAddress(),
            );

            await expect(token1Contract.connect(owner).mint(address1, ethers.parseEther("100000")))
                .not.reverted;

            await expect(token1Contract.connect(owner).mint(address2, ethers.parseEther("100000")))
                .not.reverted;

            await expect(
                token1Contract
                    .connect(address1)
                    .approve(await crowdFundEasyContract.getAddress(), ethers.parseEther("100000")),
            ).not.reverted;

            await expect(
                token1Contract
                    .connect(address2)
                    .approve(await crowdFundEasyContract.getAddress(), ethers.parseEther("100000")),
            ).not.reverted;

            await expect(
                crowdFundEasyContract
                    .connect(address1)
                    .createCampaign(ethers.parseEther("1000"), 10_000),
            ).not.reverted;

            await expect(
                crowdFundEasyContract
                    .connect(address2)
                    .createCampaign(ethers.parseEther("2000"), 15_000),
            ).not.reverted;

            await expect(
                crowdFundEasyContract.connect(address1).contribute(2, ethers.parseEther("100")),
            ).not.reverted;

            await expect(
                crowdFundEasyContract.connect(address2).contribute(1, ethers.parseEther("500")),
            ).not.reverted;

            expect(
                await crowdFundEasyContract.connect(address1).getContribution(1, address1),
            ).equal(0);

            expect(
                await crowdFundEasyContract.connect(address1).getContribution(1, address2),
            ).equal(ethers.parseEther("2500"));

            expect(
                await crowdFundEasyContract.connect(address1).getContribution(2, address1),
            ).equal(ethers.parseEther("500"));

            expect(await token1Contract.connect(address1).balanceOf(address1)).equal(
                ethers.parseEther("99900"),
            );
            expect(await token1Contract.connect(address1).balanceOf(address2)).equal(
                ethers.parseEther("99500"),
            );

            await expect(crowdFundEasyContract.connect(address1).cancelContribution(0)).reverted;
            await expect(crowdFundEasyContract.connect(address1).cancelContribution(1)).reverted;
            await expect(crowdFundEasyContract.connect(address2).cancelContribution(2)).reverted;
            await expect(crowdFundEasyContract.connect(address1).cancelContribution(2)).not
                .reverted;

            expect(
                await crowdFundEasyContract.connect(address1).getContribution(2, address1),
            ).equal(0);

            expect(await token1Contract.connect(address1).balanceOf(address1)).equal(
                ethers.parseEther("100000"),
            );
        });
    });
});
