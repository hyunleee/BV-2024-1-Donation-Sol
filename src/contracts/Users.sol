// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./Dao.sol";
import "./DaoToken.sol";

contract Users {
    Dao public dao;
    DaoToken public daoToken;
    mapping(address => bool) public pendingRequests;
    mapping(address => bool) public approvedUsers;
    uint256 public exchangeRate = 0.001 ether; // 0.001 ETH당 100 DAO 토큰

    event DaoMembershipRequested(address indexed user);
    event DaoMembershipApproved(address indexed user);
    event DaoMembershipRejected(address indexed user);
    event EthExchangedForDao(address indexed user, uint256 ethAmount, uint256 daoAmount);

    constructor(address _daoAddress, address _daoTokenAddress) {
        dao = Dao(_daoAddress);
        daoToken = DaoToken(_daoTokenAddress);
    }

    function requestDaoMembership() external {
        require(!pendingRequests[msg.sender], "Request already pending");
        require(!approvedUsers[msg.sender], "User already approved");
        pendingRequests[msg.sender] = true;
        emit DaoMembershipRequested(msg.sender);
    }

    function approveDaoMembership(address _user) external {
        require(msg.sender == address(dao), "Only Dao can approve");
        require(pendingRequests[_user], "No pending request");
        pendingRequests[_user] = false;
        approvedUsers[_user] = true;
        dao.registerUser(_user);
        emit DaoMembershipApproved(_user);
    }

    function rejectDaoMembership(address _user) external {
        require(msg.sender == address(dao), "Only Dao can reject");
        require(pendingRequests[_user], "No pending request");
        pendingRequests[_user] = false;
        emit DaoMembershipRejected(_user);
    }

    function exchange() external payable {
        require(msg.value > 0, "Must send ETH to exchange");
        uint256 daoAmount = (msg.value * 100) / exchangeRate; // 0.001 ETH → 100 DAO
        require(daoToken.balanceOf(address(this)) >= daoAmount, "Not enough DAO tokens in contract");

        daoToken.transfer(msg.sender, daoAmount);
        emit EthExchangedForDao(msg.sender, msg.value, daoAmount);
    }

    receive() external payable {}
}
