import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Privacy Policy for The Nexus - collegiate crew battle league platform.',
  openGraph: {
    title: 'Privacy Policy | The Nexus',
    description: 'Privacy Policy for The Nexus - collegiate crew battle league platform.',
    url: '/privacy'
  },
  twitter: {
    title: 'Privacy Policy | The Nexus',
    description: 'Privacy Policy for The Nexus - collegiate crew battle league platform.'
  }
};

export default function PrivacyPolicyPage() {
  return (
    <article className="privacy-page">
      <header className="privacy-header">
        <h1>Privacy Policy</h1>
        <p className="privacy-effective">Last updated: September 2026</p>
        <p className="privacy-lead">
          The Nexus League LLC (&quot;The Nexus&quot;, &quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) provides a collegiate Super Smash Bros.
          Ultimate league management platform. This Privacy Policy outlines how we collect, use, and protect your information
          when you access thenexus.gg, participate in league matches, or create an account.
        </p>
      </header>

      <div className="privacy-sections">
        <section className="privacy-section">
          <h2>1. Overview</h2>
          <p>
            The Nexus organizes and runs competitive collegiate crew battle leagues. We believe in transparency and
            collect only the information necessary to operate league competitions, authenticate participants, and publish
            fair competition stats and standings.
          </p>
        </section>

        <section className="privacy-section">
          <h2>2. Information We Collect</h2>
          <p>We collect information in the following contexts:</p>
          <ul>
            <li>
              <strong>Account Information:</strong> When you register or complete onboarding, we collect your name, chosen
              player tag, email address, school affiliation, assigned role (player, director, moderator), and optional
              social links (such as your Discord or X/Twitter handles).
            </li>
            <li>
              <strong>Competition &amp; Match Data:</strong> In-game player selections, character picks, stage counterpicks,
              round outcomes, stock counts, and crew battle progression recorded during official league matches.
            </li>
            <li>
              <strong>Authentication &amp; Technical Logs:</strong> Secure authentication session tokens (including OAuth
              credentials if you sign in with Google or Discord), device/browser type, and basic server access logs.
            </li>
            <li>
              <strong>Cookies and Tracking Data:</strong> We use essential cookies and local web storage to maintain your
              active login session and manage live match room states.
            </li>
          </ul>
        </section>

        <section className="privacy-section">
          <h2>3. How We Use Your Information</h2>
          <p>We use collected data solely for league management and player experience, including:</p>
          <ul>
            <li>Administering live match rooms, stage striking, and score reporting.</li>
            <li>Generating public standings, team rosters, player profile cards, and tournament brackets.</li>
            <li>Verifying student competitor and school program eligibility.</li>
            <li>Facilitating coordinator communications, match scheduling, and dispute resolutions.</li>
            <li>Protecting the integrity, safety, and security of our services and participants.</li>
          </ul>
        </section>

        <section className="privacy-section">
          <h2>4. Publicly Accessible Competition Data</h2>
          <p>
            Because The Nexus is a public esports league, certain competition-related details are publicly viewable by nature
            of the competition:
          </p>
          <ul>
            <li>Your player tag, school/team name, and avatar.</li>
            <li>Match outcomes, game replays/VOD links, character usage rates, and counterpick stage statistics.</li>
            <li>Connected public social handles (Discord, X/Twitter) if you choose to provide them on your profile.</li>
          </ul>
          <p>
            We never publicly publish or sell your private email address, internal user IDs, or billing details.
          </p>
        </section>

        <section className="privacy-section">
          <h2>5. Data Storage &amp; Security</h2>
          <p>
            Your information is stored securely in encrypted cloud infrastructure. We do not sell, rent, or trade your personal
            data to advertisers or third-party data brokers. While we do not sell your data, we do share necessary information with
            trusted third-party service providers who help us operate the platform (such as our cloud hosting and database
            infrastructure), strictly for the purpose of providing The Nexus services. Access to private administrative operations
            is strictly limited to authorized league officials.
          </p>
        </section>

        <section className="privacy-section">
          <h2>6. Your Rights &amp; Data Choices</h2>
          <p>
            You can update your personal information, player tag, and social links at any time through your{' '}
            <Link href="/dashboard">Dashboard</Link> or onboarding settings. If you wish to request account deletion or have
            questions about your stored information, please contact us.
          </p>
        </section>

        <section className="privacy-section">
          <h2>7. Changes to this Policy</h2>
          <p>
            We may update this policy periodically to reflect changes in our platform or legal requirements. We will notify you
            of any material changes by posting the new policy on this page and updating the effective date at the top of the
            document.
          </p>
        </section>

        <section className="privacy-section">
          <h2>8. Contact Us</h2>
          <p>
            For any privacy inquiries, data requests, or feedback, please email us directly at{' '}
            <a href="mailto:connect@thenexus.gg">connect@thenexus.gg</a>.
          </p>
        </section>
      </div>
    </article>
  );
}
