import { NexusLogoLoader } from './nexus-logo-loader';

type RouteLoaderProps = {
  label?: string;
  size?: number | string;
};

export function RouteLoader({ label = 'Loading page', size = 56 }: RouteLoaderProps) {
  return (
    <section className="route-loading" role="status" aria-live="polite" aria-label={label}>
      <NexusLogoLoader size={size} />
      <span className="sr-only">{label}</span>
    </section>
  );
}
