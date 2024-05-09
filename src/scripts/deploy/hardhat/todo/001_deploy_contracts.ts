import { hardhatInfo } from "@constants";
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

  // DaoToken 컨트랙트 배포
  const daoToken = await deploy("DaoToken", {
    from: developer.address,
    contract: "DaoToken",
    args: [hardhatInfo.daoTokenName, hardhatInfo.daoTokenSymbol],
    log: true,
    autoMine: true,
  });

  // Funding 컨트랙트 배포
  const funding = await deploy("Funding", {
    from: developer.address,
    contract: "Funding",
    args: [daoToken.address], // 배포된 DaoToken 컨트랙트의 주소 사용
    log: true,
    autoMine: true,
  });

  // DaoAdmin 컨트랙트 배포
  const daoAdmin = await deploy("DaoAdmin", {
    from: developer.address,
    contract: "DaoAdmin",
    args: [daoToken.address], // 배포된 DaoToken 컨트랙트의 주소 사용
    log: true,
    autoMine: true,
  });

  // 배포된 컨트랙트의 주소 출력
  console.log("DaoToken deployed to:", daoToken.address);
  console.log("Funding deployed to:", funding.address);
  console.log("DaoAdmin deployed to:", daoAdmin.address);
};

export default func;
func.tags = ["001_deploy_contracts"];
