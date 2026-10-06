import { players, teams } from '@/lib/data';

export default function StandingsEntityPage({ params }: { params: { slug: string } }) {
  const slug = params.slug.toLowerCase();

  const player = players.find((entry) => entry.tag.toLowerCase() === slug);
  const team = teams.find((entry) => entry.short_name.toLowerCase() === slug);

  if (!player && !team) {
    return (
      <section className="card">
        <h1>Standings profile not found</h1>
        <p className="muted">Try a player tag like /standings/nova or team code like /standings/flx.</p>
      </section>
    );
  }

  if (player) {
    return (
      <section className="card">
        <h1>Player: {player.tag}</h1>
        <p>Matches Played: {player.matches.length}</p>
        <p>
          Record: {player.wins}-{player.losses}
        </p>
      </section>
    );
  }

  return (
    <section className="card">
      <h1>Team: {team?.name}</h1>
      <p>Director: {team?.director_tag}</p>
      <p>
        Record: {team?.wins}-{team?.losses}
      </p>
    </section>
  );
}
