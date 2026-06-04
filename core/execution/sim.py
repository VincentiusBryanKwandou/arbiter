"""Broker simulasi (dipakai backtest & paper trading).

Mengisi order arbitrage terhadap harga yang tersedia, TANPA order nyata.
Asumsi (didokumentasikan, konservatif):
  * Fill di harga leg (best ask) hingga size tersedia (executable_sets).
  * filled_sets = leg tertipis (arb hanya terkunci kalau SEMUA leg terisi).
  * Biaya tx dikenakan per leg.
  * Profit arbitrage terkunci: filled_sets * (1 - cost_per_set) - biaya.

CATATAN JUJUR: model ini mengabaikan leg-risk (satu leg terisi, lain tidak),
slippage multi-level, dan kompetisi. Itu di-flag untuk Fase 5/6.
"""

from __future__ import annotations

from core.edge.arbitrage import ArbOpportunity
from core.execution.base import ArbResult, Broker, Fill, orders_from_opportunity


class SimulatedBroker(Broker):
    def __init__(self, starting_cash: float):
        self.cash = starting_cash
        self.realized_pnl = 0.0
        self.trades: list[ArbResult] = []

    def place_arb(
        self, opp: ArbOpportunity, market_id: str, sets: float, cost_per_tx: float = 0.0
    ) -> ArbResult:
        orders = orders_from_opportunity(opp, sets)
        fills: list[Fill] = []
        filled_each = []
        for order, leg in zip(orders, opp.legs, strict=True):
            fill_size = min(order.size, leg.max_size)  # dibatasi likuiditas leg
            fills.append(Fill(token_id=order.token_id, price=order.price, size=fill_size))
            filled_each.append(fill_size)

        filled_sets = min(filled_each) if filled_each else 0.0
        fully = abs(filled_sets - sets) < 1e-9 and sets > 0
        tx_cost = cost_per_tx * len(orders)
        locked = filled_sets * (1.0 - opp.cost_per_set) - tx_cost

        # Akuntansi kas: keluar modal beli, masuk $1/set saat resolve (disederhanakan: realize).
        self.cash += locked
        self.realized_pnl += locked

        res = ArbResult(
            market_id=market_id,
            fills=fills,
            requested_sets=sets,
            filled_sets=filled_sets,
            cost=tx_cost,
            locked_profit=locked,
            fully_filled=fully,
            note="" if fully else "partial fill (leg-risk diabaikan di sim)",
        )
        self.trades.append(res)
        return res

    def balance(self) -> float:
        return self.cash
