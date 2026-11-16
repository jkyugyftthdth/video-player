import { Film } from 'lucide-react';
import { useState } from 'react';

interface VideoThumbProps {
  src?: string;
  alt: string;
  className?: string;
  iconSize?: number;
  roundedClass?: string;
}

export function VideoThumb({
  src,
  alt,
  className = '',
  iconSize = 24,
  roundedClass = 'rounded-md',
}: VideoThumbProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`flex items-center justify-center bg-gradient-to-br from-neutral-200 to-neutral-300 dark:from-[#2c2c2c] dark:to-[#1f1f1f] text-neutral-500 dark:text-neutral-400 ${roundedClass} ${className}`}
        aria-label={alt}
      >
        <Film size={iconSize} strokeWidth={1.6} />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`object-cover bg-neutral-200 dark:bg-[#252525] ${roundedClass} ${className}`}
    />
  );
}
