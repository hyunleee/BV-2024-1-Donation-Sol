import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, ethers } = hre;
  const { deploy } = deployments;
  const { deployer, user1, user2 } = await getNamedAccounts();

  console.log("Deploying contracts with the account:", deployer);
  console.log("User1 address:", user1);
  console.log("User2 address:", user2);

  // DaoToken 배포
  const daoToken = await deploy("DaoToken", {
    from: deployer,
    args: ["TestToken", "TT"],
    log: true,
  });
  console.log("DaoToken deployed at:", daoToken.address);

  // Users 배포
  const users = await deploy("Users", {
    from: deployer,
    args: [ethers.constants.AddressZero, daoToken.address],
    log: true,
  });
  console.log("Users deployed at:", users.address);

  // Dao 배포
  const dao = await deploy("Dao", {
    from: deployer,
    args: [daoToken.address, ethers.constants.AddressZero, users.address, 3600],
    log: true,
  });
  console.log("Dao deployed at:", dao.address);

  // Users 컨트랙트에 Dao 주소 설정
  const usersContract = await ethers.getContract("Users", deployer);
  await usersContract.setDaoAddress(dao.address);
  console.log("Dao address set in Users contract");

  // DaoToken 전송
  const daoTokenContract = await ethers.getContract("DaoToken", deployer);
  const initialSupply = ethers.utils.parseEther("50000");
  await daoTokenContract.mint(deployer, initialSupply);
  console.log(`Minted ${ethers.utils.formatEther(initialSupply)} DAO tokens to deployer`);

  // Users 컨트랙트에 초기 토큰 전송
  const initialUsersSupply = ethers.utils.parseEther("10000");
  await daoTokenContract.transfer(users.address, initialUsersSupply);
  console.log(`Transferred ${ethers.utils.formatEther(initialUsersSupply)} DAO tokens to Users contract`);

  // 사용자들에게 토큰 배포
  const userAddresses = [user1, user2];
  for (const userAddr of userAddresses) {
    await daoTokenContract.transfer(userAddr, ethers.utils.parseEther("10000"));
    console.log(`Transferred 10000 DAO tokens to ${userAddr}`);
  }

  // Donation 배포
  const donation = await deploy("Donation", {
    from: deployer,
    args: [daoToken.address, dao.address],
    log: true,
  });
  console.log("Donation deployed at:", donation.address);
};

export default func;
func.tags = ["all"];
