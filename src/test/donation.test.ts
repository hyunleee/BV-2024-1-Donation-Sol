import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { setup } from "./setup";
import { DaoToken, Dao, Donation } from "@typechains";
import { expect } from "chai";
import { ethers, network } from "hardhat";
import { HardhatUtil } from "./lib/hardhat_utils";
import { mockCampaign } from "./mock/mock";

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

  it("Donation 컨트랙트의 생성자가 정상적으로 설정되어 있는지 확인", async () => {
    expect(await donation.admin()).to.equal(admin.address);
    expect(await donation.daoToken()).to.equal(daoToken.address);
  });

  // NOTE: 1차 과제에는 포함 X
  it("Donation 컨트랙트의 Dao 컨트랙트 주소가 정상적으로 설정되어 있는지 확인", async () => {
    expect(await donation.dao()).to.equal(dao.address);
  });

  describe("캠페인 생성(Launch) 테스트", () => {
    const campaignInfo = mockCampaign();

    it("launch 함수가 시작 시간이 현재 시간보다 이전인 경우 실패하는지 확인", async () => {
      const startAtInput = Math.floor(Date.now() / 1000) - 1000;
      const invalidCampaignInfo = mockCampaign({ startAt: startAtInput });
      const { target, title, description, goal, startAt, endAt } = invalidCampaignInfo;

      await expect(
        donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt),
      ).to.be.revertedWith("start at < now");
    });

    it("launch 함수가 종료 시간이 시작 시간보다 이전인 경우 실패하는지 확인", async () => {
      const invalidCampaignInfo = mockCampaign({
        startAt: Math.floor(Date.now() / 1000) + 1000,
        endAt: Math.floor(Date.now() / 1000) - 1000,
      });
      const { target, title, description, goal, startAt, endAt } = invalidCampaignInfo;

      await expect(
        donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt),
      ).to.be.revertedWith("end at < start at");
    });

    it("launch 함수가 종료 시간이 90일을 초과하는 경우 실패하는지 확인", async () => {
      const invalidCampaignInfo = mockCampaign({ endAt: Math.floor(Date.now() / 1000) + 100 * 24 * 60 * 60 });
      const { target, title, description, goal, startAt, endAt } = invalidCampaignInfo;

      await expect(
        donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt),
      ).to.be.revertedWith("end at > max duration");
    });

    it("launch 함수 실행 후 캠페인 정보가 정상적으로 등록되는지 확인", async () => {
      const { target, title, description, goal, startAt, endAt } = campaignInfo;

      await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);

      /* Campaign */
      const campaign = await donation.campaigns(1);
      expect(campaign.creator).to.equal(users[0].address);
      expect(campaign.target).to.equal(target);
      expect(campaign.title).to.equal(title);
      expect(campaign.description).to.equal(description);
      expect(campaign.goal).to.equal(goal);
      expect(campaign.startAt).to.equal(startAt);
      expect(campaign.endAt).to.equal(endAt);
      expect(campaign.pledged).to.equal(0);
      expect(campaign.claimed).to.equal(false);

      /* count */
      expect(await donation.count()).to.equal(1);
    });

    it("launch 함수 실행 후 이벤트가 정상적으로 발생하는지 확인", async () => {
      const { target, title, description, goal, startAt, endAt } = campaignInfo;

      await expect(donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt))
        .to.emit(donation, "Launch")
        .withArgs(1, [users[0].address, target, title, description, goal, 0, startAt, endAt, false]);
    });
  });

  // it("cancel 함수 실행 시 creator가 아닌 경우 실패하는지 확인", async () => {
  //   const target = ethers.Wallet.createRandom().address;
  //   const title = "Test Campaign";
  //   const description = "This is a test campaign";
  //   const goal = HardhatUtil.ToETH(1);
  //   const startAt = Math.floor(Date.now() / 1000) + 1000;
  //   const endAt = Math.floor(Date.now() / 1000) + 2000;

  //   await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);
  //   await expect(donation.connect(users[1]).cancel(1)).to.be.revertedWith("not creator");
  // });

  // it("cancel 함수 실행 시 캠페인이 이미 시작한 경우 실패하는지 확인", async () => {
  //   const target = ethers.Wallet.createRandom().address;
  //   const title = "Test Campaign";
  //   const description = "This is a test campaign";
  //   const goal = HardhatUtil.ToETH(1);
  //   const startAt = Math.floor(Date.now() / 1000) + 500; // 캠페인이 500초 후 시작
  //   const endAt = Math.floor(Date.now() / 1000) + 2000;

  //   await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);

  //   // 시간 이동 (캠페인이 시작되도록)
  //   await network.provider.send("evm_increaseTime", [600]);
  //   await network.provider.send("evm_mine");

  //   await expect(donation.connect(users[0]).cancel(1)).to.be.revertedWith("started");
  // });

  // it("cancel 함수 실행 시 Campaign이 삭제되는지 확인", async () => {
  //   const target = ethers.Wallet.createRandom().address;
  //   const title = "Test Campaign";
  //   const description = "This is a test campaign";
  //   const goal = HardhatUtil.ToETH(1);
  //   const startAt = Math.floor(Date.now() / 1000) + 1000;
  //   const endAt = Math.floor(Date.now() / 1000) + 2000;

  //   await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);
  //   await donation.connect(users[0]).cancel(1);

  //   const campaign = await donation.campaigns(1);
  //   expect(campaign.creator).to.equal(ethers.constants.AddressZero);
  // });

  // it("cancel 함수 실행 시 이벤트가 정상적으로 발생하는지 확인", async () => {
  //   const target = ethers.Wallet.createRandom().address;
  //   const title = "Test Campaign";
  //   const description = "This is a test campaign";
  //   const goal = HardhatUtil.ToETH(1);
  //   const startAt = Math.floor(Date.now() / 1000) + 1000;
  //   const endAt = Math.floor(Date.now() / 1000) + 2000;

  //   await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);
  //   await expect(donation.connect(users[0]).cancel(1)).to.emit(donation, "Cancel").withArgs(1, true);
  // });

  // it("pledge 함수 실행 시 캠페인이 시작되지 않은 경우 실패하는지 확인", async () => {
  //   const target = ethers.Wallet.createRandom().address;
  //   const title = "Test Campaign";
  //   const description = "This is a test campaign";
  //   const goal = HardhatUtil.ToETH(1);
  //   const latestBlock = await ethers.provider.getBlock("latest");
  //   const startAt = latestBlock.timestamp + 1000;
  //   const endAt = latestBlock.timestamp + 2000;

  //   await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);
  //   await expect(donation.connect(users[1]).pledge(1, HardhatUtil.ToETH(1))).to.be.revertedWith("not started");
  // });

  // it("pledge 함수 실행 시 캠페인이 종료된 경우 실패하는지 확인", async () => {
  //   const target = ethers.Wallet.createRandom().address;
  //   const title = "Test Campaign";
  //   const description = "This is a test campaign";
  //   const goal = HardhatUtil.ToETH(1);

  //   // 현재 블록 타임스탬프 가져오기
  //   const latestBlock = await ethers.provider.getBlock("latest");
  //   const startAt = latestBlock.timestamp + 100; // 현재 시간보다 100초 후로 설정
  //   const endAt = latestBlock.timestamp + 200; // 현재 시간보다 200초 후로 설정

  //   // 캠페인 생성
  //   await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);

  //   // 캠페인이 종료되도록 시간을 이동
  //   await HardhatUtil.passNSeconds(300); // 300초를 이동하여 캠페인이 종료되도록 함

  //   // isEnded 상태 업데이트
  //   await donation.connect(users[0]).getIsEnded(1);

  //   // DaoToken 구매
  //   await daoToken.connect(users[1]).buyTokens({ value: HardhatUtil.ToETH(1) });

  //   // 충분한 토큰 허용량을 설정
  //   await daoToken.connect(users[1]).approve(donation.address, HardhatUtil.ToETH(1));

  //   // 캠페인이 종료된 상태에서 pledge 시도
  //   await expect(donation.connect(users[1]).pledge(1, HardhatUtil.ToETH(1))).to.be.revertedWith("ended");
  // });

  // it("pledge 함수 실행 시 amount가 0인 경우 실패하는지 확인", async () => {
  //   const target = ethers.Wallet.createRandom().address;
  //   const title = "Test Campaign";
  //   const description = "This is a test campaign";
  //   const goal = HardhatUtil.ToETH(1);
  //   const latestBlock = await ethers.provider.getBlock("latest");
  //   const startAt = latestBlock.timestamp + 100;
  //   const endAt = latestBlock.timestamp + 200;

  //   await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);

  //   // 캠페인 시작 시간으로 이동
  //   await HardhatUtil.passNSeconds(100);

  //   await daoToken.connect(users[0]).approve(donation.address, HardhatUtil.ToETH(1));

  //   await expect(donation.connect(users[0]).pledge(1, 0)).to.be.revertedWith("Amount must be greater than zero");
  // });

  // it("pledge 함수 실행 시 DAO 토큰이 정상적으로 전송되는지 확인", async () => {
  //   const target = ethers.Wallet.createRandom().address;
  //   const title = "Test Campaign";
  //   const description = "This is a test campaign";
  //   const goal = HardhatUtil.ToETH(1);
  //   const latestBlock = await ethers.provider.getBlock("latest");
  //   const startAt = latestBlock.timestamp + 100;
  //   const endAt = latestBlock.timestamp + 200;

  //   await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);

  //   // 캠페인 시작 시간으로 이동
  //   await HardhatUtil.passNSeconds(100);

  //   await daoToken.connect(users[0]).buyTokens({ value: HardhatUtil.ToETH(1) });
  //   await daoToken.connect(users[0]).approve(donation.address, HardhatUtil.ToETH(1));
  //   await donation.connect(users[0]).pledge(1, HardhatUtil.ToETH(1));

  //   const balance = await daoToken.balanceOf(users[0].address);
  //   expect(balance).to.equal(HardhatUtil.ToETH(99999)); // 100,000 - 1
  // });

  // it("pledge 함수 실행 시 Campaign의 목표 금액을 달성하지 못한 경우 투표가 시작되지 않는지 확인", async () => {
  //   const target = ethers.Wallet.createRandom().address;
  //   const title = "Test Campaign";
  //   const description = "This is a test campaign";
  //   const goal = HardhatUtil.ToETH(1);

  //   // 현재 블록 타임스탬프 가져오기
  //   const latestBlock = await ethers.provider.getBlock("latest");
  //   const startAt = latestBlock.timestamp + 100; // 현재 시간보다 100초 후로 설정
  //   const endAt = latestBlock.timestamp + 200; // 현재 시간보다 200초 후로 설정

  //   // 캠페인 생성
  //   await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);

  //   // 캠페인 시작 시간으로 이동
  //   await network.provider.send("evm_increaseTime", [100]);
  //   await network.provider.send("evm_mine");

  //   // DaoToken 구매
  //   await daoToken.connect(users[1]).buyTokens({ value: HardhatUtil.ToETH(1) });

  //   // 충분한 토큰 허용량을 설정
  //   await daoToken.connect(users[1]).approve(donation.address, HardhatUtil.ToETH(1));

  //   // 캠페인이 시작된 상태에서 pledge 시도
  //   await donation.connect(users[1]).pledge(1, HardhatUtil.ToETH(0.5));

  //   // Campaign이 목표 금액에 도달하지 않았는지 확인
  //   const campaign = await donation.campaigns(1);
  //   expect(campaign.pledged).to.equal(HardhatUtil.ToETH(0.5));
  //   expect(await donation.isEnded(1)).to.equal(false);
  // });

  // it("pledge 함수 실행 시 Campaign의 목표 금액을 달성한 경우 isEnded가 true로 설정되는지 확인", async () => {
  //   const target = ethers.Wallet.createRandom().address;
  //   const title = "Test Campaign";
  //   const description = "This is a test campaign";
  //   const goal = HardhatUtil.ToETH(1);
  //   const latestBlock = await ethers.provider.getBlock("latest");
  //   const startAt = latestBlock.timestamp + 100;
  //   const endAt = latestBlock.timestamp + 200;

  //   await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);

  //   // 캠페인 시작 시간으로 이동
  //   await HardhatUtil.passNSeconds(100);

  //   await daoToken.connect(users[0]).buyTokens({ value: HardhatUtil.ToETH(1) });
  //   await daoToken.connect(users[0]).approve(donation.address, HardhatUtil.ToETH(1));
  //   await donation.connect(users[0]).pledge(1, HardhatUtil.ToETH(1));

  //   expect(await donation.isEnded(1)).to.equal(true);
  // });

  // it("pledge 함수 실행 시 Campaign의 목표 금액을 달성하지 못한 경우 투표가 시작되지 않는지 확인", async () => {
  //   const target = ethers.Wallet.createRandom().address;
  //   const title = "Test Campaign";
  //   const description = "This is a test campaign";
  //   const goal = HardhatUtil.ToETH(1);

  //   // 현재 블록 타임스탬프 가져오기
  //   const latestBlock = await ethers.provider.getBlock("latest");
  //   const startAt = latestBlock.timestamp + 100; // 현재 시간보다 100초 후로 설정
  //   const endAt = latestBlock.timestamp + 200; // 현재 시간보다 200초 후로 설정

  //   // 캠페인 생성
  //   await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);

  //   // 캠페인 시작 시간으로 이동
  //   await network.provider.send("evm_increaseTime", [100]);
  //   await network.provider.send("evm_mine");

  //   // DaoToken 구매
  //   await daoToken.connect(users[1]).buyTokens({ value: HardhatUtil.ToETH(1) });

  //   // 충분한 토큰 허용량을 설정
  //   await daoToken.connect(users[1]).approve(donation.address, HardhatUtil.ToETH(1));

  //   // 캠페인이 시작된 상태에서 pledge 시도
  //   await donation.connect(users[1]).pledge(1, HardhatUtil.ToETH(0.5));

  //   // Campaign이 목표 금액에 도달하지 않았는지 확인
  //   const campaign = await donation.campaigns(1);
  //   expect(campaign.pledged).to.equal(HardhatUtil.ToETH(0.5));
  //   expect(await donation.isEnded(1)).to.equal(false);
  // });

  // it("pledge 함수 실행 시 Campaign의 목표 금액을 달성하지 못한 경우 isEnded가 false로 설정되는지 확인", async () => {
  //   const target = ethers.Wallet.createRandom().address;
  //   const title = "Test Campaign";
  //   const description = "This is a test campaign";
  //   const goal = HardhatUtil.ToETH(1);
  //   const latestBlock = await ethers.provider.getBlock("latest");
  //   const startAt = latestBlock.timestamp + 100;
  //   const endAt = latestBlock.timestamp + 200;

  //   await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);

  //   // 캠페인 시작 시간으로 이동
  //   await HardhatUtil.passNSeconds(100);

  //   await daoToken.connect(users[1]).buyTokens({ value: HardhatUtil.ToETH(0.5) });
  //   await daoToken.connect(users[1]).approve(donation.address, HardhatUtil.ToETH(0.5));
  //   await donation.connect(users[1]).pledge(1, HardhatUtil.ToETH(0.5));

  //   expect(await donation.isEnded(1)).to.equal(false);
  // });

  // it("pledge 함수 실행 시 이벤트가 정상적으로 발생하는지 확인", async () => {
  //   const target = ethers.Wallet.createRandom().address;
  //   const title = "Test Campaign";
  //   const description = "This is a test campaign";
  //   const goal = HardhatUtil.ToETH(1);
  //   const latestBlock = await ethers.provider.getBlock("latest");
  //   const startAt = latestBlock.timestamp + 100;
  //   const endAt = latestBlock.timestamp + 200;

  //   await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);

  //   // 캠페인 시작 시간으로 이동
  //   await HardhatUtil.passNSeconds(100);

  //   await daoToken.connect(users[1]).buyTokens({ value: HardhatUtil.ToETH(1) });
  //   await daoToken.connect(users[1]).approve(donation.address, HardhatUtil.ToETH(1));

  //   await expect(donation.connect(users[1]).pledge(1, HardhatUtil.ToETH(1)))
  //     .to.emit(donation, "Pledge")
  //     .withArgs(1, users[1].address, HardhatUtil.ToETH(1), HardhatUtil.ToETH(1)); // 1 ETH => 1 Pledge, Total Pledged = 1 ETH
  // });

  // it("unpledge 함수 실행 시 amount가 0인 경우 실패하는지 확인", async () => {
  //   const target = ethers.Wallet.createRandom().address;
  //   const title = "Test Campaign";
  //   const description = "This is a test campaign";
  //   const goal = HardhatUtil.ToETH(1);
  //   const latestBlock = await ethers.provider.getBlock("latest");
  //   const startAt = latestBlock.timestamp + 100;
  //   const endAt = latestBlock.timestamp + 2000;

  //   await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);

  //   // 캠페인 시작 시간으로 이동
  //   await HardhatUtil.passNSeconds(100);

  //   await daoToken.connect(users[1]).buyTokens({ value: HardhatUtil.ToETH(1) });
  //   await daoToken.connect(users[1]).approve(donation.address, HardhatUtil.ToETH(1));

  //   await donation.connect(users[1]).pledge(1, HardhatUtil.ToETH(1));

  //   await expect(donation.connect(users[1]).unpledge(1, 0)).to.be.revertedWith("Amount must be greater than zero");
  // });

  // it("unpledge 함수 실행 시 isEnded가 true인 경우 실패하는지 확인", async () => {
  //   const target = ethers.Wallet.createRandom().address;
  //   const title = "Test Campaign";
  //   const description = "This is a test campaign";
  //   const goal = HardhatUtil.ToETH(1);
  //   const latestBlock = await ethers.provider.getBlock("latest");
  //   const startAt = latestBlock.timestamp + 100;
  //   const endAt = latestBlock.timestamp + 200; // 종료 시간을 가까이 설정

  //   await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);

  //   // 캠페인 시작 시간으로 이동
  //   await HardhatUtil.passNSeconds(100);

  //   await daoToken.connect(users[1]).buyTokens({ value: HardhatUtil.ToETH(1) });
  //   await daoToken.connect(users[1]).approve(donation.address, HardhatUtil.ToETH(1));

  //   await donation.connect(users[1]).pledge(1, HardhatUtil.ToETH(1));

  //   // 캠페인 종료 시간으로 이동
  //   await HardhatUtil.passNSeconds(100);

  //   await expect(donation.connect(users[1]).unpledge(1, HardhatUtil.ToETH(1))).to.be.revertedWith("ended");
  // });

  // it("unpledge 함수 실행 시 DAO 토큰이 정상적으로 전송되는지 확인", async () => {
  //   const target = ethers.Wallet.createRandom().address;
  //   const title = "Test Campaign";
  //   const description = "This is a test campaign";
  //   const goal = HardhatUtil.ToETH(1);
  //   const latestBlock = await ethers.provider.getBlock("latest");
  //   const startAt = latestBlock.timestamp + 100;
  //   const endAt = latestBlock.timestamp + 2000;

  //   await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);

  //   // 캠페인 시작 시간으로 이동
  //   await HardhatUtil.passNSeconds(100);

  //   await daoToken.connect(users[1]).buyTokens({ value: HardhatUtil.ToETH(1) });
  //   await daoToken.connect(users[1]).approve(donation.address, HardhatUtil.ToETH(1));

  //   await donation.connect(users[1]).pledge(1, HardhatUtil.ToETH(0.5)); // 목표 금액 미달성
  //   await donation.connect(users[1]).unpledge(1, HardhatUtil.ToETH(0.5));

  //   const balance = await daoToken.balanceOf(users[1].address);
  //   expect(balance).to.equal(HardhatUtil.ToETH(100000)); // 100,000 - 0.5 + 0.5
  // });

  // it("unpledge 함수 실행 시 이벤트가 정상적으로 발생하는지 확인", async () => {
  //   const target = ethers.Wallet.createRandom().address;
  //   const title = "Test Campaign";
  //   const description = "This is a test campaign";
  //   const goal = HardhatUtil.ToETH(1);
  //   const latestBlock = await ethers.provider.getBlock("latest");
  //   const startAt = latestBlock.timestamp + 100;
  //   const endAt = latestBlock.timestamp + 2000;

  //   await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);

  //   // 캠페인 시작 시간으로 이동
  //   await HardhatUtil.passNSeconds(100);

  //   await daoToken.connect(users[1]).buyTokens({ value: HardhatUtil.ToETH(1) });
  //   await daoToken.connect(users[1]).approve(donation.address, HardhatUtil.ToETH(1));

  //   await donation.connect(users[1]).pledge(1, HardhatUtil.ToETH(0.5)); // 목표 금액 미달성

  //   await expect(donation.connect(users[1]).unpledge(1, HardhatUtil.ToETH(0.5)))
  //     .to.emit(donation, "Unpledge")
  //     .withArgs(1, users[1].address, HardhatUtil.ToETH(0.5), HardhatUtil.ToETH(0));
  // });

  // it("claim 함수 실행 시 creator가 아닌 경우 실패하는지 확인", async () => {
  //   const target = ethers.Wallet.createRandom().address;
  //   const title = "Test Campaign";
  //   const description = "This is a test campaign";
  //   const goal = HardhatUtil.ToETH(1);
  //   const latestBlock = await ethers.provider.getBlock("latest");
  //   const startAt = latestBlock.timestamp + 100;
  //   const endAt = latestBlock.timestamp + 200;

  //   await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);

  //   // 캠페인 시작 시간으로 이동
  //   await HardhatUtil.passNSeconds(100);

  //   await daoToken.connect(users[1]).buyTokens({ value: HardhatUtil.ToETH(1) });
  //   await daoToken.connect(users[1]).approve(donation.address, HardhatUtil.ToETH(1));
  //   await donation.connect(users[1]).pledge(1, HardhatUtil.ToETH(1));

  //   // 캠페인 종료 시간으로 이동
  //   await HardhatUtil.passNSeconds(100);

  //   await expect(donation.connect(users[1]).claim(1)).to.be.revertedWith("not creator");
  // });

  // it("claim 함수 실행 시 isEnded가 false인 경우 실패하는지 확인", async () => {
  //   const target = ethers.Wallet.createRandom().address;
  //   const title = "Test Campaign";
  //   const description = "This is a test campaign";
  //   const goal = HardhatUtil.ToETH(1);
  //   const latestBlock = await ethers.provider.getBlock("latest");
  //   const startAt = latestBlock.timestamp + 100;
  //   const endAt = latestBlock.timestamp + 200;

  //   await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);

  //   // 캠페인 시작 시간으로 이동
  //   await HardhatUtil.passNSeconds(100);

  //   await daoToken.connect(users[1]).buyTokens({ value: HardhatUtil.ToETH(0.5) });
  //   await daoToken.connect(users[1]).approve(donation.address, HardhatUtil.ToETH(0.5));
  //   await donation.connect(users[1]).pledge(1, HardhatUtil.ToETH(0.5)); // 목표 금액 미달성

  //   // 종료 시간 전인 상태에서 claim 시도
  //   await expect(donation.connect(users[0]).claim(1)).to.be.revertedWith("not ended");

  //   // 캠페인 종료 시간까지 이동하지 않음
  //   // expect문이 성공해야 함
  // });
  // it("claim 함수 실행 시 claimed가 true인 경우 실패하는지 확인", async () => {
  //   const target = ethers.Wallet.createRandom().address;
  //   const title = "Test Campaign";
  //   const description = "This is a test campaign";
  //   const goal = HardhatUtil.ToETH(1);
  //   const latestBlock = await ethers.provider.getBlock("latest");
  //   const startAt = latestBlock.timestamp + 100;
  //   const endAt = latestBlock.timestamp + 200;

  //   await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);

  //   // 캠페인 시작 시간으로 이동
  //   await HardhatUtil.passNSeconds(100);

  //   await daoToken.connect(users[1]).buyTokens({ value: HardhatUtil.ToETH(1) });
  //   await daoToken.connect(users[1]).approve(donation.address, HardhatUtil.ToETH(1));
  //   await donation.connect(users[1]).pledge(1, HardhatUtil.ToETH(1));

  //   // 캠페인 종료 시간으로 이동
  //   await HardhatUtil.passNSeconds(100);

  //   await donation.connect(users[0]).claim(1);

  //   await expect(donation.connect(users[0]).claim(1)).to.be.revertedWith("claimed");
  // });

  // it("claim 함수 실행 시 DAO 토큰이 정상적으로 전송되는지 확인", async () => {
  //   const target = ethers.Wallet.createRandom().address;
  //   const title = "Test Campaign";
  //   const description = "This is a test campaign";
  //   const goal = HardhatUtil.ToETH(1);
  //   const latestBlock = await ethers.provider.getBlock("latest");
  //   const startAt = latestBlock.timestamp + 100;
  //   const endAt = latestBlock.timestamp + 200;

  //   await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);

  //   // 캠페인 시작 시간으로 이동
  //   await HardhatUtil.passNSeconds(100);

  //   await daoToken.connect(users[1]).buyTokens({ value: HardhatUtil.ToETH(1) });
  //   await daoToken.connect(users[1]).approve(donation.address, HardhatUtil.ToETH(1));
  //   await donation.connect(users[1]).pledge(1, HardhatUtil.ToETH(1));

  //   // 캠페인 종료 시간으로 이동
  //   await HardhatUtil.passNSeconds(100);

  //   await donation.connect(users[0]).claim(1);

  //   const balance = await daoToken.balanceOf(target);
  //   expect(balance).to.equal(HardhatUtil.ToETH(1));
  // });

  // it("claim 함수 실행 시 이벤트가 정상적으로 발생하는지 확인", async () => {
  //   const target = ethers.Wallet.createRandom().address;
  //   const title = "Test Campaign";
  //   const description = "This is a test campaign";
  //   const goal = HardhatUtil.ToETH(1);
  //   const latestBlock = await ethers.provider.getBlock("latest");
  //   const startAt = latestBlock.timestamp + 100;
  //   const endAt = latestBlock.timestamp + 200;

  //   await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);

  //   // 캠페인 시작 시간으로 이동
  //   await HardhatUtil.passNSeconds(100);

  //   await daoToken.connect(users[1]).buyTokens({ value: HardhatUtil.ToETH(1) });
  //   await daoToken.connect(users[1]).approve(donation.address, HardhatUtil.ToETH(1));
  //   await donation.connect(users[1]).pledge(1, HardhatUtil.ToETH(1));

  //   // 캠페인 종료 시간으로 이동
  //   await HardhatUtil.passNSeconds(100);

  //   await expect(donation.connect(users[0]).claim(1)).to.emit(donation, "Claim").withArgs(1, true);
  // });

  // it("refund 함수 실행 시 isEnded가 true인 경우 실패하는지 확인", async () => {
  //   const target = ethers.Wallet.createRandom().address;
  //   const title = "Test Campaign";
  //   const description = "This is a test campaign";
  //   const goal = HardhatUtil.ToETH(1);
  //   const latestBlock = await ethers.provider.getBlock("latest");
  //   const startAt = latestBlock.timestamp + 100;
  //   const endAt = latestBlock.timestamp + 200;

  //   await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);

  //   // 캠페인 시작 시간으로 이동
  //   await HardhatUtil.passNSeconds(100);

  //   await daoToken.connect(users[1]).buyTokens({ value: HardhatUtil.ToETH(1) });
  //   await daoToken.connect(users[1]).approve(donation.address, HardhatUtil.ToETH(1));
  //   await donation.connect(users[1]).pledge(1, HardhatUtil.ToETH(1));

  //   // 캠페인 종료 시간으로 이동
  //   await HardhatUtil.passNSeconds(100);

  //   await donation.connect(users[0]).claim(1);

  //   await expect(donation.connect(users[1]).refund(1)).to.be.revertedWith("ended");
  // });

  // it("refund 함수 실행 시 DAO 토큰이 정상적으로 전송되는지 확인", async () => {
  //   const target = ethers.Wallet.createRandom().address;
  //   const title = "Test Campaign";
  //   const description = "This is a test campaign";
  //   const goal = HardhatUtil.ToETH(1);
  //   const latestBlock = await ethers.provider.getBlock("latest");
  //   const startAt = latestBlock.timestamp + 100;
  //   const endAt = latestBlock.timestamp + 200;

  //   await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);

  //   // 캠페인 시작 시간으로 이동
  //   await HardhatUtil.passNSeconds(100);

  //   await daoToken.connect(users[1]).buyTokens({ value: HardhatUtil.ToETH(0.5) });
  //   await daoToken.connect(users[1]).approve(donation.address, HardhatUtil.ToETH(0.5));
  //   await donation.connect(users[1]).pledge(1, HardhatUtil.ToETH(0.5));

  //   // 초기 잔액 확인
  //   const initialBalance = await daoToken.balanceOf(users[1].address);

  //   await donation.connect(users[1]).refund(1);

  //   // 최종 잔액 확인
  //   const finalBalance = await daoToken.balanceOf(users[1].address);
  //   const expectedFinalBalance = initialBalance.add(HardhatUtil.ToETH(0.5));

  //   expect(finalBalance).to.equal(expectedFinalBalance);
  // });

  // it("refund 함수 실행 시 이벤트가 정상적으로 발생하는지 확인", async () => {
  //   const target = ethers.Wallet.createRandom().address;
  //   const title = "Test Campaign";
  //   const description = "This is a test campaign";
  //   const goal = HardhatUtil.ToETH(1);
  //   const latestBlock = await ethers.provider.getBlock("latest");
  //   const startAt = latestBlock.timestamp + 100;
  //   const endAt = latestBlock.timestamp + 200;

  //   await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);

  //   // 캠페인 시작 시간으로 이동
  //   await HardhatUtil.passNSeconds(100);

  //   await daoToken.connect(users[1]).buyTokens({ value: HardhatUtil.ToETH(0.5) });
  //   await daoToken.connect(users[1]).approve(donation.address, HardhatUtil.ToETH(0.5));
  //   await donation.connect(users[1]).pledge(1, HardhatUtil.ToETH(0.5));

  //   await expect(donation.connect(users[1]).refund(1))
  //     .to.emit(donation, "Refund")
  //     .withArgs(1, users[1].address, HardhatUtil.ToETH(0.5));
  // });
});
