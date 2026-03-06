export const sanitizePopularCandidates = (candidates = []) =>
  candidates.map((district) => ({
    districtName: district.districtName,
    isCompleted: !!district.isCompleted,
    leaderCandidate: {
      type: district.leaderCandidate?.type,
      name: district.leaderCandidate?.name,
      avatar: district.leaderCandidate?.avatar,
      votes: district.leaderCandidate?.votes,
      voteChange: district.leaderCandidate?.voteChange,
      partyImg: district.leaderCandidate?.partyImg,
      partyName: district.leaderCandidate?.partyName,
    },
    sideCandidates: (district.sideCandidates || []).map((candidate) => ({
      type: candidate.type,
      name: candidate.name,
      avatar: candidate.avatar,
      votes: candidate.votes,
      voteChange: candidate.voteChange,
      partyImg: candidate.partyImg,
      partyName: candidate.partyName,
    })),
  }));

export const sanitizeProvinceParties = (provinces = []) =>
  provinces.map((province) => ({
    provinceName: province.provinceName,
    districtCount: province.districtCount,
    districtLabel: province.districtLabel,
    constituencyCount: province.constituencyCount,
    constituencyLabel: province.constituencyLabel,
    parties: (province.parties || []).map((party) => ({
      partyName: party.partyName,
      partyImage: party.partyImage,
      elected: party.elected,
      electedText: party.electedText,
      leading: party.leading,
      leadingText: party.leadingText,
    })),
  }));

export const sanitizePartyStatus = (parties = []) =>
  parties.map((party) => ({
    partyName: party.partyName,
    partyImage: party.partyImage,
    elected: party.elected,
    electedText: party.electedText,
    leading: party.leading,
    leadingText: party.leadingText,
  }));

export const sanitizeConstituencyResult = (cached) => ({
  _id: cached._id,
  provinceId: cached.provinceId,
  provinceName: cached.provinceName,
  districtSlug: cached.districtSlug,
  districtName: cached.districtName,
  constituencyNo: cached.constituencyNo,
  constituencyTitle: cached.constituencyTitle,
  sourceSummary: cached.sourceSummary,
  scrapedAt: cached.scrapedAt,
  cacheUpdatedAt: cached.updatedAt || cached.scrapedAt,
  isCompleted: !!cached.isCompleted,
  candidates: (cached.candidates || []).map((candidate) => ({
    candidateName: candidate.candidateName,
    candidateAvatarUrl: candidate.candidateAvatarUrl || candidate.candidateImage || null,
    candidateImage: candidate.candidateImage || candidate.candidateAvatarUrl || null,
    partyName: candidate.partyName,
    partyAvatarUrl: candidate.partyAvatarUrl || candidate.partyImage || null,
    partyImage: candidate.partyImage || candidate.partyAvatarUrl || null,
    totalVotes: candidate.totalVotes,
    totalVotesText: candidate.totalVotesText,
    marginText: candidate.marginText,
    position: candidate.position,
    status: candidate.status,
  })),
});
