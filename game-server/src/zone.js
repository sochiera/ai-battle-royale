'use strict';

function zoneAt(elapsed, zoneCfg, base) {
  const { shrinkStart, shrinkEnd } = zoneCfg;
  let r;
  if (elapsed <= shrinkStart) r = base.startR;
  else if (elapsed >= shrinkEnd) r = base.endR;
  else r = base.startR + (base.endR - base.startR) * ((elapsed - shrinkStart) / (shrinkEnd - shrinkStart));
  return { x: base.cx, y: base.cy, r };
}

module.exports = { zoneAt };
