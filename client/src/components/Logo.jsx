function Logo({ size = 40 }) {
  return (
    <span className="logo" style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 48 48" role="img">
        <defs>
          <linearGradient id="logo-gradient" x1="8" y1="5" x2="40" y2="43" gradientUnits="userSpaceOnUse">
            <stop stopColor="#5CB6FF" />
            <stop offset="1" stopColor="#0068F0" />
          </linearGradient>
        </defs>
        <rect width="48" height="48" rx="15" fill="url(#logo-gradient)" />
        <path d="M13 16.5C13 12.91 15.91 10 19.5 10h9C32.09 10 35 12.91 35 16.5v7c0 3.59-2.91 6.5-6.5 6.5H22l-6.8 5.1.95-5.48A6.5 6.5 0 0 1 13 24v-7.5Z" fill="white" />
        <circle cx="20" cy="20" r="2" fill="#087CFF" />
        <circle cx="28" cy="20" r="2" fill="#087CFF" />
      </svg>
    </span>
  );
}

export default Logo;
