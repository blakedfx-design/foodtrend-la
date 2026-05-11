"use client";

import { useState } from "react";

type TrendHeroMediaProps = {
  src?: string;
  title: string;
  mealCue?: string;
};

export function TrendHeroMedia({ src, title, mealCue }: TrendHeroMediaProps) {
  const [failed, setFailed] = useState(false);
  const showImg = Boolean(src?.trim()) && !failed;

  return (
    <div className="ft-editorial-card__hero-frame">
      {showImg ? (
        /* eslint-disable-next-line @next/next/no-img-element -- curated local files or validated paths only */
        <img
          src={src}
          alt=""
          className="ft-editorial-card__hero-img"
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="ft-editorial-card__hero-placeholder">
          <span className="ft-editorial-card__hero-placeholder__kicker">
            {mealCue?.trim() || "Foodtrend LA"}
          </span>
          <span className="ft-editorial-card__hero-placeholder__title">{title}</span>
        </div>
      )}
    </div>
  );
}
