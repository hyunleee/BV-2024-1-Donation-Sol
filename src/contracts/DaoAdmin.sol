pragma solidity ^0.8.19;

import "./DaoToken.sol";

contract DaoAdmin {
    address public admin;
    DaoToken public tokenContract;

    constructor(DaoToken _tokenContract) {
        admin = msg.sender; // 최초 배포자를 관리자로 설정
        tokenContract = _tokenContract;
    }

    // 토큰을 민트하는 함수
    function mintTokens(address to, uint256 amount) public {
        require(msg.sender == admin, "Only the admin can mint tokens");
        tokenContract.mint(to, amount);
    }
}
