import { time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("DAppWorld testcases", async function () {
    describe("TestCase 3", async function () {
        it("Should pass testcase", async function () {
            const [owner, address1, address2] = await ethers.getSigners();

            const myTokenFactory = await ethers.getContractFactory("MyToken");

            const myTokenContractOne = await myTokenFactory
                .connect(owner)
                .deploy("Token1", "T1", ethers.parseEther("1"));

            const myTokenContractTwo = await myTokenFactory
                .connect(owner)
                .deploy("Token2", "T2", ethers.parseEther("4"));

            const myTokenContractThree = await myTokenFactory
                .connect(owner)
                .deploy("Token3", "T3", ethers.parseEther("5"));

            const CrowdFundEasyContractFactory = await ethers.getContractFactory("CrowdFundHard");
            const crowdFundContract = await CrowdFundEasyContractFactory.connect(owner).deploy([
                await myTokenContractOne.getAddress(),
                await myTokenContractTwo.getAddress(),
            ]);

            await expect(
                myTokenContractOne.connect(owner).mint(address1, ethers.parseEther("100000")),
            ).not.reverted;

            await expect(
                myTokenContractOne.connect(owner).mint(address2, ethers.parseEther("100000")),
            ).not.reverted;

            await expect(
                myTokenContractTwo.connect(owner).mint(address2, ethers.parseEther("100000")),
            ).not.reverted;

            await expect(
                myTokenContractTwo
                    .connect(address1)
                    .approve(await crowdFundContract.getAddress(), ethers.parseEther("100000")),
            ).not.reverted;

            await expect(
                myTokenContractOne
                    .connect(address1)
                    .approve(await crowdFundContract.getAddress(), ethers.parseEther("100000")),
            ).not.reverted;

            await expect(
                crowdFundContract
                    .connect(address1)
                    .createCampaign(ethers.parseEther("1000"), 10_000),
            ).not.reverted;
            const campaign1Timestamp = await time.latest();

            await expect(
                crowdFundContract
                    .connect(address2)
                    .createCampaign(ethers.parseEther("100"), 20_000),
            ).not.reverted;
            const campaign2Timestamp = await time.latest();

            await time.increaseTo(campaign1Timestamp + 110);
            expect(await crowdFundContract.connect(address1).getCampaign(1)).deep.equal([
                9890,
                ethers.parseEther("1000"),
                0,
            ]);

            await time.increaseTo(campaign2Timestamp + 110);
            expect(await crowdFundContract.connect(address1).getCampaign(2)).deep.equal([
                19_890,
                ethers.parseEther("100"),
                0,
            ]);

            await expect(
                crowdFundContract
                    .connect(address1)
                    .contribute(1, await myTokenContractOne.getAddress(), ethers.parseEther("100")),
            ).reverted;

            await expect(
                crowdFundContract
                    .connect(address1)
                    .contribute(0, await myTokenContractOne.getAddress(), ethers.parseEther("100")),
            ).reverted;

            await expect(
                crowdFundContract
                    .connect(address1)
                    .contribute(2, await myTokenContractOne.getAddress(), 0),
            ).reverted;

            await expect(
                crowdFundContract
                    .connect(address1)
                    .contribute(
                        2,
                        await myTokenContractThree.getAddress(),
                        ethers.parseEther("100"),
                    ),
            ).reverted;

            await expect(
                crowdFundContract
                    .connect(address2)
                    .contribute(1, await myTokenContractOne.getAddress(), ethers.parseEther("100")),
            ).reverted;

            await expect(
                crowdFundContract
                    .connect(address1)
                    .contribute(2, await myTokenContractOne.getAddress(), ethers.parseEther("100")),
            ).not.reverted;

            await expect(crowdFundContract.connect(address1).getContribution(0, address1)).reverted;

            expect(await crowdFundContract.connect(address1).getContribution(1, address1)).equal(0);

            expect(await crowdFundContract.connect(address1).getContribution(1, address2)).equal(0);

            expect(await crowdFundContract.connect(address2).getContribution(2, address1)).equal(
                ethers.parseEther("100"),
            );
        });
    });
});
