import Image from "next/image";

export default function BrandHeader() {
  return (
    <header className="w-full border-b bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <Image
            src="/logo.png"
            alt="LGU Lingayen Seal"
            width={32}
            height={32}
            className="shrink-0 rounded"
            priority
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">Municipality of Lingayen</p>
            <p className="text-[11px] leading-3 text-muted-foreground truncate">
              Official Public Profile
            </p>
          </div>
        </div>

        {/* optional: link to main LGU site */}
        <a href="https://lingayen.gov.ph" className="text-xs text-primary hover:underline">
          lingayen.gov.ph
        </a>
      </div>
    </header>
  );
}
