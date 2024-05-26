// describe("Dao 테스트", () => {
//   it("Dao 컨트랙트의 생성자가 정상적으로 설정되어 있는지 확인", async () => {
//     expect(await dao.admin()).to.equal(admin.address);
//   });

//   it("startVote 함수 실행 시 voteInProgress가 true인 경우 함수가 리버트 되는지 확인", async () => {
//     const target = ethers.Wallet.createRandom().address;
//     const title = "Test Campaign";
//     const description = "This is a test campaign";
//     const goal = HardhatUtil.ToETH(1);
//     const latestBlock = await ethers.provider.getBlock("latest");
//     const startAt = latestBlock.timestamp + 100;
//     const endAt = latestBlock.timestamp + 200;

//     await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);
//     await dao.connect(users[0]).startVote(1);

//     await expect(dao.connect(users[0]).startVote(1)).to.be.revertedWith(
//       "A vote is already in progress for this campaign.",
//     );
//   });

//   //   function startVote(uint256 _campaignId) external {
//   //     uint256 goal = donation.getCampaignGoal(_campaignId);
//   //     uint256 totalAmount = donation.getCampaignTotalAmount(_campaignId);
//   //     require(!voteInProgress[_campaignId], "A vote is already in progress for this campaign.");

//   //     emit VoteStarted(_campaignId, goal, totalAmount);

//   //     for (uint i = 0; i < daoMemberList.length; i++) {
//   //         address voter = daoMemberList[i];
//   //         hasVoted[voter] = false; //모든 다오 멤버가 다시 투표할 수 있는 상태로 만들어 줌!!
//   //     }
//   //     voteCountYes[_campaignId] = 0;
//   //     voteCountNo[_campaignId] = 0;
//   //     voteInProgress[_campaignId] = true;

//   //     emit VoteReady(_campaignId, voteCountYes[_campaignId], voteCountNo[_campaignId], voteInProgress[_campaignId]);
//   // }
//   it("startVote 함수 실행 시 voteInProgress가 false인 경우 VoteStarted 이벤트가 정상적으로 발생하는지 확인", async () => {
//     const target = ethers.Wallet.createRandom().address;
//     const title = "Test Campaign";
//     const description = "This is a test campaign";
//     const goal = HardhatUtil.ToETH(1);
//     const latestBlock = await ethers.provider.getBlock("latest");
//     const startAt = latestBlock.timestamp + 100;
//     const endAt = latestBlock.timestamp + 200;

//     await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);

//     await expect(dao.connect(users[0]).startVote(1)).to.emit(dao, "VoteStarted").withArgs(1, goal, 0);
//   });

//   it("startVote 함수 실행 성공 시 daoMemberList(5명)의 hasVoted가 false로 설정되는지 확인", async () => {
//     const target = ethers.Wallet.createRandom().address;
//     const title = "Test Campaign";
//     const description = "This is a test campaign";
//     const goal = HardhatUtil.ToETH(1);
//     const latestBlock = await ethers.provider.getBlock("latest");
//     const startAt = latestBlock.timestamp + 100;
//     const endAt = latestBlock.timestamp + 200;

//     await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);
//     await dao.connect(users[0]).startVote(1);

//     for (let i = 0; i < 5; i++) {
//       const voter = users[i].address;
//       expect(await dao.hasVoted(voter)).to.equal(false);
//     }
//   });

//   it("startVote 함수 실행 시 voteInProgress가 false인 경우 VoteReady 이벤트가 정상적으로 발생하는지 확인", async () => {
//     const target = ethers.Wallet.createRandom().address;
//     const title = "Test Campaign";
//     const description = "This is a test campaign";
//     const goal = HardhatUtil.ToETH(1);
//     const latestBlock = await ethers.provider.getBlock("latest");
//     const startAt = latestBlock.timestamp + 100;
//     const endAt = latestBlock.timestamp + 200;

//     await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);

//     await expect(dao.connect(users[0]).startVote(1)).to.emit(dao, "VoteReady").withArgs(1, 0, 0, true);
//   });

//   it("vote 함수 실행 시 onlyDaoMember modifier가 정상적으로 작동하는지 확인", async () => {
//     const target = ethers.Wallet.createRandom().address;
//     const title = "Test Campaign";
//     const description = "This is a test campaign";
//     const goal = HardhatUtil.ToETH(1);
//     const latestBlock = await ethers.provider.getBlock("latest");
//     const startAt = latestBlock.timestamp + 100;
//     const endAt = latestBlock.timestamp + 200;

//     await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);
//     await dao.connect(users[0]).startVote(1);

//     await expect(dao.connect(users[1]).vote(1, true)).to.be.revertedWith("Only DAO members can perform this action");
//   });

//   it("vote 함수 실행 시 hasVoted가 true인 경우 실패하는지 확인", async () => {
//     const target = ethers.Wallet.createRandom().address;
//     const title = "Test Campaign";
//     const description = "This is a test campaign";
//     const goal = HardhatUtil.ToETH(1);
//     const latestBlock = await ethers.provider.getBlock("latest");
//     const startAt = latestBlock.timestamp + 100;
//     const endAt = latestBlock.timestamp + 200;

//     await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);

//     // 사용자를 DAO 멤버로 승인
//     await dao.connect(admin).approveDaoMembership(users[0].address, true);
//     await dao.connect(admin).approveDaoMembership(users[1].address, true);

//     await dao.connect(users[0]).startVote(1);
//     await dao.connect(users[1]).vote(1, true);

//     await expect(dao.connect(users[1]).vote(1, true)).to.be.revertedWith("You have already voted.");
//   });

//   it("vote 함수 실행 시 _agree가 true인 경우 voteCountYes가 1 증가하는지 확인", async () => {
//     const target = ethers.Wallet.createRandom().address;
//     const title = "Test Campaign";
//     const description = "This is a test campaign";
//     const goal = HardhatUtil.ToETH(1);
//     const latestBlock = await ethers.provider.getBlock("latest");
//     const startAt = latestBlock.timestamp + 100;
//     const endAt = latestBlock.timestamp + 200;

//     await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);

//     // 사용자를 DAO 멤버로 승인
//     await dao.connect(admin).approveDaoMembership(users[0].address, true);
//     await dao.connect(admin).approveDaoMembership(users[1].address, true);

//     await dao.connect(users[0]).startVote(1);
//     await dao.connect(users[1]).vote(1, true);

//     expect(await dao.voteCountYes(1)).to.equal(1);
//   });

//   it("vote 함수 실행 시 _agree가 false인 경우 voteCountNo가 1 증가하는지 확인", async () => {
//     const target = ethers.Wallet.createRandom().address;
//     const title = "Test Campaign";
//     const description = "This is a test campaign";
//     const goal = HardhatUtil.ToETH(1);
//     const latestBlock = await ethers.provider.getBlock("latest");
//     const startAt = latestBlock.timestamp + 100;
//     const endAt = latestBlock.timestamp + 200;

//     await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);

//     // 사용자를 DAO 멤버로 승인
//     await dao.connect(admin).approveDaoMembership(users[0].address, true);
//     await dao.connect(admin).approveDaoMembership(users[1].address, true);

//     await dao.connect(users[0]).startVote(1);
//     await dao.connect(users[1]).vote(1, false);

//     expect(await dao.voteCountNo(1)).to.equal(1);
//   });

//   it("vote 함수 실행 시 Voted 이벤트가 정상적으로 발생하는지 확인", async () => {
//     const target = ethers.Wallet.createRandom().address;
//     const title = "Test Campaign";
//     const description = "This is a test campaign";
//     const goal = HardhatUtil.ToETH(1);
//     const latestBlock = await ethers.provider.getBlock("latest");
//     const startAt = latestBlock.timestamp + 100;
//     const endAt = latestBlock.timestamp + 200;

//     // 사용자를 DAO 멤버로 승인
//     await dao.connect(admin).approveDaoMembership(users[1].address, true);

//     await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);
//     await dao.connect(users[0]).startVote(1);
//     await expect(dao.connect(users[1]).vote(1, true)).to.emit(dao, "Voted").withArgs(1, users[1].address, true);
//   });

//   it("vote 함수 실행 시 모든 다오 멤버가 투표한 경우 voteEnd 함수가 실행되는지 확인", async () => {
//     const target = ethers.Wallet.createRandom().address;
//     const title = "Test Campaign";
//     const description = "This is a test campaign";
//     const goal = HardhatUtil.ToETH(1);
//     const latestBlock = await ethers.provider.getBlock("latest");
//     const startAt = latestBlock.timestamp + 100;
//     const endAt = latestBlock.timestamp + 200;

//     await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);

//     // 사용자를 DAO 멤버로 승인
//     for (let i = 1; i <= 4; i++) {
//       await dao.connect(admin).approveDaoMembership(users[i].address, true);
//     }

//     await dao.connect(users[0]).startVote(1);
//     await dao.connect(users[1]).vote(1, true);
//     await dao.connect(users[2]).vote(1, true);
//     await dao.connect(users[3]).vote(1, true);
//     await dao.connect(users[4]).vote(1, true);

//     // 모든 다오 멤버가 투표한 후 voteInProgress가 false로 설정되는지 확인
//     const voteInProgress = await dao.voteInProgress(1);
//     expect(voteInProgress).to.equal(false);
//   });

//   it("vote 함수 실행 시 voteEnd 함수가 실행되면 agreePercentage가 70% 이상인 경우 VoteEnded_approve 이벤트가 발생하는지 확인", async () => {
//     const target = ethers.Wallet.createRandom().address;
//     const title = "Test Campaign";
//     const description = "This is a test campaign";
//     const goal = HardhatUtil.ToETH(1);
//     const latestBlock = await ethers.provider.getBlock("latest");
//     const startAt = latestBlock.timestamp + 100;
//     const endAt = latestBlock.timestamp + 200;

//     await donation.connect(users[0]).launch(target, title, description, goal, startAt, endAt);

//     // 사용자를 DAO 멤버로 승인
//     for (let i = 1; i <= 4; i++) {
//       await dao.connect(admin).approveDaoMembership(users[i].address, true);
//     }

//     // 투표 시작
//     await dao.connect(users[0]).startVote(1);

//     // 각 DAO 멤버가 투표
//     await dao.connect(users[1]).vote(1, true);
//     await dao.connect(users[2]).vote(1, true);
//     await dao.connect(users[3]).vote(1, true);

//     // 마지막 멤버가 투표할 때 이벤트 발생 확인
//     await expect(dao.connect(users[4]).vote(1, true))
//       .to.emit(dao, "VoteEnded_approve")
//       .withArgs(1, 100, "The campaign has been approved for claim.");
//   });

//   it("requestDaoMembership 함수 실행 시 이미 DAO 멤버인 경우 실패하는지 확인", async () => {
//     await dao.connect(admin).approveDaoMembership(users[0].address, true);
//     await expect(dao.connect(users[0]).requestDaoMembership()).to.be.revertedWith("User is already a DAO member");
//   });

//   it("requestDaoMembership 함수 실행 시 DaoMembershipRequested 이벤트가 정상적으로 발생하는지 확인", async () => {
//     await expect(dao.connect(users[5]).requestDaoMembership())
//       .to.emit(dao, "DaoMembershipRequested")
//       .withArgs(users[5].address, "User has requested DAO membership");
//   });

//   it("requestRejectDaoMembership 함수 실행 시 DAO 멤버가 아닌 경우 실패하는지 확인", async () => {
//     await expect(dao.connect(users[0]).requestRejectDaoMembership()).to.be.revertedWith("User is not a DAO member");
//   });

//   it("requestRejectDaoMembership 함수 실행 시 RejectDaoMembershipRequested 이벤트가 정상적으로 발생하는지 확인", async () => {
//     await dao.connect(admin).approveDaoMembership(users[0].address, true);
//     await expect(dao.connect(users[0]).requestRejectDaoMembership())
//       .to.emit(dao, "RejectDaoMembershipRequested")
//       .withArgs(users[0].address, "User has requested to leave DAO membership");
//   });

//   it("approveDaoMembership 함수 실행 시 onlyAdmin modifier가 정상적으로 작동하는지 확인", async () => {
//     await expect(dao.connect(users[0]).approveDaoMembership(users[1].address, true)).to.be.revertedWith(
//       "Only admin can perform this action",
//     );
//   });
//   it("approveDaoMembership 함수 실행 시 관리자가 승인을 수락하면 DaoMembershipApproved 이벤트가 정상적으로 발생하는지 확인", async () => {
//     await expect(dao.connect(admin).approveDaoMembership(users[1].address, true))
//       .to.emit(dao, "DaoMembershipApproved")
//       .withArgs(users[1].address, true, "User has been approved as a DAO member");
//   });

//   it("approveDaoMembership 함수 실행 시 관리자가 승인을 거절하면 DaoMembershipRejected 이벤트가 정상적으로 발생하는지 확인", async () => {
//     await expect(dao.connect(admin).approveDaoMembership(users[1].address, false))
//       .to.emit(dao, "DaoMembershipRejected")
//       .withArgs(users[1].address, false, "User has been rejected as a DAO member");
//   });

//   it("approveDaoMembership 함수 실행 시 membershipRequests 배열의 길이가 1만큼 줄어들었는지 확인", async () => {
//     await dao.connect(users[5]).requestDaoMembership();
//     await dao.connect(admin).approveDaoMembership(users[5].address, true);

//     const length = await dao.membershipRequests.length;
//     expect(length).to.equal(0);
//   });

//   it("rejectDaoMembership 함수 실행 시 onlyAdmin modifier가 정상적으로 작동하는지 확인", async () => {
//     await expect(dao.connect(users[0]).rejectDaoMembership(users[1].address)).to.be.revertedWith(
//       "Only admin can perform this action",
//     );
//   });

//   it("rejectDaoMembership 함수 실행 시 DaoMembershipRejected 이벤트가 정상적으로 발생하는지 확인", async () => {
//     await dao.connect(admin).approveDaoMembership(users[1].address, true);
//     await expect(dao.connect(admin).rejectDaoMembership(users[1].address))
//       .to.emit(dao, "DaoMembershipRejected")
//       .withArgs(users[1].address, false, "User has been rejected as a DAO member");
//   });

//   it("rejectDaoMembership 함수 실행 시 membershipRequests 배열의 길이가 1만큼 줄어들었는지 확인", async () => {
//     await dao.connect(admin).approveDaoMembership(users[5].address, true);
//     await dao.connect(users[5]).requestRejectDaoMembership();
//     await dao.connect(admin).rejectDaoMembership(users[5].address);

//     const length = await dao.membershipRequests.length;
//     expect(length).to.equal(0);
//   });
// });
