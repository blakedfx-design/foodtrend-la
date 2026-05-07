export type SocialSignalPlatform = "instagram" | "tiktok" | "reddit";

export type SocialSignalStrength = "high" | "medium" | "low";

export type TrendSocialSignalLabel = "Creator Reel" | "TikTok post" | "Reddit mention";

export type TrendSocialSignal = {
  platform: SocialSignalPlatform;
  label: TrendSocialSignalLabel;
  url: string;
  strength: SocialSignalStrength;
};
