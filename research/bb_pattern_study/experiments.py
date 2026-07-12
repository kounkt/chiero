"""ボリンジャーバンド×レジーム分類×パターン探索 構想の事前検証シミュレーション.

実験1: 多重検定の罠
  エッジがゼロであることを構築上保証した幾何ランダムウォーク100銘柄に対して
  「銘柄×曜日×ルール」を総当たり探索し、イン・サンプルで最良に見えるパターンが
  アウト・オブ・サンプルでどうなるかを見る。

実験2: レジーム依存性と検出ラグ
  上昇/下落レジームが持続性を持って切り替わる過程で BB(20,2) 下限タッチ買いを検証。
  (a) 無条件 (b) 200日SMAフィルタ (c) 真のレジームを知るチート の3条件を比較し、
  「レジームを事後にしか観測できないコスト」を定量化する。

実行: python3 experiments.py  (numpy/pandas のみ依存。乱数シード固定で再現可能)
"""

import numpy as np
import pandas as pd

rng = np.random.default_rng(20260712)

# ---------------------------------------------------------------- 実験1

N_STOCKS = 100
N_DAYS = 2520  # 約10年
IS_END = 1260  # 前半5年をイン・サンプルに


def make_random_walks():
    """ドリフト0・エッジ0を保証したリターン行列 (days x stocks)。"""
    vol = rng.uniform(0.01, 0.03, N_STOCKS)  # 銘柄ごとに日次ボラだけ変える
    return rng.standard_normal((N_DAYS, N_STOCKS)) * vol


def bollinger_signals(prices, window=20, k=2.0):
    ma = prices.rolling(window).mean()
    sd = prices.rolling(window).std()
    lower = ma - k * sd
    upper = ma + k * sd
    return prices <= lower, prices >= upper


def pattern_returns(rets, prices, stock, rule, weekday):
    """指定パターンの「シグナル翌日リターン」系列を返す."""
    p = prices[stock]
    r = rets[stock]
    touch_low, touch_up = bollinger_signals(p)
    if rule == "bb_low_buy":
        sig = touch_low
    elif rule == "bb_up_sell":  # 上限タッチで売り(ショート)
        sig = touch_up
        r = -r
    elif rule == "streak3_buy":  # 3日続落で買い
        sig = (r.shift(0) < 0) & (r.shift(1) < 0) & (r.shift(2) < 0)
    else:  # streak3_sell: 3日続伸で売り
        sig = (r.shift(0) > 0) & (r.shift(1) > 0) & (r.shift(2) > 0)
        r = -r
    if weekday is not None:
        sig = sig & (pd.Series(np.arange(len(p)) % 5, index=p.index) == weekday)
    return r.shift(-1)[sig].dropna()  # シグナル当日の翌日リターン


def experiment1():
    raw = make_random_walks()
    rets = pd.DataFrame(raw)
    prices = 100 * np.exp(rets.cumsum())

    is_rets, oos_rets = rets.iloc[:IS_END], rets.iloc[IS_END:]
    is_prices, oos_prices = prices.iloc[:IS_END], prices.iloc[IS_END:]

    rules = ["bb_low_buy", "bb_up_sell", "streak3_buy", "streak3_sell"]
    weekdays = [None, 0, 1, 2, 3, 4]

    rows = []
    for s in range(N_STOCKS):
        for rule in rules:
            for wd in weekdays:
                tr = pattern_returns(is_rets, is_prices, s, rule, wd)
                if len(tr) < 20:
                    continue
                t = tr.mean() / (tr.std(ddof=1) / np.sqrt(len(tr)))
                rows.append((s, rule, wd, len(tr), tr.mean(), t))
    df = pd.DataFrame(rows, columns=["stock", "rule", "weekday", "n", "mean", "t"])

    n_tested = len(df)
    n_sig = (df["t"].abs() > 1.96).sum()
    top = df.nlargest(20, "t")

    oos_results = []
    for _, row in top.iterrows():
        tr = pattern_returns(oos_rets, oos_prices, int(row["stock"]), row["rule"],
                             None if pd.isna(row["weekday"]) else int(row["weekday"]))
        oos_t = (tr.mean() / (tr.std(ddof=1) / np.sqrt(len(tr)))) if len(tr) >= 10 else np.nan
        oos_results.append((row["t"], row["mean"] * 100, oos_t,
                            (tr.mean() * 100) if len(tr) else np.nan))
    oos_df = pd.DataFrame(oos_results, columns=["IS_t", "IS_mean%", "OOS_t", "OOS_mean%"])

    print("=" * 70)
    print("実験1: エッジゼロのランダムウォークに対するパターン総当たり探索")
    print(f"  探索パターン数           : {n_tested}")
    print(f"  |t|>1.96 (見かけ上有意)  : {n_sig} 件 ({n_sig/n_tested:.1%})")
    print(f"  イン・サンプル最大 t 値  : {df['t'].max():.2f}")
    print()
    print("  イン・サンプル上位20パターンのアウト・オブ・サンプル成績:")
    print(oos_df.round(3).to_string(index=False))
    print(f"\n  上位20の平均: IS平均リターン {oos_df['IS_mean%'].mean():+.3f}%/日"
          f" → OOS {oos_df['OOS_mean%'].mean():+.3f}%/日")
    print(f"  上位20のうちOOSでもt>1.96を維持: {(oos_df['OOS_t'] > 1.96).sum()} 件")
    return df


# ---------------------------------------------------------------- 実験2

def experiment2(n_paths=60):
    """複数パスで集計し、1本のパス固有のノイズを潰す."""
    n_days = 2520  # 10年 x n_paths
    p_stay_up, p_stay_dn = 0.99, 0.9833  # 平均持続 上昇~100日 / 下落~60日
    names = ["無条件でBB下限買い", "200日SMA上のみ(実運用可能フィルタ)",
             "SMA200が上昇中のみ(実運用可能)", "タッチ後の反発確認で入る(実運用可能)",
             "真の上昇レジームのみ(事後チート)", "真の下落レジームのみ(参考)"]
    pooled = {k: [] for k in names}
    up_ratio = []

    for _ in range(n_paths):
        state = np.zeros(n_days, dtype=int)  # 0=up, 1=down
        u = rng.random(n_days)
        for tt in range(1, n_days):
            if state[tt - 1] == 0:
                state[tt] = 0 if u[tt] < p_stay_up else 1
            else:
                state[tt] = 1 if u[tt] < p_stay_dn else 0
        drift = np.where(state == 0, 0.0008, -0.0010)  # +0.08%/日, -0.10%/日
        rets = pd.Series(drift + rng.standard_normal(n_days) * 0.015)
        prices = 100 * np.exp(rets.cumsum())

        touch_low, _ = bollinger_signals(prices)
        sma200 = prices.rolling(200).mean()
        fwd5 = prices.shift(-5) / prices - 1  # 5日後リターンで評価
        up_ratio.append((state == 0).mean())

        conds = {
            names[0]: touch_low,
            names[1]: touch_low & (prices > sma200),
            names[2]: touch_low & (sma200 > sma200.shift(20)),
            # 直近5日以内にBB下限タッチがあり、当日が陽線 → 翌日から5日保有
            names[3]: touch_low.rolling(5).max().astype(bool) & (rets > 0),
            names[4]: touch_low & pd.Series(state == 0),
            names[5]: touch_low & pd.Series(state == 1),
        }
        for k, cond in conds.items():
            pooled[k].append(fwd5[cond].dropna())

    print("\n" + "=" * 70)
    print(f"実験2: レジームスイッチング相場での BB(20,2) 下限タッチ買い "
          f"(5日保有, {n_paths}パス x 10年)")
    print(f"  上昇レジーム比率: {np.mean(up_ratio):.1%}")
    print(f"  {'条件':<34}{'回数':>8}{'平均5日リターン':>14}{'勝率':>8}")
    for k in names:
        r = pd.concat(pooled[k])
        print(f"  {k:<34}{len(r):>8}{r.mean()*100:>+12.2f}%{(r > 0).mean():>8.1%}")


if __name__ == "__main__":
    experiment1()
    experiment2()
