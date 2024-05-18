// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./interface/DaoTokenInterface.sol";
import "./interface/DaoInterface.sol";

contract Donation {
    address public donationAdmin;
    DaoInterface public dao;
    DaoTokenInterface public daoToken;

    event Launch(uint256 id, address indexed creator, address target, uint256 goal, uint32 startAt, uint32 endAt);
    event Cancel(uint256 id);
    event Pledge(uint256 indexed id, address indexed caller, uint256 amount);
    event Unpledge(uint256 indexed id, address indexed caller, uint256 amount);
    event Claim(uint256 id);
    event Refund(uint256 id, address indexed caller, uint256 amount);
    event ClaimRequested(uint256 id);

    struct Campaign {
        address creator;
        address target;
        uint256 goal;
        uint256 pledged;
        uint32 startAt;
        uint32 endAt;
        bool claimed;
    }

    uint256 public count;
    mapping(uint256 => Campaign) public campaigns;
    mapping(uint256 => mapping(address => uint256)) public pledgedAmount;

    constructor(address daoTokenAddr, address daoAddress) {
        donationAdmin = msg.sender;
        daoToken = DaoTokenInterface(daoTokenAddr);
        dao = DaoInterface(daoAddress);
    }

    function launch(address _target, uint256 _goal, uint32 _startAt, uint32 _endAt) external {
        require(_startAt >= block.timestamp, "start at < now");
        require(_endAt >= _startAt, "end at < start at");
        require(_endAt <= block.timestamp + 90 days, "end at > max duration");

        count += 1;
        campaigns[count] = Campaign({
            creator: msg.sender,
            target: _target,
            goal: _goal,
            pledged: 0,
            startAt: _startAt,
            endAt: _endAt,
            claimed: false
        });

        emit Launch(count, msg.sender, _target, _goal, _startAt, _endAt);
    }

    function cancel(uint256 _id) external {
        Campaign memory campaign = campaigns[_id];
        require(campaign.creator == msg.sender, "not creator");
        require(block.timestamp < campaign.startAt, "started");

        delete campaigns[_id];
        emit Cancel(_id);
    }

    function pledge(uint256 _id, uint256 _amount) external {
        Campaign storage campaign = campaigns[_id];
        require(block.timestamp >= campaign.startAt, "not started");
        require(block.timestamp <= campaign.endAt, "ended");

        campaign.pledged += _amount;
        pledgedAmount[_id][msg.sender] += _amount;
        require(daoToken.transferFrom(msg.sender, address(this), _amount), "Transfer failed");

        if (campaign.pledged >= campaign.goal) {
            dao.startVote(_id); // 기부 목표 달성 시 투표 시작
        }

        emit Pledge(_id, msg.sender, _amount);
    }

    function unpledge(uint256 _id, uint256 _amount) external {
        Campaign storage campaign = campaigns[_id];
        require(block.timestamp <= campaign.endAt, "ended");

        campaign.pledged -= _amount;
        pledgedAmount[_id][msg.sender] -= _amount;
        require(daoToken.transfer(msg.sender, _amount), "Transfer failed");

        emit Unpledge(_id, msg.sender, _amount);
    }

    function claim(uint256 _id) external {
        Campaign storage campaign = campaigns[_id];
        require(campaign.creator == msg.sender, "not creator");
        require(block.timestamp > campaign.endAt, "not ended");
        require(campaign.pledged >= campaign.goal, "pledged < goal");
        require(!campaign.claimed, "claimed");

        campaign.claimed = true;

        emit ClaimRequested(_id);
    }

    function finalizeClaim(uint256 _id) external {
        require(msg.sender == address(dao), "Only DAO can finalize the claim");
        Campaign storage campaign = campaigns[_id];
        require(campaign.claimed, "Claim not requested");

        require(daoToken.transfer(campaign.target, campaign.pledged), "Transfer failed");

        emit Claim(_id);
    }

    function refund(uint256 _id) external {
        Campaign memory campaign = campaigns[_id];
        require(block.timestamp > campaign.endAt, "not ended");
        require(campaign.pledged < campaign.goal, "pledged >= goal");

        uint256 bal = pledgedAmount[_id][msg.sender];
        pledgedAmount[_id][msg.sender] = 0;
        require(daoToken.transfer(msg.sender, bal), "Transfer failed");

        emit Refund(_id, msg.sender, bal);
    }

    function getCampaign(
        uint256 _id
    )
        external
        view
        returns (
            address creator,
            address target,
            uint256 goal,
            uint256 pledged,
            uint32 startAt,
            uint32 endAt,
            bool claimed
        )
    {
        Campaign storage campaign = campaigns[_id];
        return (
            campaign.creator,
            campaign.target,
            campaign.goal,
            campaign.pledged,
            campaign.startAt,
            campaign.endAt,
            campaign.claimed
        );
    }

    function getCampaignGoal(uint256 _id) external view returns (uint256) {
        return campaigns[_id].goal;
    }
}
