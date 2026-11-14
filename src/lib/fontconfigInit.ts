import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Inicializa configuracao minima do Fontconfig em containers Linux serverless
 * (Vercel) antes do carregamento do sharp/libvips, apontando para public/fonts
 * e usando /tmp como cache gravavel.
 */
function ensureLinuxFontconfig(): void {
  if (process.platform !== "linux" || process.env.FONTCONFIG_FILE) {
    return;
  }

  try {
    const fontsDir = path.join(process.cwd(), "public", "fonts");
    const cacheDir = path.join(os.tmpdir(), "hnk-fontconfig-cache");
    const confPath = path.join(os.tmpdir(), "fonts.conf");

    fs.mkdirSync(cacheDir, { recursive: true });

    const xml = [
      '<?xml version="1.0"?>',
      '<!DOCTYPE fontconfig SYSTEM "fonts.dtd">',
      "<fontconfig>",
      `  <dir>${fontsDir}</dir>`,
      `  <cachedir>${cacheDir}</cachedir>`,
      "  <config></config>",
      "</fontconfig>",
      "",
    ].join("\n");

    fs.writeFileSync(confPath, xml, "utf8");
    process.env.FONTCONFIG_FILE = confPath;
    process.env.FONTCONFIG_PATH = os.tmpdir();
  } catch (err) {
    console.warn(
      "[fontconfig] bootstrap warning:",
      err instanceof Error ? err.message : String(err)
    );
  }
}

ensureLinuxFontconfig();
