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
      expect(initialSupply).to.equal(HardhatUtil.ToETH(1000));
    });

    it("DaoToken의 mint 함수가 정상적으로 동작하는지 확인", async () => {
      const amount = HardhatUtil.ToETH(100);
      await daoToken.connect(admin).mint(users[0].address, amount);
      const balance = await daoToken.balanceOf(users[0].address);
      expect(balance).to.equal(amount);
    });

    it("DaoToken의 mint 함수가 관리자만 사용 가능한지 확인", async () => {
      const amount = HardhatUtil.ToETH(100);
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
      const amount = HardhatUtil.ToETH(1);
      await daoToken.connect(users[0]).buyTokens({ value: amount });
      const balance = await daoToken.balanceOf(users[0].address);
      expect(balance).to.equal(HardhatUtil.ToETH(100000)); // 1 ETH => 100,000 DAO
    });

    it("DaoToken의 buyToken 함수 실행 시 이벤트가 정상적으로 발생하는지 확인", async () => {
      const amount = HardhatUtil.ToETH(1);
      await expect(daoToken.connect(users[0]).buyTokens({ value: amount }))
        .to.emit(daoToken, "TokensPurchased")
        .withArgs(users[0].address, amount, HardhatUtil.ToETH(100000)); // 1 ETH => 100,000 DAO
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
      const goal = HardhatUtil.ToETH(1);
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
      const goal = HardhatUtil.ToETH(1);
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
      const goal = HardhatUtil.ToETH(1);
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
      const goal = HardhatUtil.ToETH(1);
      const startAt = Math.floor(Date.now() / 1000) + 1000;
      const endAt = Math.floor(Date.now() / 1000) + 2000;

      await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);
      expect(await donation.count()).to.equal(1);
    });

    it("launch 함수 실행 후 Campaign 구조체가 정상적으로 설정되어 있는지 확인", async () => {
      const target = ethers.Wallet.createRandom().address;
      const title = "Test Campaign";
      const description = "This is a test campaign";
      const goal = HardhatUtil.ToETH(1);
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
      const goal = HardhatUtil.ToETH(1);
      const startAt = Math.floor(Date.now() / 1000) + 1000;
      const endAt = Math.floor(Date.now() / 1000) + 2000;

      await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);
      expect(await donation.isEnded(1)).to.equal(false);
    });

    it("launch 함수 실행 후 이벤트가 정상적으로 발생하는지 확인", async () => {
      const target = ethers.Wallet.createRandom().address;
      const title = "Test Campaign";
      const description = "This is a test campaign";
      const goal = HardhatUtil.ToETH(1);
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
      const goal = HardhatUtil.ToETH(1);
      const startAt = Math.floor(Date.now() / 1000) + 1000;
      const endAt = Math.floor(Date.now() / 1000) + 2000;

      await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);
      await donation.connect(users[0]).cancel(1);

      const campaign = await donation.campaigns(1);
      expect(campaign.claimed).to.equal(false);
    });

    it("cancel 함수 실행 시 creator가 아닌 경우 실패하는지 확인", async () => {
      const target = ethers.Wallet.createRandom().address;
      const title = "Test Campaign";
      const description = "This is a test campaign";
      const goal = HardhatUtil.ToETH(1);
      const startAt = Math.floor(Date.now() / 1000) + 1000;
      const endAt = Math.floor(Date.now() / 1000) + 2000;

      await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);
      await expect(donation.connect(users[1]).cancel(1)).to.be.revertedWith("not creator");
    });

    it("cancel 함수 실행 시 캠페인이 이미 시작한 경우 실패하는지 확인", async () => {
      const target = ethers.Wallet.createRandom().address;
      const title = "Test Campaign";
      const description = "This is a test campaign";
      const goal = HardhatUtil.ToETH(1);
      const startAt = Math.floor(Date.now() / 1000) + 500; // 캠페인이 500초 후 시작
      const endAt = Math.floor(Date.now() / 1000) + 2000;

      await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);

      // 시간 이동 (캠페인이 시작되도록)
      await network.provider.send("evm_increaseTime", [600]);
      await network.provider.send("evm_mine");

      await expect(donation.connect(users[0]).cancel(1)).to.be.revertedWith("started");
    });

    it("cancel 함수 실행 시 Campaign이 삭제되는지 확인", async () => {
      const target = ethers.Wallet.createRandom().address;
      const title = "Test Campaign";
      const description = "This is a test campaign";
      const goal = HardhatUtil.ToETH(1);
      const startAt = Math.floor(Date.now() / 1000) + 1000;
      const endAt = Math.floor(Date.now() / 1000) + 2000;

      await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);
      await donation.connect(users[0]).cancel(1);

      const campaign = await donation.campaigns(1);
      expect(campaign.creator).to.equal(ethers.constants.AddressZero);
    });

    it("cancel 함수 실행 시 isEnded가 true로 설정되는지 확인", async () => {
      const target = ethers.Wallet.createRandom().address;
      const title = "Test Campaign";
      const description = "This is a test campaign";
      const goal = HardhatUtil.ToETH(1);
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
      const goal = HardhatUtil.ToETH(1);
      const startAt = Math.floor(Date.now() / 1000) + 1000;
      const endAt = Math.floor(Date.now() / 1000) + 2000;

      await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);
      await expect(donation.connect(users[0]).cancel(1)).to.emit(donation, "Cancel").withArgs(1);
    });

    it("pledge 함수 실행 시 캠페인이 시작되지 않은 경우 실패하는지 확인", async () => {
      const target = ethers.Wallet.createRandom().address;
      const title = "Test Campaign";
      const description = "This is a test campaign";
      const goal = HardhatUtil.ToETH(1);
      const latestBlock = await ethers.provider.getBlock("latest");
      const startAt = latestBlock.timestamp + 1000;
      const endAt = latestBlock.timestamp + 2000;

      await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);
      await expect(donation.connect(users[1]).pledge(1, HardhatUtil.ToETH(1))).to.be.revertedWith("not started");
    });

    // it("pledge 함수 실행 시 캠페인이 종료된 경우 실패하는지 확인", async () => {
    //   const target = ethers.Wallet.createRandom().address;
    //   const title = "Test Campaign";
    //   const description = "This is a test campaign";
    //   const goal = ethers.utils.parseUnits("1", 18);

    //   // 현재 블록 타임스탬프 가져오기
    //   const latestBlock = await ethers.provider.getBlock("latest");
    //   const startAt = latestBlock.timestamp + 100; // 현재 시간보다 100초 후로 설정
    //   const endAt = latestBlock.timestamp + 200; // 현재 시간보다 200초 후로 설정

    //   // 캠페인 생성
    //   await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);

    //   // 캠페인이 종료되도록 시간을 이동
    //   await HardhatUtil.passNSeconds(300); // 300초를 이동하여 캠페인이 종료되도록 함

    //   // DaoToken 구매
    //   await daoToken.connect(users[1]).buyTokens({ value: ethers.utils.parseUnits("1", 18) });

    //   // 충분한 토큰 허용량을 설정
    //   await daoToken.connect(users[1]).approve(donation.address, ethers.utils.parseUnits("1", 18));

    //   // 캠페인이 종료된 상태에서 pledge 시도
    //   await expect(donation.connect(users[1]).pledge(1, ethers.utils.parseUnits("1", 18))).to.be.revertedWith("ended");
    // });
  });
});
