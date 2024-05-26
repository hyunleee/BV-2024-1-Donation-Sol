// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./interface/DaoTokenInterface.sol";
import "./interface/DaoInterface.sol";

contract Donation {
    address public admin;
    uint256 public count;

    mapping(uint256 => Campaign) public campaigns; // id => Campaign
    mapping(uint256 => mapping(address => uint256)) public pledgedAmount;
    mapping(uint256 => bool) public isEnded; //캠페인 종료 여부 (목표 금액 도달 or 시간 종료 시 true)

    DaoInterface public dao;
    DaoTokenInterface public daoToken;

    event Launch(
        uint256 id,
        address indexed creator,
        address target,
        string title,
        string description,
        uint256 goal,
        uint32 startAt,
        uint32 endAt,
        bool isEnded
    );
    event Cancel(uint256 id, bool isEnded);
    event Pledge(uint256 indexed id, address indexed caller, uint256 amount, uint256 totalAmount);
    event Unpledge(uint256 indexed id, address indexed caller, uint256 amount, uint256 totalAmount);
    event Claim(uint256 id, bool claimed);
    event Refund(uint256 id, address indexed caller, uint256 amount);

    struct Campaign {
        address creator;
        address target;
        string title;
        string description;
        uint256 goal;
        uint256 pledged;
        uint32 startAt;
        uint32 endAt;
        bool claimed;
    }

    constructor(address daoTokenAddr) {
        admin = msg.sender;
        daoToken = DaoTokenInterface(daoTokenAddr);
    }

    function setDaoAddress(address _daoAddr) external onlyAdmin {
        dao = DaoInterface(_daoAddr);
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can perform this action");
        _;
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

        isEnded[count] = false;

        emit Launch(count, msg.sender, _target, _title, _description, _goal, _startAt, _endAt, isEnded[count]);
    }

    function cancel(uint256 _id) external {
        Campaign memory campaign = campaigns[_id];
        require(msg.sender == campaign.creator, "not creator");
        require(block.timestamp < campaign.startAt, "started");

        delete campaigns[_id];
        isEnded[_id] = true;
        emit Cancel(_id, isEnded[_id]);
    }

    function pledge(uint256 _id, uint256 _amount) external {
        Campaign storage campaign = campaigns[_id];
        require(block.timestamp >= campaign.startAt, "not started");
        require(isEnded[_id] == false, "ended");
        require(_amount > 0, "Amount must be greater than zero");

        campaign.pledged += _amount;
        pledgedAmount[_id][msg.sender] += _amount;
        require(daoToken.transferFrom(msg.sender, address(this), _amount), "Transfer failed");

        if (campaign.pledged >= campaign.goal) {
            isEnded[_id] = true;
            dao.startVote(_id); // 기부 목표 달성 시 투표 시작
        }

        emit Pledge(_id, msg.sender, _amount, campaign.pledged);
    }

    function unpledge(uint256 _id, uint256 _amount) external {
        Campaign storage campaign = campaigns[_id];
        require(_amount > 0, "Amount must be greater than zero");
        require(isEnded[_id] == false, "ended");

        campaign.pledged -= _amount;
        pledgedAmount[_id][msg.sender] -= _amount;
        require(daoToken.transfer(msg.sender, _amount), "Transfer failed");

        emit Unpledge(_id, msg.sender, _amount, campaign.pledged);
    }

    function claim(uint256 _id) external {
        Campaign storage campaign = campaigns[_id];
        require(campaign.creator == msg.sender, "not creator");
        require(isEnded[_id] == true, "not ended");
        require(!campaign.claimed, "claimed");

        require(daoToken.transfer(campaign.target, campaign.pledged), "Transfer failed");
        campaign.claimed = true;

        emit Claim(_id, campaign.claimed);
    }

    function refund(uint256 _id) external {
        require(isEnded[_id] == false, "ended");

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

    // isEnded: true => 캠페인 종료, false => 캠페인 진행중
    function getIsEnded(uint256 _id) external returns (bool) {
        if (campaigns[_id].pledged >= campaigns[_id].goal) {
            isEnded[_id] = true;
        } else if (block.timestamp > campaigns[_id].endAt) {
            isEnded[_id] = true;
        }

        return isEnded[_id];
    }

    function getCampaignCreator(uint256 _id) external view returns (address) {
        return campaigns[_id].creator;
    }

    function getCampaignGoal(uint256 _id) external view returns (uint256) {
        return campaigns[_id].goal;
    }

    function getCampaignTotalAmount(uint256 _id) external view returns (uint256) {
        return campaigns[_id].pledged;
    }
}
