type NexusLogoLoaderProps = {
  className?: string;
  size?: number | string;
};

export function NexusLogoLoader({ className = '', size = 56 }: NexusLogoLoaderProps) {
  const dimension = typeof size === 'number' ? `${size}px` : size;

  return (
    <div
      className={`nexus-logo-loader ${className}`.trim()}
      style={{ width: dimension, height: dimension }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 153.6 154.25"
        className="nexus-logo-spinner-svg"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Strong Pure White Outline */}
        <g className="nexus-logo-outline">
          <polygon
            points="37.6 37.85 76.8 77.19 116.01 37.85 116.01 .13 153.6 53.48 103.38 103.87 153.6 154.25 100.43 154.25 76.8 130.54 53.17 154.25 0 154.25 50.22 103.87 0 53.48 37.6 .13 37.6 37.85 37.6 37.85"
            fill="none"
            stroke="#f9fafd"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
          <polygon
            points="77.02 0 95.88 41.44 77.02 60.3 58.15 41.44 77.02 0 77.02 0"
            fill="none"
            stroke="#f9fafd"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
        </g>

        {/* Animated Rising Solid Pure White Fill */}
        <g className="nexus-logo-fill-group">
          <polygon
            points="37.6 37.85 76.8 77.19 116.01 37.85 116.01 .13 153.6 53.48 103.38 103.87 153.6 154.25 100.43 154.25 76.8 130.54 53.17 154.25 0 154.25 50.22 103.87 0 53.48 37.6 .13 37.6 37.85 37.6 37.85"
            fill="#f9fafd"
          />
          <polygon
            points="77.02 0 95.88 41.44 77.02 60.3 58.15 41.44 77.02 0 77.02 0"
            fill="#f9fafd"
          />
        </g>
      </svg>
    </div>
  );
}
