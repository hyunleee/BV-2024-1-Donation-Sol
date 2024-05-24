// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface DaoInterface {
    struct MembershipRequest {
        address user;
        bool isJoinRequest; // true: 멤버십 승인요청, false: 멤버십 탈퇴 요청
    }

    //onlyDao
    function startVote(uint256 _campaignId) external;
    function vote(uint256 _campaignId, bool _agree) external;

    //onlyUsers
    function requestDaoMembership() external;
    function requestRejectDaoMembership() external;

    //onlyAdmin
    function approveDaoMembership(address _user, bool _approve) external;
    function rejectDaoMembership(address _user) external;

    function getMembershipRequests() external view returns (MembershipRequest[] memory);
    function getDaoList() external view returns (address[] memory);
}
