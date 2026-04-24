export default function GeometricPattern() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" className="opacity-[0.08]">
        <defs>
          <pattern id="islamic-pattern" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
            <path d="M40 0 L60 20 L40 40 L20 20 Z" fill="none" stroke="currentColor" strokeWidth="1" />
            <path d="M0 40 L20 60 L40 40 L20 20 Z" fill="none" stroke="currentColor" strokeWidth="1" />
            <path d="M40 40 L60 60 L80 40 L60 20 Z" fill="none" stroke="currentColor" strokeWidth="1" />
            <path d="M40 40 L60 20 L80 40 L60 60 Z" fill="none" stroke="currentColor" strokeWidth="1" />
            <circle cx="40" cy="40" r="8" fill="none" stroke="currentColor" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#islamic-pattern)" />
      </svg>
    </div>
  );
}
