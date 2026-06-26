import { defineConfig } from "vite";

const repoName = "Test";

export default defineConfig(({ command }) => ({
  base: command === "build" ? `/${repoName}/` : "/",
}));
