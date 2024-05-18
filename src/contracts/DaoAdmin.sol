// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./DaoToken.sol";
import "./Users.sol";

contract DaoAdmin {
    address public admin;
    DaoToken public tokenContract;
    Users public usersContract;

    event DaoMembershipApproved(address indexed user);
    event DaoMembershipRejected(address indexed user);

    constructor(DaoToken _tokenContract, Users _usersContract) {
        admin = msg.sender; // 최초 배포자를 관리자로 설정
        tokenContract = _tokenContract;
        usersContract = _usersContract;
    }

    // Dao 회원 요청 수락
    function approveDaoMembership(address _user) external {
        require(msg.sender == admin, "Only the admin can approve");
        usersContract.approveDaoMembership(_user);
        emit DaoMembershipApproved(_user);
    }

    // Dao 회원 요청 거절
    function rejectDaoMembership(address _user) external {
        require(msg.sender == admin, "Only the admin can reject");
        usersContract.rejectDaoMembership(_user);
        emit DaoMembershipRejected(_user);
    }
}
