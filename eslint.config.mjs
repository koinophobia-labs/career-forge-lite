import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  {
    ignores: ["koinophobia-labs-site-source/**", "outputs/**", "work/**"]
  },
  ...nextVitals,
  ...nextTypescript
];

export default eslintConfig;
