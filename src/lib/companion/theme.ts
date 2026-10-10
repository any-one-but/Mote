/** Shared face geometry, in viewBox units. */
export const GEO = {
  vbW: 240,
  vbH: 268,
  /** Face body. */
  cx: 120,
  cy: 132,
  faceRx: 98,
  faceRy: 92,
  /** Where the body squashes against (bottom of the face) and where it leans from. */
  groundY: 224,
  pivotY: 150,
  /** Soft contact shadow under the body. */
  shadowY: 244,
  shadowRx: 60,
  shadowRy: 6.5,
  /** Pill eyes at rest. */
  eyeLX: 85,
  eyeRX: 155,
  eyeY: 138,
  eyeW: 38,
  eyeH: 58,
} as const;

export const INK = "#231c18";
