/**
 * Minimal LA skyline + palm line art.
 * `default`: subtle texture for the home header (left-anchored, low opacity).
 * `home`: fills the right half of the masthead (editorial hero).
 * `hero`: larger, right-anchored illustration for the /la-food report header.
 */
type HeaderAtmosphereProps = {
  variant?: "default" | "home" | "hero";
};

export function HeaderAtmosphere({ variant = "default" }: HeaderAtmosphereProps) {
  const hero = variant === "hero";
  const home = variant === "home";

  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        top: 0,
        ...(hero
          ? { right: 0, left: "auto", bottom: 0, width: "100%", height: "100%" }
          : home
            ? { right: 0, left: "50%", bottom: 0, width: "50%", height: "100%" }
            : { bottom: 0, left: 0, width: "128%", height: "100%" }),
        opacity: hero ? 0.72 : home ? 0.52 : 0.125,
        pointerEvents: "none",
        zIndex: hero || home ? 1 : 0,
        color: "inherit",
      }}
    >
      <svg
        viewBox="0 0 360 140"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio={hero || home ? "xMidYMid meet" : "xMidYMid slice"}
        style={{ width: "100%", height: "100%", display: "block" }}
      >
        <g stroke="currentColor" strokeWidth={1.15} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 118V84h14v34M30 118V62h18v56M52 118V78h12v18h8v22M76 118V52h20v66M100 118V88h14v30M118 118V96h12v22M134 118V70h16v26h6v22" />
          <line x1={4} y1={118} x2={168} y2={118} strokeWidth={1} />
          {/* Ferris wheel hint */}
          <circle cx={154} cy={82} r={14} strokeWidth={1.1} />
          <path d="M154 68v28M140 82h28M146 74l16 16M146 90l16-16" strokeWidth={1} />
          <path d="M220 120 Q226 72 232 28" />
          <path d="M232 30 L214 48 M232 30 L250 46 M232 30 L224 18 M232 30 L242 20" />
          <path d="M268 122 Q272 68 278 32" />
          <path d="M278 34 L260 50 M278 34 L296 48 M278 34 L270 22" />
          <path d="M312 124 Q316 76 322 36" />
          <path d="M322 38 L306 54 M322 38 L338 50" />
        </g>
      </svg>
    </div>
  );
}
