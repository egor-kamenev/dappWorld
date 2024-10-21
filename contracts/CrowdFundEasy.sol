// Layout of Contract:
// version
// imports
// errors
// interfaces, libraries, contracts
// Type declarations
// State variables
// Events
// Modifiers
// Functions

// Layout of Functions:
// constructor
// receive function (if exists)
// fallback function (if exists)
// external
// public
// internal
// private
// internal & private view & pure functions
// external & public view & pure functions

// SPDX-License-Identifier: MIT
pragma solidity 0.8.21;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {MyToken} from "./mocks/Mytoken.sol";
import "hardhat/console.sol";

contract CrowdFundEasy {
    error CrowdFundEasy__ZeroAddress();
    error CrowdFundEasy__ZeroCampaignGoal();
    error CrowdFundEasy__ZeroCampaignDuration();
    error CrowdFundEasy__CampaignEnded(uint256 timeEnd);
    error CrowdFundEasy__ZeroContributions();
    error CrowdFundEasy__ZeroContribution();
    error CrowdFundEasy__CampaignNotEnded(uint256 timeEnd);
    error CrowdFundEasy__CampaignDoesNotExists(uint256 id);
    error CrowdFundEasy__CampaignGoalDoesNotReached(uint256 goal, uint256 contributionsAmount);
    error CrowdFundEasy__CampaignGoalReached(uint256 goal, uint256 contributionsAmount);
    error CrowdFundEasy__AlreadyWithdrawed();
    error CrowdFundEasy__TryingToContributeByCreator();

    error CrowdFundEasy__NotCampaignCreator(address contributor);
    error ERC20InsufficientAllowance(address sender, uint256 currentAllowance, uint256 value);

    struct Campaign {
        uint256 goal; // in USD
        uint256 timeEnd;
        address creator;
        uint256 contributionsAmount; // in Tokens
        bool isWithdrawn;
    }

    MyToken immutable i_token;
    Campaign[] s_campaigns;
    mapping(uint256 campaign => mapping(address contributor => uint256 amount)) s_contributions; // amount in tokens

    /**
     * @notice checks that address param is not zero
     * @param _adr ERC20 token address
     */
    modifier isAddressNotZero(address _adr) {
        if (_adr == address(0)) revert CrowdFundEasy__ZeroAddress();
        _;
    }

    /**
     * @notice checks that campaign is created
     * @param _id campaign id
     */
    modifier isCampaignExists(uint256 _id) {
        if (_id == 0 || _id >= s_campaigns.length) revert CrowdFundEasy__CampaignDoesNotExists(_id);
        _;
    }

    /**
     * @notice checks that campaign is not ended yet
     * @param _id campaign id
     */
    modifier isCampaignNotEnded(uint256 _id) {
        uint256 timeEnd = s_campaigns[_id].timeEnd;
        if (block.timestamp >= timeEnd) revert CrowdFundEasy__CampaignEnded(timeEnd);
        _;
    }

    /**
     * @notice checks that campaign is already ended
     * @param _id campaign id
     */
    modifier isCampaignEnded(uint256 _id) {
        uint256 timeEnd = s_campaigns[_id].timeEnd;
        if (block.timestamp < timeEnd) revert CrowdFundEasy__CampaignNotEnded(timeEnd);
        _;
    }

    /**
     * @notice checks that campaign is not withdrawn yet
     * @param _id campaign id
     */
    modifier isCampaignNotWithdrawn(uint256 _id) {
        bool isWithdrawed = s_campaigns[_id].isWithdrawn;
        if (isWithdrawed) revert CrowdFundEasy__AlreadyWithdrawed();
        _;
    }

    /**
     * @notice checks that user contribution is not zero
     * @param _id campaign id
     */
    modifier isUserContributionIsNotZero(uint256 _id) {
        if (s_contributions[_id][msg.sender] == 0) revert CrowdFundEasy__ZeroContributions();
        _;
    }

    /**
     * @param _token list of allowed token addresses
     */
    constructor(address _token) isAddressNotZero(_token) {
        i_token = MyToken(_token);
    }

    /**
     * @notice createCampaign allows anyone to create a campaign
     * @param _goal amount of funds to be raised in USD
     * @param _duration the duration of the campaign in seconds
     */
    function createCampaign(uint256 _goal, uint256 _duration) external {
        if (_goal == 0) revert CrowdFundEasy__ZeroCampaignGoal();
        if (_duration == 0) revert CrowdFundEasy__ZeroCampaignDuration();

        Campaign memory campaign = Campaign({
            goal: _goal,
            timeEnd: block.timestamp + _duration,
            creator: msg.sender,
            contributionsAmount: 0,
            isWithdrawn: false
        });

        if (s_campaigns.length == 0) {
            s_campaigns.push();
            s_campaigns.push(campaign);
            return;
        }

        s_campaigns.push(campaign);
    }

    /**
     * @dev contribute allows anyone to contribute to a campaign
     * @param _id the id of the campaign
     * @param _amount the amount of tokens to contribute
     */
    function contribute(
        uint256 _id,
        uint256 _amount
    ) external isCampaignExists(_id) isCampaignNotEnded(_id) {
        if (_amount == 0) revert CrowdFundEasy__ZeroContribution();

        if (s_campaigns[_id].creator == msg.sender)
            revert CrowdFundEasy__TryingToContributeByCreator();

        require(i_token.transferFrom(msg.sender, address(this), _amount));

        s_contributions[_id][msg.sender] += _amount;
        s_campaigns[_id].contributionsAmount += _amount;
    }

    /**
     * @dev cancelContribution allows anyone to cancel their contribution
     * @param _id the id of the campaign
     */
    function cancelContribution(
        uint256 _id
    ) external isCampaignExists(_id) isCampaignNotEnded(_id) isUserContributionIsNotZero(_id) {
        uint256 contributionAmount = s_contributions[_id][msg.sender];

        s_campaigns[_id].contributionsAmount -= contributionAmount;
        s_contributions[_id][msg.sender] = 0;

        require(i_token.transfer(msg.sender, contributionAmount));
    }

    /**
     * @notice withdrawFunds allows the creator of the campaign to withdraw the funds
     * @param _id the id of the campaign
     */

    function withdrawFunds(
        uint256 _id
    ) external isCampaignExists(_id) isCampaignEnded(_id) isCampaignNotWithdrawn(_id) {
        Campaign memory campaign = s_campaigns[_id];

        if (campaign.creator != msg.sender)
            revert CrowdFundEasy__NotCampaignCreator(campaign.creator);

        if (getTokenAmountInUsd(campaign.contributionsAmount) < campaign.goal)
            revert CrowdFundEasy__CampaignGoalDoesNotReached(
                campaign.goal,
                campaign.contributionsAmount
            );

        require(i_token.transfer(msg.sender, campaign.contributionsAmount));

        s_campaigns[_id].isWithdrawn = true;
    }

    /**
     * @notice refund allows the contributors to get a refund if the campaign failed
     * @param _id the id of the campaign
     */
    function refund(
        uint256 _id
    )
        external
        isCampaignExists(_id)
        isCampaignEnded(_id)
        isCampaignNotWithdrawn(_id)
        isUserContributionIsNotZero(_id)
    {
        Campaign memory campaign = s_campaigns[_id];

        if (getTokenAmountInUsd(campaign.contributionsAmount) >= campaign.goal)
            revert CrowdFundEasy__CampaignGoalReached(campaign.goal, campaign.contributionsAmount);

        uint256 contributionAmount = s_contributions[_id][msg.sender];

        s_campaigns[_id].contributionsAmount -= contributionAmount;
        s_contributions[_id][msg.sender] = 0;

        require(i_token.transfer(msg.sender, contributionAmount));
    }

    function getTokenAmountInUsd(uint256 _amount) private view returns (uint256) {
        uint256 rate = i_token.getTokenPriceInUSD();
        return (rate * _amount) / 1e18;
    }

    /**
     * @notice getContribution returns the contribution of a contributor in USD
     * @param _id the id of the campaign
     * @param _contributor the address of the contributor
     */
    function getContribution(
        uint256 _id,
        address _contributor
    ) public view isCampaignExists(_id) isAddressNotZero(_contributor) returns (uint256) {
        return getTokenAmountInUsd(s_contributions[_id][_contributor]);
    }

    /**
     * @notice getCampaign returns details about a campaign
     * @param _id the id of the campaign
     * @return remainingTime the time (in seconds) when the campaign ends
     * @return goal the goal of the campaign (in USD)
     * @return totalFunds total funds (in USD) raised by the campaign
     */
    function getCampaign(
        uint256 _id
    )
        external
        view
        isCampaignExists(_id)
        returns (uint256 remainingTime, uint256 goal, uint256 totalFunds)
    {
        Campaign memory campaign = s_campaigns[_id];

        remainingTime = block.timestamp > campaign.timeEnd ? 0 : campaign.timeEnd - block.timestamp;
        goal = campaign.goal;
        totalFunds = getTokenAmountInUsd(campaign.contributionsAmount);
    }

    function getToken() external view returns (address) {
        return address(i_token);
    }

    function getCampaigns() external view returns (Campaign[] memory) {
        return s_campaigns;
    }
}
