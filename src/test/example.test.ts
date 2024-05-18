import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { DaoToken, Donation, Users, Dao } from "@typechains";
import { expect } from "chai";
import { ethers, network } from "hardhat";
import { HardhatUtil } from "./utils/hardhat_utils";

describe("DAO 시스템 전체 테스트", () => {
  let admin: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let member1: SignerWithAddress;
  let member2: SignerWithAddress;
  let member3: SignerWithAddress;
  let member4: SignerWithAddress;
  let member5: SignerWithAddress;
  let daoToken: DaoToken;
  let donation: Donation;
  let userContract: Users;
  let dao: Dao;

  let initialSnapshotId: string;
  let snapshotId: string;

  before(async () => {
    [admin, user1, user2, member1, member2, member3, member4, member5] = await ethers.getSigners();

    const DaoTokenFactory = await ethers.getContractFactory("DaoToken");
    daoToken = (await DaoTokenFactory.deploy("TestToken", "TT")) as DaoToken;
    await daoToken.deployed();

    const UsersFactory = await ethers.getContractFactory("Users");
    userContract = (await UsersFactory.deploy(ethers.constants.AddressZero, daoToken.address)) as Users;
    await userContract.deployed();

    const DaoFactory = await ethers.getContractFactory("Dao");
    dao = (await DaoFactory.deploy(daoToken.address, ethers.constants.AddressZero, userContract.address, 3600)) as Dao;
    await dao.deployed();

    await userContract.setDaoAddress(dao.address);
    await daoToken.mint(admin.address, ethers.utils.parseEther("100000")); // 충분한 토큰 발행
    await daoToken.transfer(userContract.address, ethers.utils.parseEther("10000"));
    await daoToken.transfer(user1.address, ethers.utils.parseEther("10000"));
    await daoToken.transfer(user2.address, ethers.utils.parseEther("10000"));
    await daoToken.transfer(member1.address, ethers.utils.parseEther("10000"));
    await daoToken.transfer(member2.address, ethers.utils.parseEther("10000"));
    await daoToken.transfer(member3.address, ethers.utils.parseEther("10000"));
    await daoToken.transfer(member4.address, ethers.utils.parseEther("10000"));
    await daoToken.transfer(member5.address, ethers.utils.parseEther("10000"));

    const DonationFactory = await ethers.getContractFactory("Donation");
    donation = (await DonationFactory.deploy(daoToken.address, dao.address)) as Donation;
    await donation.deployed();
    await daoToken.transfer(donation.address, ethers.utils.parseEther("10000"));

    // DAO 멤버 요청 및 승인
    await userContract.connect(member1).requestDaoMembership();
    await userContract.connect(admin).approveDaoMembership(member1.address);
    await userContract.connect(member2).requestDaoMembership();
    await userContract.connect(admin).approveDaoMembership(member2.address);
    await userContract.connect(member3).requestDaoMembership();
    await userContract.connect(admin).approveDaoMembership(member3.address);
    await userContract.connect(member4).requestDaoMembership();
    await userContract.connect(admin).approveDaoMembership(member4.address);
    await userContract.connect(member5).requestDaoMembership();
    await userContract.connect(admin).approveDaoMembership(member5.address);

    initialSnapshotId = await network.provider.send("evm_snapshot");
  });

  beforeEach(async () => {
    snapshotId = await network.provider.send("evm_snapshot");
  });

  afterEach(async () => {
    await network.provider.send("evm_revert", [snapshotId]);
  });

  after(async () => {
    await network.provider.send("evm_revert", [initialSnapshotId]);
  });

  describe("DaoToken Tests", () => {
    it("관리자가 토큰을 발행할 수 있는가?", async () => {
      const initialBalance = await daoToken.balanceOf(admin.address);
      await daoToken.connect(admin).mint(admin.address, ethers.utils.parseEther("1000"));
      const balance = await daoToken.balanceOf(admin.address);
      expect(balance).to.equal(initialBalance.add(ethers.utils.parseEther("1000")));
    });

    it("토큰을 다른 주소로 전송할 수 있는가?", async () => {
      await userContract.connect(user1).exchange({ value: ethers.utils.parseEther("0.5") });
      const initialBalanceUser1 = await daoToken.balanceOf(user1.address);
      await daoToken.transfer(user1.address, ethers.utils.parseEther("100"));
      const balance = await daoToken.balanceOf(user1.address);
      expect(balance).to.equal(initialBalanceUser1.add(ethers.utils.parseEther("100")));
    });

    it("토큰을 전송할 수 있는가(approve, transferFrom)?", async () => {
      await userContract.connect(user1).exchange({ value: ethers.utils.parseEther("0.5") });
      const initialBalanceUser2 = await daoToken.balanceOf(user2.address);
      await daoToken.approve(user1.address, ethers.utils.parseEther("100"));
      await daoToken.connect(user1).transferFrom(admin.address, user2.address, ethers.utils.parseEther("100"));
      const balance = await daoToken.balanceOf(user2.address);
      expect(balance).to.equal(initialBalanceUser2.add(ethers.utils.parseEther("100")));
    });
  });

  describe("Users Tests", () => {
    it("유저가 DAO 회원 승인을 요청할 수 있는가?", async () => {
      await userContract.connect(user1).requestDaoMembership();
      const isPending = await userContract.pendingRequests(user1.address);
      expect(isPending).to.be.true;
    });

    it("관리자가 DAO 회원 승인 요청을 승인할 수 있는가?", async () => {
      await userContract.connect(user1).requestDaoMembership();
      await userContract.connect(admin).approveDaoMembership(user1.address);
      const isApproved = await userContract.isApprovedUser(user1.address);
      expect(isApproved).to.be.true;
    });

    it("유저가 ETH를 DAO 토큰으로 교환할 수 있는가?", async () => {
      const ethAmount = ethers.utils.parseEther("0.01");
      await userContract.connect(user1).exchange({ value: ethAmount });
      const daoBalance = await daoToken.balanceOf(user1.address);
      const expectedDaoAmount = ethAmount.mul(100).div(ethers.utils.parseEther("0.001"));
      expect(daoBalance).to.be.gte(expectedDaoAmount);
    });
  });

  describe("Dao Tests", () => {
    // it("투표를 시작할 수 있는가?", async () => {
    //   const goal = ethers.utils.parseEther("100");
    //   const startAt = (await ethers.provider.getBlock("latest")).timestamp + 10;
    //   const endAt = startAt + 86400; // 1일 후

    //   await donation.connect(user1).launch(user1.address, goal, startAt, endAt);
    //   await HardhatUtil.passNSeconds(11); // 캠페인 시작 시간으로 이동

    //   await dao.connect(member1).startVote(1);
    //   const voteInfo = await dao.votes(1);
    //   expect(voteInfo.startTime).to.be.gt(0);
    // });

    // it("유저가 투표에 참여 & 투표 종료를 할 수 있는가?", async () => {
    //   const goal = ethers.utils.parseEther("100");
    //   const startAt = (await ethers.provider.getBlock("latest")).timestamp + 10;
    //   const endAt = startAt + 86400; // 1일 후

    //   await donation.connect(user1).launch(user1.address, goal, startAt, endAt);
    //   await HardhatUtil.passNSeconds(11); // 캠페인 시작 시간으로 이동

    //   await dao.connect(member1).startVote(1);
    //   await dao.connect(member2).vote(1, true);
    //   const hasVoted = await dao.hasVoted(1, member2.address);
    //   expect(hasVoted).to.be.true;

    //   await HardhatUtil.passNSeconds(3600); // 1시간 후
    //   await dao.connect(admin).finalizeVote(1);
    //   const voteInfo = await dao.votes(1);
    //   expect(voteInfo.yesVotes).to.be.gt(0);
    // });

    it("유저를 등록하고 해제할 수 있는가?", async () => {
      await dao.connect(admin).registerUser(user1.address);
      const isRegistered = await userContract.isApprovedUser(user1.address);
      expect(isRegistered).to.be.true;

      await dao.connect(admin).unregisterUser(user1.address);
      const isRegisteredAfter = await userContract.isApprovedUser(user1.address);
      expect(isRegisteredAfter).to.be.false;
    });
  });

  describe("Donation Tests", () => {
    it("유저가 기부 캠페인을 시작할 수 있는가?", async () => {
      const goal = ethers.utils.parseEther("100");
      const startAt = (await ethers.provider.getBlock("latest")).timestamp + 10;
      const endAt = startAt + 86400; // 1일 후

      await donation.connect(user1).launch(user1.address, goal, startAt, endAt);
      const campaign = await donation.getCampaign(1);

      expect(campaign.creator).to.equal(user1.address);
      expect(campaign.goal).to.equal(goal);
      expect(campaign.startAt).to.equal(startAt);
      expect(campaign.endAt).to.equal(endAt);
    });

    it("유저가 기부 & 기부 취소를 할 수 있는가?", async () => {
      const goal = ethers.utils.parseEther("100");
      const startAt = (await ethers.provider.getBlock("latest")).timestamp + 10;
      const endAt = startAt + 86400; // 1일 후

      await donation.connect(user1).launch(user1.address, goal, startAt, endAt);
      await HardhatUtil.passNSeconds(11); // 캠페인 시작 시간으로 이동

      const pledgeAmount = ethers.utils.parseEther("50");
      await daoToken.connect(user1).approve(donation.address, pledgeAmount);
      await donation.connect(user1).pledge(1, pledgeAmount);

      const campaign = await donation.getCampaign(1);
      expect(campaign.pledged).to.equal(pledgeAmount);

      await donation.connect(user1).unpledge(1, pledgeAmount);
      const campaignAfterUnpledge = await donation.getCampaign(1);
      expect(campaignAfterUnpledge.pledged).to.equal(0);
    });

    // it("캠페인 목표 달성 시 claim할 수 있는가?", async () => {
    //   const goal = ethers.utils.parseEther("100");
    //   const startAt = (await ethers.provider.getBlock("latest")).timestamp + 10;
    //   const endAt = startAt + 86400; // 1일 후

    //   await donation.connect(user1).launch(user1.address, goal, startAt, endAt);
    //   await HardhatUtil.passNSeconds(11); // 캠페인 시작 시간으로 이동

    //   const pledgeAmount = ethers.utils.parseEther("100");
    //   await daoToken.connect(user1).approve(donation.address, pledgeAmount);
    //   await donation.connect(user1).pledge(1, pledgeAmount);

    //   await HardhatUtil.passNSeconds(86400); // 1일 후

    //   await donation.connect(user1).claim(1);
    //   const campaign = await donation.getCampaign(1);
    //   expect(campaign.claimed).to.be.true;
    // });

    it("캠페인 목표 미달성 시 refund할 수 있는가?", async () => {
      const goal = ethers.utils.parseEther("100");
      const startAt = (await ethers.provider.getBlock("latest")).timestamp + 10;
      const endAt = startAt + 86400; // 1일 후

      await donation.connect(user1).launch(user1.address, goal, startAt, endAt);
      await HardhatUtil.passNSeconds(11); // 캠페인 시작 시간으로 이동

      const pledgeAmount = ethers.utils.parseEther("50");
      await daoToken.connect(user1).approve(donation.address, pledgeAmount);
      await donation.connect(user1).pledge(1, pledgeAmount);

      await HardhatUtil.passNSeconds(86400); // 1일 후

      await donation.connect(user1).refund(1);
      const userBalance = await daoToken.balanceOf(user1.address);
      expect(userBalance).to.equal(ethers.utils.parseEther("10000")); // 초기 잔액과 같아야 함
    });

    it("캠페인 정보 조회가 가능한가?", async () => {
      const goal = ethers.utils.parseEther("100");
      const startAt = (await ethers.provider.getBlock("latest")).timestamp + 10;
      const endAt = startAt + 86400; // 1일 후

      await donation.connect(user1).launch(user1.address, goal, startAt, endAt);
      const campaign = await donation.getCampaign(1);

      expect(campaign.creator).to.equal(user1.address);
      expect(campaign.goal).to.equal(goal);
      expect(campaign.startAt).to.equal(startAt);
      expect(campaign.endAt).to.equal(endAt);
    });
  });
});
