import * as cheerio from "cheerio";
import { createHash } from "crypto";

export const normalizeText = (value = "") => value.replace(/\s+/g, " ").trim();
export const parseVotes = (value = "") => Number(normalizeText(value).replace(/,/g, "")) || 0;

const devanagariDigits = "०१२३४५६७८९";

export const normalizeCount = (value = "") => {
  const normalized = normalizeText(value)
    .split("")
    .map((char) => {
      const index = devanagariDigits.indexOf(char);
      return index >= 0 ? String(index) : char;
    })
    .join("");
  const digits = normalized.replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
};

export const toAbsoluteUrl = (value = "") => {
  if (!value) return null;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  return `https://election.ekantipur.com${value}`;
};

export const toDateOrNull = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const checksumText = (text = "") =>
  createHash("sha256").update(text).digest("hex");

export const parseBoolean = (value = "") =>
  ["1", "true", "yes"].includes(String(value).toLowerCase());

// ── Popular Candidates ──

export const parsePopularCandidatesFromHtml = (html = "") => {
  const $ = cheerio.load(html);
  const wrappers = $(".content-body .popular-candidate-card-wrapper");
  const districts = [];

  wrappers.each((_, wrapper) => {
    const wrapperEl = $(wrapper);
    const districtLink = wrapperEl.find(".popular-candidate-header a").first();
    const districtName = normalizeText(districtLink.text());
    const districtUrl = districtLink.attr("href");

    const mainCard = wrapperEl.find(".popular-candidate-card > .candidate-card").first();
    const isCompleted = mainCard.hasClass("win") || mainCard.hasClass("lost");
    const mainParty = mainCard.find("a.party-image").first();
    const mainCandidate = {
      type: "side",
      name: normalizeText(mainCard.find("a > h5").text()),
      profileUrl: mainCard.find("a[href*='/profile']").first().attr("href"),
      avatar: mainCard.find(".candidate-image img, figure img").first().attr("src"),
      votes: normalizeText(mainCard.find(".vote-count > p").text()),
      voteChange: normalizeText(mainCard.find(".vote-count > span").text()),
      partyUrl: mainParty.attr("href"),
      partyImg: mainParty.find("img").first().attr("src"),
      partyName: normalizeText(
        mainParty.find("span").first().text() || mainParty.find("img").first().attr("alt")
      ),
    };

    const parsedCandidates = [];
    if (mainCandidate.name || mainCandidate.profileUrl) parsedCandidates.push(mainCandidate);

    wrapperEl.find(".candidate-list > div").each((__, c) => {
      const cEl = $(c);
      const description = cEl.find(".candidate-description");
      const profile = description
        .find("a.candidate-image, .candidate-name > a[href*='/profile']")
        .first()
        .attr("href");
      const avatar = description.find("a.candidate-image img").first().attr("src");
      const name = normalizeText(
        description.find(".candidate-name > a[href*='/profile'] > p").first().text() ||
        description.find(".candidate-name > a[href*='/profile']").first().text()
      );
      const votes = normalizeText(cEl.find(".vote-count > p").first().text());
      const partyLink = description.find(".candidate-name a.party-image").first();
      const partyUrl = partyLink.attr("href");
      const partyImg = partyLink.find("figure > img, img").first().attr("src");
      const partyName = normalizeText(partyLink.find("span").first().text());
      if (!name && !profile) return;
      parsedCandidates.push({
        type: "side",
        name,
        profileUrl: profile,
        avatar,
        votes,
        partyUrl,
        partyImg,
        partyName,
      });
    });

    const candidateMap = new Map();
    parsedCandidates.forEach((candidate) => {
      const key = candidate.profileUrl || `${candidate.name}-${candidate.partyName || ""}`;
      if (!key) return;
      const existing = candidateMap.get(key);
      if (!existing) {
        candidateMap.set(key, candidate);
        return;
      }
      candidateMap.set(key, {
        ...existing,
        ...candidate,
        voteChange: existing.voteChange || candidate.voteChange,
      });
    });

    const uniqueCandidates = [...candidateMap.values()];
    if (!districtName && uniqueCandidates.length === 0) return;
    uniqueCandidates.sort((a, b) => parseVotes(b.votes) - parseVotes(a.votes));
    const [highestCandidate, ...remainingCandidates] = uniqueCandidates;
    const leaderCandidate = highestCandidate ? { ...highestCandidate, type: "leader" } : null;
    const sideCandidates = remainingCandidates
      .slice(0, 3)
      .map((candidate) => ({ ...candidate, type: "side" }));
    if (!leaderCandidate) return;
    districts.push({ districtName, districtUrl, leaderCandidate, sideCandidates, isCompleted });
  });

  return districts;
};

// ── Province & Party from Homepage ──

export const parseProvinceAndPartyFromHomepage = (html = "") => {
  const $ = cheerio.load(html);
  const resultTables = $(".content-wrapper .content-body .result-table");
  const provinces = [];

  resultTables.each((_, table) => {
    const tableEl = $(table);
    const provinceName = normalizeText(
      tableEl.find(".result-header .first-col p").first().text()
    );
    const summarySpans = tableEl.find(".result-header .second-col span");
    const districtLabel = normalizeText(summarySpans.eq(0).text());
    const constituencyLabel = normalizeText(summarySpans.eq(1).text());

    const parties = [];
    tableEl.find(".result-row").each((__, row) => {
      const rowEl = $(row);
      const partyLink = rowEl.find("a.first-col").first();
      if (!partyLink.length) return;
      const partyName = normalizeText(
        partyLink.find("p").first().text() || partyLink.find("img").first().attr("alt")
      );
      const partyImage = partyLink.find("img").first().attr("src") || null;
      const winningText = normalizeText(rowEl.find(".win-count").first().text());
      const leadingText = normalizeText(rowEl.find(".lead-count").first().text());
      parties.push({
        partyName,
        partyUrl: toAbsoluteUrl(partyLink.attr("href")),
        partyImage,
        elected: normalizeCount(winningText),
        electedText: winningText,
        leading: normalizeCount(leadingText),
        leadingText,
      });
    });
    if (!provinceName) return;
    provinces.push({
      provinceName,
      districtCount: normalizeCount(districtLabel),
      districtLabel,
      constituencyCount: normalizeCount(constituencyLabel),
      constituencyLabel,
      parties,
    });
  });

  const partySection = $("main section div.col-lg-4 .party-stat").first();
  const partyTitle =
    normalizeText(partySection.find(".party-header .first-col p").first().text()) ||
    "पार्टीगत नतिजा";
  const parties = [];
  partySection.find(".party-stat-inside-wrap .party-row").each((_, row) => {
    const rowEl = $(row);
    const partyLink = rowEl.find("a.first-col").first();
    if (!partyLink.length) return;
    const partyName = normalizeText(
      partyLink.find("p").first().text() || partyLink.find("img").first().attr("alt")
    );
    const electedText = normalizeText(rowEl.find(".win-count").first().text());
    const leadingText = normalizeText(rowEl.find(".lead-count").first().text());
    if (!partyName) return;
    parties.push({
      partyName,
      partyUrl: toAbsoluteUrl(partyLink.attr("href")),
      partyImage: partyLink.find("img").first().attr("src") || null,
      elected: normalizeCount(electedText),
      electedText,
      leading: normalizeCount(leadingText),
      leadingText,
    });
  });

  return { provinces, parties, partyTitle };
};

// ── Location Index from Homepage JS ──

export const parseLocationIndexFromHtml = (html = "", lastScraped = null) => {
  const districtMap = new Map();
  const districtOptions = [
    ...html.matchAll(
      /pradeshdistricts\['(\d+)'\]\s*\+=\s*'<option value="([^"]+)">([^<]+)<\/option>';/g
    ),
  ];
  districtOptions.forEach((match) => {
    const provinceId = Number(match[1]);
    const districtSlug = normalizeText(match[2]).toLowerCase();
    const districtName = normalizeText(match[3]);
    if (!provinceId || !districtSlug || !districtName) return;
    districtMap.set(districtSlug, { provinceId, districtSlug, districtName });
  });

  const districtMeta = new Map();
  const districtMetaMatches = [
    ...html.matchAll(/dists\['([^']+)'\]\s*=\s*(\{[^;]+\});/g),
  ];
  districtMetaMatches.forEach((match) => {
    const districtSlug = normalizeText(match[1]).toLowerCase();
    try {
      const meta = JSON.parse(match[2]);
      districtMeta.set(districtSlug, {
        districtName: normalizeText(meta?.name || districtSlug),
        provinceId: Number(meta?.pid) || null,
        provinceName: normalizeText(meta?.pname || ""),
      });
    } catch {
      districtMeta.set(districtSlug, {
        districtName: districtSlug,
        provinceId: null,
        provinceName: "",
      });
    }
  });

  const regions = new Map();
  const regionMatches = [...html.matchAll(/regions\['([^']+)'\]\s*=\s*(\d+);/g)];
  regionMatches.forEach((match) => {
    const districtSlug = normalizeText(match[1]).toLowerCase();
    regions.set(districtSlug, Number(match[2]) || 0);
  });

  const sourceLastScraped = toDateOrNull(lastScraped);
  const docs = [];

  districtMap.forEach((district) => {
    const constituencyCount = regions.get(district.districtSlug) || 0;
    if (constituencyCount <= 0) return;

    const meta = districtMeta.get(district.districtSlug);
    const provinceId = meta?.provinceId || district.provinceId;
    const provinceName = meta?.provinceName || `Province ${provinceId}`;
    const districtName = meta?.districtName || district.districtName;

    for (let constituencyNo = 1; constituencyNo <= constituencyCount; constituencyNo += 1) {
      docs.push({
        provinceId,
        provinceName,
        districtSlug: district.districtSlug,
        districtName,
        constituencyNo,
        constituencyUrl: `https://election.ekantipur.com/pradesh-${provinceId}/district-${district.districtSlug}/constituency-${constituencyNo}?lng=eng`,
        sourceLastScraped,
      });
    }
  });

  return docs;
};

// ── Constituency Result Page ──

export const parseConstituencyResultPage = (html = "", sourceUrl = "") => {
  const $ = cheerio.load(html);
  const title = normalizeText(
    $("main .inner-data-wrap h3").first().text() || $("h3").first().text()
  );
  const sourceSummary = normalizeText($(".district-summary-box p").first().text());
  const rows = $(".candidate-list-table-district table tbody tr");
  const candidates = [];

  rows.each((index, row) => {
    const rowEl = $(row);
    const candidateLink = rowEl.find("td").eq(0).find("a").first();
    const partyLink = rowEl.find("td").eq(1).find("a").first();
    const voteBox = rowEl.find("td").eq(2).find(".votecount").first();

    const candidateName = normalizeText(candidateLink.find("span").first().text());
    const partyName = normalizeText(partyLink.find(".party-name").first().text());
    if (!candidateName) return;

    const candidateAvatarUrl = toAbsoluteUrl(
      candidateLink.find("img").first().attr("src") || ""
    );
    const partyProfileUrl = toAbsoluteUrl(partyLink.attr("href"));
    const partyAvatarUrl = toAbsoluteUrl(partyLink.find("img").first().attr("src") || "");
    const totalVotesText = normalizeText(voteBox.find("p").first().text());
    const marginText = normalizeText(voteBox.find("span").first().text());
    const status =
      normalizeText(voteBox.attr("class"))
        .split(" ")
        .find((cls) => ["win", "lost"].includes(cls)) || null;

    candidates.push({
      candidateName,
      candidateProfileUrl: toAbsoluteUrl(candidateLink.attr("href")),
      candidateAvatarUrl,
      candidateImage: candidateAvatarUrl,
      partyName: partyName || "Unknown",
      partyProfileUrl,
      partyAvatarUrl,
      partyUrl: partyProfileUrl,
      partyImage: partyAvatarUrl,
      totalVotes: normalizeCount(totalVotesText),
      totalVotesText,
      marginText,
      position: index + 1,
      status,
    });
  });

  // Detect if the election is completed for this constituency.
  // Only the winner's .votecount.win span contains "Elected" when officially declared.
  const winnerSpan = $(".candidate-list-table-district .votecount.win span").first().text();
  const isCompleted = /elected/i.test(normalizeText(winnerSpan));
  candidates.sort((a, b) => b.totalVotes - a.totalVotes);
  const ranked = candidates.map((candidate, index) => ({
    ...candidate,
    position: index + 1,
  }));
  return { title, sourceSummary, candidates: ranked, checksum: checksumText(html), sourceUrl, isCompleted };
};
