import { createRoot } from "react-dom/client";
import { REST, eyeShape, poseFor, type Mood, type Pose } from "@/components/companion/engine";
import { GEO, INK } from "@/lib/companion/theme";
import "../src/styles.css";

// A tuning sheet: every expression frozen side by side. Open /gallery.html.
const ALL: Array<[string, Mood | null, number, number?, number?]> = [
  ["rest", null, 0],
  ["blink ½", null, 0, 0, 0.5],
  ["blink", null, 0, 0, 1],
  ["look right", null, 0, 0.9],
  ["glance up", "glance", 200, 0.6],
  ["think", "think", 1200, 0.9],
  ["grumpy", "frustrate", 600, 0.9],
  ["cute hop", "cute", 200, 0.9],
  ["cute wink", "cute", 900, 0.9],
  ["delight", "delight", 700, 0.9],
  ["surprise", "surprise", 300, 0.9],
  ["doze", "doze", 3500, 0.9],
  ["sleep", "sleep", 0, 0.9],
];

const only = new URLSearchParams(location.search).get("only");
const SHOTS = only ? ALL.filter(([name]) => only.split(",").includes(name)) : ALL;

function Still({ pose, gx, gy, blink, id }: { pose: Pose; gx: number; gy: number; blink: number; id: string }) {
  const eyes = (["l", "r"] as const).map((side) => ({ side, ...eyeShape(side, pose, gx, gy, blink) }));
  return (
    <svg viewBox={`0 0 ${GEO.vbW} ${GEO.vbH}`} style={{ width: 300 }}>
      <defs>
        <filter id={`soft-${id}`} x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceAlpha" stdDeviation="2.2" result="blur" />
          <feComponentTransfer in="blur" result="shape">
            <feFuncA type="linear" slope="12" intercept="-5.6" />
          </feComponentTransfer>
          <feFlood floodColor={INK} />
          <feComposite in2="shape" operator="in" />
        </filter>
        {eyes.map((e) => (
          <mask key={e.side} id={`m-${id}-${e.side}`} maskUnits="userSpaceOnUse" x="0" y="0" width={GEO.vbW} height={GEO.vbH}>
            <rect fill="white" x={e.pill.x} y={e.pill.y} width={e.pill.w} height={e.pill.h} rx={e.pill.r} />
            <path fill="black" d={e.lid} />
            <path fill="black" d={e.cheek} />
          </mask>
        ))}
      </defs>
      <ellipse className="shadow" cx={GEO.cx} cy={GEO.shadowY} rx={GEO.shadowRx} ry={GEO.shadowRy} />
      <g transform={`translate(0 ${pose.y}) rotate(${pose.rot} ${GEO.cx} ${GEO.pivotY})`}>
        <ellipse className="skin" cx={GEO.cx} cy={GEO.cy} rx={GEO.faceRx} ry={GEO.faceRy} />
        <g filter={`url(#soft-${id})`}>
          {eyes.map((e) => (
            <rect key={e.side} className="ink" mask={`url(#m-${id}-${e.side})`} x={0} y={0} width={GEO.vbW} height={GEO.vbH} />
          ))}
        </g>
      </g>
    </svg>
  );
}

function Gallery() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 16, padding: 24, overflow: "auto", height: "100vh" }}>
      {SHOTS.map(([name, mood, t, seed = 0.9, blink = 0], i) => {
        const pose = mood ? poseFor(mood, t, seed).pose : REST;
        const gx = name === "look right" ? 0.9 : pose.lookX * pose.lookMix;
        const gy = pose.lookY * pose.lookMix;
        return (
          <figure key={name} style={{ margin: 0, textAlign: "center", fontSize: 13 }}>
            <Still pose={pose} gx={gx} gy={gy} blink={blink} id={String(i)} />
            <figcaption>{name}</figcaption>
          </figure>
        );
      })}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<Gallery />);
