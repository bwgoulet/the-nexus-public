export type GameType = "ultimate" | "melee";

const ULTIMATE_CHARACTER_ICONS: Record<string, string> = {
  mario: "mario",
  "donkey kong": "donkey",
  link: "link",
  samus: "samus",
  "dark samus": "samusd",
  yoshi: "yoshi",
  kirby: "kirby",
  fox: "fox",
  pikachu: "pikachu",
  luigi: "luigi",
  ness: "ness",
  "captain falcon": "captain",
  jigglypuff: "jigglypuff",
  peach: "peach",
  daisy: "daisy",
  bowser: "bowser",
  "ice climbers": "ice_climber",
  sheik: "sheik",
  zelda: "zelda",
  "dr mario": "mariod",
  pichu: "pichu",
  falco: "falco",
  marth: "marth",
  lucina: "lucina",
  "young link": "younglink",
  ganondorf: "ganon",
  mewtwo: "mewtwo",
  roy: "roy",
  chrom: "chrom",
  "mr game watch": "gamewatch",
  "meta knight": "metaknight",
  pit: "pit",
  "dark pit": "pitb",
  "zero suit samus": "szerosuit",
  wario: "wario",
  snake: "snake",
  ike: "ike",
  "pokemon trainer": "ptrainer",
  "diddy kong": "diddy",
  lucas: "lucas",
  sonic: "sonic",
  "king dedede": "dedede",
  olimar: "olimar",
  lucario: "lucario",
  rob: "robot",
  "toon link": "toonlink",
  wolf: "wolf",
  villager: "villager",
  "mega man": "megaman",
  "wii fit trainer": "wiifit",
  "rosalina luma": "rosalina",
  "little mac": "littlemac",
  greninja: "greninja",
  "mii brawler": "miifighter",
  "mii swordfighter": "miiswordsman",
  "mii sword fighter": "miiswordsman",
  "mii gunner": "miigunner",
  palutena: "palutena",
  "pac man": "pacman",
  robin: "robin",
  shulk: "shulk",
  "bowser jr": "bowserjr",
  "duck hunt": "duckhunt",
  ryu: "ryu",
  ken: "ken",
  cloud: "cloud",
  corrin: "corrin",
  bayonetta: "bayonetta",
  inkling: "inkling",
  ridley: "ridley",
  simon: "simon",
  richter: "richter",
  "king k rool": "krool",
  isabelle: "isabelle",
  incineroar: "incineroar",
  "piranha plant": "plant",
  joker: "joker",
  hero: "hero",
  "banjo kazooie": "banjo",
  terry: "terry",
  byleth: "byleth",
  "min min": "minmin",
  minmin: "minmin",
  steve: "steve",
  sephiroth: "sephiroth",
  "pyra mythra": "aegis",
  kazuya: "kazuya",
  sora: "sora",
};

// Character names and stored filenames used before the icon assets were renamed.
const LEGACY_ULTIMATE_CHARACTER_ICON_ALIASES: Record<string, string> = {
  brave: "hero",
  buddy: "banjo",
  demon: "kazuya",
  dolly: "terry",
  edge: "sephiroth",
  gaogaen: "incineroar",
  jack: "joker",
  packun: "plant",
  pickel: "steve",
  tantan: "minmin",
  gekkouga: "greninja",
  kamui: "corrin",
  koopa: "bowser",
  koopajr: "bowserjr",
  murabito: "villager",
  pikmin: "olimar",
  purin: "jigglypuff",
  reflet: "robin",
  rockman: "megaman",
  rosetta: "rosalina",
  shizue: "isabelle",
  trail: "sora",
};

const ULTIMATE_CHARACTER_ICON_ALIASES = {
  ...ULTIMATE_CHARACTER_ICONS,
  ...LEGACY_ULTIMATE_CHARACTER_ICON_ALIASES,
};

export const ULTIMATE_CHARACTER_OPTIONS = Object.keys(
  ULTIMATE_CHARACTER_ICONS,
)
  .map((name) => name.replace(/\b\w/g, (letter) => letter.toUpperCase()));

export const MELEE_CHARACTER_OPTIONS = [
  "Captain Falcon",
  "Donkey Kong",
  "Dr Mario",
  "Falco",
  "Fox",
  "Ganondorf",
  "Ice Climbers",
  "Jigglypuff",
  "Kirby",
  "Link",
  "Luigi",
  "Mario",
  "Marth",
  "Mewtwo",
  "Mr Game Watch",
  "Ness",
  "Peach",
  "Pichu",
  "Pikachu",
  "Roy",
  "Samus",
  "Sheik",
  "Yoshi",
  "Young Link",
  "Zelda",
];

export const getCharacterOptions = (game: GameType) =>
  game === "ultimate" ? ULTIMATE_CHARACTER_OPTIONS : MELEE_CHARACTER_OPTIONS;

const normalizeCharacterName = (character: string) =>
  character
    .toLowerCase()
    .replace(/[.'&/]/g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const ULTIMATE_CHARACTER_ICON_MAP = Object.fromEntries(
  Object.entries(ULTIMATE_CHARACTER_ICON_ALIASES).map(([name, icon]) => [
    normalizeCharacterName(name),
    icon,
  ]),
);

export const getCharacterIconPath = (game: GameType, character: string) => {
  if (game !== "ultimate") {
    return `/characterIcons/${game}/${character
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")}.png`;
  }

  const normalized = normalizeCharacterName(character);
  const mapped = ULTIMATE_CHARACTER_ICON_MAP[normalized];
  return mapped
    ? `/characterIcons/ultimate/${mapped}_00.png`
    : "/characterIcons/ultimate/random_00.png";
};

export const getStocksPerPlayer = (game: GameType) =>
  game === "ultimate" ? 3 : 4;

export const resolveCharacterImagePath = (
  game: GameType,
  character: string,
  storedImagePath: string | null | undefined,
) => {
  if (!storedImagePath) {
    return getCharacterIconPath(game, character);
  }

  if (game !== "ultimate") {
    return storedImagePath;
  }

  const ultimateAssetMatch = storedImagePath.match(
    /^\/characterIcons\/ultimate\/([a-z0-9_]+)_(\d{2})\.png$/,
  );

  if (ultimateAssetMatch) {
    const [, iconName, costume] = ultimateAssetMatch;
    const currentIconName =
      LEGACY_ULTIMATE_CHARACTER_ICON_ALIASES[iconName] ?? iconName;

    return `/characterIcons/ultimate/${currentIconName}_${costume}.png`;
  }

  if (!storedImagePath.startsWith("/characterIcons/ultimate/")) {
    return storedImagePath;
  }

  return getCharacterIconPath(game, character);
};

export const getCharacterRenderPath = (
  character: string,
  costume = 0,
): string | null => {
  if (!character) return null;
  const normalized = normalizeCharacterName(character);
  const mapped =
    ULTIMATE_CHARACTER_ICON_MAP[normalized] ??
    ULTIMATE_CHARACTER_ICONS[normalized] ??
    normalized;

  const renderKey =
    mapped === "byleth"
      ? "master"
      : mapped === "aegis" || mapped === "pyra mythra"
      ? "pyra"
      : mapped;

  return `/characterRenders/${renderKey}_render_${costume}.png`;
};
