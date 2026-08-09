/**
 * kanjiEvaluator.js
 * 漢字書き順・形状判定（相対・形状優先）
 *
 * 1画ごと: 重心(COM)を揃えたうえでの形状距離
 * 2画目以降: 直前画の終点→現在画の始点の相対ベクトル方向
 * TotalCost = shapeDist + dirPenalty×DIR_W + relStartPenalty×REL_W  < THRESHOLD で合格
 */
(function (global) {
  "use strict";

  var KJ_ORDER_EVAL_CFG = {
    SAMPLE_POINTS: 32,
    DIR_PENALTY_WEIGHT: 10.0,
    REL_START_PENALTY_WEIGHT: 10.0,
    SCORE_THRESHOLD: 35.0,
    REF_CANVAS_SIZE: 300.0,
    REL_ANGLE_TOLERANCE_DEG: 45.0
  };

  function kjOrderResamplePoints(points, targetCount) {
    if (!points || !points.length) return Array(targetCount).fill({ x: 0, y: 0 });
    if (points.length < 2) return Array(targetCount).fill({ x: points[0].x, y: points[0].y });
    var totalLen = 0;
    for (var i = 0; i < points.length - 1; i++) {
      totalLen += Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
    }
    if (totalLen <= 0) return Array(targetCount).fill({ x: points[0].x, y: points[0].y });
    var interval = totalLen / (targetCount - 1);
    var result = [{ x: points[0].x, y: points[0].y }];
    var distAcc = 0;
    for (var j = 0; j < points.length - 1; j++) {
      var p1 = points[j];
      var p2 = points[j + 1];
      var segmentLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      if (segmentLen === 0) continue;
      while (distAcc + segmentLen >= interval && result.length < targetCount) {
        var t = (interval - distAcc) / segmentLen;
        var newPt = { x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) };
        result.push(newPt);
        segmentLen -= interval - distAcc;
        p1 = newPt;
        distAcc = 0;
      }
      distAcc += segmentLen;
    }
    while (result.length < targetCount) {
      result.push({ x: points[points.length - 1].x, y: points[points.length - 1].y });
    }
    return result.slice(0, targetCount);
  }

  function kjOrderScalePoints(points, canvasSize) {
    var adj = canvasSize > 0 ? KJ_ORDER_EVAL_CFG.REF_CANVAS_SIZE / canvasSize : 1;
    return points.map(function (p) {
      return { x: p.x * adj, y: p.y * adj };
    });
  }

  function kjOrderCenterOfMass(points) {
    if (!points || !points.length) return { x: 0, y: 0 };
    var sx = 0;
    var sy = 0;
    for (var i = 0; i < points.length; i++) {
      sx += points[i].x;
      sy += points[i].y;
    }
    return { x: sx / points.length, y: sy / points.length };
  }

  function kjOrderToComRelative(points, com) {
    return points.map(function (p) {
      return { x: p.x - com.x, y: p.y - com.y };
    });
  }

  function kjOrderMeanPointDistance(a, b) {
    var sum = 0;
    for (var i = 0; i < a.length; i++) {
      sum += Math.hypot(a[i].x - b[i].x, a[i].y - b[i].y);
    }
    return sum / Math.max(1, a.length);
  }

  /** 2ベクトルの方向ペナルティ (1 - cosθ)。0=同方向, 2=逆方向 */
  function kjOrderVectorDirectionPenalty(v1, v2) {
    var uMag = Math.hypot(v1.x, v1.y);
    var rMag = Math.hypot(v2.x, v2.y);
    if (uMag < 1e-6 || rMag < 1e-6) return 0;
    var cos = Math.max(-1, Math.min(1, (v1.x * v2.x + v1.y * v2.y) / (uMag * rMag)));
    return 1.0 - cos;
  }

  function kjOrderAngleDegFromPenalty(penalty) {
    var cos = Math.max(-1, Math.min(1, 1.0 - penalty));
    return (Math.acos(cos) * 180) / Math.PI;
  }

  function kjOrderDirectionPenalty(userPts, refPts) {
    var n = userPts.length;
    var uVec = { x: userPts[n - 1].x - userPts[0].x, y: userPts[n - 1].y - userPts[0].y };
    var rVec = { x: refPts[n - 1].x - refPts[0].x, y: refPts[n - 1].y - refPts[0].y };
    return kjOrderVectorDirectionPenalty(uVec, rVec);
  }

  /** 直前画終点→現在画始点の相対ベクトル方向ペナルティ（2画目以降） */
  function kjOrderRelativeStartPenalty(prevUserEnd, userStart, prevRefEnd, refStart) {
    var uVec = { x: userStart.x - prevUserEnd.x, y: userStart.y - prevUserEnd.y };
    var rVec = { x: refStart.x - prevRefEnd.x, y: refStart.y - prevRefEnd.y };
    return kjOrderVectorDirectionPenalty(uVec, rVec);
  }

  function kjOrderPenaltyWithinTolerance(penalty) {
    var tolCos = Math.cos((KJ_ORDER_EVAL_CFG.REL_ANGLE_TOLERANCE_DEG * Math.PI) / 180);
    return penalty <= 1.0 - tolCos + 1e-9;
  }

  /**
   * 1画分の合否判定（純関数）
   * @param {object} [opts] strokeIndex, prevUserPoints, prevRefPoints
   */
  function kjOrderEvaluateStrokePair(rawUserPoints, refPoints, canvasSize, opts) {
    opts = opts || {};
    var strokeIndex = opts.strokeIndex || 0;
    var cfg = KJ_ORDER_EVAL_CFG;

    var u = kjOrderScalePoints(kjOrderResamplePoints(rawUserPoints, cfg.SAMPLE_POINTS), canvasSize);
    var r = kjOrderScalePoints(kjOrderResamplePoints(refPoints, cfg.SAMPLE_POINTS), canvasSize);

    var uCom = kjOrderCenterOfMass(u);
    var rCom = kjOrderCenterOfMass(r);
    var shapeDist = kjOrderMeanPointDistance(kjOrderToComRelative(u, uCom), kjOrderToComRelative(r, rCom));

    var dirPenalty = kjOrderDirectionPenalty(u, r);
    var relStartPenalty = 0;
    var relStartSkipped = strokeIndex <= 0;
    if (!relStartSkipped && opts.prevUserPoints && opts.prevRefPoints) {
      var prevU = kjOrderScalePoints(
        kjOrderResamplePoints(opts.prevUserPoints, cfg.SAMPLE_POINTS),
        canvasSize
      );
      var prevR = kjOrderScalePoints(
        kjOrderResamplePoints(opts.prevRefPoints, cfg.SAMPLE_POINTS),
        canvasSize
      );
      relStartPenalty = kjOrderRelativeStartPenalty(
        prevU[prevU.length - 1],
        u[0],
        prevR[prevR.length - 1],
        r[0]
      );
    }

    var totalScore =
      shapeDist + dirPenalty * cfg.DIR_PENALTY_WEIGHT + relStartPenalty * cfg.REL_START_PENALTY_WEIGHT;

    var dirAngleDeg = kjOrderAngleDegFromPenalty(dirPenalty);
    var relStartAngleDeg = relStartSkipped ? 0 : kjOrderAngleDegFromPenalty(relStartPenalty);

    return {
      pass: totalScore < cfg.SCORE_THRESHOLD,
      totalScore: Number(totalScore.toFixed(1)),
      shapeDist: Number(shapeDist.toFixed(1)),
      dirPenalty: Number(dirPenalty.toFixed(2)),
      relStartPenalty: Number(relStartPenalty.toFixed(2)),
      strokeIndex: strokeIndex,
      details: {
        shapeOk: shapeDist < cfg.SCORE_THRESHOLD * 0.55,
        directionOk: kjOrderPenaltyWithinTolerance(dirPenalty),
        relStartOk: relStartSkipped || kjOrderPenaltyWithinTolerance(relStartPenalty),
        relStartSkipped: relStartSkipped,
        dirAngleDeg: Number(dirAngleDeg.toFixed(1)),
        relStartAngleDeg: Number(relStartAngleDeg.toFixed(1)),
        userCom: { x: Number(uCom.x.toFixed(1)), y: Number(uCom.y.toFixed(1)) },
        refCom: { x: Number(rCom.x.toFixed(1)), y: Number(rCom.y.toFixed(1)) },
        failReason:
          totalScore < cfg.SCORE_THRESHOLD
            ? ""
            : shapeDist >= dirPenalty * cfg.DIR_PENALTY_WEIGHT &&
                shapeDist >= relStartPenalty * cfg.REL_START_PENALTY_WEIGHT
              ? "shape"
              : !kjOrderPenaltyWithinTolerance(dirPenalty)
                ? "direction"
                : !relStartSkipped && !kjOrderPenaltyWithinTolerance(relStartPenalty)
                  ? "relStart"
                  : "shape"
      }
    };
  }

  /** 全画を i 画目どうしで照合（純関数） */
  function kjOrderEvaluateStrokes(userStrokesPts, refStrokesPts, canvasSize) {
    var n = Math.min(userStrokesPts.length, refStrokesPts.length);
    var results = [];
    var firstWrong = 0;
    for (var i = 0; i < n; i++) {
      var ev = kjOrderEvaluateStrokePair(userStrokesPts[i], refStrokesPts[i], canvasSize, {
        strokeIndex: i,
        prevUserPoints: i > 0 ? userStrokesPts[i - 1] : null,
        prevRefPoints: i > 0 ? refStrokesPts[i - 1] : null
      });
      results.push(ev);
      if (!ev.pass && !firstWrong) firstWrong = i + 1;
    }
    if (!firstWrong && userStrokesPts.length !== refStrokesPts.length) firstWrong = n + 1;
    return { orderOk: firstWrong === 0, firstWrongStroke: firstWrong, results: results };
  }

  global.KJ_ORDER_EVAL_CFG = KJ_ORDER_EVAL_CFG;
  global.kjOrderResamplePoints = kjOrderResamplePoints;
  global.kjOrderEvaluateStrokePair = kjOrderEvaluateStrokePair;
  global.kjOrderEvaluateStrokes = kjOrderEvaluateStrokes;
})(typeof window !== "undefined" ? window : this);
