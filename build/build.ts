import { copyFileSync, mkdirSync, existsSync, readdirSync } from "fs";
import { join } from "path";
import tailwind from "bun-plugin-tailwind";

console.log("Building for production...");

const result = await Bun.build({
  entrypoints: ["./src/main.tsx"],
  outdir: "./dist",
  target: "browser",
  minify: true,
  sourcemap: "external",
  splitting: true,
  plugins: [tailwind],
  naming: {
    entry: "assets/[name]-[hash].[ext]",
    chunk: "assets/[name]-[hash].[ext]",
    asset: "assets/[name]-[hash].[ext]",
  },
  define: {
    "import.meta.env.VITE_PUBLIC_POSTHOG_HOST": JSON.stringify(
      process.env.POSTHOG_HOST || ""
    ),
    "import.meta.env.VITE_PUBLIC_POSTHOG_KEY": JSON.stringify(
      process.env.POSTHOG_KEY || ""
    ),
  },
});

if (!result.success) {
  console.error("Build failed:");
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}

// Ensure dist directory exists
if (!existsSync("./dist")) {
  mkdirSync("./dist", { recursive: true });
}

if (!existsSync("./dist/assets")) {
  mkdirSync("./dist/assets", { recursive: true });
}

// Copy favicon
if (existsSync("./public/favicon.ico")) {
  copyFileSync("./public/favicon.ico", "./dist/favicon.ico");
}

// Copy WASM files
const wasmDir = "./src/wasm/pkg";
if (existsSync(wasmDir)) {
  const wasmFiles = readdirSync(wasmDir).filter((f) => f.endsWith(".wasm"));
  for (const file of wasmFiles) {
    copyFileSync(join(wasmDir, file), join("./dist/assets", file));
  }
}

// Find the main entry output and CSS output
const mainOutput = result.outputs.find(
  (o) => o.kind === "entry-point" && o.path.includes("main")
);

if (!mainOutput) {
  console.error("Could not find main entry point in build outputs");
  process.exit(1);
}

const mainFileName = mainOutput.path.split("/").pop();
const cssOutput = result.outputs.find((o) => o.path.endsWith(".css"));
const cssFileName = cssOutput?.path.split("/").pop();

// Generate index.html with hashed assets
const htmlContent = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>3D Car Racing Game - Open Source Racing Simulator</title>
    <meta
      name="description"
      content="A free, open-source 3D car racing game with physics, dynamic weather conditions (sunny, rainy, cold), tire management, and a built-in track editor. Feedback welcome for further development."
    />
    <meta
      name="keywords"
      content="car racing game, 3D racing, open source, track editor, weather system, browser game, Three.js, React"
    />
    <meta name="author" content="Open Source Community" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="3D Car Racing - Open Source Racing Game" />
    <meta
      property="og:description"
      content="Free, open-source 3D racing with realistic physics, dynamic weather, tire management, and a track editor. Contributions and feedback welcome!"
    />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="3D Car Racing - Open Source Racing Game" />
    <meta
      name="twitter:description"
      content="Free, open-source 3D racing with realistic physics, dynamic weather, tire management, and a track editor."
    />
    <meta name="theme-color" content="#1a1a2e" />
    <link rel="icon" href="/favicon.ico" type="image/x-icon" />${cssFileName ? `
    <link rel="stylesheet" href="/assets/${cssFileName}" />` : ""}
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      html,
      body,
      #root {
        width: 100%;
        height: 100%;
        overflow: hidden;
      }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/assets/${mainFileName}"></script>
  </body>
</html>`;

await Bun.write("./dist/index.html", htmlContent);

console.log("Build succeeded!");
console.log(`Output files:`);
for (const output of result.outputs) {
  console.log(`  - ${output.path}`);
}
