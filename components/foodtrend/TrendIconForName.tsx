import {
  BagelIcon,
  BurgerIcon,
  ChiliJarIcon,
  FermentJarIcon,
  IzakayaIcon,
  SnackBowlIcon,
} from "@/components/foodtrend/FoodTrendIcons";

export function TrendIconForName({ name }: { name: string }) {
  const n = name.toLowerCase();
  if (n.includes("burger")) return <BurgerIcon />;
  if (n.includes("korean") || n.includes("ssam")) return <SnackBowlIcon />;
  if (n.includes("izakaya") || n.includes("skewer")) return <IzakayaIcon />;
  if (n.includes("bagel") || n.includes("basque") || n.includes("ube")) return <BagelIcon />;
  if (n.includes("chili") || n.includes("aguachile") || n.includes("burrito")) return <ChiliJarIcon />;
  if (n.includes("olive")) return <FermentJarIcon />;
  if (n.includes("ferment") || n.includes("martini") || n.includes("wine bar")) return <FermentJarIcon />;
  return <SnackBowlIcon />;
}
