// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./interface/DaoTokenInterface.sol";
import "./interface/DaoInterface.sol";
import "./interface/UsersInterface.sol";

contract Users is UsersInterface {
    DaoTokenInterface public daoToken;
    DaoInterface public dao;
    address public admin;
    mapping(address => bool) public pendingRequests;
    mapping(address => bool) public approvedUsers;
    uint256 public exchangeRate = 0.001 ether; // 0.001 ETH당 100 DAO 토큰

    event DaoMembershipRequested(address indexed user);
    event DaoMembershipApproved(address indexed user);
    event DaoMembershipRejected(address indexed user);
    event EthExchangedForDao(address indexed user, uint256 ethAmount, uint256 daoAmount);

    constructor(address _daoAddress, address _daoTokenAddress) {
        admin = msg.sender;
        dao = DaoInterface(_daoAddress);
        daoToken = DaoTokenInterface(_daoTokenAddress);
    }

    function setDaoAddress(address _daoAddress) external {
        require(msg.sender == admin, "Only the admin can set the new DAO address");
        dao = DaoInterface(_daoAddress);
    }

    function requestDaoMembership() external {
        require(!pendingRequests[msg.sender], "Request already pending");
        require(!approvedUsers[msg.sender], "User already approved");
        pendingRequests[msg.sender] = true;
        emit DaoMembershipRequested(msg.sender);
    }

    function approveDaoMembership(address _user) external override {
        require(msg.sender == address(dao) || msg.sender == admin, "Only Dao or admin can approve");
        require(pendingRequests[_user], "No pending request");
        pendingRequests[_user] = false;
        approvedUsers[_user] = true;
        emit DaoMembershipApproved(_user);
    }

    function rejectDaoMembership(address _user) external override {
        require(msg.sender == address(dao) || msg.sender == admin, "Only Dao or admin can reject");
        require(pendingRequests[_user], "No pending request");
        pendingRequests[_user] = false;
        emit DaoMembershipRejected(_user);
    }

    function registerUser(address _user) external override {
        require(msg.sender == address(dao) || msg.sender == admin, "Only Dao or admin can register user");
        approvedUsers[_user] = true;
    }

    function unregisterUser(address _user) external override {
        // 이 함수 추가
        require(msg.sender == address(dao) || msg.sender == admin, "Only Dao or admin can unregister user");
        require(approvedUsers[_user], "User not approved");
        approvedUsers[_user] = false;
    }

    function exchange() external payable {
        require(msg.value > 0, "Must send ETH to exchange");
        uint256 daoAmount = (msg.value * 100) / exchangeRate; // 0.001 ETH → 100 DAO
        require(daoToken.balanceOf(address(this)) >= daoAmount, "Not enough DAO tokens in contract");

        daoToken.transfer(msg.sender, daoAmount);
        emit EthExchangedForDao(msg.sender, msg.value, daoAmount);
    }

    function isApprovedUser(address _user) external view override returns (bool) {
        return approvedUsers[_user];
    }

    receive() external payable {}
}
