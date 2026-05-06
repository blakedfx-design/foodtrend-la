import { getRestaurantUrl, type WherePick } from "./wherePick";

function formatReviewCount(n: number): string {
  if (!Number.isFinite(n) || n < 0) {
    return "";
  }
  if (n >= 100_000) {
    return `${Math.round(n / 1000)}k`;
  }
  if (n >= 10_000) {
    return `${(n / 1000).toFixed(1)}k`.replace(/\.0k$/, "k");
  }
  if (n >= 1000) {
    return `${(n / 1000).toFixed(1)}k`.replace(/\.0k$/, "k");
  }
  return String(Math.round(n));
}

export function WherePickList({ picks }: { picks: WherePick[] }) {
  return (
    <div className="ft-where-list ft-where-list--cards" role="list">
      {picks.map((pick, i) => {
        const href = getRestaurantUrl(pick);
        const hood = pick.neighborhood.trim() || "Los Angeles";
        const dishLine =
          typeof pick.dish === "string" && pick.dish.trim()
            ? pick.dish.trim()
            : null;
        const sourceLabel =
          typeof pick.source === "string" && pick.source.trim()
            ? pick.source.trim()
            : null;
        const ratingLine =
          pick.rating != null &&
          Number.isFinite(pick.rating) &&
          pick.review_count != null &&
          Number.isFinite(pick.review_count)
            ? `★${pick.rating.toFixed(1)} · ${formatReviewCount(pick.review_count)} reviews`
            : pick.rating != null && Number.isFinite(pick.rating)
              ? `★${pick.rating.toFixed(1)}`
              : null;

        return (
          <div
            key={`${pick.restaurant}-${i}`}
            className={`ft-where-pick-row${href ? " ft-where-pick-row--linked" : ""}`}
            role="listitem"
          >
            <div className="ft-where-pick-main">
              <div className="ft-where-pick-name-line">
                {href ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ft-where-pick-name ft-where-pick-name--link"
                  >
                    {pick.restaurant}
                    <span className="ft-where-pick-glyph" aria-hidden>
                      {" "}
                      ↗
                    </span>
                  </a>
                ) : (
                  <span className="ft-where-pick-name">{pick.restaurant}</span>
                )}
              </div>
              <div className="ft-where-pick-meta">
                <span className="ft-where-pick-hood">{hood}</span>
                {sourceLabel ? (
                  <>
                    <span className="ft-where-pick-meta-sep" aria-hidden>
                      ·
                    </span>
                    <span className="ft-where-pick-source">{sourceLabel}</span>
                  </>
                ) : null}
              </div>
              {ratingLine ? (
                <div className="ft-where-pick-ratings">{ratingLine}</div>
              ) : null}
            </div>
            {dishLine ? (
              <div className="ft-where-pick-dish">{dishLine}</div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
