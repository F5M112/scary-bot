'use client';

export default function Logo({ size = 32, className = '', showText = false, textClassName = '' }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <img
        src="/logo.png"
        alt="ST Logo"
        width={size}
        height={size}
        className="logo-glow rounded-lg"
        style={{ width: size, height: size }}
      />
      {showText && (
        <span className={`font-black tracking-tight ${textClassName}`}>
          <span className="text-brand-500">ST</span>
          <span className="text-white"> Tickets</span>
        </span>
      )}
    </div>
  );
}
