// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./DaoToken.sol";
import "./Donation.sol";

contract Dao {
    IERC20 public daoToken;
    address public donationContract;
    uint256 public voteDuration;

    event VoteStarted(uint256 indexed campaignId, uint256 endTime);
    event Voted(uint256 indexed campaignId, address indexed voter, bool vote);
    event VoteEnded(uint256 indexed campaignId, bool approved);
    event UserRegistered(address indexed user);
    event UserUnregistered(address indexed user);

    struct VoteInfo {
        uint256 startTime;
        uint256 endTime;
        uint256 yesVotes;
        uint256 noVotes;
        address[] voters;
        mapping(address => bool) hasVoted;
    }
    mapping(uint256 => VoteInfo) public votes;
    mapping(address => bool) public registeredUsers;

    constructor(address _daoToken, address _donationContract, uint256 _voteDuration) {
        daoToken = IERC20(_daoToken);
        donationContract = _donationContract;
        voteDuration = _voteDuration;
    }

    function startVote(uint256 _campaignId) external {
        (, , uint256 goal, , , , ) = Donation(donationContract).getCampaign(_campaignId);
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

    function vote(uint256 _campaignId, bool _support) external returns (bool) {
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

    function finalizeVote(uint256 _campaignId) internal returns (bool) {
        VoteInfo storage voteInfo = votes[_campaignId];
        require(block.timestamp > voteInfo.endTime, "Vote not ended");

        uint256 totalVotes = voteInfo.yesVotes + voteInfo.noVotes;
        bool approved = voteInfo.yesVotes * 100 >= totalVotes * 70;

        emit VoteEnded(_campaignId, approved);

        return approved;
    }

    function registerUser(address _user) external {
        require(!registeredUsers[_user], "User already registered");
        registeredUsers[_user] = true;
        emit UserRegistered(_user);
    }

    function unregisterUser(address _user) internal {
        require(registeredUsers[_user], "User not registered");
        registeredUsers[_user] = false;
        emit UserUnregistered(_user);
    }

    function requestUnregister() external {
        unregisterUser(msg.sender);
    }
}
