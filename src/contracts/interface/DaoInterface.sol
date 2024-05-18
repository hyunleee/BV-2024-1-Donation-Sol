// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface DaoInterface {
    function approveDaoMembership(address _user) external;
    function rejectDaoMembership(address _user) external;
    function registerUser(address _user) external;
    function startVote(uint256 _campaignId) external;
    function finalizeVote(uint256 _campaignId) external returns (bool);
    function unregisterUser(address _user) external;
    function getCampaignGoal(uint256 _id) external view returns (uint256);
}
