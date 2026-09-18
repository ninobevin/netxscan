export function CompanyLogo({
  src,
  className,
  alt = 'Company logo',
}: {
  src: string | null | undefined;
  className?: string;
  alt?: string;
}) {
  if (!src) {
    return null;
  }
  return <img src={src} alt={alt} className={className} />;
}
