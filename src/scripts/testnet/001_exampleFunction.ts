import { DaoAdmin } from "@typechains";
import { DaoToken } from "@typechains";
import { Funding } from "@typechains";
import { ethers, getNamedAccounts } from "hardhat";

const main = async () => {
  const { developer } = await getNamedAccounts();
  const signer = await ethers.getSigner(developer);

  const DaoToken = await ethers.getContract<DaoToken>("DaoToken");
  const DaoAdmin = await ethers.getContract<DaoAdmin>("DaoAdmin");
  const Funding = await ethers.getContract<Funding>("Funding");
};

main();
