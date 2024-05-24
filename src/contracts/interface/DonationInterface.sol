// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface DonationInterface {
    //캠패인 관련 기능
    function launch(
        address _target,
        string memory _title,
        string memory _description,
        uint256 _goal,
        uint32 _startAt,
        uint32 _endAt
    ) external;
    function cancel(uint256 _id) external;
    function pledge(uint256 _id, uint256 _amount) external;
    function unpledge(uint256 _id, uint256 _amount) external;
    function claim(uint256 _id) external;
    function refund(uint256 _id) external;

    //캠패인 정보 조회 기능
    function getCampaign(
        uint256 _id
    )
        external
        view
        returns (
            address creator,
            address target,
            string memory title,
            string memory description,
            uint256 goal,
            uint256 pledged,
            uint32 startAt,
            uint32 endAt,
            uint256 totalAmount,
            bool claimed
        );
    function getCampaignGoal(uint256 _id) external view returns (uint256);
    function getCampaignTotalAmount(uint256 _id) external view returns (uint256);
}
