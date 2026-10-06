import { CrewBattleRound, Game } from '@/lib/data';

const STOCKS_PER_PLAYER: Record<Game['game'], number> = {
  melee: 4,
  ultimate: 3
};

interface TeamState {
  stocksRemainingByPlayer: Map<string, number>;
  teamStocksRemaining: number;
}

export interface CrewRoundWithTeamStocks extends CrewBattleRound {
  home_team_stocks_remaining: number;
  away_team_stocks_remaining: number;
}

export const getStocksPerPlayer = (game: Game['game']) => STOCKS_PER_PLAYER[game];

const getPlayerStocksAtRoundStart = (
  playerTag: string,
  stocksPerPlayer: number,
  state: TeamState
) => {
  const normalizedTag = playerTag.trim();
  return state.stocksRemainingByPlayer.get(normalizedTag) ?? stocksPerPlayer;
};

const getStocksTakenInRound = (stocksAtRoundStart: number, stocksRemainingAfterRound: number) =>
  Math.max(0, stocksAtRoundStart - stocksRemainingAfterRound);

export const calculateCrewBattleStockProgress = (
  game: Pick<Game, 'game' | 'home_roster_size' | 'away_roster_size'>,
  rounds: CrewBattleRound[]
): CrewRoundWithTeamStocks[] => {
  const stocksPerPlayer = getStocksPerPlayer(game.game);

  const homeState: TeamState = {
    stocksRemainingByPlayer: new Map<string, number>(),
    teamStocksRemaining: game.home_roster_size * stocksPerPlayer
  };

  const awayState: TeamState = {
    stocksRemainingByPlayer: new Map<string, number>(),
    teamStocksRemaining: game.away_roster_size * stocksPerPlayer
  };

  return rounds.map((round) => {
    if ((round.home_stocks_remaining === 0) === (round.away_stocks_remaining === 0)) {
      console.warn(
        `[crew-battle] Round has non-standard KO state (both zero or both above zero), rendering anyway: ${round.id}`
      );
    }
    const homeStocksAtRoundStart = getPlayerStocksAtRoundStart(round.home_player_tag, stocksPerPlayer, homeState);
    const awayStocksAtRoundStart = getPlayerStocksAtRoundStart(round.away_player_tag, stocksPerPlayer, awayState);

    const homeStocksTaken = getStocksTakenInRound(homeStocksAtRoundStart, round.home_stocks_remaining);
    const awayStocksTaken = getStocksTakenInRound(awayStocksAtRoundStart, round.away_stocks_remaining);

    homeState.teamStocksRemaining = Math.max(0, homeState.teamStocksRemaining - homeStocksTaken);
    awayState.teamStocksRemaining = Math.max(0, awayState.teamStocksRemaining - awayStocksTaken);

    homeState.stocksRemainingByPlayer.set(round.home_player_tag.trim(), round.home_stocks_remaining);
    awayState.stocksRemainingByPlayer.set(round.away_player_tag.trim(), round.away_stocks_remaining);

    return {
      ...round,
      home_team_stocks_remaining: homeState.teamStocksRemaining,
      away_team_stocks_remaining: awayState.teamStocksRemaining
    };
    });
};
