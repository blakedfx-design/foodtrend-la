import test from "node:test";
import assert from "node:assert/strict";
import { editorialSourceTestUtils } from "@/lib/signals/sources/editorialSignals";
import {
  credentialGatedStatus,
  editorialStatusDetailFromCounts,
} from "@/lib/debug/getPipelineHealth";

test("Time Out HTML fallback parser normalizes card rows", () => {
  const html = `
    <article>
      <a href="/los-angeles/restaurants/best-tacos-la">Read</a>
      <h3>Best tacos in Los Angeles right now</h3>
      <p>Our favorite taco spots across Koreatown and Boyle Heights.</p>
      <time datetime="2026-05-10T10:00:00.000Z"></time>
    </article>
  `;
  const parsed = editorialSourceTestUtils.parseTimeoutHtmlArticles(html);
  assert.equal(parsed.articles.length, 1);
  assert.equal(parsed.articles[0].title, "Best tacos in Los Angeles right now");
  assert.equal(
    parsed.articles[0].link,
    "https://www.timeout.com/los-angeles/restaurants/best-tacos-la",
  );
  assert.equal(parsed.articles[0].publishedAt, "2026-05-10T10:00:00.000Z");
});

test("Bon Appetit relevance keeps LA-linked content", () => {
  const kept = editorialSourceTestUtils.evaluateSourceFilter("bonappetit", {
    source: "bonappetit",
    title: "The Los Angeles restaurant dishes we keep chasing",
    link: "https://www.bonappetit.com/story/la-restaurant-dishes",
    publishedAt: "",
    subhead: "From Koreatown to Downtown LA, these are worth ordering.",
  });
  const rejected = editorialSourceTestUtils.evaluateSourceFilter("bonappetit", {
    source: "bonappetit",
    title: "Best restaurants in New York this spring",
    link: "https://www.bonappetit.com/story/nyc-list",
    publishedAt: "",
    subhead: "A Manhattan-heavy roundup.",
  });
  assert.equal(kept.keep, true);
  assert.equal(rejected.keep, false);
});

test("Bon Appetit smoky tuna tostadas extracts dish candidate", () => {
  const candidates = editorialSourceTestUtils.extractHeuristicEntitiesFromText(
    "These Smoky Tuna Tostadas Are Delightfully Easy (and Cheap)",
    "title",
  );
  const entities = candidates.map((c) => c.entity.toLowerCase());
  assert.equal(entities.includes("smoky tuna tostadas"), true);
  assert.equal(entities.includes("tuna tostadas"), true);
  assert.equal(entities.includes("tostadas"), true);
});

test("Generic Time Out best restaurants headline does not create generic trend", () => {
  assert.equal(
    editorialSourceTestUtils.isGenericListicleHeadline(
      "The 33 best restaurants in Los Angeles you need to try",
    ),
    true,
  );
  const candidates = editorialSourceTestUtils.extractHeuristicEntitiesFromText(
    "The 33 best restaurants in Los Angeles you need to try",
    "title",
  );
  assert.equal(candidates.some((c) => c.entity.toLowerCase().includes("best restaurants")), false);
});

test("Time Out card data can produce restaurant and cuisine candidates", () => {
  const fromTitle = editorialSourceTestUtils.extractHeuristicEntitiesFromText(
    "Korean BBQ at Soban",
    "title",
  );
  const entities = fromTitle.map((c) => c.entity.toLowerCase());
  assert.equal(entities.includes("korean"), true);
  assert.equal(entities.includes("soban"), true);
});

test("Low-confidence candidate is counted as confidence rejection", () => {
  const signal = {
    source: "bonappetit",
    entity: "tuna tostadas",
    confidence: 0.2,
    metadata: { candidateOnly: true, matchedCategory: "dish", matchScope: "title" },
  } as Parameters<typeof editorialSourceTestUtils.candidateFilterDecision>[0];
  const decision = editorialSourceTestUtils.candidateFilterDecision(signal, false);
  assert.equal(decision.keep, false);
  assert.equal(decision.rejectedBy, "confidence");
});

test("Credential-gated connector is disabled when env missing", () => {
  assert.deepEqual(credentialGatedStatus(false), {
    lifecycle: "disabled",
    statusDetail: "disabled_credentials_missing",
  });
});

test("Active source with zero signals is not degraded", () => {
  assert.equal(editorialStatusDetailFromCounts(null, 0), "active_no_matches");
  assert.notEqual(editorialStatusDetailFromCounts(null, 0), "degraded");
});
