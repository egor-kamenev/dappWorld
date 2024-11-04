// SPDX-License-Identifier: MIT

pragma solidity 0.8.21;
import {MyToken} from "./mocks/Mytoken.sol";

contract CrowdFundHard {
    /**
     * @title Campaign struct
     * @notice Stores the details of a campaign
     * @dev
     * @param goal the goal of the campaign in USD
     * @param timeEnd the time when the campaign ends
     * @param creator the address of the creator of the campaign
     * @param contributionsAmount the total amount of tokens contributed to the campaign
     * @param isWithdrawn whether the campaign creator has withdrawn the funds
     */
    struct Campaign {
        uint256 goal;
        uint256 timeEnd;
        address creator;
        bool isWithdrawn;
    }

    // @notice List of allowed ERC20 token addresses for contributions
    address[] private tokens;

    // @notice Array to store all campaigns
    Campaign[] private campaigns;

    // @notice Mapping to track the total amount of each token contributed to each campaign
    // @dev Maps campaign ID to a mapping of token address to contribution amount
    mapping(uint256 campaign => mapping(address token => uint256 amount))
        private contributionsAmount;

    // @notice Mapping to track individual contributions to campaigns
    // @dev Maps campaign ID to a mapping of contributor address to a mapping of token address to contribution amount
    mapping(uint256 campaign => mapping(address contributor => mapping(address token => uint256 amount)))
        private contributions;

    error CrowdFundHard__ZeroAddress();
    error CrowdFundHard__EmptyTokensArray();
    error CrowdFundHard__TokenIsNotAvaliable(address token);
    error CrowdFundEasy__TokenTransactionFailed(address from, address to, uint256 amount);
    error CrowdFundHard__ZeroCampaignGoal();
    error CrowdFundHard__ZeroCampaignDuration();
    error CrowdFundHard__CampaignEnded(uint256 timeEnd);
    error CrowdFundHard__ZeroContribution();
    error CrowdFundHard__CampaignNotEnded(uint256 timeEnd);
    error CrowdFundHard__CampaignDoesNotExists(uint256 id);
    error CrowdFundHard__CampaignGoalDoesNotReached(uint256 goal, uint256 contributionsAmount);
    error CrowdFundHard__CampaignGoalReached(uint256 goal, uint256 contributionsAmount);
    error CrowdFundHard__AlreadyWithdrawed();
    error CrowdFundHard__TryingToContributeByCreator();
    error CrowdFundHard__ZeroAmount();

    error CrowdFundHard__NotCampaignCreator(address contributor);
    error ERC20InsufficientAllowance(address sender, uint256 currentAllowance, uint256 value);

    /**
     * @notice checks that address param is not zero
     * @param _adr ERC20 token address
     */
    modifier isAddressNotZero(address _adr) {
        if (_adr == address(0)) revert CrowdFundHard__ZeroAddress();
        _;
    }

    /**
     * @notice checks that campaign is created
     * @param _id campaign id
     */
    modifier isCampaignExists(uint256 _id) {
        if (_id == 0 || _id >= campaigns.length) revert CrowdFundHard__CampaignDoesNotExists(_id);
        _;
    }

    /**
     * @notice checks that campaign is not ended yet
     * @param _id campaign id
     */
    modifier isCampaignNotEnded(uint256 _id) {
        uint256 timeEnd = campaigns[_id].timeEnd;
        if (block.timestamp >= timeEnd) revert CrowdFundHard__CampaignEnded(timeEnd);
        _;
    }

    /**
     * @notice checks that campaign is already ended
     * @param _id campaign id
     */
    modifier isCampaignEnded(uint256 _id) {
        uint256 timeEnd = campaigns[_id].timeEnd;
        if (block.timestamp < timeEnd) revert CrowdFundHard__CampaignNotEnded(timeEnd);
        _;
    }

    /**
     * @notice checks that campaign is not withdrawn yet
     * @param _id campaign id
     */
    modifier isCampaignNotWithdrawn(uint256 _id) {
        bool isWithdrawed = campaigns[_id].isWithdrawn;
        if (isWithdrawed) revert CrowdFundHard__AlreadyWithdrawed();
        _;
    }

    /**
     * @notice checks that token is avaliable
     * @param _token address of the ERC20 token
     */
    modifier isTokenAvaliable(address _token) {
        address token;
        address[] memory avaliableTokens = tokens;
        uint256 tokensLength = avaliableTokens.length;

        unchecked {
            for (uint256 i; i < tokensLength; i++) {
                if (_token == avaliableTokens[i]) {
                    token = _token;
                    break;
                }
            }
        }

        if (token == address(0)) revert CrowdFundHard__TokenIsNotAvaliable(_token);

        _;
    }

    /**
     * @notice checks that the amount is not zero
     * @param _amount the amount to check
     */
    modifier isNotZeroAmount(uint256 _amount) {
        if (_amount == 0) revert CrowdFundHard__ZeroAmount();
        _;
    }

    /**
     * @notice checks that user contribution is not zero
     * @param _id campaign id
     */
    modifier isUserContributionNotZero(uint256 _id) {
        address[] memory avaliableTokens = tokens;
        uint256 tokensLength = avaliableTokens.length;
        bool isZero = true;

        unchecked {
            for (uint256 i; i < tokensLength; i++) {
                if (contributions[_id][msg.sender][avaliableTokens[i]] > 0) {
                    isZero = false;
                    break;
                }
            }
        }

        if (isZero) revert CrowdFundHard__ZeroContribution();

        _;
    }

    /**
     * @param _tokens list of allowed token addresses
     */
    constructor(address[] memory _tokens) {
        uint256 tokensLength = _tokens.length;

        if (tokensLength == 0) revert CrowdFundHard__EmptyTokensArray();

        unchecked {
            for (uint256 i; i < tokensLength; i++) {
                if (_tokens[i] == address(0)) revert CrowdFundHard__ZeroAddress();
            }
        }

        tokens = _tokens;
    }

    /**
     * @notice createCampaign allows anyone to create a campaign
     * @param _goal amount of funds to be raised in USD
     * @param _duration the duration of the campaign in seconds
     */
    function createCampaign(uint256 _goal, uint256 _duration) external {
        if (_goal == 0) revert CrowdFundHard__ZeroCampaignGoal();
        if (_duration == 0) revert CrowdFundHard__ZeroCampaignDuration();

        Campaign memory campaign = Campaign({
            goal: _goal,
            timeEnd: block.timestamp + _duration,
            creator: msg.sender,
            isWithdrawn: false
        });

        if (campaigns.length == 0) {
            campaigns.push();
        }

        campaigns.push(campaign);
    }

    /**
     * @dev contribute allows anyone to contribute to a campaign
     * @param _id the id of the campaign
     * @param _token the address of the ERC20 token to contribute with
     * @param _amount the amount of tokens to contribute
     */
    function contribute(
        uint256 _id,
        address _token,
        uint256 _amount
    )
        external
        isCampaignExists(_id)
        isCampaignNotEnded(_id)
        isAddressNotZero(_token)
        isTokenAvaliable(_token)
        isNotZeroAmount(_amount)
    {
        if (campaigns[_id].creator == msg.sender)
            revert CrowdFundHard__TryingToContributeByCreator();

        if (!MyToken(_token).transferFrom(msg.sender, address(this), _amount))
            revert CrowdFundEasy__TokenTransactionFailed(msg.sender, address(this), _amount);

        contributions[_id][msg.sender][_token] += _amount;
        contributionsAmount[_id][_token] += _amount;
    }

    /**
     * @dev cancelContribution allows anyone to cancel their contribution
     * @param _id the id of the campaign
     */
    function cancelContribution(
        uint256 _id
    ) external isCampaignExists(_id) isCampaignNotEnded(_id) isUserContributionNotZero(_id) {
        _refundContributor(_id, msg.sender);
    }

    /**
     * @notice withdrawFunds allows the creator of the campaign to withdraw the funds
     * @param _id the id of the campaign
     */

    function withdrawFunds(
        uint256 _id
    ) external isCampaignExists(_id) isCampaignEnded(_id) isCampaignNotWithdrawn(_id) {
        Campaign memory campaign = campaigns[_id];

        if (campaign.creator != msg.sender)
            revert CrowdFundHard__NotCampaignCreator(campaign.creator);

        address[] memory avaliableTokens = tokens;
        uint256 tokensLength = avaliableTokens.length;

        uint256 contributionsAmountInUsd = _getContributionsAmountInUsd(_id);

        if (contributionsAmountInUsd < campaign.goal)
            revert CrowdFundHard__CampaignGoalDoesNotReached(
                campaign.goal,
                contributionsAmountInUsd
            );

        campaigns[_id].isWithdrawn = true;

        unchecked {
            for (uint256 i; i < tokensLength; i++) {
                if (
                    !MyToken(avaliableTokens[i]).transfer(
                        campaign.creator,
                        contributionsAmount[_id][avaliableTokens[i]]
                    )
                )
                    revert CrowdFundEasy__TokenTransactionFailed(
                        msg.sender,
                        address(this),
                        contributionsAmount[_id][avaliableTokens[i]]
                    );
            }
        }
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
        isUserContributionNotZero(_id)
    {
        Campaign memory campaign = campaigns[_id];
        uint256 contributionsAmountInUsd = _getContributionsAmountInUsd(_id);

        if (contributionsAmountInUsd >= campaign.goal)
            revert CrowdFundHard__CampaignGoalReached(campaign.goal, contributionsAmountInUsd);

        _refundContributor(_id, msg.sender);
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
        isCampaignNotWithdrawn(_id)
        returns (uint256 remainingTime, uint256 goal, uint256 totalFunds)
    {
        Campaign memory campaign = campaigns[_id];

        remainingTime = block.timestamp > campaign.timeEnd ? 0 : campaign.timeEnd - block.timestamp;
        goal = campaign.goal;

        address[] memory avaliableTokens = tokens;
        uint256 tokensLength = avaliableTokens.length;

        unchecked {
            for (uint256 i; i < tokensLength; i++) {
                totalFunds += _getTokenAmountInUsd(
                    avaliableTokens[i],
                    contributionsAmount[_id][avaliableTokens[i]]
                );
            }
        }
    }

    /**
     * @notice getToken returns the address of the ERC20 token
     * @return address of the ERC20 token
     */
    function getTokens() external view returns (address[] memory) {
        return tokens;
    }

    /**
     * @notice getCampaigns returns an array of all campaigns
     * @return list of all campaigns
     */
    function getCampaigns() external view returns (Campaign[] memory) {
        return campaigns;
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
        uint256 contributionAmount;

        address[] memory avaliableTokens = tokens;
        uint256 tokensLength = avaliableTokens.length;
        uint256 contributionTokenAmount;

        unchecked {
            for (uint256 i; i < tokensLength; i++) {
                contributionTokenAmount = contributions[_id][_contributor][avaliableTokens[i]];

                if (contributionTokenAmount == 0) continue;

                contributionAmount += _getTokenAmountInUsd(
                    avaliableTokens[i],
                    contributionTokenAmount
                );
            }
        }

        return contributionAmount;
    }

    /**
     * @dev _refundContributor refunds the contributor in all tokens they contributed in
     * @param _id the id of the campaign
     * @param contributor the address of the contributor
     */
    function _refundContributor(uint256 _id, address contributor) private {
        address[] memory avaliableTokens = tokens;
        uint256 tokensLength = avaliableTokens.length;

        uint256 contributionTokenAmount;

        unchecked {
            for (uint256 i; i < tokensLength; i++) {
                contributionTokenAmount = contributions[_id][contributor][avaliableTokens[i]];
                if (contributionTokenAmount == 0) continue;

                contributions[_id][contributor][avaliableTokens[i]] = 0;
                contributionsAmount[_id][avaliableTokens[i]] -= contributionTokenAmount;

                if (!MyToken(avaliableTokens[i]).transfer(contributor, contributionTokenAmount))
                    revert CrowdFundEasy__TokenTransactionFailed(
                        address(this),
                        contributor,
                        contributionTokenAmount
                    );
            }
        }
    }

    /**
     * @dev getTokenAmountInUsd returns the USD value of a given amount of tokens
     * @param _amount the amount of tokens
     * @return the USD value of the amount of tokens
     */
    function _getTokenAmountInUsd(
        address _token,
        uint256 _amount
    ) private view isAddressNotZero(_token) isTokenAvaliable(_token) returns (uint256) {
        if (_amount == 0) return 0;

        uint256 rate = MyToken(_token).getTokenPriceInUSD();
        return (rate * _amount) / 1e18;
    }

    function _getContributionsAmountInUsd(
        uint256 _id
    ) private view returns (uint256 contributionsAmountInUsd) {
        address[] memory avaliableTokens = tokens;
        uint256 tokensLength = avaliableTokens.length;
        unchecked {
            for (uint256 i; i < tokensLength; i++) {
                contributionsAmountInUsd += _getTokenAmountInUsd(
                    avaliableTokens[i],
                    contributionsAmount[_id][avaliableTokens[i]]
                );
            }
        }
    }
}
