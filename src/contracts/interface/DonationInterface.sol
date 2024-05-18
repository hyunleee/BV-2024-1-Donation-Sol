// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface DonationInterface {
    function getCampaign(
        uint256 _id
    )
        external
        view
        returns (
            address creator,
            address target,
            uint256 goal,
            uint256 pledged,
            uint32 startAt,
            uint32 endAt,
            bool claimed
        );

    function getCampaignGoal(uint256 _id) external view returns (uint256);

    function launch(address _target, uint256 _goal, uint32 _startAt, uint32 _endAt) external;
    function pledge(uint256 _id, uint256 _amount) external;
    function unpledge(uint256 _id, uint256 _amount) external;
    function claim(uint256 _id) external;
    function finalizeClaim(uint256 _id) external;
    function refund(uint256 _id) external;
}
