// Fonte vetorial única: SVG do portal e VectorDrawable/adaptive icon Android.
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = fileURLToPath(new URL("../", import.meta.url));
const paths = [
  [
    "#FFFFFF",
    "M36,26 H62 L76,40 V75 Q76,80 71,80 H36 Q31,80 31,75 V31 Q31,26 36,26 Z",
  ],
  ["#12323D", "M62,26 V36 Q62,40 66,40 H76 Z"],
  [
    "#087C79",
    "M39,43 H42 V60 H39 Z M45,43 H47 V60 H45 Z M50,43 H54 V60 H50 Z M57,43 H59 V60 H57 Z M62,43 H67 V60 H62 Z M39,65 H53 V69 H39 Z",
  ],
  ["#12323D", "M81,70 A13,13 0,1 1,55,70 A13,13 0,1 1,81,70 Z"],
  ["#FFFFFF", "M60,69 L63,66 L67,70 L74,62 L77,65 L67,76 Z"],
];
function save(name, contents) {
  const target = path.join(root, name);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, contents);
}
const background = "#087C79";
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108"><title>Patrimônio Fatec</title><rect width="108" height="108" rx="24" fill="${background}"/>${paths.map(([color, d]) => `<path fill="${color}" d="${d}"/>`).join("")}</svg>\n`;
save("assets/brand/patrimonio-fatec.svg", svg);
save("web/public/patrimonio-fatec.svg", svg);
function vector(items) {
  return `<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108">\n${items.map(([color, d]) => `  <path android:fillColor="${color}" android:pathData="${d}"/>`).join("\n")}\n</vector>\n`;
}
save(
  "mobile/app/src/main/res/drawable/ic_launcher_foreground.xml",
  vector(paths),
);
save(
  "mobile/app/src/main/res/drawable/ic_launcher.xml",
  vector([[background, "M0,0 H108 V108 H0 Z"], ...paths]),
);
// Silhueta única para ícones temáticos Android 13+.
save(
  "mobile/app/src/main/res/drawable/ic_launcher_monochrome.xml",
  vector([
    [
      "#FFFFFF",
      "M36,26 H62 L76,40 V55 A16,16 0,0 1,68,86 H36 Q31,86 31,80 V31 Q31,26 36,26 Z",
    ],
  ]),
);
for (const version of [26, 33]) {
  save(
    `mobile/app/src/main/res/mipmap-anydpi-v${version}/ic_launcher.xml`,
    `<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n  <background android:drawable="@color/launcher_background"/>\n  <foreground android:drawable="@drawable/ic_launcher_foreground"/>\n${version === 33 ? '  <monochrome android:drawable="@drawable/ic_launcher_monochrome"/>\n' : ""}</adaptive-icon>\n`,
  );
}
save(
  "mobile/app/src/main/res/values/colors.xml",
  `<resources><color name="launcher_background">${background}</color></resources>\n`,
);
console.log("Ícones SVG e Android gerados.");
