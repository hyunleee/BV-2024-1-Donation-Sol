// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./interface/DaoTokenInterface.sol";
import "./interface/DaoInterface.sol";
import "./interface/DonationInterface.sol";

contract Donation is DonationInterface {
    address public admin;
    uint256 public count;

    mapping(uint256 => Campaign) public campaigns; // id => Campaign
    mapping(uint256 => mapping(address => uint256)) public pledgedUserToAmount;

    DaoInterface public dao;
    DaoTokenInterface public daoToken;

    constructor(address daoTokenAddr) {
        admin = msg.sender;
        daoToken = DaoTokenInterface(daoTokenAddr);
    }

    function setDaoAddress(DaoInterface _dao) external onlyAdmin {
        dao = _dao;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can perform this action");
        _;
    }

    modifier onlyDao() {
        require(msg.sender == address(dao), "Only DAO contract can perform this action");
        _;
    }

    function getIsEnded(uint256 _campaignId) public view returns (bool) {
        Campaign memory campaign = campaigns[_campaignId];
        return block.timestamp >= campaign.endAt || campaign.pledged >= campaign.goal;
    }

    function launch(
        address _target,
        string memory _title,
        string memory _description,
        uint256 _goal,
        uint32 _startAt,
        uint32 _endAt
    ) external {
        require(_startAt >= block.timestamp, "start at < now");
        require(_endAt >= _startAt, "end at < start at");
        require(_endAt <= block.timestamp + 90 days, "end at > max duration");

        count += 1;
        campaigns[count] = Campaign({
            creator: msg.sender,
            target: _target,
            title: _title,
            description: _description,
            goal: _goal,
            pledged: 0,
            startAt: _startAt,
            endAt: _endAt,
            claimed: false
        });

        emit Launch(count, campaigns[count]);
    }

    function cancel(uint256 _campaignId) external {
        Campaign memory campaign = campaigns[_campaignId];
        require(msg.sender == campaign.creator, "not creator");
        require(block.timestamp < campaign.startAt, "started");

        delete campaigns[_campaignId];
        emit Cancel(_campaignId);
    }

    function pledge(uint256 _campaignId, uint256 _amount) external {
        Campaign storage campaign = campaigns[_campaignId];
        require(block.timestamp >= campaign.startAt, "not started");
        require(!getIsEnded(_campaignId), "Campaign ended");
        require(_amount > 0, "Amount must be greater than zero");
        require(dao != DaoInterface(address(0)), "Dao address not set");

        campaign.pledged += _amount;
        pledgedUserToAmount[_campaignId][msg.sender] += _amount;
        daoToken.transferFrom(msg.sender, address(this), _amount);

        if (campaign.pledged >= campaign.goal) {
            dao.startVote(_campaignId); // 기부 목표 달성 시 투표 시작
        }

        emit Pledge(_campaignId, msg.sender, _amount, campaign.pledged);
    }

    function unpledge(uint256 _campaignId, uint256 _amount) external {
        Campaign storage campaign = campaigns[_campaignId];
        require(_amount > 0, "Amount must be greater than zero");
        require(!getIsEnded(_campaignId), "Campaign ended");

        campaign.pledged -= _amount;
        pledgedUserToAmount[_campaignId][msg.sender] -= _amount;
        daoToken.transfer(msg.sender, _amount);

        emit Unpledge(_campaignId, msg.sender, _amount, campaign.pledged);
    }

    function claim(uint256 _campaignId) external onlyDao {
        require(getIsEnded(_campaignId), "Campaign not ended");

        Campaign storage campaign = campaigns[_campaignId];
        require(!campaign.claimed, "claimed");

        daoToken.transfer(campaign.target, campaign.pledged);
        campaign.claimed = true;

        emit Claim(_campaignId, campaign.claimed, campaign.pledged);
    }

    function refund(uint256 _campaignId) external {
        require(getIsEnded(_campaignId), "Campaign not ended");

        uint256 bal = pledgedUserToAmount[_campaignId][msg.sender];
        pledgedUserToAmount[_campaignId][msg.sender] = 0;
        daoToken.transfer(msg.sender, bal);

        emit Refund(_campaignId, msg.sender, bal);
    }

    function getCampaign(uint256 _campaignId) external view returns (Campaign memory) {
        return campaigns[_campaignId];
    }

    function getCampaignCreator(uint256 _campaignId) external view returns (address) {
        return campaigns[_campaignId].creator;
    }

    function getCampaignGoal(uint256 _campaignId) external view returns (uint256) {
        return campaigns[_campaignId].goal;
    }

    function getCampaignTotalAmount(uint256 _campaignId) external view returns (uint256) {
        return campaigns[_campaignId].pledged;
    }
}
