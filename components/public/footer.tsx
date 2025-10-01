import Image from "next/image";

type Logo = {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  title?: string;
};

export default function PublicFooter({
  className = "",
  creatorName = "JDN Systems",
  creatorLink,
  systemName = "HR Profiling System",
  systemLogo,
  hrLogo,
  lguLogo,
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
        "fixed inset-x-0 bottom-0 z-40",
        "w-full border-t bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60",
        "pb-[max(0px,env(safe-area-inset-bottom))]",
        className,
      ].join(" ")}
    >
      <div className="mx-auto px-4 sm:px-6 lg:px-8 py-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Left: system + logos */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-2">
              <LogoImg {...systemLogo} />
              <LogoImg {...hrLogo} />
              {lguLogo ? <LogoImg {...lguLogo} /> : null}
            </div>

            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{systemName}</p>

              <p className="text-[11px] leading-3 text-muted-foreground truncate">
                © {year}{" "}
                {creatorLink ? (
                  <a
                    href={creatorLink}
                    className="group inline-flex items-center hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span className="creator-animated-name">{creatorName}</span>
                    <span
                      aria-hidden
                      className="ml-1 opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      ✨
                    </span>
                  </a>
                ) : (
                  <span className="creator-animated-name">{creatorName}</span>
                )}
              </p>
            </div>
          </div>

          {/* (right side content if any) */}
        </div>
      </div>
    </footer>
  );
}
