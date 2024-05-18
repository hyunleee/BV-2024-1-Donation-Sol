// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./interface/DaoTokenInterface.sol";
import "./interface/UsersInterface.sol";
import "./interface/DaoInterface.sol";
import "./interface/DonationInterface.sol";

contract Dao is DaoInterface {
    DaoTokenInterface public daoToken;
    UsersInterface public usersContract;
    DonationInterface public donationContract;
    address public admin;
    uint256 public voteDuration;

    event VoteStarted(uint256 indexed campaignId, uint256 endTime);
    event Voted(uint256 indexed campaignId, address indexed voter, bool vote);
    event VoteEnded(uint256 indexed campaignId, bool approved);
    event DaoMembershipApproved(address indexed user);
    event DaoMembershipRejected(address indexed user);

    struct VoteInfo {
        uint256 startTime;
        uint256 endTime;
        uint256 yesVotes;
        uint256 noVotes;
        address[] voters;
        mapping(address => bool) hasVoted;
    }
    mapping(uint256 => VoteInfo) public votes;

    constructor(address _daoToken, address _donationContract, address _usersContract, uint256 _voteDuration) {
        admin = msg.sender;
        daoToken = DaoTokenInterface(_daoToken);
        donationContract = DonationInterface(_donationContract);
        usersContract = UsersInterface(_usersContract);
        voteDuration = _voteDuration;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only the admin can perform this action");
        _;
    }

    modifier onlyDaoMember() {
        require(usersContract.isApprovedUser(msg.sender), "Only DAO members can perform this action");
        _;
    }

    // Dao membership approval and rejection
    function approveDaoMembership(address _user) external override onlyAdmin {
        usersContract.approveDaoMembership(_user);
        emit DaoMembershipApproved(_user);
    }

    function rejectDaoMembership(address _user) external override onlyAdmin {
        usersContract.rejectDaoMembership(_user);
        emit DaoMembershipRejected(_user);
    }

    // Voting functions
    function startVote(uint256 _campaignId) external override onlyDaoMember {
        uint256 goal = donationContract.getCampaignGoal(_campaignId);
        require(goal > 0, "Campaign does not exist");
        require(votes[_campaignId].startTime == 0, "Vote already started");

        uint256 endTime = block.timestamp + voteDuration;

        VoteInfo storage voteInfo = votes[_campaignId];

        voteInfo.startTime = block.timestamp;
        voteInfo.endTime = endTime;
        voteInfo.yesVotes = 0;
        voteInfo.noVotes = 0;

        emit VoteStarted(_campaignId, endTime);
    }

    function vote(uint256 _campaignId, bool _support) external onlyDaoMember returns (bool) {
        VoteInfo storage voteInfo = votes[_campaignId];
        require(block.timestamp >= voteInfo.startTime, "Vote not started");
        require(block.timestamp <= voteInfo.endTime, "Vote ended");
        require(!voteInfo.hasVoted[msg.sender], "Already voted");

        voteInfo.hasVoted[msg.sender] = true;

        if (_support) {
            voteInfo.yesVotes += daoToken.balanceOf(msg.sender);
        } else {
            voteInfo.noVotes += daoToken.balanceOf(msg.sender);
        }

        emit Voted(_campaignId, msg.sender, _support);

        if (block.timestamp >= voteInfo.endTime) {
            return finalizeVote(_campaignId);
        }

        return false;
    }

    function finalizeVote(uint256 _campaignId) public override returns (bool) {
        VoteInfo storage voteInfo = votes[_campaignId];
        require(block.timestamp > voteInfo.endTime, "Vote not ended");

        uint256 totalVotes = voteInfo.yesVotes + voteInfo.noVotes;
        bool approved = voteInfo.yesVotes * 100 >= totalVotes * 70;

        emit VoteEnded(_campaignId, approved);

        return approved;
    }

    // User registration functions
    function registerUser(address _user) external override {
        usersContract.registerUser(_user);
    }

    function unregisterUser(address _user) public override {
        usersContract.unregisterUser(_user);
    }

    function requestUnregister() external {
        unregisterUser(msg.sender);
    }

    function hasVoted(uint256 _campaignId, address _voter) external view returns (bool) {
        return votes[_campaignId].hasVoted[_voter];
    }

    function getCampaignGoal(uint256 _id) external view override returns (uint256) {
        return donationContract.getCampaignGoal(_id);
    }

    function isDaoMember(address _user) public view returns (bool) {
        return usersContract.isApprovedUser(_user);
    }
}
