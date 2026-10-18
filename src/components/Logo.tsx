import Image from "next/image";

/** Small lockup for the navbar. */
export function LogoLockup() {
  return (
    <span className="flex items-center gap-2.5">
      <span className="relative grid h-16 w-15 my-2 place-items-center overflow-hidden rounded-full bg-[radial-gradient(circle_at_40%_35%,#f2fffc,#b7efe6_60%,#4fb9ad)] shadow-[0_0_18px_rgba(46,230,201,0.45)]">
        <Image src="/datacare-mark.png" alt="" width={30} height={25} priority />
      </span>
      {/* <span className="hidden font-display text-[15px] font-bold leading-none tracking-[0.18em] min-[430px]:inline">
        DATA<span className="text-pulse">CARE</span>
        <span className="block font-mono text-[9px] font-medium tracking-[0.42em] text-mist">CARE</span>
      </span> */}
    </span>
  );
}

/**
 * Hero emblem: the Datacare mother-and-child mark sealed inside a luminous core,
 * orbited by rotating survey rings and a radar sweep.
 */
export function LogoOrb({ size = 220 }: { size?: number }) {
  return (
    <div className="relative mx-auto" style={{ width: size, height: size }} aria-label="Datacare Care" role="img">
      {/* radar sweep */}
      <div
        className="animate-radar absolute inset-[-18%] rounded-full opacity-60"
        style={{
          background: "conic-gradient(from 0deg, rgba(46,230,201,0.35), transparent 70deg, transparent 360deg)",
          maskImage: "radial-gradient(circle, transparent 38%, black 40%, black 69%, transparent 71%)",
          WebkitMaskImage: "radial-gradient(circle, transparent 38%, black 40%, black 69%, transparent 71%)",
        }}
      />
      {/* rings */}
      <svg viewBox="0 0 200 200" className="animate-spin-slow absolute inset-[-18%] h-[136%] w-[136%]">
        <circle cx="100" cy="100" r="96" fill="none" stroke="rgba(46,230,201,0.35)" strokeWidth="0.6" strokeDasharray="2 6" />
        <circle cx="100" cy="100" r="84" fill="none" stroke="rgba(46,230,201,0.18)" strokeWidth="0.5" />
        <circle cx="100" cy="4" r="2.2" fill="#2ee6c9" />
        <circle cx="16" cy="100" r="1.6" fill="#ff4d6d" />
      </svg>
      <svg viewBox="0 0 200 200" className="animate-spin-rev absolute inset-[-6%] h-[112%] w-[112%]">
        <circle
          cx="100"
          cy="100"
          r="94"
          fill="none"
          stroke="rgba(58,168,255,0.5)"
          strokeWidth="1"
          strokeDasharray="60 40 8 40"
          strokeLinecap="round"
        />
        <circle cx="194" cy="100" r="2" fill="#3aa8ff" />
      </svg>
      {/* tick marks */}
      <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full opacity-50">
        {Array.from({ length: 48 }, (_, i) => (
          <line
            key={i}
            x1="100"
            y1="2"
            x2="100"
            y2={i % 4 === 0 ? 9 : 5}
            stroke="#2ee6c9"
            strokeWidth="0.6"
            transform={`rotate(${i * 7.5} 100 100)`}
          />
        ))}
      </svg>
      {/* core */}
      <div className="absolute inset-[13%] rounded-full bg-[radial-gradient(circle_at_40%_35%,#f4fffd,#c9f5ee_45%,#5fc4b8_80%,#1d6f69)] shadow-[0_0_60px_rgba(46,230,201,0.55),inset_0_-10px_30px_rgba(0,40,40,0.5)]" />
      <div className="absolute inset-[13%] grid place-items-center">
        <Image
          src="/datacare-mark.png"
          alt="Datacare logo"
          width={480}
          height={402}
          priority
          className="w-[68%] drop-shadow-[0_4px_10px_rgba(0,30,40,0.35)]"
        />
      </div>
    </div>
  );
}
