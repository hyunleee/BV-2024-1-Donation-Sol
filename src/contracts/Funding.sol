pragma solidity ^0.8.19;

import "hardhat/console.sol";
import "./common/token/IERC20.sol";
import "./DaoToken.sol";

contract Funding {
    address public donationAdmin;
    IERC20 public daoToken;

    mapping(address => uint256) public pendingDonations;

    event DonationRequested(address indexed donor, uint256 amount);
    event DonationApproved(address indexed donor, uint256 amount);
    event DonationRejected(address indexed donor, uint256 amount);

    constructor(address daoTokenAddr) {
        donationAdmin = msg.sender;
        daoToken = IERC20(daoTokenAddr);
    }
    function setDaoToken(address newDaoTokenAddr) external {
        require(msg.sender == donationAdmin, "Access denied");
        daoToken = IERC20(newDaoTokenAddr);
    }

    function requestDonation(uint256 donationAmount) external {
        require(daoToken.balanceOf(msg.sender) >= donationAmount, "Not enough tokens");

        pendingDonations[msg.sender] = donationAmount;
        emit DonationRequested(msg.sender, donationAmount);
    }

    function approveDonation(address donor) external {
        require(msg.sender == donationAdmin, "Only admin can approve donations");

        uint256 donationAmount = pendingDonations[donor];
        require(donationAmount > 0, "No pending donation");

        daoToken.transferFrom(donor, address(this), donationAmount);
        delete pendingDonations[donor];

        emit DonationApproved(donor, donationAmount);
    }

    function rejectDonation(address donor) external {
        require(msg.sender == donationAdmin, "Only admin can reject donations");

        uint256 donationAmount = pendingDonations[donor];
        require(donationAmount > 0, "No pending donation");

        delete pendingDonations[donor];

        emit DonationRejected(donor, donationAmount);
    }
}
