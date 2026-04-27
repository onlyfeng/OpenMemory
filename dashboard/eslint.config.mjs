import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    name: "openmemory-dashboard/transitional-rules",
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "react-hooks/immutability": "off",
    },
  },
];

export default eslintConfig;
