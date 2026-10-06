const STAGE_RULES: Array<{ matches: string[]; image: string; icon: string }> = [
  { matches: ['small battlefield'], image: '/stages/small-battlefield.jpg', icon: '/stages/svg/small-battlefield.svg' },
  { matches: ['battlefield'], image: '/stages/battlefield.png', icon: '/stages/svg/battlefield.svg' },
  { matches: ['final destination', 'fd'], image: '/stages/final-destination.jpg', icon: '/stages/svg/final-destination.svg' },
  { matches: ['hollow bastion'], image: '/stages/hollow-bastion.jpg', icon: '/stages/svg/hollow-bastion.svg' },
  { matches: ['pokemon stadium 2', 'pokémon stadium 2', 'ps2'], image: '/stages/pokemon-stadium-2.png', icon: '/stages/svg/pokemon-stadium-2.svg' },
  { matches: ['kalos'], image: '/stages/kalos.png', icon: '/stages/svg/kalos.svg' },
  { matches: ['smashville'], image: '/stages/smashville.png', icon: '/stages/svg/smashville.svg' },
  { matches: ['town', 'town & city', 'town and city'], image: '/stages/town.png', icon: '/stages/svg/town.svg' }
];

export const resolveRoundStageBackground = (stage: string) => {
  const normalizedStage = stage.toLowerCase().trim();

  const stageRule = STAGE_RULES.find((rule) => rule.matches.some((stageName) => normalizedStage.includes(stageName)));

  return stageRule?.image ?? null;
};

export const resolveRoundStageIcon = (stage: string) => {
  const normalizedStage = stage.toLowerCase().trim();

  const stageRule = STAGE_RULES.find((rule) => rule.matches.some((stageName) => normalizedStage.includes(stageName)));

  return stageRule?.icon ?? null;
};
