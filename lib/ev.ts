/** Alpha threshold from the original spec: |p_model - p_market| > 0.05 */
export const ALPHA_THRESHOLD = 0.05;

export type EvSide = "yes" | "no";

export type EvResult = {
  side: EvSide;
  p_true_adjusted: number;
  p_market_adjusted: number;
  stake: number;
  net_profit_if_win: number;
  loss_if_lose: number;
  ev: number;
  edge: number;
  alpha_signal: boolean;
  alpha_threshold: number;
};

export type AlphaSignal = "ALPHA_YES" | "ALPHA_NO" | "NONE";

export function classifySignal(edge: number): AlphaSignal {
  if (edge > ALPHA_THRESHOLD) return "ALPHA_YES";
  if (edge < -ALPHA_THRESHOLD) return "ALPHA_NO";
  return "NONE";
}

/**
 * Expected value of a YES position on a binary contract.
 * EV(stake) = p_true * ((1/p_market - 1) * stake) - (1 - p_true) * stake
 */
export function computeEv(input: {
  p_true: number;
  p_market: number;
  stake?: number;
  side?: EvSide;
}): EvResult {
  const stake = input.stake ?? 1;
  const side = input.side ?? "yes";
  const pTrue = side === "yes" ? input.p_true : 1 - input.p_true;
  const pMkt = side === "yes" ? input.p_market : 1 - input.p_market;
  const netProfit = (1 / pMkt - 1) * stake;
  const loss = stake;
  const ev = pTrue * netProfit - (1 - pTrue) * loss;
  const edge = pTrue - pMkt;
  return {
    side,
    p_true_adjusted: Number(pTrue.toFixed(4)),
    p_market_adjusted: Number(pMkt.toFixed(4)),
    stake,
    net_profit_if_win: Number(netProfit.toFixed(4)),
    loss_if_lose: Number(loss.toFixed(4)),
    ev: Number(ev.toFixed(4)),
    edge: Number(edge.toFixed(4)),
    alpha_signal: Math.abs(edge) > ALPHA_THRESHOLD,
    alpha_threshold: ALPHA_THRESHOLD,
  };
}
