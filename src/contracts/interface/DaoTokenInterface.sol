// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface DaoTokenInterface {
    function transfer(address recipient, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function mint(address to, uint256 amount) external;
    function buyTokens() external view returns (uint256);
    function withdrawETH(address payable _target, uint256 _amount) external;
    function getContractBalance() external view returns (uint256);
}
