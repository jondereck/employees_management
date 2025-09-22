import Image from "next/image";

type Logo = {
  src: string;         // e.g. "/system-logo.png"
  alt: string;         // accessible label
  width?: number;      // default 28
  height?: number;     // default 28
  title?: string;      // tooltip
};

export default function PublicFooter({
  className = "",
  creatorName = "JDN Systems",
  creatorLink, // e.g. "https://lingayen.gov.ph/hrmo"
  systemName = "HR Profiling System",
  systemLogo,
  hrLogo,
  lguLogo, // optional, if you want to also show the LGU seal here
}: {
  className?: string;
  creatorName?: string;
  creatorLink?: string;
  systemName?: string;
  systemLogo: Logo;
  hrLogo: Logo;
  lguLogo?: Logo;
}) {
  const year = new Date().getFullYear();

  const LogoImg = (props: Logo) => (
    <Image
      src={props.src}
      alt={props.alt}
      width={props.width ?? 28}
      height={props.height ?? 28}
      className="shrink-0 rounded"
      title={props.title}
      priority={false}
    />
  );

  return (
    <footer
      className={[
        "w-full border-t bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60",
        className,
      ].join(" ")}
    >
      <div className="mx-auto  px-4 sm:px-6 lg:px-8 py-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Left: system + logos */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-2">
              {/* System Logo */}
              <LogoImg {...systemLogo} />
              {/* HR Logo */}
              <LogoImg {...hrLogo} />
              {/* Optional LGU Logo */}
              {lguLogo ? <LogoImg {...lguLogo} /> : null}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{systemName}</p>
              <p className="text-[11px] leading-3 text-muted-foreground truncate">
                © {year} {creatorLink ? (
              <a
                href={creatorLink}
                className="hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
               {creatorName}
              </a>
            ) : (
              <>{creatorName}</>
            )}
              </p>
            </div>
          </div>


        </div>
      </div>
    </footer>
  );
}
