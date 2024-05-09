import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { setup } from "./setup";
import { DaoToken } from "@typechains";
import { Funding } from "@typechains";
import { DaoAdmin } from "@typechains";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers, network } from "hardhat";

describe("다오토큰 컨트랙트 테스트", () => {
  /* Signer */
  let admin: SignerWithAddress;
  let users: SignerWithAddress[];

  /* 컨트랙트 객체 */
  let daoToken: DaoToken;
  let funding: Funding;
  let daoAdmin: DaoAdmin;

  /* 테스트 스냅샷 */
  let initialSnapshotId: number;
  let snapshotId: number;

  before(async () => {
    /* 테스트에 필요한 컨트랙트 및 Signer 정보를 불러오는 함수 */
    ({ admin, users, daoToken, funding } = await setup());
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

  //위 내용까지는 건드리면 안되는 코드

  //error here!!!!!!!!!!!
  it("다오 토큰 주소", () => {
    console.log("다오 토큰 주소:", daoToken.address);
  });

  it("다오 토큰 이름과 심볼", async () => {
    const name = await daoToken.name();
    const symbol = await daoToken.symbol();

    expect(name).to.equal("TestToken");
    expect(symbol).to.equal("TT");
  });

  it("다오 토큰 발행량 확인", async () => {
    const totalSupply = await daoToken.totalSupply();

    // 예상된 발행량을 이용하여 체크
    const expectedTotalSupply = ethers.utils.parseEther("1000000"); // 예시 발행량

    expect(totalSupply).to.equal(expectedTotalSupply);
  });

  it("펀딩 승인 요청 확인 및 이벤트 처리 확인", async () => {
    const [user] = users;
    const donationAmount = ethers.utils.parseEther("10");

    await daoToken.connect(admin).mintTokens(user.address, donationAmount);
    expect(await daoToken.balanceOf(user.address)).to.equal(donationAmount);

    await funding.connect(user).requestDonation(donationAmount);

    const userPendingDonation = await funding.pendingDonations(user.address);
    expect(userPendingDonation).to.equal(donationAmount);

    const donationRequestedEvents = await funding.queryFilter(funding.filters.DonationRequested());
    expect(donationRequestedEvents.length).to.equal(1);

    const [event] = donationRequestedEvents;
    expect(event.args.donor).to.equal(user.address);
    expect(event.args.amount).to.equal(donationAmount);
  });

  // //펀딩 승인 시 잔량 확인
  // it("펀딩 승인 시 잔량 확인", async () => {});
  // //펀딩 거절 시 맵핑에서 삭제 됐는지 확인
  // it("펀딩 승인 시 잔량 확인", async () => {});
  // //관리자 첫 토큰 민트 받았는지 확인
  // it("펀딩 승인 시 잔량 확인", async () => {});
});
