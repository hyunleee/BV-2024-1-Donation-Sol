import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, ethers } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  // DaoToken 배포
  const daoToken = await deploy("DaoToken", {
    from: deployer,
    args: ["TestToken", "TT"],
    log: true,
  });
  console.log("DaoToken deployed at:", daoToken.address);

  // Dao 배포
  const dao = await deploy("Dao", {
    from: deployer,
    args: [daoToken.address, ethers.constants.AddressZero, 3600], // 예시로 1시간 (3600초)로 설정
    log: true,
  });
  console.log("Dao deployed at:", dao.address);

  // Donation 배포
  const donation = await deploy("Donation", {
    from: deployer,
    args: [daoToken.address, dao.address], // 두 개의 인자 전달
    log: true,
  });
  console.log("Donation deployed at:", donation.address);

  // Users 배포
  const users = await deploy("Users", {
    from: deployer,
    args: [dao.address, daoToken.address], // Dao 주소 전달
    log: true,
  });
  console.log("Users deployed at:", users.address);

  // DaoAdmin 배포
  const daoAdmin = await deploy("DaoAdmin", {
    from: deployer,
    args: [daoToken.address, users.address], // 두 개의 인자 전달
    log: true,
  });
  console.log("DaoAdmin deployed at:", daoAdmin.address);
};

export default func;
func.tags = ["all"];
