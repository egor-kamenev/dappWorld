import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre, { ethers } from "hardhat";
import { CrowdFundHard, ERC20 } from "typechain-types";

async function crowdFundEasyFixture() {
    const [owner, tokenOwner, , campaignCreator, contributor, other] =
        await hre.ethers.getSigners();

    const myTokenFactory = await hre.ethers.getContractFactory("MyToken");
    const myTokenContractOne = await myTokenFactory
        .connect(tokenOwner)
        .deploy("myToken", "MTK", ethers.parseEther("1"));

    const myTokenContractTwo = await myTokenFactory
        .connect(tokenOwner)
        .deploy("myToken2", "MTK2", ethers.parseEther("1"));

    const mintTokensForContributorTx1 = await myTokenContractOne
        .connect(tokenOwner)
        .mint(contributor.address, ethers.parseEther("100"));
    await mintTokensForContributorTx1.wait();

    const mintTokensForContributorTx2 = await myTokenContractTwo
        .connect(tokenOwner)
        .mint(contributor.address, ethers.parseEther("100"));
    await mintTokensForContributorTx2.wait();

    const crowdFundHardFactory = await hre.ethers.getContractFactory("CrowdFundHard");
    const crowdFundHardContract = await crowdFundHardFactory
        .connect(owner)
        .deploy([await myTokenContractOne.getAddress(), await myTokenContractTwo.getAddress()]);

    const approveTokensForCrowdFundHardContractTx1 = await myTokenContractOne
        .connect(contributor)
        .approve(await crowdFundHardContract.getAddress(), ethers.parseEther("100"));
    approveTokensForCrowdFundHardContractTx1.wait();

    const approveTokensForCrowdFundHardContractTx2 = await myTokenContractTwo
        .connect(contributor)
        .approve(await crowdFundHardContract.getAddress(), ethers.parseEther("100"));
    approveTokensForCrowdFundHardContractTx2.wait();

    return {
        campaignCreator,
        contributor,
        crowdFundHardContract,
        myTokenContractOne,
        myTokenContractTwo,
        other,
        owner,
    };
}

async function loadCrowdFundEasyFixture() {
    return await loadFixture(crowdFundEasyFixture);
}

async function createCampaign(
    contract: CrowdFundHard,
    creator: HardhatEthersSigner,
    goal: bigint | number = ethers.parseEther("100"),
    duration = 100,
) {
    return contract.connect(creator).createCampaign(goal, duration);
}

async function contribute({
    amount = ethers.parseEther("100"),
    contract,
    contributor,
    id = 1,
    token,
}: {
    amount?: bigint | number;
    contract: CrowdFundHard;
    contributor: HardhatEthersSigner;
    id?: number;
    token: ERC20 | string | HardhatEthersSigner;
}) {
    return contract.connect(contributor).contribute(id, token, amount);
}

describe("CrowdFundEasy", async function () {
    describe("constructor", async function () {
        it("Should revert on empty tokens array", async function () {
            const CrowdFundHardContractFactory =
                await hre.ethers.getContractFactory("CrowdFundHard");

            await expect(CrowdFundHardContractFactory.deploy([])).to.revertedWithCustomError(
                CrowdFundHardContractFactory,
                "CrowdFundHard__EmptyTokensArray",
            );
        });

        it("Should revert on zero token address", async function () {
            const CrowdFundHardContractFactory =
                await hre.ethers.getContractFactory("CrowdFundHard");

            await expect(
                CrowdFundHardContractFactory.deploy([ethers.ZeroAddress]),
            ).to.revertedWithCustomError(
                CrowdFundHardContractFactory,
                "CrowdFundHard__ZeroAddress",
            );
        });

        it("Should set toknes correctly", async function () {
            const { myTokenContractOne, myTokenContractTwo, crowdFundHardContract } =
                await loadCrowdFundEasyFixture();

            expect(await crowdFundHardContract.getTokens()).deep.equal([
                await myTokenContractOne.getAddress(),
                await myTokenContractTwo.getAddress(),
            ]);
        });
    });

    describe("createCampaign", async function () {
        it("Should revert on zero _goal", async function name() {
            const { crowdFundHardContract, campaignCreator } = await loadCrowdFundEasyFixture();

            await expect(
                createCampaign(crowdFundHardContract, campaignCreator, 0),
            ).to.revertedWithCustomError(crowdFundHardContract, "CrowdFundHard__ZeroCampaignGoal");
        });

        it("Should revert on zero _duration", async function name() {
            const { crowdFundHardContract, campaignCreator } = await loadCrowdFundEasyFixture();

            await expect(
                createCampaign(crowdFundHardContract, campaignCreator, 100, 0),
            ).to.revertedWithCustomError(
                crowdFundHardContract,
                "CrowdFundHard__ZeroCampaignDuration",
            );
        });

        it("Should create campaign id starting from 1", async function () {
            const { crowdFundHardContract, campaignCreator } = await loadCrowdFundEasyFixture();

            const tx = await createCampaign(crowdFundHardContract, campaignCreator);
            await tx.wait();

            const timestamp = await time.latest();

            expect(await crowdFundHardContract.getCampaigns()).to.deep.equal([
                [0, 0, ethers.ZeroAddress, false],
                [ethers.parseEther("100"), timestamp + 100, campaignCreator.address, false],
            ]);
        });
    });

    describe("contribute", async function () {
        it("Should revert if _id is 0", async function () {
            const { crowdFundHardContract, contributor, myTokenContractOne } =
                await loadCrowdFundEasyFixture();

            await expect(
                contribute({
                    contract: crowdFundHardContract,
                    contributor,
                    id: 0,
                    token: myTokenContractOne,
                }),
            )
                .to.revertedWithCustomError(
                    crowdFundHardContract,
                    "CrowdFundHard__CampaignDoesNotExists",
                )
                .withArgs(0);
        });

        it("Should revert if campaign does not exist", async function () {
            const { crowdFundHardContract, contributor, myTokenContractOne } =
                await loadCrowdFundEasyFixture();

            await expect(
                contribute({
                    contract: crowdFundHardContract,
                    contributor,
                    token: myTokenContractOne,
                }),
            )
                .to.revertedWithCustomError(
                    crowdFundHardContract,
                    "CrowdFundHard__CampaignDoesNotExists",
                )
                .withArgs(1);
        });

        it("Should revert if campaign is expired", async function () {
            const { crowdFundHardContract, campaignCreator, contributor, myTokenContractOne } =
                await loadCrowdFundEasyFixture();

            const tx = await createCampaign(crowdFundHardContract, campaignCreator);
            await tx.wait();

            const timestamp = await time.latest();

            await time.increase(100);
            await expect(
                contribute({
                    contract: crowdFundHardContract,
                    contributor,
                    token: myTokenContractOne,
                }),
            )
                .to.revertedWithCustomError(crowdFundHardContract, "CrowdFundHard__CampaignEnded")
                .withArgs(timestamp + 100);
        });

        it("Should revert contribution amount is 0", async function () {
            const { crowdFundHardContract, campaignCreator, contributor, myTokenContractOne } =
                await loadCrowdFundEasyFixture();

            const tx = await createCampaign(crowdFundHardContract, campaignCreator);

            await tx.wait();

            await expect(
                contribute({
                    amount: 0,
                    contract: crowdFundHardContract,
                    contributor,
                    token: myTokenContractOne,
                }),
            ).to.be.revertedWithCustomError(crowdFundHardContract, "CrowdFundHard__ZeroAmount");
        });

        it("Should revert token address is 0", async function () {
            const { crowdFundHardContract, campaignCreator, contributor } =
                await loadCrowdFundEasyFixture();

            const tx = await createCampaign(crowdFundHardContract, campaignCreator);

            await tx.wait();

            await expect(
                contribute({
                    amount: 0,
                    contract: crowdFundHardContract,
                    contributor,
                    token: ethers.ZeroAddress,
                }),
            ).to.be.revertedWithCustomError(crowdFundHardContract, "CrowdFundHard__ZeroAddress");
        });

        it("Should revert if contributor is campaign creator", async function () {
            const { crowdFundHardContract, campaignCreator, myTokenContractOne } =
                await loadCrowdFundEasyFixture();

            const tx = await createCampaign(crowdFundHardContract, campaignCreator);
            await tx.wait();

            await expect(
                contribute({
                    contract: crowdFundHardContract,
                    contributor: campaignCreator,
                    token: myTokenContractOne,
                }),
            ).to.revertedWithCustomError(
                crowdFundHardContract,
                "CrowdFundHard__TryingToContributeByCreator",
            );
        });

        it("Should revert if token address is not in s_tokens", async function () {
            const { crowdFundHardContract, contributor, campaignCreator, other } =
                await loadCrowdFundEasyFixture();

            const tx = await createCampaign(crowdFundHardContract, campaignCreator);
            await tx.wait();

            await expect(
                contribute({
                    contract: crowdFundHardContract,
                    contributor,
                    token: other,
                }),
            )
                .to.revertedWithCustomError(
                    crowdFundHardContract,
                    "CrowdFundHard__TokenIsNotAvaliable",
                )
                .withArgs(other);
        });

        it("Should reverted if contributor does not have enough tokens", async function () {
            const { crowdFundHardContract, campaignCreator, contributor, myTokenContractOne } =
                await loadCrowdFundEasyFixture();

            const tx = await createCampaign(crowdFundHardContract, campaignCreator);
            await tx.wait();

            await expect(
                contribute({
                    amount: ethers.parseEther("101"),
                    contract: crowdFundHardContract,
                    contributor,
                    token: myTokenContractOne,
                }),
            )
                .to.revertedWithCustomError(myTokenContractOne, "ERC20InsufficientAllowance")
                .withArgs(
                    await crowdFundHardContract.getAddress(),
                    ethers.parseEther("100"),
                    ethers.parseEther("101"),
                );
        });

        it("Should contribute", async function () {
            const {
                crowdFundHardContract,
                campaignCreator,
                contributor,
                myTokenContractOne,
                myTokenContractTwo,
            } = await loadCrowdFundEasyFixture();

            const tx = await createCampaign(crowdFundHardContract, campaignCreator);
            await tx.wait();
            const createCampaignTimestamp = await time.latest();

            await expect(
                contribute({
                    amount: ethers.parseEther("100"),
                    contract: crowdFundHardContract,
                    contributor,
                    token: myTokenContractOne,
                }),
            ).changeTokenBalances(
                myTokenContractOne,
                [crowdFundHardContract, contributor],
                [ethers.parseEther("100"), ethers.parseEther("-100")],
            );

            await expect(
                contribute({
                    amount: ethers.parseEther("100"),
                    contract: crowdFundHardContract,
                    contributor,
                    token: myTokenContractTwo,
                }),
            ).changeTokenBalances(
                myTokenContractTwo,
                [crowdFundHardContract, contributor],
                [ethers.parseEther("100"), ethers.parseEther("-100")],
            );
            const latestTimestamp = await time.latest();

            expect(await crowdFundHardContract.getCampaign(1)).to.deep.equal([
                100 - (latestTimestamp - createCampaignTimestamp),
                ethers.parseEther("100"),
                ethers.parseEther("200"),
            ]);

            expect(await crowdFundHardContract.getContribution(1, contributor)).to.equal(
                ethers.parseEther("200"),
            );
        });
    });

    describe("cancelContribution", async function () {
        it("Should revert if campaign does not exist", async function () {
            const { crowdFundHardContract } = await loadCrowdFundEasyFixture();

            await expect(crowdFundHardContract.cancelContribution(1))
                .revertedWithCustomError(
                    crowdFundHardContract,
                    "CrowdFundHard__CampaignDoesNotExists",
                )
                .withArgs(1);
        });

        it("Should revert if campaign isExpired", async function () {
            const { crowdFundHardContract, campaignCreator, contributor, myTokenContractOne } =
                await loadCrowdFundEasyFixture();

            const tx = await createCampaign(crowdFundHardContract, campaignCreator);
            await tx.wait();
            const createCampaignTimestamp = await time.latest();

            const tx2 = await contribute({
                contract: crowdFundHardContract,
                contributor,
                token: myTokenContractOne,
            });
            await tx2.wait();

            await time.increase(100);
            await expect(crowdFundHardContract.cancelContribution(1))
                .revertedWithCustomError(crowdFundHardContract, "CrowdFundHard__CampaignEnded")
                .withArgs(createCampaignTimestamp + 100);
        });

        it("Should revert if contributor has zero contribution for campaign", async function () {
            const { crowdFundHardContract, campaignCreator, contributor } =
                await loadCrowdFundEasyFixture();

            const tx = await createCampaign(crowdFundHardContract, campaignCreator);
            await tx.wait();

            await expect(
                crowdFundHardContract.connect(contributor).cancelContribution(1),
            ).revertedWithCustomError(crowdFundHardContract, "CrowdFundHard__ZeroContribution");
        });

        it("Should cancel contribution", async function () {
            const {
                crowdFundHardContract,
                campaignCreator,
                contributor,
                myTokenContractOne,
                myTokenContractTwo,
            } = await loadCrowdFundEasyFixture();

            const tx = await createCampaign(crowdFundHardContract, campaignCreator);
            await tx.wait();
            const createCampaignTimestamp = await time.latest();

            const tx2 = await contribute({
                contract: crowdFundHardContract,
                contributor,
                token: myTokenContractOne,
            });
            await tx2.wait();

            const tx3 = await contribute({
                contract: crowdFundHardContract,
                contributor,
                token: myTokenContractTwo,
            });
            await tx3.wait();

            const cancelContributionTx = await crowdFundHardContract
                .connect(contributor)
                .cancelContribution(1);

            await cancelContributionTx.wait();

            await expect(cancelContributionTx).changeTokenBalances(
                myTokenContractOne,
                [crowdFundHardContract, contributor],
                [ethers.parseEther("-100"), ethers.parseEther("100")],
            );

            await expect(cancelContributionTx).changeTokenBalances(
                myTokenContractTwo,
                [crowdFundHardContract, contributor],
                [ethers.parseEther("-100"), ethers.parseEther("100")],
            );

            const latestTimestamp = await time.latest();

            expect(await crowdFundHardContract.getCampaign(1)).to.deep.equal([
                100 - (latestTimestamp - createCampaignTimestamp),
                ethers.parseEther("100"),
                0,
            ]);

            expect(await crowdFundHardContract.getContribution(1, contributor)).to.equal(0);
        });
    });

    describe("withdrawFunds", async function () {
        it("Should revert if campaign does not exist", async function () {
            const { crowdFundHardContract, campaignCreator } = await loadCrowdFundEasyFixture();

            await expect(crowdFundHardContract.connect(campaignCreator).withdrawFunds(1))
                .to.revertedWithCustomError(
                    crowdFundHardContract,
                    "CrowdFundHard__CampaignDoesNotExists",
                )
                .withArgs(1);
        });

        it("Should revert if campaign is not ended", async function () {
            const { crowdFundHardContract, contributor, campaignCreator, myTokenContractOne } =
                await loadCrowdFundEasyFixture();

            const tx = await createCampaign(crowdFundHardContract, campaignCreator);
            await tx.wait();
            const createCampaignTimestamp = await time.latest();

            const tx2 = await contribute({
                contract: crowdFundHardContract,
                contributor,
                token: myTokenContractOne,
            });
            await tx2.wait();

            await expect(crowdFundHardContract.connect(campaignCreator).withdrawFunds(1))
                .to.revertedWithCustomError(
                    crowdFundHardContract,
                    "CrowdFundHard__CampaignNotEnded",
                )
                .withArgs(100 + createCampaignTimestamp);
        });

        it("Should revert if campaign is already withdrawn", async function () {
            const { crowdFundHardContract, contributor, campaignCreator, myTokenContractOne } =
                await loadCrowdFundEasyFixture();

            const tx = await createCampaign(crowdFundHardContract, campaignCreator);
            await tx.wait();

            const tx2 = await contribute({
                contract: crowdFundHardContract,
                contributor,
                token: myTokenContractOne,
            });
            await tx2.wait();

            await time.increase(100);
            const tx3 = await crowdFundHardContract.connect(campaignCreator).withdrawFunds(1);
            await tx3.wait();

            await expect(
                crowdFundHardContract.connect(campaignCreator).withdrawFunds(1),
            ).to.revertedWithCustomError(crowdFundHardContract, "CrowdFundHard__AlreadyWithdrawed");
        });

        it("Should revert if sender is not campaign creator", async function () {
            const { crowdFundHardContract, contributor, campaignCreator, myTokenContractOne } =
                await loadCrowdFundEasyFixture();

            const tx = await createCampaign(crowdFundHardContract, campaignCreator);
            await tx.wait();

            const tx2 = await contribute({
                contract: crowdFundHardContract,
                contributor,
                token: myTokenContractOne,
            });
            await tx2.wait();

            await time.increase(100);
            await expect(crowdFundHardContract.connect(contributor).withdrawFunds(1))
                .to.revertedWithCustomError(
                    crowdFundHardContract,
                    "CrowdFundHard__NotCampaignCreator",
                )
                .withArgs(campaignCreator);
        });

        it("Should revert if campaign goal is not reached", async function () {
            const { crowdFundHardContract, contributor, campaignCreator, myTokenContractOne } =
                await loadCrowdFundEasyFixture();

            const tx = await createCampaign(crowdFundHardContract, campaignCreator);
            await tx.wait();

            const tx2 = await contribute({
                amount: ethers.parseEther("1"),
                contract: crowdFundHardContract,
                contributor,
                token: myTokenContractOne,
            });
            await tx2.wait();

            await time.increase(100);
            await expect(crowdFundHardContract.connect(campaignCreator).withdrawFunds(1))
                .to.revertedWithCustomError(
                    crowdFundHardContract,
                    "CrowdFundHard__CampaignGoalDoesNotReached",
                )
                .withArgs(ethers.parseEther("100"), ethers.parseEther("1"));
        });

        it("Should withdraw funds", async function () {
            const { crowdFundHardContract, myTokenContractOne, contributor, campaignCreator } =
                await loadCrowdFundEasyFixture();

            const tx = await createCampaign(crowdFundHardContract, campaignCreator);
            await tx.wait();
            const createCampaignTimestamp = await time.latest();

            const tx2 = await contribute({
                contract: crowdFundHardContract,
                contributor,
                token: myTokenContractOne,
            });
            await tx2.wait();

            await time.increase(100);
            expect(
                await crowdFundHardContract.connect(campaignCreator).withdrawFunds(1),
            ).to.changeTokenBalances(
                myTokenContractOne,
                [crowdFundHardContract, campaignCreator],
                [-ethers.parseEther("100"), ethers.parseEther("100")],
            );

            expect(await crowdFundHardContract.getCampaigns()).to.deep.equal([
                [0, 0, ethers.ZeroAddress, false],
                [
                    ethers.parseEther("100"),
                    createCampaignTimestamp + 100,
                    campaignCreator.address,
                    true,
                ],
            ]);
        });
    });

    describe("refund", async function () {
        it("Should revert if campaign is not exists", async function () {
            const { crowdFundHardContract, contributor } = await loadCrowdFundEasyFixture();
            await expect(crowdFundHardContract.connect(contributor).refund(1))
                .to.revertedWithCustomError(
                    crowdFundHardContract,
                    "CrowdFundHard__CampaignDoesNotExists",
                )
                .withArgs(1);
        });

        it("Should revert if campaign is not ended", async function () {
            const { crowdFundHardContract, campaignCreator, contributor, myTokenContractOne } =
                await loadCrowdFundEasyFixture();
            const tx = await createCampaign(crowdFundHardContract, campaignCreator);
            await tx.wait();
            const createCampaignTimestamp = await time.latest();

            const tx2 = await contribute({
                contract: crowdFundHardContract,
                contributor,
                token: myTokenContractOne,
            });
            await tx2.wait();

            await expect(crowdFundHardContract.connect(contributor).refund(1))
                .to.revertedWithCustomError(
                    crowdFundHardContract,
                    "CrowdFundHard__CampaignNotEnded",
                )
                .withArgs(createCampaignTimestamp + 100);
        });

        it("Should revert if campaign is already withdrawed", async function () {
            const { crowdFundHardContract, campaignCreator, contributor, myTokenContractOne } =
                await loadCrowdFundEasyFixture();

            const tx = await createCampaign(crowdFundHardContract, campaignCreator);
            await tx.wait();

            const tx2 = await contribute({
                contract: crowdFundHardContract,
                contributor,
                token: myTokenContractOne,
            });
            await tx2.wait();

            await time.increase(100);
            const tx3 = await crowdFundHardContract.connect(campaignCreator).withdrawFunds(1);
            await tx3.wait();

            await expect(
                crowdFundHardContract.connect(contributor).refund(1),
            ).to.revertedWithCustomError(crowdFundHardContract, "CrowdFundHard__AlreadyWithdrawed");
        });

        it("Should revert if contributor is not contributor of the campaign", async function () {
            const { crowdFundHardContract, campaignCreator, contributor } =
                await loadCrowdFundEasyFixture();

            const tx = await createCampaign(crowdFundHardContract, campaignCreator);
            await tx.wait();

            await time.increase(100);
            await expect(
                crowdFundHardContract.connect(contributor).refund(1),
            ).to.revertedWithCustomError(crowdFundHardContract, "CrowdFundHard__ZeroContribution");
        });

        it("Should revert if campaign goal is reached", async function () {
            const { crowdFundHardContract, campaignCreator, contributor, myTokenContractOne } =
                await loadCrowdFundEasyFixture();

            const tx = await createCampaign(crowdFundHardContract, campaignCreator);
            await tx.wait();

            const tx2 = await contribute({
                contract: crowdFundHardContract,
                contributor,
                token: myTokenContractOne,
            });
            await tx2.wait();

            await time.increase(100);
            await expect(crowdFundHardContract.connect(contributor).refund(1))
                .to.revertedWithCustomError(
                    crowdFundHardContract,
                    "CrowdFundHard__CampaignGoalReached",
                )
                .withArgs(ethers.parseEther("100"), ethers.parseEther("100"));
        });

        it("Should refund money to contributor", async function () {
            const { crowdFundHardContract, campaignCreator, contributor, myTokenContractOne } =
                await loadCrowdFundEasyFixture();

            const tx = await createCampaign(crowdFundHardContract, campaignCreator);
            await tx.wait();

            const tx2 = await contribute({
                amount: ethers.parseEther("50"),
                contract: crowdFundHardContract,
                contributor,
                token: myTokenContractOne,
            });
            await tx2.wait();

            await time.increase(100);
            await expect(
                crowdFundHardContract.connect(contributor).refund(1),
            ).to.changeTokenBalances(
                myTokenContractOne,
                [crowdFundHardContract, contributor],
                [ethers.parseEther("-50"), ethers.parseEther("50")],
            );

            expect(await crowdFundHardContract.getCampaign(1)).to.deep.equal([
                0,
                ethers.parseEther("100"),
                0,
            ]);

            expect(await crowdFundHardContract.getContribution(1, contributor)).to.equal(0);
        });
    });

    describe("getContribution", async function () {
        it("Should revert if campaign does not exist", async function () {
            const { crowdFundHardContract, contributor } = await loadCrowdFundEasyFixture();

            await expect(
                crowdFundHardContract.getContribution(1, contributor),
            ).to.revertedWithCustomError(
                crowdFundHardContract,
                "CrowdFundHard__CampaignDoesNotExists",
            );
        });

        it("Should revet if user address is 0", async function () {
            const { crowdFundHardContract, campaignCreator, contributor, myTokenContractOne } =
                await loadCrowdFundEasyFixture();

            const tx = await createCampaign(crowdFundHardContract, campaignCreator);
            await tx.wait();

            const tx2 = await contribute({
                contract: crowdFundHardContract,
                contributor,
                token: myTokenContractOne,
            });
            await tx2.wait();

            await expect(
                crowdFundHardContract.getContribution(1, ethers.ZeroAddress),
            ).to.revertedWithCustomError(crowdFundHardContract, "CrowdFundHard__ZeroAddress");
        });

        it("Should return contribution", async function () {
            const {
                crowdFundHardContract,
                campaignCreator,
                contributor,
                myTokenContractOne,
                myTokenContractTwo,
            } = await loadCrowdFundEasyFixture();

            const tx = await createCampaign(crowdFundHardContract, campaignCreator);
            await tx.wait();

            const tx2 = await contribute({
                amount: ethers.parseEther("50"),
                contract: crowdFundHardContract,
                contributor,
                token: myTokenContractOne,
            });
            await tx2.wait();

            const tx3 = await contribute({
                amount: ethers.parseEther("50"),
                contract: crowdFundHardContract,
                contributor,
                token: myTokenContractTwo,
            });
            await tx3.wait();

            expect(await crowdFundHardContract.getContribution(1, contributor)).to.equal(
                ethers.parseEther("100"),
            );

            expect(await crowdFundHardContract.getContribution(1, campaignCreator)).to.equal(0);
        });
    });

    describe("getCampaign", async function () {
        it("Should revert if campaign does not exist", async function () {
            const { crowdFundHardContract } = await loadCrowdFundEasyFixture();

            expect(crowdFundHardContract.getCampaign(1))
                .to.revertedWithCustomError(
                    crowdFundHardContract,
                    "CrowdFundHard__CampaignDoesNotExists",
                )
                .withArgs(2);
        });

        it("Should return campaign", async function () {
            const { crowdFundHardContract, campaignCreator } = await loadCrowdFundEasyFixture();

            const tx = await createCampaign(crowdFundHardContract, campaignCreator);
            await tx.wait();

            expect(await crowdFundHardContract.getCampaign(1)).to.deep.equal([
                100,
                ethers.parseEther("100"),
                0,
            ]);
        });
    });

    describe("getTokens", async function () {
        it("Should return token", async function () {
            const { crowdFundHardContract, myTokenContractOne, myTokenContractTwo } =
                await loadCrowdFundEasyFixture();

            expect(await crowdFundHardContract.getTokens()).to.deep.equal([
                await myTokenContractOne.getAddress(),
                await myTokenContractTwo.getAddress(),
            ]);
        });
    });

    describe("getCampaigns", async function () {
        it("Should return campaigns", async function () {
            const { crowdFundHardContract, campaignCreator } = await loadCrowdFundEasyFixture();

            const tx = await createCampaign(crowdFundHardContract, campaignCreator);
            await tx.wait();
            const latestTimestamp = await time.latest();

            expect(await crowdFundHardContract.getCampaigns()).to.deep.equal([
                [0, 0, ethers.ZeroAddress, false],
                [ethers.parseEther("100"), latestTimestamp + 100, campaignCreator.address, false],
            ]);
        });
    });
});
