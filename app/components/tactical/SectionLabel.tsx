type Props = {
  title: string;
  subtitle?: string;
  accent?: 'cyan' | 'magenta' | 'yellow' | 'green' | 'lime' | 'purple';
  className?: string;
};

const accentClass = {
  cyan: 'text-cyan',
  magenta: 'text-magenta',
  yellow: 'text-yellow',
  green: 'text-green',
  lime: 'text-yellow',
  purple: 'text-magenta',
};

export function SectionLabel({ title, subtitle, accent = 'cyan', className = '' }: Props) {
  return (
    <div className={`mb-3 ${className}`.trim()}>
      <h3 className={`label-tactical ${accentClass[accent]}`}>{title}</h3>
      {subtitle && <p className="mt-1 text-sm leading-relaxed text-foreground/80">{subtitle}</p>}
    </div>
  );
}
