import React from "react";

/**
 * Глобальные градиенты для аватарок ASTRA.
 * Разместить один раз в корне приложения (например, в App.jsx).
 */
const AstraAvatarDefs = () => (
  <svg style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }} aria-hidden="true">
    <defs>
      <linearGradient
        id="astra-ava-hair-pink"
        x1="422.76"
        y1="404.65"
        x2="422.76"
        y2="114.25"
        gradientTransform="translate(-123.31 596.72) scale(1 -1)"
        gradientUnits="userSpaceOnUse"
      >
        <stop offset="0" stopColor="#ff0198" />
        <stop offset="1" stopColor="#ff89d6" />
      </linearGradient>
      <linearGradient
        id="astra-ava-hair-red"
        x1="422.76"
        y1="404.65"
        x2="422.76"
        y2="114.25"
        gradientTransform="translate(-123.31 596.72) scale(1 -1)"
        gradientUnits="userSpaceOnUse"
      >
        <stop offset="0" stopColor="#ff0915" />
        <stop offset="1" stopColor="#ff89d6" />
      </linearGradient>
      <linearGradient
        id="astra-ava-hair-violet"
        x1="422.76"
        y1="404.65"
        x2="422.76"
        y2="114.25"
        gradientTransform="translate(-123.31 596.72) scale(1 -1)"
        gradientUnits="userSpaceOnUse"
      >
        <stop offset="0" stopColor="#2a40ff" />
        <stop offset="1" stopColor="#ff75d6" />
      </linearGradient>

      <radialGradient
        id="astra-ava-bg-pink"
        cx="-.43"
        cy="597.49"
        fx="-.43"
        fy="597.49"
        r=".58"
        gradientTransform="translate(-612622.59 621278.67) rotate(44.63) scale(1441.82 -1460.32)"
        gradientUnits="userSpaceOnUse"
      >
        <stop offset="0" stopColor="#8c61ec" />
        <stop offset=".89" stopColor="#000" />
      </radialGradient>
      <radialGradient
        id="astra-ava-ov-pink"
        cx="1.36"
        cy="595.94"
        fx="1.36"
        fy="595.94"
        r=".58"
        gradientTransform="translate(613427.43 -617312.29) rotate(-135.37) scale(1441.82 -1460.32)"
        gradientUnits="userSpaceOnUse"
      >
        <stop offset="0" stopColor="#720050" />
        <stop offset="1" stopColor="#000" />
      </radialGradient>
      <radialGradient
        id="astra-ava-ov-red"
        cx="-630.55"
        cy="595.64"
        fx="-630.55"
        fy="595.64"
        r=".58"
        gradientTransform="translate(-35180.48 -1257084.81) rotate(-135.37) scale(1441.82 -1460.32)"
        gradientUnits="userSpaceOnUse"
      >
        <stop offset="0" stopColor="#ff156a" />
        <stop offset=".89" stopColor="#000" />
      </radialGradient>
      <radialGradient
        id="astra-ava-bg-violet"
        cx="-1265.36"
        cy="595.34"
        fx="-1265.36"
        fy="595.34"
        r=".58"
        gradientTransform="translate(-686809.08 -1899836.88) rotate(-135.37) scale(1441.82 -1460.32)"
        gradientUnits="userSpaceOnUse"
      >
        <stop offset="0" stopColor="#8c61ec" />
        <stop offset=".89" stopColor="#000" />
      </radialGradient>
    </defs>
  </svg>
);

export default AstraAvatarDefs;