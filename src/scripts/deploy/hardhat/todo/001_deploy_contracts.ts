import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

/**
 * @dev this script is used for tests and deployments on hardhat network
 * @deployer person who deployed
 * @date deployed date
 * @description summary of this deployment
 */

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments } = hre;
  const { deploy } = deployments;
  const [developer] = await ethers.getSigners();

  const daoToken = await deploy("DaoToken", {
    from: developer.address,
    contract: "DaoToken",
    args: [],
    log: true,
    autoMine: true,
  });

  const donation = await deploy("Donation", {
    from: developer.address,
    contract: "Donation",
    args: [daoToken.address],
    log: true,
    autoMine: true,
  });

  await deploy("Dao", {
    from: developer.address,
    contract: "Dao",
    args: [donation.address],
    log: true,
    autoMine: true,
  });
};

export default func;
func.tags = ["001_deploy_contracts"];
