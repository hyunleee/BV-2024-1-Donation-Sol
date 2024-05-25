import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { setup } from "./setup";
import { DaoToken, Dao, Donation } from "@typechains";
import { expect, use } from "chai";
import { ethers, network } from "hardhat";
import { HardhatUtil } from "./lib/hardhat_utils";

describe("Dao Donation 테스트", () => {
  /* Signer */
  let admin: SignerWithAddress;
  let users: SignerWithAddress[];

  /* 컨트랙트 객체 */
  let daoToken: DaoToken;
  let dao: Dao;
  let donation: Donation;

  /* 테스트 스냅샷 */
  let initialSnapshotId: number;
  let snapshotId: number;

  before(async () => {
    /* 테스트에 필요한 컨트랙트 및 Signer 정보를 불러오는 함수 */
    ({ admin, users, daoToken, donation, dao } = await setup());
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

  it("Hardhat 환경 배포 테스트", () => {
    expect(daoToken.address).to.not.be.undefined;
    expect(dao.address).to.not.be.undefined;
    expect(donation.address).to.not.be.undefined;
  });

  describe("DaoToken 테스트", () => {
    it("DaoToken의 생성자가 정상적으로 설정되어 있는지 확인", async () => {
      expect(await daoToken.admin()).to.equal(admin.address);
    });

    it("DaoToken의 이름과 심볼이 정상적으로 설정되어 있는지 확인", async () => {
      expect(await daoToken.name()).to.equal("DaoToken");
      expect(await daoToken.symbol()).to.equal("DAO");
    });

    it("DaoToken의 초기 공급량이 정상적으로 설정되어 있는지 확인", async () => {
      const initialSupply = await daoToken.totalSupply();
      expect(initialSupply).to.equal(ethers.utils.parseUnits("1000", 18));
    });

    it("DaoToken의 mint 함수가 정상적으로 동작하는지 확인", async () => {
      const amount = ethers.utils.parseEther("100");
      await daoToken.connect(admin).mint(users[0].address, amount);
      const balance = await daoToken.balanceOf(users[0].address);
      expect(balance).to.equal(amount);
    });

    it("DaoToken의 mint 함수가 관리자만 사용 가능한지 확인", async () => {
      const amount = ethers.utils.parseEther("100");
      await expect(daoToken.connect(users[0]).mint(users[0].address, amount)).to.be.revertedWith(
        "Only admin can mint tokens",
      );
    });
    it("DaoToken의 buyToken 함수에서 ETH를 전송하지 않으면 실패하는지 확인", async () => {
      await expect(daoToken.buyTokens()).to.be.revertedWith("You must send ETH to buy tokens");
    });

    it("DaoToken의 buyToken 함수에서 잔고가 부족한 경우 실패하는지 확인", async () => {
      await expect(daoToken.connect(users[0]).buyTokens({ value: 0 })).to.be.revertedWith(
        "You must send ETH to buy tokens",
      );
    });

    it("DaoToken의 buyToken 함수 실행 시 토큰이 정상적으로 민트되는지 확인", async () => {
      const amount = ethers.utils.parseEther("1");
      await daoToken.connect(users[0]).buyTokens({ value: amount });
      const balance = await daoToken.balanceOf(users[0].address);
      expect(balance).to.equal(ethers.utils.parseUnits("100000", 18)); // 1 ETH => 100,000 DAO
    });

    it("DaoToken의 buyToken 함수 실행 시 이벤트가 정상적으로 발생하는지 확인", async () => {
      const amount = ethers.utils.parseEther("1");
      await expect(daoToken.connect(users[0]).buyTokens({ value: amount }))
        .to.emit(daoToken, "TokensPurchased")
        .withArgs(users[0].address, amount, ethers.utils.parseUnits("100000", 18)); // 1 ETH => 100,000 DAO
    });

    it("DaoToken의 getContractBalance 함수가 정상적으로 동작하는지 확인", async () => {
      const balance = await daoToken.getContractBalance();
      expect(balance).to.equal(0);
    });
  });

  describe("Donation 테스트", () => {
    it("Donation 컨트랙트의 생성자가 정상적으로 설정되어 있는지 확인", async () => {
      expect(await donation.admin()).to.equal(admin.address);
    });

    it("launch 함수가 시작 시간이 현재 시간보다 이전인 경우 실패하는지 확인", async () => {
      const target = ethers.Wallet.createRandom().address;
      const title = "Test Campaign";
      const description = "This is a test campaign";
      const goal = ethers.utils.parseEther("1");
      const startAt = Math.floor(Date.now() / 1000) - 1000;
      const endAt = Math.floor(Date.now() / 1000) + 2000;

      await expect(
        donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt),
      ).to.be.revertedWith("start at < now");
    });

    it("launch 함수가 종료 시간이 시작 시간보다 이전인 경우 실패하는지 확인", async () => {
      const target = ethers.Wallet.createRandom().address;
      const title = "Test Campaign";
      const description = "This is a test campaign";
      const goal = ethers.utils.parseEther("1");
      const startAt = Math.floor(Date.now() / 1000) + 1000;
      const endAt = Math.floor(Date.now() / 1000) - 2000;

      await expect(
        donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt),
      ).to.be.revertedWith("end at < start at");
    });

    it("launch 함수가 종료 시간이 90일을 초과하는 경우 실패하는지 확인", async () => {
      const target = ethers.Wallet.createRandom().address;
      const title = "Test Campaign";
      const description = "This is a test campaign";
      const goal = ethers.utils.parseEther("1");
      const latestBlock = await ethers.provider.getBlock("latest");
      const startAt = latestBlock.timestamp + 1000;
      const endAt = latestBlock.timestamp + 91 * 24 * 60 * 60; // 90일을 초과

      await expect(
        donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt),
      ).to.be.revertedWith("end at > max duration");
    });

    it("launch 함수 실행 후 count가 1 증가하는지 확인", async () => {
      const target = ethers.Wallet.createRandom().address;
      const title = "Test Campaign";
      const description = "This is a test campaign";
      const goal = ethers.utils.parseEther("1");
      const startAt = Math.floor(Date.now() / 1000) + 1000;
      const endAt = Math.floor(Date.now() / 1000) + 2000;

      await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);
      expect(await donation.count()).to.equal(1);
    });

    it("launch 함수 실행 후 Campaign 구조체가 정상적으로 설정되어 있는지 확인", async () => {
      const target = ethers.Wallet.createRandom().address;
      const title = "Test Campaign";
      const description = "This is a test campaign";
      const goal = ethers.utils.parseEther("1");
      const startAt = Math.floor(Date.now() / 1000) + 1000;
      const endAt = Math.floor(Date.now() / 1000) + 2000;

      await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);

      const campaign = await donation.campaigns(1);
      expect(campaign.creator).to.equal(users[0].address);
      expect(campaign.target).to.equal(target);
      expect(campaign.title).to.equal(title);
      expect(campaign.description).to.equal(description);
      expect(campaign.goal).to.equal(goal);
      expect(campaign.pledged).to.equal(0);
      expect(campaign.startAt).to.equal(startAt);
      expect(campaign.endAt).to.equal(endAt);
      expect(campaign.claimed).to.equal(false);
    });

    it("launch 함수 실행 후 isEnded가 false로 설정되어 있는지 확인", async () => {
      const target = ethers.Wallet.createRandom().address;
      const title = "Test Campaign";
      const description = "This is a test campaign";
      const goal = ethers.utils.parseEther("1");
      const startAt = Math.floor(Date.now() / 1000) + 1000;
      const endAt = Math.floor(Date.now() / 1000) + 2000;

      await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);
      expect(await donation.isEnded(1)).to.equal(false);
    });

    it("launch 함수 실행 후 이벤트가 정상적으로 발생하는지 확인", async () => {
      const target = ethers.Wallet.createRandom().address;
      const title = "Test Campaign";
      const description = "This is a test campaign";
      const goal = ethers.utils.parseEther("1");
      const startAt = Math.floor(Date.now() / 1000) + 1000;
      const endAt = Math.floor(Date.now() / 1000) + 2000;

      await expect(donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt))
        .to.emit(donation, "Launch")
        .withArgs(1, users[0].address, target, title, description, goal, startAt, endAt);
    });

    it("cancel 함수가 Campaign을 취소하는지 확인", async () => {
      const target = ethers.Wallet.createRandom().address;
      const title = "Test Campaign";
      const description = "This is a test campaign";
      const goal = ethers.utils.parseEther("1");
      const startAt = Math.floor(Date.now() / 1000) + 1000;
      const endAt = Math.floor(Date.now() / 1000) + 2000;

      await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);
      await donation.connect(users[0]).cancel(1);

      const campaign = await donation.campaigns(1);
      expect(campaign.claimed).to.equal(false);
    });

    // it("cancel 함수가 creator만 실행 가능한지 확인", async () => {
    //   const target = ethers.Wallet.createRandom().address;
    //   const title = "Test Campaign";
    //   const description = "This is a test campaign";
    //   const goal = ethers.utils.parseEther("1");
    //   const startAt = Math.floor(Date.now() / 1000) + 1000;
    //   const endAt = Math.floor(Date.now() / 1000) + 2000;

    //   await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);
    //   await expect(donation.connect(users[0]).cancel(1)).to.be.revertedWith("Only creator can cancel the campaign");
    // });

    // it("cancel 함수가 Campaign이 존재하지 않는 경우 실패하는지 확인", async () => {
    //   await expect(donation.connect(users[0]).cancel(1)).to.be.revertedWith("Campaign does not exist");
    // });

    // it("cancle 함수 실행 시 campaigns 배열에서 Campaign이 삭제되는지 확인", async () => {
    //   const target = ethers.Wallet.createRandom().address;
    //   const title = "Test Campaign";
    //   const description = "This is a test campaign";
    //   const goal = ethers.utils.parseEther("1");
    //   const startAt = Math.floor(Date.now() / 1000) + 1000;
    //   const endAt = Math.floor(Date.now() / 1000) + 2000;
    //   await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);
    //   await donation.connect(users[0]).cancel(1);

    //   const campaign = await donation.campaigns(1);
    //   expect(campaign.creator).to.equal(users[0].address);
    // });

    it("cancle 함수 실행 시 isEnded가 true로 설정되는지 확인", async () => {
      const target = ethers.Wallet.createRandom().address;
      const title = "Test Campaign";
      const description = "This is a test campaign";
      const goal = ethers.utils.parseEther("1");
      const startAt = Math.floor(Date.now() / 1000) + 1000;
      const endAt = Math.floor(Date.now() / 1000) + 2000;

      await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);
      await donation.connect(users[0]).cancel(1);

      expect(await donation.isEnded(1)).to.equal(true);
    });

    it("cancel 함수 실행 시 이벤트가 정상적으로 발생하는지 확인", async () => {
      const target = ethers.Wallet.createRandom().address;
      const title = "Test Campaign";
      const description = "This is a test campaign";
      const goal = ethers.utils.parseEther("1");
      const startAt = Math.floor(Date.now() / 1000) + 1000;
      const endAt = Math.floor(Date.now() / 1000) + 2000;

      await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);
      await expect(donation.connect(users[0]).cancel(1)).to.emit(donation, "Cancel").withArgs(1);
    });
  });
});
