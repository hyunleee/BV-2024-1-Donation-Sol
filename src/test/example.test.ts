import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { setup } from "./setup";
import { DaoToken, Dao, Donation } from "@typechains";
import { expect } from "chai";
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
    it("launch 함수 실행 후 이벤트가 정상적으로 발생하는지 확인", async () => {
      const target = ethers.Wallet.createRandom().address;
      const title = "Test Campaign";
      const description = "This is a test campaign";
      const goal = HardhatUtil.ToETH(1);
      const startAt = Math.floor(Date.now() / 1000) + 1000;
      const endAt = Math.floor(Date.now() / 1000) + 2000;

      await expect(donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt))
        .to.emit(donation, "Launch")
        .withArgs(1, users[0].address, target, title, description, goal, startAt, endAt, false);
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

    it("cancel 함수 실행 시 이벤트가 정상적으로 발생하는지 확인", async () => {
      const target = ethers.Wallet.createRandom().address;
      const title = "Test Campaign";
      const description = "This is a test campaign";
      const goal = HardhatUtil.ToETH(1);
      const startAt = Math.floor(Date.now() / 1000) + 1000;
      const endAt = Math.floor(Date.now() / 1000) + 2000;

      await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);
      await expect(donation.connect(users[0]).cancel(1)).to.emit(donation, "Cancel").withArgs(1, true);
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

    it("pledge 함수 실행 시 캠페인이 종료된 경우 실패하는지 확인", async () => {
      const target = ethers.Wallet.createRandom().address;
      const title = "Test Campaign";
      const description = "This is a test campaign";
      const goal = HardhatUtil.ToETH(1);

      // 현재 블록 타임스탬프 가져오기
      const latestBlock = await ethers.provider.getBlock("latest");
      const startAt = latestBlock.timestamp + 100; // 현재 시간보다 100초 후로 설정
      const endAt = latestBlock.timestamp + 200; // 현재 시간보다 200초 후로 설정

      // 캠페인 생성
      await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);

      // 캠페인이 종료되도록 시간을 이동
      await HardhatUtil.passNSeconds(300); // 300초를 이동하여 캠페인이 종료되도록 함

      // isEnded 상태 업데이트
      await donation.connect(users[0]).getIsEnded(1);

      // DaoToken 구매
      await daoToken.connect(users[1]).buyTokens({ value: HardhatUtil.ToETH(1) });

      // 충분한 토큰 허용량을 설정
      await daoToken.connect(users[1]).approve(donation.address, HardhatUtil.ToETH(1));

      // 캠페인이 종료된 상태에서 pledge 시도
      await expect(donation.connect(users[1]).pledge(1, HardhatUtil.ToETH(1))).to.be.revertedWith("ended");
    });

    it("pledge 함수 실행 시 amount가 0인 경우 실패하는지 확인", async () => {
      const target = ethers.Wallet.createRandom().address;
      const title = "Test Campaign";
      const description = "This is a test campaign";
      const goal = HardhatUtil.ToETH(1);
      const latestBlock = await ethers.provider.getBlock("latest");
      const startAt = latestBlock.timestamp + 100;
      const endAt = latestBlock.timestamp + 200;

      await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);

      // 캠페인 시작 시간으로 이동
      await HardhatUtil.passNSeconds(100);

      await daoToken.connect(users[0]).approve(donation.address, HardhatUtil.ToETH(1));

      await expect(donation.connect(users[0]).pledge(1, 0)).to.be.revertedWith("Amount must be greater than zero");
    });

    it("pledge 함수 실행 시 DAO 토큰이 정상적으로 전송되는지 확인", async () => {
      const target = ethers.Wallet.createRandom().address;
      const title = "Test Campaign";
      const description = "This is a test campaign";
      const goal = HardhatUtil.ToETH(1);
      const latestBlock = await ethers.provider.getBlock("latest");
      const startAt = latestBlock.timestamp + 100;
      const endAt = latestBlock.timestamp + 200;

      await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);

      // 캠페인 시작 시간으로 이동
      await HardhatUtil.passNSeconds(100);

      await daoToken.connect(users[0]).buyTokens({ value: HardhatUtil.ToETH(1) });
      await daoToken.connect(users[0]).approve(donation.address, HardhatUtil.ToETH(1));
      await donation.connect(users[0]).pledge(1, HardhatUtil.ToETH(1));

      const balance = await daoToken.balanceOf(users[0].address);
      expect(balance).to.equal(HardhatUtil.ToETH(99999)); // 100,000 - 1
    });

    it("pledge 함수 실행 시 Campaign의 목표 금액을 달성하지 못한 경우 투표가 시작되지 않는지 확인", async () => {
      const target = ethers.Wallet.createRandom().address;
      const title = "Test Campaign";
      const description = "This is a test campaign";
      const goal = HardhatUtil.ToETH(1);

      // 현재 블록 타임스탬프 가져오기
      const latestBlock = await ethers.provider.getBlock("latest");
      const startAt = latestBlock.timestamp + 100; // 현재 시간보다 100초 후로 설정
      const endAt = latestBlock.timestamp + 200; // 현재 시간보다 200초 후로 설정

      // 캠페인 생성
      await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);

      // 캠페인 시작 시간으로 이동
      await network.provider.send("evm_increaseTime", [100]);
      await network.provider.send("evm_mine");

      // DaoToken 구매
      await daoToken.connect(users[1]).buyTokens({ value: HardhatUtil.ToETH(1) });

      // 충분한 토큰 허용량을 설정
      await daoToken.connect(users[1]).approve(donation.address, HardhatUtil.ToETH(1));

      // 캠페인이 시작된 상태에서 pledge 시도
      await donation.connect(users[1]).pledge(1, HardhatUtil.ToETH(0.5));

      // Campaign이 목표 금액에 도달하지 않았는지 확인
      const campaign = await donation.campaigns(1);
      expect(campaign.pledged).to.equal(HardhatUtil.ToETH(0.5));
      expect(await donation.isEnded(1)).to.equal(false);
    });

    it("pledge 함수 실행 시 Campaign의 목표 금액을 달성한 경우 isEnded가 true로 설정되는지 확인", async () => {
      const target = ethers.Wallet.createRandom().address;
      const title = "Test Campaign";
      const description = "This is a test campaign";
      const goal = HardhatUtil.ToETH(1);
      const latestBlock = await ethers.provider.getBlock("latest");
      const startAt = latestBlock.timestamp + 100;
      const endAt = latestBlock.timestamp + 200;

      await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);

      // 캠페인 시작 시간으로 이동
      await HardhatUtil.passNSeconds(100);

      await daoToken.connect(users[0]).buyTokens({ value: HardhatUtil.ToETH(1) });
      await daoToken.connect(users[0]).approve(donation.address, HardhatUtil.ToETH(1));
      await donation.connect(users[0]).pledge(1, HardhatUtil.ToETH(1));

      expect(await donation.isEnded(1)).to.equal(true);
    });

    it("pledge 함수 실행 시 Campaign의 목표 금액을 달성하지 못한 경우 투표가 시작되지 않는지 확인", async () => {
      const target = ethers.Wallet.createRandom().address;
      const title = "Test Campaign";
      const description = "This is a test campaign";
      const goal = HardhatUtil.ToETH(1);

      // 현재 블록 타임스탬프 가져오기
      const latestBlock = await ethers.provider.getBlock("latest");
      const startAt = latestBlock.timestamp + 100; // 현재 시간보다 100초 후로 설정
      const endAt = latestBlock.timestamp + 200; // 현재 시간보다 200초 후로 설정

      // 캠페인 생성
      await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);

      // 캠페인 시작 시간으로 이동
      await network.provider.send("evm_increaseTime", [100]);
      await network.provider.send("evm_mine");

      // DaoToken 구매
      await daoToken.connect(users[1]).buyTokens({ value: HardhatUtil.ToETH(1) });

      // 충분한 토큰 허용량을 설정
      await daoToken.connect(users[1]).approve(donation.address, HardhatUtil.ToETH(1));

      // 캠페인이 시작된 상태에서 pledge 시도
      await donation.connect(users[1]).pledge(1, HardhatUtil.ToETH(0.5));

      // Campaign이 목표 금액에 도달하지 않았는지 확인
      const campaign = await donation.campaigns(1);
      expect(campaign.pledged).to.equal(HardhatUtil.ToETH(0.5));
      expect(await donation.isEnded(1)).to.equal(false);
    });

    it("pledge 함수 실행 시 Campaign의 목표 금액을 달성하지 못한 경우 isEnded가 false로 설정되는지 확인", async () => {
      const target = ethers.Wallet.createRandom().address;
      const title = "Test Campaign";
      const description = "This is a test campaign";
      const goal = HardhatUtil.ToETH(1);
      const latestBlock = await ethers.provider.getBlock("latest");
      const startAt = latestBlock.timestamp + 100;
      const endAt = latestBlock.timestamp + 200;

      await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);

      // 캠페인 시작 시간으로 이동
      await HardhatUtil.passNSeconds(100);

      await daoToken.connect(users[1]).buyTokens({ value: HardhatUtil.ToETH(0.5) });
      await daoToken.connect(users[1]).approve(donation.address, HardhatUtil.ToETH(0.5));
      await donation.connect(users[1]).pledge(1, HardhatUtil.ToETH(0.5));

      expect(await donation.isEnded(1)).to.equal(false);
    });

    it("pledge 함수 실행 시 이벤트가 정상적으로 발생하는지 확인", async () => {
      const target = ethers.Wallet.createRandom().address;
      const title = "Test Campaign";
      const description = "This is a test campaign";
      const goal = HardhatUtil.ToETH(1);
      const latestBlock = await ethers.provider.getBlock("latest");
      const startAt = latestBlock.timestamp + 100;
      const endAt = latestBlock.timestamp + 200;

      await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);

      // 캠페인 시작 시간으로 이동
      await HardhatUtil.passNSeconds(100);

      await daoToken.connect(users[1]).buyTokens({ value: HardhatUtil.ToETH(1) });
      await daoToken.connect(users[1]).approve(donation.address, HardhatUtil.ToETH(1));

      await expect(donation.connect(users[1]).pledge(1, HardhatUtil.ToETH(1)))
        .to.emit(donation, "Pledge")
        .withArgs(1, users[1].address, HardhatUtil.ToETH(1), HardhatUtil.ToETH(1)); // 1 ETH => 1 Pledge, Total Pledged = 1 ETH
    });

    it("unpledge 함수 실행 시 amount가 0인 경우 실패하는지 확인", async () => {
      const target = ethers.Wallet.createRandom().address;
      const title = "Test Campaign";
      const description = "This is a test campaign";
      const goal = HardhatUtil.ToETH(1);
      const latestBlock = await ethers.provider.getBlock("latest");
      const startAt = latestBlock.timestamp + 100;
      const endAt = latestBlock.timestamp + 2000;

      await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);

      // 캠페인 시작 시간으로 이동
      await HardhatUtil.passNSeconds(100);

      await daoToken.connect(users[1]).buyTokens({ value: HardhatUtil.ToETH(1) });
      await daoToken.connect(users[1]).approve(donation.address, HardhatUtil.ToETH(1));

      await donation.connect(users[1]).pledge(1, HardhatUtil.ToETH(1));

      await expect(donation.connect(users[1]).unpledge(1, 0)).to.be.revertedWith("Amount must be greater than zero");
    });

    it("unpledge 함수 실행 시 isEnded가 true인 경우 실패하는지 확인", async () => {
      const target = ethers.Wallet.createRandom().address;
      const title = "Test Campaign";
      const description = "This is a test campaign";
      const goal = HardhatUtil.ToETH(1);
      const latestBlock = await ethers.provider.getBlock("latest");
      const startAt = latestBlock.timestamp + 100;
      const endAt = latestBlock.timestamp + 200; // 종료 시간을 가까이 설정

      await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);

      // 캠페인 시작 시간으로 이동
      await HardhatUtil.passNSeconds(100);

      await daoToken.connect(users[1]).buyTokens({ value: HardhatUtil.ToETH(1) });
      await daoToken.connect(users[1]).approve(donation.address, HardhatUtil.ToETH(1));

      await donation.connect(users[1]).pledge(1, HardhatUtil.ToETH(1));

      // 캠페인 종료 시간으로 이동
      await HardhatUtil.passNSeconds(100);

      await expect(donation.connect(users[1]).unpledge(1, HardhatUtil.ToETH(1))).to.be.revertedWith("ended");
    });

    it("unpledge 함수 실행 시 DAO 토큰이 정상적으로 전송되는지 확인", async () => {
      const target = ethers.Wallet.createRandom().address;
      const title = "Test Campaign";
      const description = "This is a test campaign";
      const goal = HardhatUtil.ToETH(1);
      const latestBlock = await ethers.provider.getBlock("latest");
      const startAt = latestBlock.timestamp + 100;
      const endAt = latestBlock.timestamp + 2000;

      await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);

      // 캠페인 시작 시간으로 이동
      await HardhatUtil.passNSeconds(100);

      await daoToken.connect(users[1]).buyTokens({ value: HardhatUtil.ToETH(1) });
      await daoToken.connect(users[1]).approve(donation.address, HardhatUtil.ToETH(1));

      await donation.connect(users[1]).pledge(1, HardhatUtil.ToETH(0.5)); // 목표 금액 미달성
      await donation.connect(users[1]).unpledge(1, HardhatUtil.ToETH(0.5));

      const balance = await daoToken.balanceOf(users[1].address);
      expect(balance).to.equal(HardhatUtil.ToETH(100000)); // 100,000 - 0.5 + 0.5
    });

    it("unpledge 함수 실행 시 이벤트가 정상적으로 발생하는지 확인", async () => {
      const target = ethers.Wallet.createRandom().address;
      const title = "Test Campaign";
      const description = "This is a test campaign";
      const goal = HardhatUtil.ToETH(1);
      const latestBlock = await ethers.provider.getBlock("latest");
      const startAt = latestBlock.timestamp + 100;
      const endAt = latestBlock.timestamp + 2000;

      await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);

      // 캠페인 시작 시간으로 이동
      await HardhatUtil.passNSeconds(100);

      await daoToken.connect(users[1]).buyTokens({ value: HardhatUtil.ToETH(1) });
      await daoToken.connect(users[1]).approve(donation.address, HardhatUtil.ToETH(1));

      await donation.connect(users[1]).pledge(1, HardhatUtil.ToETH(0.5)); // 목표 금액 미달성

      await expect(donation.connect(users[1]).unpledge(1, HardhatUtil.ToETH(0.5)))
        .to.emit(donation, "Unpledge")
        .withArgs(1, users[1].address, HardhatUtil.ToETH(0.5), HardhatUtil.ToETH(0));
    });

    it("claim 함수 실행 시 creator가 아닌 경우 실패하는지 확인", async () => {
      const target = ethers.Wallet.createRandom().address;
      const title = "Test Campaign";
      const description = "This is a test campaign";
      const goal = HardhatUtil.ToETH(1);
      const latestBlock = await ethers.provider.getBlock("latest");
      const startAt = latestBlock.timestamp + 100;
      const endAt = latestBlock.timestamp + 200;

      await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);

      // 캠페인 시작 시간으로 이동
      await HardhatUtil.passNSeconds(100);

      await daoToken.connect(users[1]).buyTokens({ value: HardhatUtil.ToETH(1) });
      await daoToken.connect(users[1]).approve(donation.address, HardhatUtil.ToETH(1));
      await donation.connect(users[1]).pledge(1, HardhatUtil.ToETH(1));

      // 캠페인 종료 시간으로 이동
      await HardhatUtil.passNSeconds(100);

      await expect(donation.connect(users[1]).claim(1)).to.be.revertedWith("not creator");
    });

    it("claim 함수 실행 시 isEnded가 false인 경우 실패하는지 확인", async () => {
      const target = ethers.Wallet.createRandom().address;
      const title = "Test Campaign";
      const description = "This is a test campaign";
      const goal = HardhatUtil.ToETH(1);
      const latestBlock = await ethers.provider.getBlock("latest");
      const startAt = latestBlock.timestamp + 100;
      const endAt = latestBlock.timestamp + 200;

      await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);

      // 캠페인 시작 시간으로 이동
      await HardhatUtil.passNSeconds(100);

      await daoToken.connect(users[1]).buyTokens({ value: HardhatUtil.ToETH(0.5) });
      await daoToken.connect(users[1]).approve(donation.address, HardhatUtil.ToETH(0.5));
      await donation.connect(users[1]).pledge(1, HardhatUtil.ToETH(0.5)); // 목표 금액 미달성

      // 종료 시간 전인 상태에서 claim 시도
      await expect(donation.connect(users[0]).claim(1)).to.be.revertedWith("not ended");

      // 캠페인 종료 시간까지 이동하지 않음
      // expect문이 성공해야 함
    });
    it("claim 함수 실행 시 claimed가 true인 경우 실패하는지 확인", async () => {
      const target = ethers.Wallet.createRandom().address;
      const title = "Test Campaign";
      const description = "This is a test campaign";
      const goal = HardhatUtil.ToETH(1);
      const latestBlock = await ethers.provider.getBlock("latest");
      const startAt = latestBlock.timestamp + 100;
      const endAt = latestBlock.timestamp + 200;

      await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);

      // 캠페인 시작 시간으로 이동
      await HardhatUtil.passNSeconds(100);

      await daoToken.connect(users[1]).buyTokens({ value: HardhatUtil.ToETH(1) });
      await daoToken.connect(users[1]).approve(donation.address, HardhatUtil.ToETH(1));
      await donation.connect(users[1]).pledge(1, HardhatUtil.ToETH(1));

      // 캠페인 종료 시간으로 이동
      await HardhatUtil.passNSeconds(100);

      await donation.connect(users[0]).claim(1);

      await expect(donation.connect(users[0]).claim(1)).to.be.revertedWith("claimed");
    });

    it("claim 함수 실행 시 DAO 토큰이 정상적으로 전송되는지 확인", async () => {
      const target = ethers.Wallet.createRandom().address;
      const title = "Test Campaign";
      const description = "This is a test campaign";
      const goal = HardhatUtil.ToETH(1);
      const latestBlock = await ethers.provider.getBlock("latest");
      const startAt = latestBlock.timestamp + 100;
      const endAt = latestBlock.timestamp + 200;

      await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);

      // 캠페인 시작 시간으로 이동
      await HardhatUtil.passNSeconds(100);

      await daoToken.connect(users[1]).buyTokens({ value: HardhatUtil.ToETH(1) });
      await daoToken.connect(users[1]).approve(donation.address, HardhatUtil.ToETH(1));
      await donation.connect(users[1]).pledge(1, HardhatUtil.ToETH(1));

      // 캠페인 종료 시간으로 이동
      await HardhatUtil.passNSeconds(100);

      await donation.connect(users[0]).claim(1);

      const balance = await daoToken.balanceOf(target);
      expect(balance).to.equal(HardhatUtil.ToETH(1));
    });

    it("claim 함수 실행 시 이벤트가 정상적으로 발생하는지 확인", async () => {
      const target = ethers.Wallet.createRandom().address;
      const title = "Test Campaign";
      const description = "This is a test campaign";
      const goal = HardhatUtil.ToETH(1);
      const latestBlock = await ethers.provider.getBlock("latest");
      const startAt = latestBlock.timestamp + 100;
      const endAt = latestBlock.timestamp + 200;

      await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);

      // 캠페인 시작 시간으로 이동
      await HardhatUtil.passNSeconds(100);

      await daoToken.connect(users[1]).buyTokens({ value: HardhatUtil.ToETH(1) });
      await daoToken.connect(users[1]).approve(donation.address, HardhatUtil.ToETH(1));
      await donation.connect(users[1]).pledge(1, HardhatUtil.ToETH(1));

      // 캠페인 종료 시간으로 이동
      await HardhatUtil.passNSeconds(100);

      await expect(donation.connect(users[0]).claim(1)).to.emit(donation, "Claim").withArgs(1, true);
    });

    it("refund 함수 실행 시 isEnded가 true인 경우 실패하는지 확인", async () => {
      const target = ethers.Wallet.createRandom().address;
      const title = "Test Campaign";
      const description = "This is a test campaign";
      const goal = HardhatUtil.ToETH(1);
      const latestBlock = await ethers.provider.getBlock("latest");
      const startAt = latestBlock.timestamp + 100;
      const endAt = latestBlock.timestamp + 200;

      await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);

      // 캠페인 시작 시간으로 이동
      await HardhatUtil.passNSeconds(100);

      await daoToken.connect(users[1]).buyTokens({ value: HardhatUtil.ToETH(1) });
      await daoToken.connect(users[1]).approve(donation.address, HardhatUtil.ToETH(1));
      await donation.connect(users[1]).pledge(1, HardhatUtil.ToETH(1));

      // 캠페인 종료 시간으로 이동
      await HardhatUtil.passNSeconds(100);

      await donation.connect(users[0]).claim(1);

      await expect(donation.connect(users[1]).refund(1)).to.be.revertedWith("ended");
    });

    it("refund 함수 실행 시 DAO 토큰이 정상적으로 전송되는지 확인", async () => {
      const target = ethers.Wallet.createRandom().address;
      const title = "Test Campaign";
      const description = "This is a test campaign";
      const goal = HardhatUtil.ToETH(1);
      const latestBlock = await ethers.provider.getBlock("latest");
      const startAt = latestBlock.timestamp + 100;
      const endAt = latestBlock.timestamp + 200;

      await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);

      // 캠페인 시작 시간으로 이동
      await HardhatUtil.passNSeconds(100);

      await daoToken.connect(users[1]).buyTokens({ value: HardhatUtil.ToETH(0.5) });
      await daoToken.connect(users[1]).approve(donation.address, HardhatUtil.ToETH(0.5));
      await donation.connect(users[1]).pledge(1, HardhatUtil.ToETH(0.5));

      // 초기 잔액 확인
      const initialBalance = await daoToken.balanceOf(users[1].address);

      await donation.connect(users[1]).refund(1);

      // 최종 잔액 확인
      const finalBalance = await daoToken.balanceOf(users[1].address);
      const expectedFinalBalance = initialBalance.add(HardhatUtil.ToETH(0.5));

      expect(finalBalance).to.equal(expectedFinalBalance);
    });

    it("refund 함수 실행 시 이벤트가 정상적으로 발생하는지 확인", async () => {
      const target = ethers.Wallet.createRandom().address;
      const title = "Test Campaign";
      const description = "This is a test campaign";
      const goal = HardhatUtil.ToETH(1);
      const latestBlock = await ethers.provider.getBlock("latest");
      const startAt = latestBlock.timestamp + 100;
      const endAt = latestBlock.timestamp + 200;

      await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);

      // 캠페인 시작 시간으로 이동
      await HardhatUtil.passNSeconds(100);

      await daoToken.connect(users[1]).buyTokens({ value: HardhatUtil.ToETH(0.5) });
      await daoToken.connect(users[1]).approve(donation.address, HardhatUtil.ToETH(0.5));
      await donation.connect(users[1]).pledge(1, HardhatUtil.ToETH(0.5));

      await expect(donation.connect(users[1]).refund(1))
        .to.emit(donation, "Refund")
        .withArgs(1, users[1].address, HardhatUtil.ToETH(0.5));
    });
  });

  describe("Dao 테스트", () => {
    it("Dao 컨트랙트의 생성자가 정상적으로 설정되어 있는지 확인", async () => {
      expect(await dao.admin()).to.equal(admin.address);
    });

    it("startVote 함수 실행 시 voteInProgress가 true인 경우 함수가 리버트 되는지 확인", async () => {
      const target = ethers.Wallet.createRandom().address;
      const title = "Test Campaign";
      const description = "This is a test campaign";
      const goal = HardhatUtil.ToETH(1);
      const latestBlock = await ethers.provider.getBlock("latest");
      const startAt = latestBlock.timestamp + 100;
      const endAt = latestBlock.timestamp + 200;

      await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);
      await dao.connect(users[0]).startVote(1);

      await expect(dao.connect(users[0]).startVote(1)).to.be.revertedWith(
        "A vote is already in progress for this campaign.",
      );
    });

    //   function startVote(uint256 _campaignId) external {
    //     uint256 goal = donation.getCampaignGoal(_campaignId);
    //     uint256 totalAmount = donation.getCampaignTotalAmount(_campaignId);
    //     require(!voteInProgress[_campaignId], "A vote is already in progress for this campaign.");

    //     emit VoteStarted(_campaignId, goal, totalAmount);

    //     for (uint i = 0; i < daoMemberList.length; i++) {
    //         address voter = daoMemberList[i];
    //         hasVoted[voter] = false; //모든 다오 멤버가 다시 투표할 수 있는 상태로 만들어 줌!!
    //     }
    //     voteCountYes[_campaignId] = 0;
    //     voteCountNo[_campaignId] = 0;
    //     voteInProgress[_campaignId] = true;

    //     emit VoteReady(_campaignId, voteCountYes[_campaignId], voteCountNo[_campaignId], voteInProgress[_campaignId]);
    // }
    it("startVote 함수 실행 시 voteInProgress가 false인 경우 VoteStarted 이벤트가 정상적으로 발생하는지 확인", async () => {
      const target = ethers.Wallet.createRandom().address;
      const title = "Test Campaign";
      const description = "This is a test campaign";
      const goal = HardhatUtil.ToETH(1);
      const latestBlock = await ethers.provider.getBlock("latest");
      const startAt = latestBlock.timestamp + 100;
      const endAt = latestBlock.timestamp + 200;

      await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);

      await expect(dao.connect(users[0]).startVote(1)).to.emit(dao, "VoteStarted").withArgs(1, goal, 0);
    });

    it("startVote 함수 실행 성공 시 daoMemberList(5명)의 hasVoted가 false로 설정되는지 확인", async () => {
      const target = ethers.Wallet.createRandom().address;
      const title = "Test Campaign";
      const description = "This is a test campaign";
      const goal = HardhatUtil.ToETH(1);
      const latestBlock = await ethers.provider.getBlock("latest");
      const startAt = latestBlock.timestamp + 100;
      const endAt = latestBlock.timestamp + 200;

      await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);
      await dao.connect(users[0]).startVote(1);

      for (let i = 0; i < 5; i++) {
        const voter = users[i].address;
        expect(await dao.hasVoted(voter)).to.equal(false);
      }
    });

    it("startVote 함수 실행 시 voteInProgress가 false인 경우 VoteReady 이벤트가 정상적으로 발생하는지 확인", async () => {
      const target = ethers.Wallet.createRandom().address;
      const title = "Test Campaign";
      const description = "This is a test campaign";
      const goal = HardhatUtil.ToETH(1);
      const latestBlock = await ethers.provider.getBlock("latest");
      const startAt = latestBlock.timestamp + 100;
      const endAt = latestBlock.timestamp + 200;

      await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);

      await expect(dao.connect(users[0]).startVote(1)).to.emit(dao, "VoteReady").withArgs(1, 0, 0, true);
    });

    it("vote 함수 실행 시 onlyDaoMember modifier가 정상적으로 작동하는지 확인", async () => {
      const target = ethers.Wallet.createRandom().address;
      const title = "Test Campaign";
      const description = "This is a test campaign";
      const goal = HardhatUtil.ToETH(1);
      const latestBlock = await ethers.provider.getBlock("latest");
      const startAt = latestBlock.timestamp + 100;
      const endAt = latestBlock.timestamp + 200;

      await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);
      await dao.connect(users[0]).startVote(1);

      await expect(dao.connect(users[1]).vote(1, true)).to.be.revertedWith("Only DAO members can perform this action");
    });

    it("vote 함수 실행 시 hasVoted가 true인 경우 실패하는지 확인", async () => {
      const target = ethers.Wallet.createRandom().address;
      const title = "Test Campaign";
      const description = "This is a test campaign";
      const goal = HardhatUtil.ToETH(1);
      const latestBlock = await ethers.provider.getBlock("latest");
      const startAt = latestBlock.timestamp + 100;
      const endAt = latestBlock.timestamp + 200;

      await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);

      // 사용자를 DAO 멤버로 승인
      await dao.connect(admin).approveDaoMembership(users[0].address, true);
      await dao.connect(admin).approveDaoMembership(users[1].address, true);

      await dao.connect(users[0]).startVote(1);
      await dao.connect(users[1]).vote(1, true);

      await expect(dao.connect(users[1]).vote(1, true)).to.be.revertedWith("You have already voted.");
    });

    it("vote 함수 실행 시 _agree가 true인 경우 voteCountYes가 1 증가하는지 확인", async () => {
      const target = ethers.Wallet.createRandom().address;
      const title = "Test Campaign";
      const description = "This is a test campaign";
      const goal = HardhatUtil.ToETH(1);
      const latestBlock = await ethers.provider.getBlock("latest");
      const startAt = latestBlock.timestamp + 100;
      const endAt = latestBlock.timestamp + 200;

      await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);

      // 사용자를 DAO 멤버로 승인
      await dao.connect(admin).approveDaoMembership(users[0].address, true);
      await dao.connect(admin).approveDaoMembership(users[1].address, true);

      await dao.connect(users[0]).startVote(1);
      await dao.connect(users[1]).vote(1, true);

      expect(await dao.voteCountYes(1)).to.equal(1);
    });

    it("vote 함수 실행 시 _agree가 false인 경우 voteCountNo가 1 증가하는지 확인", async () => {
      const target = ethers.Wallet.createRandom().address;
      const title = "Test Campaign";
      const description = "This is a test campaign";
      const goal = HardhatUtil.ToETH(1);
      const latestBlock = await ethers.provider.getBlock("latest");
      const startAt = latestBlock.timestamp + 100;
      const endAt = latestBlock.timestamp + 200;

      await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);

      // 사용자를 DAO 멤버로 승인
      await dao.connect(admin).approveDaoMembership(users[0].address, true);
      await dao.connect(admin).approveDaoMembership(users[1].address, true);

      await dao.connect(users[0]).startVote(1);
      await dao.connect(users[1]).vote(1, false);

      expect(await dao.voteCountNo(1)).to.equal(1);
    });

    it("vote 함수 실행 시 Voted 이벤트가 정상적으로 발생하는지 확인", async () => {
      const target = ethers.Wallet.createRandom().address;
      const title = "Test Campaign";
      const description = "This is a test campaign";
      const goal = HardhatUtil.ToETH(1);
      const latestBlock = await ethers.provider.getBlock("latest");
      const startAt = latestBlock.timestamp + 100;
      const endAt = latestBlock.timestamp + 200;

      // 사용자를 DAO 멤버로 승인
      await dao.connect(admin).approveDaoMembership(users[1].address, true);

      await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);
      await dao.connect(users[0]).startVote(1);
      await expect(dao.connect(users[1]).vote(1, true)).to.emit(dao, "Voted").withArgs(1, users[1].address, true);
    });

    it("vote 함수 실행 시 모든 다오 멤버가 투표한 경우 voteEnd 함수가 실행되는지 확인", async () => {
      const target = ethers.Wallet.createRandom().address;
      const title = "Test Campaign";
      const description = "This is a test campaign";
      const goal = HardhatUtil.ToETH(1);
      const latestBlock = await ethers.provider.getBlock("latest");
      const startAt = latestBlock.timestamp + 100;
      const endAt = latestBlock.timestamp + 200;

      await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);

      // 사용자를 DAO 멤버로 승인
      for (let i = 1; i <= 4; i++) {
        await dao.connect(admin).approveDaoMembership(users[i].address, true);
      }

      await dao.connect(users[0]).startVote(1);
      await dao.connect(users[1]).vote(1, true);
      await dao.connect(users[2]).vote(1, true);
      await dao.connect(users[3]).vote(1, true);
      await dao.connect(users[4]).vote(1, true);

      // 모든 다오 멤버가 투표한 후 voteInProgress가 false로 설정되는지 확인
      const voteInProgress = await dao.voteInProgress(1);
      expect(voteInProgress).to.equal(false);
    });

    it("vote 함수 실행 시 voteEnd 함수가 실행되면 agreePercentage가 70% 이상인 경우 VoteEnded_approve 이벤트가 발생하는지 확인", async () => {
      const target = ethers.Wallet.createRandom().address;
      const title = "Test Campaign";
      const description = "This is a test campaign";
      const goal = HardhatUtil.ToETH(1);
      const latestBlock = await ethers.provider.getBlock("latest");
      const startAt = latestBlock.timestamp + 100;
      const endAt = latestBlock.timestamp + 200;

      await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);

      // 사용자를 DAO 멤버로 승인
      for (let i = 1; i <= 4; i++) {
        await dao.connect(admin).approveDaoMembership(users[i].address, true);
      }

      // 투표 시작
      await dao.connect(users[0]).startVote(1);

      // 각 DAO 멤버가 투표
      await dao.connect(users[1]).vote(1, true);
      await dao.connect(users[2]).vote(1, true);
      await dao.connect(users[3]).vote(1, true);

      // 마지막 멤버가 투표할 때 이벤트 발생 확인
      await expect(dao.connect(users[4]).vote(1, true))
        .to.emit(dao, "VoteEnded_approve")
        .withArgs(1, 100, "The campaign has been approved for claim.");
    });

    it("requestDaoMembership 함수 실행 시 이미 DAO 멤버인 경우 실패하는지 확인", async () => {
      await dao.connect(admin).approveDaoMembership(users[0].address, true);
      await expect(dao.connect(users[0]).requestDaoMembership()).to.be.revertedWith("User is already a DAO member");
    });

    it("requestDaoMembership 함수 실행 시 DaoMembershipRequested 이벤트가 정상적으로 발생하는지 확인", async () => {
      await expect(dao.connect(users[5]).requestDaoMembership())
        .to.emit(dao, "DaoMembershipRequested")
        .withArgs(users[5].address, "User has requested DAO membership");
    });

    it("requestRejectDaoMembership 함수 실행 시 DAO 멤버가 아닌 경우 실패하는지 확인", async () => {
      await expect(dao.connect(users[0]).requestRejectDaoMembership()).to.be.revertedWith("User is not a DAO member");
    });

    it("requestRejectDaoMembership 함수 실행 시 RejectDaoMembershipRequested 이벤트가 정상적으로 발생하는지 확인", async () => {
      await dao.connect(admin).approveDaoMembership(users[0].address, true);
      await expect(dao.connect(users[0]).requestRejectDaoMembership())
        .to.emit(dao, "RejectDaoMembershipRequested")
        .withArgs(users[0].address, "User has requested to leave DAO membership");
    });

    it("approveDaoMembership 함수 실행 시 onlyAdmin modifier가 정상적으로 작동하는지 확인", async () => {
      await expect(dao.connect(users[0]).approveDaoMembership(users[1].address, true)).to.be.revertedWith(
        "Only admin can perform this action",
      );
    });
    it("approveDaoMembership 함수 실행 시 관리자가 승인을 수락하면 DaoMembershipApproved 이벤트가 정상적으로 발생하는지 확인", async () => {
      await expect(dao.connect(admin).approveDaoMembership(users[1].address, true))
        .to.emit(dao, "DaoMembershipApproved")
        .withArgs(users[1].address, true, "User has been approved as a DAO member");
    });

    it("approveDaoMembership 함수 실행 시 관리자가 승인을 거절하면 DaoMembershipRejected 이벤트가 정상적으로 발생하는지 확인", async () => {
      await expect(dao.connect(admin).approveDaoMembership(users[1].address, false))
        .to.emit(dao, "DaoMembershipRejected")
        .withArgs(users[1].address, false, "User has been rejected as a DAO member");
    });

    it("approveDaoMembership 함수 실행 시 membershipRequests 배열의 길이가 1만큼 줄어들었는지 확인", async () => {
      await dao.connect(users[5]).requestDaoMembership();
      await dao.connect(admin).approveDaoMembership(users[5].address, true);

      const length = await dao.membershipRequests.length;
      expect(length).to.equal(0);
    });

    it("rejectDaoMembership 함수 실행 시 onlyAdmin modifier가 정상적으로 작동하는지 확인", async () => {
      await expect(dao.connect(users[0]).rejectDaoMembership(users[1].address)).to.be.revertedWith(
        "Only admin can perform this action",
      );
    });

    it("rejectDaoMembership 함수 실행 시 DaoMembershipRejected 이벤트가 정상적으로 발생하는지 확인", async () => {
      await dao.connect(admin).approveDaoMembership(users[1].address, true);
      await expect(dao.connect(admin).rejectDaoMembership(users[1].address))
        .to.emit(dao, "DaoMembershipRejected")
        .withArgs(users[1].address, false, "User has been rejected as a DAO member");
    });

    it("rejectDaoMembership 함수 실행 시 membershipRequests 배열의 길이가 1만큼 줄어들었는지 확인", async () => {
      await dao.connect(admin).approveDaoMembership(users[5].address, true);
      await dao.connect(users[5]).requestRejectDaoMembership();
      await dao.connect(admin).rejectDaoMembership(users[5].address);

      const length = await dao.membershipRequests.length;
      expect(length).to.equal(0);
    });
  });
});
