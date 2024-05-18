// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface DaoTokenInterface {
    function transfer(address recipient, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function mint(address to, uint256 amount) external;
}
