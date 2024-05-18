// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./common/token/ERC20.sol";
import "hardhat/console.sol";

contract DaoToken is ERC20 {
    address public owner;
    address public admin;

    constructor(string memory name, string memory symbol) ERC20(name, symbol) {
        owner = msg.sender;
        admin = msg.sender; // admin을 컨트랙트 생성자 호출자로 설정
    }

    function mint(address to, uint256 amount) public {
        require(msg.sender == admin, "Only the admin can mint tokens");
        _mint(to, amount);
    }
}
