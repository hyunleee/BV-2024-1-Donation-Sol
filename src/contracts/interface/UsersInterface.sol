// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface UsersInterface {
    function approveDaoMembership(address _user) external;
    function rejectDaoMembership(address _user) external;
    function registerUser(address _user) external;
    function unregisterUser(address _user) external; // 이 줄을 추가합니다.
    function requestDaoMembership() external;
    function exchange() external payable;
    function setDaoAddress(address _daoAddress) external;
    function isApprovedUser(address _user) external view returns (bool);
}
