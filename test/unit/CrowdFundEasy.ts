import { time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre, { ethers } from "hardhat";
import loadCrowdFundEasyFixture from "@/test/fixtures/CrowdFundEasy";

describe("CrowdFundEasy", async function () {
    describe("constructor", async function () {
        it("Should revert on zero _myToken address", async function () {
            const CrowdFundEasyContractFactory =
                await hre.ethers.getContractFactory("CrowdFundEasy");

            await expect(
                CrowdFundEasyContractFactory.deploy(ethers.ZeroAddress),
            ).to.revertedWithCustomError(
                CrowdFundEasyContractFactory,
                "CrowdFundEasy__ZeroAddress",
            );
        });

        it("Should set _myToken correctly", async function () {
            const { myTokenContract, crowdFundEasyContract } = await loadCrowdFundEasyFixture();

            expect(await myTokenContract.getAddress()).to.equal(
                await crowdFundEasyContract.getToken(),
            );
        });
    });

    describe("createCampaign", async function () {
        it("Should revert on zero _goal", async function name() {
            const { crowdFundEasyContract, campaignCreator } = await loadCrowdFundEasyFixture();

            await expect(
                crowdFundEasyContract.connect(campaignCreator).createCampaign(0, 100),
            ).to.revertedWithCustomError(crowdFundEasyContract, "CrowdFundEasy__ZeroCampaignGoal");
        });

        it("Should revert on zero _duration", async function name() {
            const { crowdFundEasyContract, campaignCreator } = await loadCrowdFundEasyFixture();

            await expect(
                crowdFundEasyContract
                    .connect(campaignCreator)
                    .createCampaign(ethers.parseEther("100"), 0),
            ).to.revertedWithCustomError(
                crowdFundEasyContract,
                "CrowdFundEasy__ZeroCampaignDuration",
            );
        });

        it("Should create compaign id starting from 1", async function () {
            const { crowdFundEasyContract, campaignCreator } = await loadCrowdFundEasyFixture();

            const tx = await crowdFundEasyContract
                .connect(campaignCreator)
                .createCampaign(ethers.parseEther("100"), 100);
            await tx.wait();

            const timestamp = await time.latest();

            expect(await crowdFundEasyContract.getCampaigns()).to.deep.equal([
                [0, 0, ethers.ZeroAddress, 0, false],
                [ethers.parseEther("100"), timestamp + 100, campaignCreator.address, 0, false],
            ]);
        });
    });

    describe("contribute", async function () {
        it("Should revert if _id is 0", async function () {
            const { crowdFundEasyContract, contributor } = await loadCrowdFundEasyFixture();

            await expect(crowdFundEasyContract.connect(contributor).contribute(0, 100))
                .to.revertedWithCustomError(
                    crowdFundEasyContract,
                    "CrowdFundEasy__CampaignDoesNotExists",
                )
                .withArgs(0);
        });

        it("Should revert if campaign does not exist", async function () {
            const { crowdFundEasyContract, contributor } = await loadCrowdFundEasyFixture();

            await expect(crowdFundEasyContract.connect(contributor).contribute(1, 100))
                .to.revertedWithCustomError(
                    crowdFundEasyContract,
                    "CrowdFundEasy__CampaignDoesNotExists",
                )
                .withArgs(1);
        });

        it("Should revert if campaign is expired", async function () {
            const { crowdFundEasyContract, campaignCreator, contributor } =
                await loadCrowdFundEasyFixture();

            const tx = await crowdFundEasyContract
                .connect(campaignCreator)
                .createCampaign(ethers.parseEther("100"), 100);
            await tx.wait();

            const timestamp = await time.latest();

            await time.increase(100);
            await expect(crowdFundEasyContract.connect(contributor).contribute(1, 100))
                .to.revertedWithCustomError(crowdFundEasyContract, "CrowdFundEasy__CampaignEnded")
                .withArgs(timestamp + 100);
        });

        it("Should revert contribution amount is 0", async function () {
            const { crowdFundEasyContract, campaignCreator, contributor } =
                await loadCrowdFundEasyFixture();

            const tx = await crowdFundEasyContract
                .connect(campaignCreator)
                .createCampaign(ethers.parseEther("100"), 100);

            await tx.wait();

            await expect(
                crowdFundEasyContract.connect(contributor).contribute(1, 0),
            ).to.be.revertedWithCustomError(
                crowdFundEasyContract,
                "CrowdFundEasy__ZeroContribution",
            );
        });

        it("Should revert if contributor is campaign creator", async function () {
            const { crowdFundEasyContract, campaignCreator } = await loadCrowdFundEasyFixture();

            const tx = await crowdFundEasyContract
                .connect(campaignCreator)
                .createCampaign(ethers.parseEther("100"), 100);
            await tx.wait();

            await expect(
                crowdFundEasyContract.connect(campaignCreator).contribute(1, 100),
            ).to.revertedWithCustomError(
                crowdFundEasyContract,
                "CrowdFundEasy__TryingToContributeByCreator",
            );
        });

        it("Should reverted if contributor does not have enough tokens", async function () {
            const { crowdFundEasyContract, campaignCreator, contributor, myTokenContract } =
                await loadCrowdFundEasyFixture();

            const tx = await crowdFundEasyContract
                .connect(campaignCreator)
                .createCampaign(ethers.parseEther("100"), 100);
            await tx.wait();

            await expect(
                crowdFundEasyContract.connect(contributor).contribute(1, ethers.parseEther("101")),
            )
                .to.revertedWithCustomError(myTokenContract, "ERC20InsufficientAllowance")
                .withArgs(
                    await crowdFundEasyContract.getAddress(),
                    ethers.parseEther("100"),
                    ethers.parseEther("101"),
                );
        });

        it("Should contribute", async function () {
            const { crowdFundEasyContract, campaignCreator, contributor, myTokenContract } =
                await loadCrowdFundEasyFixture();

            const tx = await crowdFundEasyContract
                .connect(campaignCreator)
                .createCampaign(ethers.parseEther("100"), 100);
            await tx.wait();
            const createCampaignTimestamp = await time.latest();

            await expect(
                crowdFundEasyContract.connect(contributor).contribute(1, ethers.parseEther("100")),
            ).changeTokenBalances(
                myTokenContract,
                [crowdFundEasyContract, contributor],
                [ethers.parseEther("100"), ethers.parseEther("-100")],
            );
            const latestTimestamp = await time.latest();

            expect(await crowdFundEasyContract.getCampaign(1)).to.deep.equal([
                100 - (latestTimestamp - createCampaignTimestamp),
                ethers.parseEther("100"),
                ethers.parseEther("100"),
            ]);

            expect(await crowdFundEasyContract.getContribution(1, contributor)).to.equal(
                ethers.parseEther("100"),
            );
        });
    });

    describe("cancelContribution", async function () {
        it("Should revert if campaign does not exist", async function () {
            const { crowdFundEasyContract } = await loadCrowdFundEasyFixture();

            await expect(crowdFundEasyContract.cancelContribution(1))
                .revertedWithCustomError(
                    crowdFundEasyContract,
                    "CrowdFundEasy__CampaignDoesNotExists",
                )
                .withArgs(1);
        });

        it("Should revert if campaign isExpired", async function () {
            const { crowdFundEasyContract, campaignCreator, contributor } =
                await loadCrowdFundEasyFixture();

            const tx = await crowdFundEasyContract
                .connect(campaignCreator)
                .createCampaign(ethers.parseEther("100"), 100);
            await tx.wait();
            const createCampaignTimestamp = await time.latest();

            const tx2 = await crowdFundEasyContract
                .connect(contributor)
                .contribute(1, ethers.parseEther("100"));
            await tx2.wait();

            await time.increase(100);
            await expect(crowdFundEasyContract.cancelContribution(1))
                .revertedWithCustomError(crowdFundEasyContract, "CrowdFundEasy__CampaignEnded")
                .withArgs(createCampaignTimestamp + 100);
        });

        it("Should revert if contributor has zero contributions for campaign", async function () {
            const { crowdFundEasyContract, campaignCreator, contributor } =
                await loadCrowdFundEasyFixture();

            const tx = await crowdFundEasyContract
                .connect(campaignCreator)
                .createCampaign(ethers.parseEther("100"), 100);
            await tx.wait();

            await expect(
                crowdFundEasyContract.connect(contributor).cancelContribution(1),
            ).revertedWithCustomError(crowdFundEasyContract, "CrowdFundEasy__ZeroContributions");
        });

        it("Should cancel contribution", async function () {
            const { crowdFundEasyContract, campaignCreator, contributor, myTokenContract } =
                await loadCrowdFundEasyFixture();

            const tx = await crowdFundEasyContract
                .connect(campaignCreator)
                .createCampaign(ethers.parseEther("100"), 100);
            await tx.wait();
            const createCampaignTimestamp = await time.latest();

            const tx2 = await crowdFundEasyContract
                .connect(contributor)
                .contribute(1, ethers.parseEther("100"));
            await tx2.wait();

            await expect(
                crowdFundEasyContract.connect(contributor).cancelContribution(1),
            ).changeTokenBalances(
                myTokenContract,
                [crowdFundEasyContract, contributor],
                [ethers.parseEther("-100"), ethers.parseEther("100")],
            );
            const latestTimestamp = await time.latest();

            expect(await crowdFundEasyContract.getCampaign(1)).to.deep.equal([
                100 - (latestTimestamp - createCampaignTimestamp),
                ethers.parseEther("100"),
                0,
            ]);

            expect(await crowdFundEasyContract.getContribution(1, contributor)).to.equal(0);
        });
    });

    describe("withdrawFunds", async function () {
        it("Should revert if campaign does not exist", async function () {
            const { crowdFundEasyContract, contributor } = await loadCrowdFundEasyFixture();

            await expect(crowdFundEasyContract.connect(contributor).withdrawFunds(1))
                .to.revertedWithCustomError(
                    crowdFundEasyContract,
                    "CrowdFundEasy__CampaignDoesNotExists",
                )
                .withArgs(1);
        });

        it("Should revert if sender is not campaign creator", async function () {
            const { crowdFundEasyContract, contributor, campaignCreator } =
                await loadCrowdFundEasyFixture();

            const tx = await crowdFundEasyContract
                .connect(campaignCreator)
                .createCampaign(ethers.parseEther("100"), 100);
            await tx.wait();

            const tx2 = await crowdFundEasyContract
                .connect(contributor)
                .contribute(1, ethers.parseEther("100"));
            await tx2.wait();

            await time.increase(100);
            await expect(crowdFundEasyContract.connect(contributor).withdrawFunds(1))
                .to.revertedWithCustomError(
                    crowdFundEasyContract,
                    "CrowdFundEasy__NotCampaignCreator",
                )
                .withArgs(campaignCreator);
        });

        it("Should revert if campaign is not ended", async function () {
            const { crowdFundEasyContract, contributor, campaignCreator } =
                await loadCrowdFundEasyFixture();

            const tx = await crowdFundEasyContract
                .connect(campaignCreator)
                .createCampaign(ethers.parseEther("100"), 100);
            await tx.wait();
            const createCampaignTimestamp = await time.latest();

            const tx2 = await crowdFundEasyContract
                .connect(contributor)
                .contribute(1, ethers.parseEther("100"));
            await tx2.wait();

            await expect(crowdFundEasyContract.connect(campaignCreator).withdrawFunds(1))
                .to.revertedWithCustomError(
                    crowdFundEasyContract,
                    "CrowdFundEasy__CampaignNotEnded",
                )
                .withArgs(100 + createCampaignTimestamp);
        });

        it("Should revert if campaign goal is not reached", async function () {
            const { crowdFundEasyContract, contributor, campaignCreator } =
                await loadCrowdFundEasyFixture();

            const tx = await crowdFundEasyContract
                .connect(campaignCreator)
                .createCampaign(ethers.parseEther("100"), 100);
            await tx.wait();

            const tx2 = await crowdFundEasyContract
                .connect(contributor)
                .contribute(1, ethers.parseEther("1"));
            await tx2.wait();

            await time.increase(100);
            await expect(crowdFundEasyContract.connect(campaignCreator).withdrawFunds(1))
                .to.revertedWithCustomError(
                    crowdFundEasyContract,
                    "CrowdFundEasy__CampaignGoalDoesNotReached",
                )
                .withArgs(ethers.parseEther("100"), ethers.parseEther("1"));
        });

        it("Should revert if campaign is already withdrawn", async function () {
            const { crowdFundEasyContract, contributor, campaignCreator } =
                await loadCrowdFundEasyFixture();

            const tx = await crowdFundEasyContract
                .connect(campaignCreator)
                .createCampaign(ethers.parseEther("100"), 100);
            await tx.wait();

            const tx2 = await crowdFundEasyContract
                .connect(contributor)
                .contribute(1, ethers.parseEther("100"));
            await tx2.wait();

            await time.increase(100);
            const tx3 = await crowdFundEasyContract.connect(campaignCreator).withdrawFunds(1);
            await tx3.wait();

            await expect(
                crowdFundEasyContract.connect(campaignCreator).withdrawFunds(1),
            ).to.revertedWithCustomError(crowdFundEasyContract, "CrowdFundEasy__AlreadyWithdrawed");
        });

        it("Should withdraw funds", async function () {
            const { crowdFundEasyContract, myTokenContract, contributor, campaignCreator } =
                await loadCrowdFundEasyFixture();

            const tx = await crowdFundEasyContract
                .connect(campaignCreator)
                .createCampaign(ethers.parseEther("100"), 100);
            await tx.wait();
            const createCampaignTimestamp = await time.latest();

            const tx2 = await crowdFundEasyContract
                .connect(contributor)
                .contribute(1, ethers.parseEther("100"));
            await tx2.wait();

            await time.increase(100);
            expect(
                await crowdFundEasyContract.connect(campaignCreator).withdrawFunds(1),
            ).to.changeTokenBalances(
                myTokenContract,
                [crowdFundEasyContract, contributor],
                [-ethers.parseEther("100"), ethers.parseEther("100")],
            );

            expect(await crowdFundEasyContract.getCampaigns()).to.deep.equal([
                [0, 0, ethers.ZeroAddress, 0, false],
                [
                    ethers.parseEther("100"),
                    createCampaignTimestamp + 100,
                    campaignCreator.address,
                    ethers.parseEther("100"),
                    true,
                ],
            ]);
        });
    });

    describe("refund", async function () {
        it("Should revert if campaign is not exists", async function () {
            const { crowdFundEasyContract, contributor } = await loadCrowdFundEasyFixture();
            await expect(crowdFundEasyContract.connect(contributor).refund(1))
                .to.revertedWithCustomError(
                    crowdFundEasyContract,
                    "CrowdFundEasy__CampaignDoesNotExists",
                )
                .withArgs(1);
        });

        it("Should revert if campaign is not ended", async function () {
            const { crowdFundEasyContract, campaignCreator, contributor } =
                await loadCrowdFundEasyFixture();
            const tx = await crowdFundEasyContract
                .connect(campaignCreator)
                .createCampaign(ethers.parseEther("100"), 100);
            await tx.wait();
            const createCampaignTimestamp = await time.latest();

            const tx2 = await crowdFundEasyContract
                .connect(contributor)
                .contribute(1, ethers.parseEther("100"));
            await tx2.wait();

            await expect(crowdFundEasyContract.connect(contributor).refund(1))
                .to.revertedWithCustomError(
                    crowdFundEasyContract,
                    "CrowdFundEasy__CampaignNotEnded",
                )
                .withArgs(createCampaignTimestamp + 100);
        });

        it("Should revert if campaign is already withdrawed", async function () {
            const { crowdFundEasyContract, campaignCreator, contributor } =
                await loadCrowdFundEasyFixture();

            const tx = await crowdFundEasyContract
                .connect(campaignCreator)
                .createCampaign(ethers.parseEther("100"), 100);
            await tx.wait();

            const tx2 = await crowdFundEasyContract
                .connect(contributor)
                .contribute(1, ethers.parseEther("100"));
            await tx2.wait();

            await time.increase(100);
            const tx3 = await crowdFundEasyContract.connect(campaignCreator).withdrawFunds(1);
            await tx3.wait();

            await expect(
                crowdFundEasyContract.connect(contributor).refund(1),
            ).to.revertedWithCustomError(crowdFundEasyContract, "CrowdFundEasy__AlreadyWithdrawed");
        });

        it("Should revert if contributor is not contributor of the campaign", async function () {
            const { crowdFundEasyContract, campaignCreator, contributor } =
                await loadCrowdFundEasyFixture();

            const tx = await crowdFundEasyContract
                .connect(campaignCreator)
                .createCampaign(ethers.parseEther("100"), 100);
            await tx.wait();

            await time.increase(100);
            await expect(
                crowdFundEasyContract.connect(contributor).refund(1),
            ).to.revertedWithCustomError(crowdFundEasyContract, "CrowdFundEasy__ZeroContributions");
        });

        it("Should revert if campaign goal is reached", async function () {
            const { crowdFundEasyContract, campaignCreator, contributor } =
                await loadCrowdFundEasyFixture();

            const tx = await crowdFundEasyContract
                .connect(campaignCreator)
                .createCampaign(ethers.parseEther("100"), 100);
            await tx.wait();

            const tx2 = await crowdFundEasyContract
                .connect(contributor)
                .contribute(1, ethers.parseEther("100"));
            await tx2.wait();

            await time.increase(100);
            await expect(crowdFundEasyContract.connect(contributor).refund(1))
                .to.revertedWithCustomError(
                    crowdFundEasyContract,
                    "CrowdFundEasy__CampaignGoalReached",
                )
                .withArgs(ethers.parseEther("100"), ethers.parseEther("100"));
        });

        it("Should refund money to contributor", async function () {
            const { crowdFundEasyContract, campaignCreator, contributor, myTokenContract } =
                await loadCrowdFundEasyFixture();

            const tx = await crowdFundEasyContract
                .connect(campaignCreator)
                .createCampaign(ethers.parseEther("100"), 100);
            await tx.wait();

            const tx2 = await crowdFundEasyContract
                .connect(contributor)
                .contribute(1, ethers.parseEther("50"));
            await tx2.wait();

            await time.increase(100);
            await expect(
                crowdFundEasyContract.connect(contributor).refund(1),
            ).to.changeTokenBalances(
                myTokenContract,
                [crowdFundEasyContract, contributor],
                [ethers.parseEther("-50"), ethers.parseEther("50")],
            );

            expect(await crowdFundEasyContract.getCampaign(1)).to.deep.equal([
                0,
                ethers.parseEther("100"),
                0,
            ]);

            expect(await crowdFundEasyContract.getContribution(1, contributor)).to.equal(0);
        });
    });

    describe("getContribution", async function () {
        it("Should revert if campaign does not exist", async function () {
            const { crowdFundEasyContract, contributor } = await loadCrowdFundEasyFixture();

            await expect(
                crowdFundEasyContract.getContribution(1, contributor),
            ).to.revertedWithCustomError(
                crowdFundEasyContract,
                "CrowdFundEasy__CampaignDoesNotExists",
            );
        });

        it("Should revet if user address is 0", async function () {
            const { crowdFundEasyContract, campaignCreator, contributor } =
                await loadCrowdFundEasyFixture();

            const tx = await crowdFundEasyContract
                .connect(campaignCreator)
                .createCampaign(ethers.parseEther("100"), 100);
            await tx.wait();

            const tx2 = await crowdFundEasyContract
                .connect(contributor)
                .contribute(1, ethers.parseEther("100"));
            await tx2.wait();

            await expect(
                crowdFundEasyContract.getContribution(1, ethers.ZeroAddress),
            ).to.revertedWithCustomError(crowdFundEasyContract, "CrowdFundEasy__ZeroAddress");
        });

        it("Should return contribution", async function () {
            const { crowdFundEasyContract, campaignCreator, contributor } =
                await loadCrowdFundEasyFixture();

            const tx = await crowdFundEasyContract
                .connect(campaignCreator)
                .createCampaign(ethers.parseEther("100"), 100);
            await tx.wait();

            const tx2 = await crowdFundEasyContract
                .connect(contributor)
                .contribute(1, ethers.parseEther("50"));
            await tx2.wait();

            expect(await crowdFundEasyContract.getContribution(1, contributor)).to.equal(
                ethers.parseEther("50"),
            );

            expect(await crowdFundEasyContract.getContribution(1, campaignCreator)).to.equal(0);
        });
    });

    describe("getCampaign", async function () {
        it("Should revert if campaign does not exist", async function () {
            const { crowdFundEasyContract } = await loadCrowdFundEasyFixture();

            expect(crowdFundEasyContract.getCampaign(1))
                .to.revertedWithCustomError(
                    crowdFundEasyContract,
                    "CrowdFundEasy__CampaignDoesNotExists",
                )
                .withArgs(2);
        });

        it("Should return campaign", async function () {
            const { crowdFundEasyContract, campaignCreator } = await loadCrowdFundEasyFixture();

            const tx = await crowdFundEasyContract
                .connect(campaignCreator)
                .createCampaign(ethers.parseEther("100"), 100);
            await tx.wait();

            expect(await crowdFundEasyContract.getCampaign(1)).to.deep.equal([
                100,
                ethers.parseEther("100"),
                0,
            ]);
        });
    });

    describe("getToken", async function () {
        it("Should return token", async function () {
            const { crowdFundEasyContract, myTokenContract } = await loadCrowdFundEasyFixture();

            expect(await crowdFundEasyContract.getToken()).to.equal(
                await myTokenContract.getAddress(),
            );
        });
    });

    describe("getCompaigns", async function () {
        it("Should return campaigns", async function () {
            const { crowdFundEasyContract, campaignCreator } = await loadCrowdFundEasyFixture();

            const tx = await crowdFundEasyContract
                .connect(campaignCreator)
                .createCampaign(ethers.parseEther("100"), 100);
            await tx.wait();
            const latestTimestamp = await time.latest();

            expect(await crowdFundEasyContract.getCampaigns()).to.deep.equal([
                [0, 0, ethers.ZeroAddress, 0, false],
                [
                    ethers.parseEther("100"),
                    latestTimestamp + 100,
                    campaignCreator.address,
                    0,
                    false,
                ],
            ]);
        });
    });
});

//remove address