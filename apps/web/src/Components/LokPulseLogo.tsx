import { useId, type SVGProps } from "react";

type LokPulseLogoProps = SVGProps<SVGSVGElement> & {
  title?: string;
};

/**
 * LokPulse's compact LP monogram. The negative-space pulse beneath the letters
 * hints at live election data while the single `currentColor` fill keeps the
 * mark equally useful in light and dark themes.
 */
const LokPulseLogo = ({ title, ...props }: LokPulseLogoProps) => {
  const maskId = `lokpulse-logo-${useId().replace(/:/g, "")}`;

  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
      {...props}
    >
      {title ? <title>{title}</title> : null}
      <mask id={maskId} maskUnits="userSpaceOnUse" x="2" y="2" width="60" height="60">
        <rect x="2" y="2" width="60" height="60" rx="14" fill="white" />
        <path
          d="M15 15V39H27"
          stroke="black"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M31 40V15H41C48 15 52 18.5 52 24.5C52 30.5 48 34 41 34H31"
          stroke="black"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M12 49H19L22 45L26 54L30 49H52"
          stroke="black"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </mask>
      <rect
        x="2"
        y="2"
        width="60"
        height="60"
        rx="14"
        fill="currentColor"
        mask={`url(#${maskId})`}
      />
    </svg>
  );
};

export default LokPulseLogo;
