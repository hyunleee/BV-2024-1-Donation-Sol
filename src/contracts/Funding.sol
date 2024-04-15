pragma solidity ^0.8.19;

import "hardhat/console.sol";
import "./common/token/IERC20.sol";

contract Funding {
    address public donationAdmin;
    IERC20 public daoToken;

    constructor(address daoTokenAddr) {
        donationAdmin = msg.sender;
        daoToken = IERC20(daoTokenAddr);

        // daoTokenAddr를 바로 daoToken으로 사용
        // daoToken.mint(address(this), 1000000 * 10**18);
    }

    function setDaoToken(address newDaoTokenAddr) external {
        require(msg.sender == donationAdmin, "Access denied");
        daoToken = IERC20(newDaoTokenAddr);
    }

    function donate(uint256 donationAmount) external {
        require(daoToken.balanceOf(msg.sender) >= donationAmount, "Not enough tokens");
        // 기부 기능 작성 예정
    }
}
