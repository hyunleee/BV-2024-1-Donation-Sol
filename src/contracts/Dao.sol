// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./interface/DaoInterface.sol";
import "./interface/DonationInterface.sol";

contract Dao is DaoInterface {
    address public admin;
    address[] public daoMemberList;

    mapping(address => bool) public hasVoted;
    mapping(address => bool) public isDaoMember;

    mapping(uint256 => uint256) public voteCountYes;
    mapping(uint256 => uint256) public voteCountNo;

    mapping(uint256 => bool) public voteInProgress;

    MembershipRequest[] public membershipRequests;

    DonationInterface public donation;

    event VoteStarted(uint256 campaignId, uint256 goal, uint256 totalAmount);
    event VoteReady(uint256 campaignId, uint256 voteCountYes, uint256 voteCountNo, bool voteInProgress);
    event Voted(uint256 campaignId, address voter, bool agree);

    event VoteEnded_approve(uint256 campaignId, uint256 agreePercentage, string message);
    event VoteEnded_reject(uint256 campaignId, uint256 agreePercentage, string message);

    event DaoMembershipRequested(address indexed user, string message);
    event RejectDaoMembershipRequested(address indexed user, string message);

    event DaoMembershipApproved(address indexed user, bool isDaoMember, string message);
    event DaoMembershipRejected(address indexed user, bool isDaoMember, string message);

    constructor(address _donation) {
        admin = msg.sender;
        donation = DonationInterface(_donation);
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can perform this action");
        _;
    }

    modifier onlyDaoMember() {
        require(isDaoMember[msg.sender], "Only DAO members can perform this action");
        _;
    }

    function startVote(uint256 _campaignId) external {
        uint256 goal = donation.getCampaignGoal(_campaignId);
        uint256 totalAmount = donation.getCampaignTotalAmount(_campaignId);
        require(!voteInProgress[_campaignId], "A vote is already in progress for this campaign.");

        emit VoteStarted(_campaignId, goal, totalAmount);

        for (uint i = 0; i < daoMemberList.length; i++) {
            address voter = daoMemberList[i];
            hasVoted[voter] = false; //모든 다오 멤버가 다시 투표할 수 있는 상태로 만들어 줌!!
        }
        voteCountYes[_campaignId] = 0;
        voteCountNo[_campaignId] = 0;
        voteInProgress[_campaignId] = true;

        emit VoteReady(_campaignId, voteCountYes[_campaignId], voteCountNo[_campaignId], voteInProgress[_campaignId]);
    }
    function vote(uint256 _campaignId, bool _agree) public onlyDaoMember {
        require(voteInProgress[_campaignId], "No vote in progress for this campaign.");
        require(!hasVoted[msg.sender], "You have already voted.");

        hasVoted[msg.sender] = true;

        if (_agree) {
            voteCountYes[_campaignId] += 1;
        } else {
            voteCountNo[_campaignId] += 1;
        }

        emit Voted(_campaignId, msg.sender, _agree);

        if (allMembersVoted()) {
            voteEnd(_campaignId);
        }
    }

    function allMembersVoted() internal view returns (bool) {
        for (uint i = 0; i < daoMemberList.length; i++) {
            if (!hasVoted[daoMemberList[i]]) {
                return false;
            }
        }
        return true;
    }

    function voteEnd(uint256 _campaignId) internal {
        uint256 totalVotes = voteCountYes[_campaignId] + voteCountNo[_campaignId];
        uint256 agreePercentage = (voteCountYes[_campaignId] * 100) / totalVotes;

        voteInProgress[_campaignId] = false;

        if (agreePercentage >= 70) {
            // 캠페인 생성자만 claim을 호출할 수 있도록 수정
            address creator = donation.getCampaignCreator(_campaignId);
            (bool success, ) = creator.call(abi.encodeWithSignature("claim(uint256)", _campaignId));
            require(success, "Claim failed");
            emit VoteEnded_approve(_campaignId, agreePercentage, "The campaign has been approved for claim.");
        } else {
            emit VoteEnded_reject(_campaignId, agreePercentage, "The campaign was declined for claim.");
        }
    }

    function requestDaoMembership() external {
        require(!isDaoMember[msg.sender], "User is already a DAO member");

        membershipRequests.push(MembershipRequest(msg.sender, true));

        emit DaoMembershipRequested(msg.sender, "User has requested DAO membership");
    }

    function requestRejectDaoMembership() external {
        require(isDaoMember[msg.sender], "User is not a DAO member");

        membershipRequests.push(MembershipRequest(msg.sender, false));

        emit RejectDaoMembershipRequested(msg.sender, "User has requested to leave DAO membership");
    }

    function approveDaoMembership(address _user, bool _approve) external onlyAdmin {
        if (_approve) {
            daoMemberList.push(_user);
            isDaoMember[_user] = true;
            emit DaoMembershipApproved(_user, isDaoMember[_user], "User has been approved as a DAO member");
        } else {
            emit DaoMembershipRejected(_user, isDaoMember[_user], "User has been rejected as a DAO member");
        }

        _removeMembershipRequest(_user);
    }

    function rejectDaoMembership(address _user) external onlyAdmin {
        require(isDaoMember[_user], "User is not a DAO member");
        for (uint i = 0; i < daoMemberList.length; i++) {
            if (daoMemberList[i] == _user) {
                daoMemberList[i] = daoMemberList[daoMemberList.length - 1];
                daoMemberList.pop();
                break;
            }
        }
        isDaoMember[_user] = false;
        emit DaoMembershipRejected(_user, isDaoMember[_user], "User has been rejected as a DAO member");

        _removeMembershipRequest(_user);
    }

    function _removeMembershipRequest(address _user) internal {
        for (uint i = 0; i < membershipRequests.length; i++) {
            if (membershipRequests[i].user == _user) {
                membershipRequests[i] = membershipRequests[membershipRequests.length - 1];
                membershipRequests.pop();
                break;
            }
        }
    }

    function getMembershipRequests() external view onlyAdmin returns (MembershipRequest[] memory) {
        return membershipRequests;
    }

    function getDaoList() external view onlyAdmin returns (address[] memory) {
        return daoMemberList;
    }
}
