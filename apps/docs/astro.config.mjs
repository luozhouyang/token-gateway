import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import starlight from "@astrojs/starlight";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  site: "https://minigateway.luozhouyang.com",
  integrations: [
    starlight({
      title: "MiniGateway",
      defaultLocale: "root",
      locales: {
        root: {
          label: "English",
          lang: "en",
        },
        zh: {
          label: "简体中文",
          lang: "zh-CN",
        },
      },
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/luozhouyang/minigateway",
        },
      ],
      logo: {
        src: "./src/assets/logo.svg",
        replacesTitle: true,
      },
      tableOfContents: {
        minHeadingLevel: 2,
        maxHeadingLevel: 4,
      },
      pagination: true,
      lastUpdated: true,
      editLink: {
        baseUrl: "https://github.com/luozhouyang/minigateway/edit/main/apps/docs/",
      },
    }),
    sitemap(),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
  adapter: cloudflare({
    imageService: "cloudflare-binding",
  }),
  output: "server",
});
