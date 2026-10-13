import { createRoot } from "react-dom/client";
import {
  REST,
  eyeShape,
  lookEye,
  lookMouth,
  lookPose,
  noseShape,
  poseFor,
  type Look,
  type Mood,
  type Pose,
} from "@/components/companion/engine";
import { GEO, INK } from "@/lib/companion/theme";
import "../src/styles.css";

// A tuning sheet: every expression frozen side by side. Open /gallery.html.
// ?only=a,b picks shots by name, ?size=600 makes them bigger, ?acc=1 puts the
// accessories on every face, ?brows=1 draws the eyebrows, ?mouth=1 the mouth, ?eyes=1 just the eyes,
// ?jack=1 the jack-o'-lantern mode, ?snow=1 the snowman.
type Shot = [
  name: string,
  mood: Mood | null,
  t: number,
  seed?: number,
  blink?: number,
  acc?: boolean,
];

const ALL: Shot[] = [
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
  ["cute squish", "cute", 900, 0.9],
  ["purr", "purr", 0, 0.9],
  ["sleep", "sleep", 0, 0.9],
  ["yawn", "yawn", 600, 0.9],
  ["huff", "huff", 600, 0.9],
  ["sulk", "sulk", 600, 0.9],
  ["worried", "worry", 1200, 0.9],
  ["concerned", "care", 1400, 0.9],
  ["gentle look", "soothe", 1900, 0.9],
  ["lost a piece", "ck-ouch", 1300, 0.9],
  ["sly check", "ch-check", 1000, 0.9],
  ["no thanks", "decline", 700, 0.9],
];

const params = new URLSearchParams(location.search);
const only = params.get("only");
const size = Number(params.get("size") ?? 300);
const allAcc = params.get("acc") === "1";
const brows = params.get("brows") === "1";
const mouth = params.get("mouth") === "1";
const eyesOnly = params.get("eyes") === "1";
const look: Look = params.get("jack") === "1" ? "jack" : params.get("snow") === "1" ? "snow" : "neutral";
document.documentElement.dataset.mode = look;
const SHOTS = only ? ALL.filter(([name]) => only.split(",").includes(name)) : ALL;

function Still({
  pose,
  gx,
  gy,
  blink,
  id,
  t,
  acc,
}: {
  pose: Pose;
  gx: number;
  gy: number;
  blink: number;
  id: string;
  t: number;
  acc: boolean;
}) {
  const eyes = (["l", "r"] as const).map((side) => ({
    side,
    ...eyeShape(side, lookPose(look, pose), gx, gy, blink),
  }));
  return (
    <svg viewBox={`0 0 ${GEO.vbW} ${GEO.vbH}`} style={{ width: size, overflow: "visible" }}>
      <defs>
        <filter
          id={`soft-${id}`}
          x="-20%"
          y="-20%"
          width="140%"
          height="140%"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur in="SourceAlpha" stdDeviation="3.2" result="blur" />
          <feComponentTransfer in="blur" result="shape">
            <feFuncA type="linear" slope="18" intercept="-7.1" />
          </feComponentTransfer>
          <feFlood floodColor={INK} />
          <feComposite in2="shape" operator="in" />
        </filter>
        {eyes.map((e) => (
          <mask
            key={e.side}
            id={`m-${id}-${e.side}`}
            maskUnits="userSpaceOnUse"
            x="0"
            y="0"
            width={GEO.vbW}
            height={GEO.vbH}
          >
            {look !== "neutral" ? (
              <path fill="white" d={lookEye(look, e.pill, e.side) ?? ""} />
            ) : (
              <rect
                fill="white"
                x={e.pill.x}
                y={e.pill.y}
                width={e.pill.w}
                height={e.pill.h}
                rx={e.pill.r}
              />
            )}
            <path fill="black" d={e.lid} />
            <path fill="black" d={e.cheek} />
          </mask>
        ))}
      </defs>
      {eyesOnly ? null : (
        <ellipse
          className="shadow"
          cx={GEO.cx}
          cy={GEO.shadowY}
          rx={GEO.shadowRx}
          ry={GEO.shadowRy}
        />
      )}
      <g
        transform={`translate(${pose.x} ${pose.y}) rotate(${pose.rot} ${GEO.cx} ${GEO.pivotY}) translate(${GEO.cx} ${GEO.groundY}) scale(${pose.sx} ${pose.sy}) translate(${-GEO.cx} ${-GEO.groundY})`}
      >
        {eyesOnly ? null : <ellipse className="skin" cx={GEO.cx} cy={GEO.cy} rx={GEO.faceRx} ry={GEO.faceRy} />}
        <g filter={`url(#soft-${id})`}>
          {eyes.map((e) => (
            <rect
              key={e.side}
              className="ink"
              mask={`url(#m-${id}-${e.side})`}
              x={0}
              y={0}
              width={GEO.vbW}
              height={GEO.vbH}
            />
          ))}
          {brows ? eyes.map((e) => <path key={`b${e.side}`} className="brow" d={e.brow} />) : null}
          {mouth ? (
            <path className={`mouth is-${look}`} d={lookMouth(look, pose, gx, gy)} />
          ) : null}
        </g>
        {look === "snow" ? <path className="nose" d={noseShape(gx, gy)} /> : null}
      </g>
    </svg>
  );
}

function Gallery() {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 16,
        padding: 24,
        overflow: "auto",
        height: "100vh",
      }}
    >
      {SHOTS.map(([name, mood, t, seed = 0.9, blink = 0, acc = false], i) => {
        const pose = mood ? poseFor(mood, t, seed, { sincePet: -1 }).pose : { ...REST };
        const gx = name === "look right" ? 0.9 : pose.lookX * pose.lookMix;
        const gy = pose.lookY * pose.lookMix;
        return (
          <figure key={name} style={{ margin: 0, textAlign: "center", fontSize: 13 }}>
            <Still
              pose={pose}
              gx={gx}
              gy={gy}
              blink={blink}
              id={String(i)}
              t={t}
              acc={acc || allAcc}
            />
            <figcaption>{name}</figcaption>
          </figure>
        );
      })}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<Gallery />);
