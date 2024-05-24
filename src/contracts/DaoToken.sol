// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./common/token/ERC20.sol";
import "hardhat/console.sol";

contract DaoToken is ERC20 {
    address public admin;

    uint256 public constant ETH_TO_DAO_RATE = 100; // 0.001EHE => 100 DAO
    uint256 public constant ETH_AMOUNT = 0.001 ether;

    event TokensPurchased(address indexed buyer, uint256 amountOfETH, uint256 amountOfTokens);
    event TokensWithdrawn(address indexed target, uint256 amountOfETH);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can can mint tokens");
        _;
    }

    constructor() ERC20("DaoToken", "DAO") {
        admin = msg.sender;

        //초기 공급량을 배포자에게 할당
        _mint(msg.sender, 1000 * 10 ** decimals());
    }

    //mint는 관리자만 가능하도록 설정
    function mint(address to, uint256 amount) public onlyAdmin {
        _mint(to, amount);
    }

    function buyTokens() external payable {
        require(msg.value == ETH_AMOUNT, "You must send exactly 0.001 ETH");

        uint256 tokensToMint = ETH_TO_DAO_RATE * 10 ** decimals();
        _mint(msg.sender, tokensToMint);

        emit TokensPurchased(msg.sender, msg.value, tokensToMint);
    }

    function withdrawETH(address payable _target, uint256 _amount) external onlyAdmin {
        require(address(this).balance >= _amount, "Insufficient contract balance");

        _target.transfer(_amount);

        emit TokensWithdrawn(_target, _amount);
    }

    // 컨트랙트의 잔액 조회 함수 (테스트 코드에 활용하기 위해서 추가함)
    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
